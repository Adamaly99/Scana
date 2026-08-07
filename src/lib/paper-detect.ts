// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CvNamespace = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JScanifyInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CvMat = any;

interface Point {
  x: number;
  y: number;
}

interface Corners {
  topLeftCorner: Point;
  topRightCorner: Point;
  bottomLeftCorner: Point;
  bottomRightCorner: Point;
}

/**
 * Cherche un contour de document valide dans une image cv.Mat déjà chargée :
 * - Rejette les contours trop petits (bruit, reflets, texture de fond)
 * - Rejette les contours qui ne sont pas approximativement un quadrilatère
 *
 * jscanify ne fait ni l'un ni l'autre en interne — sa fonction findPaperContour()
 * prend juste "le plus grand contour trouvé", sans jamais vérifier sa forme. C'est
 * la cause commune de deux bugs : les triangles/carrés aléatoires en détection live,
 * ET les scans déformés à la capture (un mauvais contour donne un mauvais warp).
 *
 * Nettoie tous les cv.Mat intermédiaires (jscanify ne le fait pas, fuite mémoire).
 */
function findValidCorners(
  scanner: JScanifyInstance,
  cv: CvNamespace,
  img: CvMat,
  minAreaRatio: number
): Corners | null {
  const contour = scanner.findPaperContour(img);
  if (!contour) return null;

  const frameArea = img.cols * img.rows;
  const contourArea = cv.contourArea(contour);

  if (contourArea < frameArea * minAreaRatio) {
    contour.delete();
    return null;
  }

  const peri = cv.arcLength(contour, true);
  const approx = new cv.Mat();
  cv.approxPolyDP(contour, approx, 0.02 * peri, true);
  const vertexCount = approx.rows as number;
  approx.delete();

  // Un vrai document donne un contour à 4 coins (on tolère 4-6 pour l'imprécision de détection)
  if (vertexCount < 4 || vertexCount > 6) {
    contour.delete();
    return null;
  }

  const corners = scanner.getCornerPoints(contour) as Partial<Corners>;
  contour.delete();

  const { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner } = corners;
  if (!topLeftCorner || !topRightCorner || !bottomLeftCorner || !bottomRightCorner) {
    return null;
  }

  return { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner };
}

export interface HighlightOptions {
  color: string;
  thickness: number;
  /** Fraction minimale de l'aire totale de l'image que doit occuper le contour */
  minAreaRatio?: number;
}

/**
 * Version durcie de jscanify.highlightPaper() pour l'aperçu en direct.
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

  const corners = findValidCorners(scanner, cv, img, options.minAreaRatio ?? 0.15);
  img.delete();

  if (!corners) return false;

  const ctx = destCanvas.getContext("2d");
  if (!ctx) return false;

  const { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner } = corners;
  ctx.strokeStyle = options.color;
  ctx.lineWidth = options.thickness;
  ctx.beginPath();
  ctx.moveTo(topLeftCorner.x, topLeftCorner.y);
  ctx.lineTo(topRightCorner.x, topRightCorner.y);
  ctx.lineTo(bottomRightCorner.x, bottomRightCorner.y);
  ctx.lineTo(bottomLeftCorner.x, bottomLeftCorner.y);
  ctx.closePath();
  ctx.stroke();
  return true;
}

export interface ExtractOptions {
  /** Fraction minimale de l'aire totale de l'image que doit occuper le contour */
  minAreaRatio?: number;
}

/**
 * Version durcie de jscanify.extractPaper() — LA CORRECTION CRITIQUE.
 *
 * L'originale utilise findPaperContour() sans aucune validation de forme : si le
 * contour le plus grand trouvé n'est pas vraiment le document (reflet, ombre, bord
 * de table...), elle déforme quand même toute l'image selon ces mauvais points —
 * résultat : un scan illisible en perspective cassée au lieu d'un vrai rectangle plat.
 *
 * Ici, on ne tente le redressement de perspective QUE si le contour détecté est
 * suffisamment grand ET approximativement un quadrilatère. Sinon, on retourne null
 * (même comportement que "aucun document détecté") plutôt que de produire un scan
 * inutilisable.
 */
export function extractPaperStable(
  scanner: JScanifyInstance,
  sourceCanvas: HTMLCanvasElement,
  resultWidth: number,
  resultHeight: number,
  options: ExtractOptions = {}
): HTMLCanvasElement | null {
  const cv = window.cv as unknown as CvNamespace;
  const img = cv.imread(sourceCanvas);

  const corners = findValidCorners(scanner, cv, img, options.minAreaRatio ?? 0.15);
  if (!corners) {
    img.delete();
    return null;
  }

  const { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner } = corners;

  const canvas = document.createElement("canvas");
  const warpedDst = new cv.Mat();
  const dsize = new cv.Size(resultWidth, resultHeight);

  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    topLeftCorner.x,
    topLeftCorner.y,
    topRightCorner.x,
    topRightCorner.y,
    bottomLeftCorner.x,
    bottomLeftCorner.y,
    bottomRightCorner.x,
    bottomRightCorner.y,
  ]);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    resultWidth,
    0,
    0,
    resultHeight,
    resultWidth,
    resultHeight,
  ]);

  const M = cv.getPerspectiveTransform(srcTri, dstTri);
  cv.warpPerspective(
    img,
    warpedDst,
    M,
    dsize,
    cv.INTER_LINEAR,
    cv.BORDER_CONSTANT,
    new cv.Scalar()
  );

  cv.imshow(canvas, warpedDst);

  srcTri.delete();
  dstTri.delete();
  M.delete();
  warpedDst.delete();
  img.delete();

  return canvas;
}
