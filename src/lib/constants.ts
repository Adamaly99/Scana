/**
 * Format de sortie du scan : A4 portrait à ~150dpi.
 * Bon compromis lisibilité/OCR futur vs poids du fichier.
 */
export const OUTPUT_WIDTH = 1240;
export const OUTPUT_HEIGHT = 1754;

/** Largeur max du canvas de détection live (perf : on ne fait pas tourner OpenCV en pleine résolution à chaque frame) */
export const PREVIEW_MAX_WIDTH = 640;

/** Intervalle entre deux détections de document sur le flux caméra (ms) */
export const DETECTION_INTERVAL_MS = 250;

export const ACCENT_COLOR = "#2563eb";
