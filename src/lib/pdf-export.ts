import { PDFDocument } from "pdf-lib";
import type { ScannedPage } from "./store";
import { applyFilterToDataUrl } from "./filters";
import { downloadBlob } from "./share";

// A4 en points PDF (1pt = 1/72 pouce). Format standard, cohérent avec la
// résolution de sortie du scan (OUTPUT_WIDTH/OUTPUT_HEIGHT dans constants.ts).
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("dataURL invalide : impossible d'en extraire les données.");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Fusionne toutes les pages (dans l'ordre fourni) en un seul PDF A4.
 * Le filtre de chaque page est appliqué au moment de l'export (jamais stocké
 * à l'avance), donc le PDF reflète toujours le dernier choix de filtre.
 */
export async function buildPdfFromPages(
  pages: ScannedPage[],
  onProgress?: (done: number, total: number) => void
): Promise<Uint8Array> {
  if (pages.length === 0) {
    throw new Error("Aucune page à exporter.");
  }

  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const filteredDataUrl = await applyFilterToDataUrl(page.rawDataUrl, page.filter);
    const imageBytes = dataUrlToUint8Array(filteredDataUrl);
    const jpgImage = await pdfDoc.embedJpg(imageBytes);

    const pdfPage = pdfDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
    pdfPage.drawImage(jpgImage, {
      x: 0,
      y: 0,
      width: A4_WIDTH_PT,
      height: A4_HEIGHT_PT,
    });

    onProgress?.(i + 1, pages.length);
  }

  return pdfDoc.save();
}

/**
 * Convertit un Uint8Array (ex: sortie de pdf-lib) en Blob. Voir le commentaire dans
 * downloadPdfBytes pour le pourquoi du slice + cast ArrayBuffer.
 */
export function uint8ArrayToBlob(bytes: Uint8Array, mimeType: string): Blob {
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  return new Blob([arrayBuffer], { type: mimeType });
}

/** Déclenche le téléchargement du PDF généré. */
export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  downloadBlob(uint8ArrayToBlob(bytes, "application/pdf"), filename);
}

/** Nom de fichier du type scan-2026-08-02-2114.pdf */
export function generatePdfFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `scan-${date}-${time}.pdf`;
}

/** Transforme un nom de document en nom de fichier sûr (minuscules, tirets). */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "document";
    }
