import { create } from "zustand";

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

interface ScanStore {
  pages: ScannedPage[];
  addPage: (page: Omit<ScannedPage, "id" | "createdAt">) => string;
  removePage: (id: string) => void;
  setFilter: (id: string, filter: FilterType) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  clearAll: () => void;
}

function makeId(): string {
  return `pg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useScanStore = create<ScanStore>((set) => ({
  pages: [],

  addPage: (page) => {
    const id = makeId();
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

  clearAll: () => set({ pages: [] }),
}));
