import { createWorker } from "tesseract.js";

/**
 * Extrait le texte d'une image (dataURL). Charge le moteur OCR à la demande
 * (téléchargement la première fois, plus rapide ensuite grâce au cache navigateur).
 * Langues : français + anglais, pour coller à l'audience francophone tout en
 * couvrant les mots anglais courants dans les documents.
 */
export async function runOcr(
  imageDataUrl: string,
  onProgress?: (progress: number, status: string) => void
): Promise<string> {
  const worker = await createWorker(["fra", "eng"], undefined, {
    logger: (m) => onProgress?.(m.progress, m.status),
  });

  try {
    const { data } = await worker.recognize(imageDataUrl);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}
