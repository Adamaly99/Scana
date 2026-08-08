import { createWorker } from "tesseract.js";

/**
 * Nettoie le texte extrait des lignes de bruit pur (soulignés, séparateurs
 * décoratifs mal lus par l'OCR comme "—", "~~", "|", "\"). Volontairement
 * conservateur : ne supprime QUE les lignes sans aucune lettre ni chiffre,
 * pour ne jamais risquer de corrompre du vrai texte (ex: un tiret légitime
 * en début de ligne). Un peu de bruit résiduel vaut mieux que du texte perdu.
 */
function cleanOcrText(raw: string): string {
  return raw
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return true; // garde les sauts de paragraphe
      return /[\p{L}\p{N}]/u.test(trimmed); // garde si au moins une lettre ou un chiffre
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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
    return cleanOcrText(data.text);
  } finally {
    await worker.terminate();
  }
}
