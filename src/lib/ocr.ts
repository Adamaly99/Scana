import {
  createWorker,
  type LoggerMessage,
} from "tesseract.js";

import {
  getOcrConfig,
  type OcrConfig,
} from "./ocr/config";

import { preprocessForOcr } from "./ocr/preprocess";

export interface OcrRunResult {
  text: string;
  confidence: number | null;
}

export interface OcrRunOptions {
  signal?: AbortSignal;
  onProgress?: (
    progress: number,
    status: string
  ) => void;
}

function assertNotAborted(
  signal?: AbortSignal
): void {
  if (signal?.aborted) {
    throw new DOMException(
      "OCR annulé",
      "AbortError"
    );
  }
}

function handleProgress(
  message: LoggerMessage,
  onProgress?: (
    progress: number,
    status: string
  ) => void
): void {
  const progress = Number.isFinite(
    message.progress
  )
    ? Math.max(
        0,
        Math.min(1, message.progress)
      )
    : 0;

  onProgress?.(
    progress,
    message.status ?? ""
  );
}

function cleanOcrText(
  raw: string
): string {
  return raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return true;
      }

      return /[\p{L}\p{N}]/u.test(
        trimmed
      );
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getConfidence(
  confidence: unknown
): number | null {
  if (
    typeof confidence !== "number" ||
    !Number.isFinite(confidence)
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.min(100, confidence)
  );
}

export async function runOcr(
  image: Blob | string,
  options: OcrRunOptions = {},
  config?: OcrConfig
): Promise<OcrRunResult> {
  const {
    signal,
    onProgress,
  } = options;

  assertNotAborted(signal);

  const ocrConfig =
    config ?? getOcrConfig();

  const worker = await createWorker(
    ocrConfig.langs,
    undefined,
    {
      workerPath:
        "/ocr/v7/worker.min.js",

      corePath:
        "/ocr/v7/core",

      langPath:
        "/ocr/v7/lang/",

      cachePath:
        "/ocr/v7/cache",

      cacheMethod: "write",

      workerBlobURL: false,

      gzip: true,

      logger: (message) =>
        handleProgress(
          message,
          onProgress
        ),

      errorHandler: (error) => {
        console.error(
          "Tesseract error:",
          error
        );
      },
    }
  );

  const abortHandler = () => {
    void worker.terminate();
  };

  signal?.addEventListener(
    "abort",
    abortHandler,
    { once: true }
  );

  try {
    assertNotAborted(signal);

    await worker.setParameters({
      tessedit_pageseg_mode:
        ocrConfig.psm,

      ...(ocrConfig.whitelist
        ? {
            tessedit_char_whitelist:
              ocrConfig.whitelist,
          }
        : {}),
    });

    assertNotAborted(signal);

    const preparedImage =
      await preprocessForOcr(image);

    assertNotAborted(signal);

    const result =
      await worker.recognize(
        preparedImage,
        {},
        { text: true }
      );

    assertNotAborted(signal);

    return {
      text: cleanOcrText(
        result.data.text ?? ""
      ),

      confidence: getConfidence(
        result.data.confidence
      ),
    };
  } finally {
    signal?.removeEventListener(
      "abort",
      abortHandler
    );

    await worker.terminate();
  }
}