/**
 * Format de sortie du scan : A4 portrait à ~150dpi.
 * Bon compromis lisibilité/OCR futur vs poids du fichier.
 */
export const OUTPUT_WIDTH = 1240;
export const OUTPUT_HEIGHT = 1754;

/** Largeur max du canvas de détection live (perf : on ne fait pas tourner OpenCV en pleine résolution à chaque frame) */
export const PREVIEW_MAX_WIDTH = 480;

/** Intervalle entre deux détections de document sur le flux caméra (ms) */
export const DETECTION_INTERVAL_MS = 250;

export const ACCENT_COLOR = "#2563eb";

/** Types de format de page supportés pour l'export PDF */
export type PageFormat = "a4" | "letter";

/** Taille de page en points (pdf-lib utilise des points: 1pt = 1/72 in) */
export const PAGE_SIZE_PT: Record<PageFormat, { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 }, // 210mm x 297mm
  letter: { width: 612, height: 792 }, // 8.5in x 11in
};

/** Qualités de ré-encodage JPEG disponibles pour l'export */
export type ScanQuality = "low" | "standard" | "best";

/** Valeurs de qualité JPEG (0-1) correspondant aux labels de qualité */
export const JPEG_QUALITY: Record<ScanQuality, number> = {
  low: 0.6,
  standard: 0.92,
  best: 0.98,
};
