/**
 * Qualité de sortie du scan.
 * "standard" ≈150dpi : rapide, fichiers légers, suffisant pour la plupart des documents.
 * "high" ≈200dpi : plus net (utile pour petits caractères / OCR fin), fichiers plus
 * lourds, capture un peu plus lente sur les appareils bas/moyen de gamme.
 */
export type ScanQuality = "standard" | "high";

export const OUTPUT_DIMENSIONS: Record<ScanQuality, { width: number; height: number }> = {
  standard: { width: 1240, height: 1754 },
  high: { width: 1654, height: 2339 },
};

export const JPEG_QUALITY: Record<ScanQuality, number> = {
  standard: 0.92,
  high: 0.97,
};

/** Format de page pour l'export PDF, en points PDF (1pt = 1/72 pouce). */
export type PageFormat = "a4" | "letter";

export const PAGE_SIZE_PT: Record<PageFormat, { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
};

/** Largeur max du canvas de détection live (perf : on ne fait pas tourner OpenCV en pleine résolution à chaque frame) */
export const PREVIEW_MAX_WIDTH = 480;

/** Intervalle entre deux détections de document sur le flux caméra (ms) */
export const DETECTION_INTERVAL_MS = 250;

/** Durée pendant laquelle le contour doit rester stable avant que le bouton passe au vert (ms) */
export const STABILITY_DURATION_MS = 500;

/** Tolérance de mouvement entre deux détections consécutives, en pixels du canvas d'analyse
 * (PREVIEW_MAX_WIDTH de large) — au-delà, on considère que le contour a "sauté", pas juste tremblé. */
export const STABILITY_TOLERANCE_PX = 14;

export const ACCENT_COLOR = "#2563eb";
