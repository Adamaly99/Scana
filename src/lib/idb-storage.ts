import { get, set, del } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";

/**
 * IndexedDB peut stocker des dataURL volumineuses sans les limites de taille
 * de localStorage (~5-10 Mo). Indispensable pour un scanner : quelques pages
 * A4 en JPEG peuvent facilement dépasser ce que localStorage tolère.
 */
export const idbStorage: StateStorage = {
  getItem: async (name) => {
    const value = await get(name);
    return value ?? null;
  },
  setItem: async (name, value) => {
    await set(name, value);
  },
  removeItem: async (name) => {
    await del(name);
  },
};
