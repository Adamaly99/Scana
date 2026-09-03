export interface OcrConfig {
  langs: string;
  psm: string;
  whitelist?: string;
}

export function getOcrConfig(): OcrConfig {
  return {
    langs: "fra+eng",
    psm: "3",
  };
}
