import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "./idb-storage";
import type { PageFormat, ScanQuality } from "./constants";
import {
  dataUrlToBlob,
  deleteImageBlob,
  deleteImageBlobs,
  getImageBlob,
  saveImageBlob,
} from "./image-store";
import { rotateImageBlob90, type RotateDirection } from "./rotate";

export type FilterType = "color" | "gray" | "bw";

export interface ScannedPage {
  id: string;
  filter: FilterType;
  width: number;
  height: number;
  createdAt: number;
}

/** Un document terminé et sauvegardé dans la bibliothèque (plusieurs pages fusionnées) */
export interface ScanDocument {
  id: string;
  name: string;
  pages: ScannedPage[];
  createdAt: number;
}

interface ScanStore {
  /** Pages du scan en cours, pas encore sauvegardées comme document */
  pages: ScannedPage[];
  /** Documents terminés, sauvegardés dans la bibliothèque */
  documents: ScanDocument[];
  /** true une fois la lecture depuis IndexedDB terminée (évite d'afficher "0 page" par erreur au premier rendu) */
  hasHydrated: boolean;

  /** Réglages de scan — persistés, modifiables depuis l'onglet Outils */
  quality: ScanQuality;
  pageFormat: PageFormat;
  setQuality: (quality: ScanQuality) => void;
  setPageFormat: (format: PageFormat) => void;

  /**
   * Ajoute une page : sauvegarde l'image en binaire (Blob) dans IndexedDB,
   * puis n'ajoute que la métadonnée légère à l'état. Asynchrone car l'écriture
   * du Blob doit être terminée avant que la page existe côté état.
   */
  addPage: (input: {
    dataUrl: string;
    filter: FilterType;
    width: number;
    height: number;
  }) => Promise<string>;
  /** Retire une page du scan en cours et supprime son image binaire associée */
  removePage: (id: string) => Promise<void>;
  setFilter: (id: string, filter: FilterType) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  setPageOrder: (orderedIds: string[]) => void;
  /** Vide le scan en cours et supprime toutes les images binaires associées */
  clearAll: () => Promise<void>;

  /** Sauvegarde le scan en cours comme document nommé, puis vide le scan en cours */
  saveCurrentAsDocument: (name: string) => string;
  /** Supprime un document ET les images binaires de toutes ses pages (pas de fuite de stockage) */
  deleteDocument: (id: string) => Promise<void>;
  renameDocument: (id: string, name: string) => void;
  setDocumentPageFilter: (documentId: string, pageId: string, filter: FilterType) => void;
  /**
   * Pivote une page d'un document déjà sauvegardé de 90°. Réécrit le Blob binaire
   * ET met à jour width/height (ils s'inversent), sinon l'aperçu et le PDF final
   * seraient incohérents avec l'image réellement stockée.
   */
  rotateDocumentPage: (documentId: string, pageId: string, direction: RotateDirection) => Promise<void>;

  setHasHydrated: (value: boolean) => void;

  /** true une fois que l'utilisateur a fermé l'avertissement de perte de données */
  hasSeenDataWarning: boolean;
  setHasSeenDataWarning: () => void;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useScanStore = create<ScanStore>()(
  persist(
    (set, get) => ({
      pages: [],
      documents: [],
      hasHydrated: false,
      quality: "standard",
      pageFormat: "a4",
      hasSeenDataWarning: false,

      setQuality: (quality) => set({ quality }),
      setPageFormat: (pageFormat) => set({ pageFormat }),

      addPage: async (input) => {
        const id = makeId("pg");
        const blob = await dataUrlToBlob(input.dataUrl);
        await saveImageBlob(id, blob);
        set((state) => ({
          pages: [
            ...state.pages,
            {
              id,
              filter: input.filter,
              width: input.width,
              height: input.height,
              createdAt: Date.now(),
            },
          ],
        }));
        return id;
      },

      removePage: async (id) => {
        await deleteImageBlob(id);
        set((state) => ({
          pages: state.pages.filter((p) => p.id !== id),
        }));
      },

      setFilter: (id, filter) =>
        set((state) => ({
          pages: state.pages.map((p) => (p.id === id ? { ...p, filter } : p)),
        })),

      reorderPages: (fromIndex, toIndex) =>
        set((state) => {
          const next = [...state.pages];
          const [moved] = next.splice(fromIndex, 1);
          if (!moved) return state;
          next.splice(toIndex, 0, moved);
          return { pages: next };
        }),

      /** Réordonne à partir d'une liste d'IDs dans le nouvel ordre (utilisé par le drag & drop) */
      setPageOrder: (orderedIds) =>
        set((state) => {
          const byId = new Map(state.pages.map((p) => [p.id, p]));
          const next = orderedIds
            .map((id) => byId.get(id))
            .filter((p): p is ScannedPage => Boolean(p));
          // Sécurité : si un id est introuvable (état incohérent), on ne touche à rien.
          if (next.length !== state.pages.length) return state;
          return { pages: next };
        }),

      clearAll: async () => {
        const { pages } = get();
        await deleteImageBlobs(pages.map((p) => p.id));
        set({ pages: [] });
      },

      saveCurrentAsDocument: (name) => {
        const id = makeId("doc");
        set((state) => ({
          documents: [
            {
              id,
              name: name.trim() || "Document sans titre",
              pages: state.pages,
              createdAt: Date.now(),
            },
            ...state.documents,
          ],
          pages: [],
        }));
        return id;
      },

      deleteDocument: async (id) => {
        const { documents } = get();
        const doc = documents.find((d) => d.id === id);
        if (doc) {
          await deleteImageBlobs(doc.pages.map((p) => p.id));
        }
        set((state) => ({
          documents: state.documents.filter((d) => d.id !== id),
        }));
      },

      renameDocument: (id, name) =>
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === id ? { ...d, name: name.trim() || d.name } : d
          ),
        })),

      setDocumentPageFilter: (documentId, pageId, filter) =>
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id !== documentId
              ? d
              : {
                  ...d,
                  pages: d.pages.map((p) => (p.id === pageId ? { ...p, filter } : p)),
                }
          ),
        })),

      rotateDocumentPage: async (documentId, pageId, direction) => {
        const blob = await getImageBlob(pageId);
        if (!blob) return;
        const { blob: rotatedBlob, width, height } = await rotateImageBlob90(blob, direction);
        await saveImageBlob(pageId, rotatedBlob);
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id !== documentId
              ? d
              : {
                  ...d,
                  pages: d.pages.map((p) => (p.id === pageId ? { ...p, width, height } : p)),
                }
          ),
        }));
      },

      setHasHydrated: (value) => set({ hasHydrated: value }),

      setHasSeenDataWarning: () => set({ hasSeenDataWarning: true }),
    }),
    {
      name: "scana-store",
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        pages: state.pages,
        documents: state.documents,
        quality: state.quality,
        pageFormat: state.pageFormat,
        hasSeenDataWarning: state.hasSeenDataWarning,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
