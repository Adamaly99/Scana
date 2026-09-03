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
} from "./local-db"; // CORRIGÉ : était "./image-store"
import { rotateImageBlob90, type RotateDirection } from "./rotate"; // Fichier créé ci-dessous

// ... (garder le reste du fichier store.ts inchangé)