import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '@/lib/storage';          // ton module de stockage IndexedDB
import { saveImageBlob, deleteImageBlobs } from '@/lib/storage'; // fonctions de gestion des blobs
import { makeId } from '@/lib/utils';
import type { Document, Page, User, Corners } from '@/types';

// Interface unique (suppression de la première déclaration)
interface ScanStore {
  documents: Document[];
  pages: Page[];
  user: User | null;
  syncEnabled: boolean;
  addPage: (imageData: string, corners?: Corners) => Promise<string>;
  removePage: (id: string) => void;
  clearPages: () => void;
  saveCurrentAsDocument: (name: string) => Promise<string>;
  deleteDocument: (id: string) => Promise<void>;
  setUser: (user: User | null) => void;
  setSyncEnabled: (enabled: boolean) => void;
}

// Fonction de migration CORRECTE (ne contient PAS de partialize ni de set)
async function migratePersistedState(persistedState: unknown, version: number) {
  const state = persistedState as Partial<{
    documents: Document[];
    pages: Page[];
    user: User | null;
    syncEnabled: boolean;
  }>;

  if (version === 0) {
    // Migration depuis la version 0 : on initialise les champs manquants
    return {
      documents: state.documents || [],
      pages: state.pages || [],
      user: state.user ?? null,
      syncEnabled: state.syncEnabled ?? false,
    };
  }
  // Pour les versions ultérieures, on retourne l'état tel quel
  return state;
}

export const useScanStore = create<ScanStore>()(
  persist(
    (set, get) => ({
      documents: [],
      pages: [],
      user: null,
      syncEnabled: false,

      addPage: async (imageData: string, corners?: Corners) => {
        try {
          const id = makeId('page');
          // Convertir l'image en blob et le sauvegarder dans IndexedDB
          const blob = await fetch(imageData).then(r => r.blob());
          await saveImageBlob(id, blob);

          set((state) => ({
            pages: [...state.pages, { id, imageData, corners, documentId: null }],
          }));
          return id;
        } catch (error) {
          console.error('Erreur lors de l\'ajout de la page :', error);
          throw error; // on propage l'erreur pour que l'appelant puisse la gérer
        }
      },

      removePage: (id: string) => {
        set((state) => ({
          pages: state.pages.filter((p) => p.id !== id),
        }));
        // Optionnel : supprimer le blob associé (à faire si tu veux libérer l'espace)
        // deleteImageBlobs([id]).catch(console.error);
      },

      clearPages: () => {
        set({ pages: [] });
      },

      saveCurrentAsDocument: async (name: string) => {
        const { pages } = get();
        if (pages.length === 0) throw new Error('Aucune page à sauvegarder');

        // Supprimer les blobs des pages actuelles pour éviter les doublons
        await deleteImageBlobs(pages.map(p => p.id));

        const id = makeId('doc');
        set((state) => ({
          documents: [{ id, name, pages, createdAt: Date.now() }, ...state.documents],
          pages: [],
        }));
        return id;
      },

      deleteDocument: async (id: string) => {
        const { documents } = get();
        const doc = documents.find((d) => d.id === id);
        if (doc) {
          // Supprimer les blobs de toutes les pages du document
          await deleteImageBlobs(doc.pages.map(p => p.id));
          set((state) => ({
            documents: state.documents.filter((d) => d.id !== id),
          }));
        }
      },

      setUser: (user) => set({ user }),
      setSyncEnabled: (enabled) => set({ syncEnabled: enabled }),
    }),
    {
      name: 'scan-storage',
      getStorage: () => storage,
      version: 1,
      migrate: migratePersistedState,
      partialize: (state) => ({
        documents: state.documents,
        pages: state.pages,
        user: state.user,
        syncEnabled: state.syncEnabled,
      }),
    }
  )
);