import {
  PDFDocument,
} from "pdf-lib";

import type {
  ScannedPage,
} from "./store";

import {
  applyFilterToBlob,
} from "./filters";

import {
  getImageBlob,
} from "./image-store";

import {
  downloadBlob,
} from "./share";

import {
  PAGE_SIZE_PT,
  type PageFormat,
} from "./constants";

export interface BuildPdfOptions {
  onProgress?: (
    done: number,
    total: number
  ) => void;

  pageFormat?: PageFormat;

  jpegQuality?: number;
}

function clampQuality(
  quality: number
): number {
  if (!Number.isFinite(quality)) {
    return 0.92;
  }

  return Math.max(
    0.1,
    Math.min(1, quality)
  );
}

export async function buildPdfFromPages(
  pages: ScannedPage[],
  options: BuildPdfOptions = {}
): Promise<Uint8Array> {
  const {
    onProgress,
    pageFormat = "a4",
    jpegQuality = 0.92,
  } = options;

  if (pages.length === 0) {
    throw new Error(
      "Aucune page à exporter."
    );
  }

  const quality =
    clampQuality(jpegQuality);

  let completed = 0;

  const filteredBuffers =
    await Promise.all(
      pages.map(
        async (page, index) => {
          const rawBlob =
            await getImageBlob(
              page.id
            );

          if (!rawBlob) {
            throw new Error(
              `Image manquante pour la page ${
                index + 1
              }.`
            );
          }

          const objectUrl =
            URL.createObjectURL(
              rawBlob
            );

          try {
            const filteredBlob =
              await applyFilterToBlob(
                objectUrl,
                page.filter,
                "jpeg",
                quality
              );

            return await filteredBlob.arrayBuffer();
          } finally {
            URL.revokeObjectURL(
              objectUrl
            );

            completed += 1;

            onProgress?.(
              completed,
              pages.length
            );
          }
        }
      )
    );

  const {
    width: pageWidthPt,
    height: pageHeightPt,
  } = PAGE_SIZE_PT[pageFormat];

  const pdfDoc =
    await PDFDocument.create();

  for (
    let index = 0;
    index < pages.length;
    index += 1
  ) {
    const buffer =
      filteredBuffers[index];

    if (!buffer) {
      throw new Error(
        `Données PDF manquantes pour la page ${
          index + 1
        }.`
      );
    }

    const jpgImage =
      await pdfDoc.embedJpg(
        new Uint8Array(buffer)
      );

    const pdfPage =
      pdfDoc.addPage([
        pageWidthPt,
        pageHeightPt,
      ]);

    const imageRatio =
      jpgImage.width /
      jpgImage.height;

    const pageRatio =
      pageWidthPt /
      pageHeightPt;

    let drawWidth =
      pageWidthPt;

    let drawHeight =
      pageHeightPt;

    if (imageRatio > pageRatio) {
      drawHeight =
        pageWidthPt /
        imageRatio;
    } else {
      drawWidth =
        pageHeightPt *
        imageRatio;
    }

    const x =
      (pageWidthPt -
        drawWidth) /
      2;

    const y =
      (pageHeightPt -
        drawHeight) /
      2;

    pdfPage.drawImage(
      jpgImage,
      {
        x,
        y,
        width: drawWidth,
        height: drawHeight,
      }
    );
  }

  return pdfDoc.save();
}

export function uint8ArrayToBlob(
  bytes: Uint8Array,
  mimeType: string
): Blob {
  const arrayBuffer =
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset +
        bytes.byteLength
    ) as ArrayBuffer;

  return new Blob(
    [arrayBuffer],
    {
      type: mimeType,
    }
  );
}

export function downloadPdfBytes(
  bytes: Uint8Array,
  filename: string
): void {
  downloadBlob(
    uint8ArrayToBlob(
      bytes,
      "application/pdf"
    ),
    filename
  );
}

export function generatePdfFilename(): string {
  const now = new Date();

  const pad = (
    value: number
  ) =>
    String(value).padStart(
      2,
      "0"
    );

  const date =
    `${now.getFullYear()}-${pad(
      now.getMonth() + 1
    )}-${pad(now.getDate())}`;

  const time =
    `${pad(
      now.getHours()
    )}${pad(
      now.getMinutes()
    )}`;

  return `scan-${date}-${time}.pdf`;
}

export function sanitizeFilename(
  name: string
): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      "");

  return (
    cleaned || "document"
  );
}