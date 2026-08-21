import type { StateStorage } from "zustand/middleware";
import {
  deleteEncryptedState,
  getEncryptedState,
  setEncryptedState,
} from "./local-db";

export const idbStorage: StateStorage = {
  getItem: async (name) => {
    if (typeof window === "undefined") return null;
    return getEncryptedState(name);
  },
  setItem: async (name, value) => {
    if (typeof window === "undefined") return;
    await setEncryptedState(name, value);
  },
  removeItem: async (name) => {
    if (typeof window === "undefined") return;
    await deleteEncryptedState(name);
  },
};
