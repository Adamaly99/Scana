// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CvNamespace = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JScanifyInstance = any;

export interface HighlightOptions {
  color: string;
  thickness: number;
  /** Fraction minimale de l'aire totale de l'image que doit occuper le contour (évite de suivre du bruit/reflets) */
  minAreaRatio?: number;
}

/**
 * Version durcie de jscanify.highlightPaper() :
 * - Rejette les contours trop petits (bruit, reflets, texture de fond)
 * - Rejette les contours qui ne sont pas approximativement un quadrilatère
 *   (jscanify prend juste "le plus grand contour trouvé", sans vérifier sa forme —
 *   c'est ce qui cause les petits triangles/carrés qui apparaissent au hasard)
 * - Nettoie explicitement les cv.Mat créés (jscanify ne le fait jamais, fuite mémoire
 *   qui ralentit progressivement la détection en direct)
 *
 * Retourne true si un contour valide (document) a été mis en surbrillance.
 */
export function highlightPaperStable(
  scanner: JScanifyInstance,
  sourceCanvas: HTMLCanvasElement,
  destCanvas: HTMLCanvasElement,
  options: HighlightOptions
): boolean {
  const cv = window.cv as unknown as CvNamespace;
  const img = cv.imread(sourceCanvas);

  destCanvas.width = sourceCanvas.width;
  destCanvas.height = sourceCanvas.height;
  cv.imshow(destCanvas, img);

  let found = false;
  const contour = scanner.findPaperContour(img);

  if (contour) {
    const frameArea = sourceCanvas.width * sourceCanvas.height;
    const contourArea = cv.contourArea(contour);
    const minAreaRatio = options.minAreaRatio ?? 0.15;

    if (contourArea >= frameArea * minAreaRatio) {
      const peri = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * peri, true);
      const vertexCount = approx.rows as number;

      // Un vrai document donne un contour à 4 coins (on tolère 4-6 pour l'imprécision de détection)
      if (vertexCount >= 4 && vertexCount <= 6) {
        const corners = scanner.getCornerPoints(contour);
        const { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner } = corners;

        if (topLeftCorner && topRightCorner && bottomLeftCorner && bottomRightCorner) {
          const ctx = destCanvas.getContext("2d");
          if (ctx) {
            ctx.strokeStyle = options.color;
            ctx.lineWidth = options.thickness;
            ctx.beginPath();
            ctx.moveTo(topLeftCorner.x, topLeftCorner.y);
            ctx.lineTo(topRightCorner.x, topRightCorner.y);
            ctx.lineTo(bottomRightCorner.x, bottomRightCorner.y);
            ctx.lineTo(bottomLeftCorner.x, bottomLeftCorner.y);
            ctx.closePath();
            ctx.stroke();
            found = true;
          }
        }
      }
      approx.delete();
    }
    // jscanify ne nettoie jamais ce contour lui-même (fuite mémoire à chaque appel) — on le fait ici.
    contour.delete();
  }

  img.delete();
  return found;
}
