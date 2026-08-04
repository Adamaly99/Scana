import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "./idb-storage";

export type FilterType = "color" | "gray" | "bw";

export interface ScannedPage {
  id: string;
  /** Image source de la découpe (avant filtre), format dataURL */
  rawDataUrl: string;
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

  addPage: (page: Omit<ScannedPage, "id" | "createdAt">) => string;
  removePage: (id: string) => void;
  setFilter: (id: string, filter: FilterType) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  setPageOrder: (orderedIds: string[]) => void;
  clearAll: () => void;

  /** Sauvegarde le scan en cours comme document nommé, puis vide le scan en cours */
  saveCurrentAsDocument: (name: string) => string;
  deleteDocument: (id: string) => void;
  renameDocument: (id: string, name: string) => void;

  setHasHydrated: (value: boolean) => void;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useScanStore = create<ScanStore>()(
  persist(
    (set) => ({
      pages: [],
      documents: [],
      hasHydrated: false,

      addPage: (page) => {
        const id = makeId("pg");
        set((state) => ({
          pages: [...state.pages, { ...page, id, createdAt: Date.now() }],
        }));
        return id;
      },

      removePage: (id) =>
        set((state) => ({
          pages: state.pages.filter((p) => p.id !== id),
        })),

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

      clearAll: () => set({ pages: [] }),

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

      deleteDocument: (id) =>
        set((state) => ({
          documents: state.documents.filter((d) => d.id !== id),
        })),

      renameDocument: (id, name) =>
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === id ? { ...d, name: name.trim() || d.name } : d
          ),
        })),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "scana-store",
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ pages: state.pages, documents: state.documents }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
