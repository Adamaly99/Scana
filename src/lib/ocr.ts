import { createWorker, type LoggerMessage } from "tesseract.js";

export interface OcrRunResult {
  text: string;
  confidence: number | null;
}

export interface OcrRunOptions {
  signal?: AbortSignal;
  onProgress?: (progress: number, status: string) => void;
}

function cleanOcrText(raw: string): string {
  return raw
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return true;
      return /[\p{L}\p{N}]/u.test(trimmed);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("OCR annulé", "AbortError");
}

function handleProgress(
  message: LoggerMessage,
  onProgress?: (progress: number, status: string) => void,
): void {
  onProgress?.(Math.max(0, Math.min(1, message.progress || 0)), message.status);
}

async function prepareOcrImage(image: Blob | string): Promise<Blob> {
  const source = image instanceof Blob
    ? image
    : await fetch(image).then((response) => {
        if (!response.ok) throw new Error("L’image locale n’est pas accessible.");
        return response.blob();
      });

  if (typeof createImageBitmap === "undefined" || typeof document === "undefined") {
    return source;
  }

  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Le navigateur ne peut pas préparer l’image pour l’OCR.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Impossible de préparer l’image pour l’OCR."))),
        "image/jpeg",
        0.96,
      );
    });
  } finally {
    bitmap.close();
  }
}

/**
 * OCR local français + anglais.
 * Les URLs sont servies par Scana depuis /public/ocr et préparées au build ;
 * le contenu de l’image n’est jamais envoyé à une API distante.
 */
export async function runOcr(
  image: Blob | string,
  options: OcrRunOptions = {},
): Promise<OcrRunResult> {
  const { signal, onProgress } = options;
  assertNotAborted(signal);

  const worker = await createWorker(["fra", "eng"], undefined, {
    workerPath: "/ocr/v7/worker.min.js",
    corePath: "/ocr/v7/core",
    langPath: "/ocr/v7/lang/",
    cachePath: "/ocr/v7/cache",
    cacheMethod: "write",
    workerBlobURL: false,
    gzip: true,
    logger: (message) => handleProgress(message, onProgress),
  });

  const abort = () => {
    void worker.terminate();
  };
  signal?.addEventListener("abort", abort, { once: true });

  try {
    assertNotAborted(signal);
    const preparedImage = await prepareOcrImage(image);
    const { data } = await worker.recognize(preparedImage, {}, { text: true });
    assertNotAborted(signal);
    return {
      text: cleanOcrText(data.text),
      confidence: Number.isFinite(data.confidence) ? data.confidence : null,
    };
  } finally {
    signal?.removeEventListener("abort", abort);
    await worker.terminate();
  }
}
