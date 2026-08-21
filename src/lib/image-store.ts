import {
  deleteImageBlob as deleteEncryptedImage,
  deleteImageBlobs as deleteEncryptedImages,
  getImageBlob as getEncryptedImage,
  saveImageBlob as saveEncryptedImage,
} from "./local-db";

export async function saveImageBlob(pageId: string, blob: Blob): Promise<void> {
  await saveEncryptedImage(pageId, blob);
}

export async function getImageBlob(pageId: string): Promise<Blob | undefined> {
  return getEncryptedImage(pageId);
}

export async function deleteImageBlob(pageId: string): Promise<void> {
  await deleteEncryptedImage(pageId);
}

export async function deleteImageBlobs(pageIds: string[]): Promise<void> {
  await deleteEncryptedImages(pageIds);
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("Impossible de convertir l’image capturée.");
  return response.blob();
}
