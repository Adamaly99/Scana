import { PDFDocument } from "pdf-lib";
import type { ScannedPage } from "./store";
import { applyFilterToBlob } from "./filters";
import { getImageBlob } from "./image-store";
import { downloadBlob } from "./share";
import { PAGE_SIZE_PT, type PageFormat } from "./constants";

export interface BuildPdfOptions {
  onProgress?: (done: number, total: number) => void;
  /** Format de page du PDF final. Par défaut A4. */
  pageFormat?: PageFormat;
  /** Qualité JPEG de ré-encodage de chaque page (0-1). Par défaut 0.92. */
  jpegQuality?: number;
}

/**
 * Fusionne toutes les pages (dans l'ordre fourni) en un seul PDF.
 * Le filtre de chaque page est appliqué au moment de l'export (jamais stocké
 * à l'avance), donc le PDF reflète toujours le dernier choix de filtre.
 *
 * Le filtrage de TOUTES les pages est lancé en parallèle (réparti sur le pool de
 * Workers) — c'est la partie lente. L'assemblage du PDF, lui, reste séquentiel
 * (rapide, et préserve l'ordre des pages) une fois tous les filtrages terminés.
 */
export async function buildPdfFromPages(
  pages: ScannedPage[],
  options: BuildPdfOptions = {}
): Promise<Uint8Array> {
  const { onProgress, pageFormat = "a4", jpegQuality = 0.92 } = options;

  if (pages.length === 0) {
    throw new Error("Aucune page à exporter.");
  }

  let completed = 0;

  const filteredBuffers = await Promise.all(
    pages.map(async (page, i) => {
      const rawBlob = await getImageBlob(page.id);
      if (!rawBlob) {
        throw new Error(`Image manquante pour la page ${i + 1}.`);
      }
      const rawObjectUrl = URL.createObjectURL(rawBlob);
      try {
        const filteredBlob = await applyFilterToBlob(rawObjectUrl, page.filter, "jpeg", jpegQuality);
        return await filteredBlob.arrayBuffer();
      } finally {
        URL.revokeObjectURL(rawObjectUrl);
        completed++;
        onProgress?.(completed, pages.length);
      }
    })
  );

  const { width: pageWidthPt, height: pageHeightPt } = PAGE_SIZE_PT[pageFormat];
  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < pages.length; i++) {
    const jpgImage = await pdfDoc.embedJpg(new Uint8Array(filteredBuffers[i]));
    const pdfPage = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
    pdfPage.drawImage(jpgImage, {
      x: 0,
      y: 0,
      width: pageWidthPt,
      height: pageHeightPt,
    });
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
