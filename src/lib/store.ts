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

export interface ScanDocument {
  id: string;
  name: string;
  pages: ScannedPage[];
  createdAt: number;
}

interface ScanStore {
  pages: ScannedPage[];
  documents: ScanDocument[];

  hasHydrated: boolean;
  hasSeenDataWarning: boolean;

  quality: ScanQuality;
  pageFormat: PageFormat;

  setQuality: (quality: ScanQuality) => void;
  setPageFormat: (format: PageFormat) => void;

  setHasSeenDataWarning: () => void;

  addPage: (input: {
    dataUrl: string;
    filter: FilterType;
    width: number;
    height: number;
  }) => Promise<string>;

  removePage: (id: string) => Promise<void>;

  setFilter: (id: string, filter: FilterType) => void;

  reorderPages: (fromIndex: number, toIndex: number) => void;

  setPageOrder: (orderedIds: string[]) => void;

  clearAll: () => Promise<void>;

  saveCurrentAsDocument: (name: string) => string;

  deleteDocument: (id: string) => Promise<void>;

  renameDocument: (id: string, name: string) => void;

  setDocumentPageFilter: (
    documentId: string,
    pageId: string,
    filter: FilterType
  ) => void;

  rotateDocumentPage: (
    documentId: string,
    pageId: string,
    direction: RotateDirection
  ) => Promise<void>;

  setHasHydrated: (value: boolean) => void;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export const useScanStore = create<ScanStore>()(
  persist(
    (set, get) => ({
      pages: [],
      documents: [],

      hasHydrated: false,
      hasSeenDataWarning: false,

      quality: "standard",
      pageFormat: "a4",

      setQuality: (quality) => {
        set({ quality });
      },

      setPageFormat: (pageFormat) => {
        set({ pageFormat });
      },

      setHasSeenDataWarning: () => {
        set({
          hasSeenDataWarning: true,
        });
      },

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
          pages: state.pages.filter((page) => page.id !== id),
        }));
      },

      setFilter: (id, filter) => {
        set((state) => ({
          pages: state.pages.map((page) =>
            page.id === id
              ? {
                  ...page,
                  filter,
                }
              : page
          ),
        }));
      },

      reorderPages: (fromIndex, toIndex) => {
        set((state) => {
          if (
            fromIndex < 0 ||
            fromIndex >= state.pages.length ||
            toIndex < 0 ||
            toIndex >= state.pages.length
          ) {
            return state;
          }

          const next = [...state.pages];

          const [moved] = next.splice(fromIndex, 1);

          if (!moved) {
            return state;
          }

          next.splice(toIndex, 0, moved);

          return {
            pages: next,
          };
        });
      },

      setPageOrder: (orderedIds) => {
        set((state) => {
          if (orderedIds.length !== state.pages.length) {
            return state;
          }

          const byId = new Map(
            state.pages.map((page) => [page.id, page])
          );

          const next = orderedIds
            .map((id) => byId.get(id))
            .filter(
              (page): page is ScannedPage => Boolean(page)
            );

          if (next.length !== state.pages.length) {
            return state;
          }

          return {
            pages: next,
          };
        });
      },

      clearAll: async () => {
        const { pages } = get();

        if (pages.length > 0) {
          await deleteImageBlobs(
            pages.map((page) => page.id)
          );
        }

        set({
          pages: [],
        });
      },

      /**
       * Les images ne sont PAS supprimées ici.
       *
       * Les pages du scan temporaire deviennent les pages
       * du document sauvegardé.
       *
       * Les blobs correspondants restent dans IndexedDB.
       */
      saveCurrentAsDocument: (name) => {
        const { pages } = get();

        if (pages.length === 0) {
          throw new Error("Aucune page à sauvegarder.");
        }

        const id = makeId("doc");

        const document: ScanDocument = {
          id,
          name: name.trim() || "Document sans titre",
          pages: [...pages],
          createdAt: Date.now(),
        };

        set((state) => ({
          documents: [document, ...state.documents],
          pages: [],
        }));

        return id;
      },

      deleteDocument: async (id) => {
        const { documents } = get();

        const document = documents.find(
          (item) => item.id === id
        );

        if (document) {
          await deleteImageBlobs(
            document.pages.map((page) => page.id)
          );
        }

        set((state) => ({
          documents: state.documents.filter(
            (item) => item.id !== id
          ),
        }));
      },

      renameDocument: (id, name) => {
        const cleanedName = name.trim();

        set((state) => ({
          documents: state.documents.map((document) =>
            document.id === id
              ? {
                  ...document,
                  name: cleanedName || document.name,
                }
              : document
          ),
        }));
      },

      setDocumentPageFilter: (
        documentId,
        pageId,
        filter
      ) => {
        set((state) => ({
          documents: state.documents.map((document) => {
            if (document.id !== documentId) {
              return document;
            }

            return {
              ...document,
              pages: document.pages.map((page) =>
                page.id === pageId
                  ? {
                      ...page,
                      filter,
                    }
                  : page
              ),
            };
          }),
        }));
      },

      rotateDocumentPage: async (
        documentId,
        pageId,
        direction
      ) => {
        const { documents } = get();

        const document = documents.find(
          (item) => item.id === documentId
        );

        if (!document) {
          throw new Error("Document introuvable.");
        }

        const page = document.pages.find(
          (item) => item.id === pageId
        );

        if (!page) {
          throw new Error("Page introuvable.");
        }

        const blob = await getImageBlob(page.id);

        if (!blob) {
          throw new Error("Image introuvable.");
        }

        const rotated = await rotateImageBlob90(
          blob,
          direction
        );

        await saveImageBlob(page.id, rotated.blob);

        set((state) => ({
          documents: state.documents.map((item) => {
            if (item.id !== documentId) {
              return item;
            }

            return {
              ...item,
              pages: item.pages.map((currentPage) =>
                currentPage.id === pageId
                  ? {
                      ...currentPage,
                      width: rotated.width,
                      height: rotated.height,
                    }
                  : currentPage
              ),
            };
          }),
        }));
      },

      setHasHydrated: (value) => {
        set({
          hasHydrated: value,
        });
      },
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