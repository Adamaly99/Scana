export type PsmMode = 3 | 4 | 6 | 11 | 12;

export interface OcrConfig {
  langs: string[];
  psm: PsmMode;
  whitelist?: string;
}

export const OCR_PRESETS: Record<string, OcrConfig> = {
  general: { langs: ['fra', 'eng'], psm: 3 },
  invoice: { langs: ['fra', 'eng'], psm: 6 },
  id_card: { langs: ['fra', 'eng'], psm: 4, whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789<<' },
  book: { langs: ['fra', 'eng'], psm: 6 },
  receipt: { langs: ['fra', 'eng'], psm: 4 }
};

export function getOcrConfig(preset: string = 'general', locale: string = 'fr'): OcrConfig {
  const config = OCR_PRESETS[preset] || OCR_PRESETS.general;
  // Override langs based on locale if needed
  return config;
}
