import { get, set, del } from "idb-keyval";

/**
 * Préfixe pour ne jamais entrer en collision avec la clé d'état Zustand
 * ("scana-store") qui vit dans le même object store idb-keyval par défaut.
 */
const KEY_PREFIX = "scana-image:";

/** Sauvegarde l'image d'une page (en binaire, pas en base64) */
export async function saveImageBlob(pageId: string, blob: Blob): Promise<void> {
  await set(KEY_PREFIX + pageId, blob);
}

/** Récupère l'image binaire d'une page. undefined si absente (page supprimée, corruption, etc.) */
export async function getImageBlob(pageId: string): Promise<Blob | undefined> {
  return get(KEY_PREFIX + pageId);
}

/** Supprime l'image binaire d'une page — à appeler à chaque fois qu'une page est retirée définitivement */
export async function deleteImageBlob(pageId: string): Promise<void> {
  await del(KEY_PREFIX + pageId);
}

/** Supprime plusieurs images d'un coup (ex: toutes les pages d'un document supprimé) */
export async function deleteImageBlobs(pageIds: string[]): Promise<void> {
  await Promise.all(pageIds.map((id) => deleteImageBlob(id)));
}

/**
 * Convertit une dataURL (base64) en Blob. Utilisé au moment de la capture,
 * seul endroit où l'app produit encore une dataURL brute (sortie canvas).
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
