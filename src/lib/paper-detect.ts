// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CvNamespace = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JScanifyInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CvMat = any;

export interface Point {
  x: number;
  y: number;
}

export interface Corners {
  topLeftCorner: Point;
  topRightCorner: Point;
  bottomLeftCorner: Point;
  bottomRightCorner: Point;
}

/**
 * Compare deux détections consécutives : true si les 4 coins n'ont pas bougé
 * de plus de maxDistancePx chacun. Utilisé pour la stabilisation temporelle —
 * un contour qui "tremble" légèrement d'une frame à l'autre reste considéré stable,
 * un contour qui "saute" (mauvaise détection) fait repartir le minuteur à zéro.
 */
export function cornersAreClose(a: Corners, b: Corners, maxDistancePx: number): boolean {
  const dist = (p1: Point, p2: Point) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
  return (
    dist(a.topLeftCorner, b.topLeftCorner) <= maxDistancePx &&
    dist(a.topRightCorner, b.topRightCorner) <= maxDistancePx &&
    dist(a.bottomLeftCorner, b.bottomLeftCorner) <= maxDistancePx &&
    dist(a.bottomRightCorner, b.bottomRightCorner) <= maxDistancePx
  );
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
 * Retourne les coins détectés (utilisés pour la stabilisation temporelle côté
 * appelant), ou null si aucun document valide n'est détecté sur cette frame.
 */
export function highlightPaperStable(
  scanner: JScanifyInstance,
  sourceCanvas: HTMLCanvasElement,
  overlayCanvas: HTMLCanvasElement,
  options: HighlightOptions
): Corners | null {
  const cv = window.cv as unknown as CvNamespace;
  const img = cv.imread(sourceCanvas);

  const corners = findValidCorners(scanner, cv, img, options.minAreaRatio ?? 0.15);
  img.delete();

  const ctx = overlayCanvas.getContext("2d");
  if (!ctx) return null;
  // On efface le contour précédent — la vidéo elle-même reste visible en dessous,
  // ce canvas ne sert plus qu'à dessiner le tracé, jamais l'image caméra.
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  if (!corners) return null;

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
  return corners;
}

export interface DetectOptions {
  /** Fraction minimale de l'aire totale de l'image que doit occuper le contour */
  minAreaRatio?: number;
}

/**
 * Détecte les 4 coins d'un document dans une image, SANS déformer l'image.
 * Séparé de la déformation exprès : permet de réutiliser warpToCorners() avec
 * des coins ajustés manuellement par l'utilisateur (recadrage manuel), pas
 * seulement avec les coins auto-détectés.
 */
export function detectCorners(
  scanner: JScanifyInstance,
  sourceCanvas: HTMLCanvasElement,
  options: DetectOptions = {}
): Corners | null {
  const cv = window.cv as unknown as CvNamespace;
  const img = cv.imread(sourceCanvas);
  const corners = findValidCorners(scanner, cv, img, options.minAreaRatio ?? 0.15);
  img.delete();
  return corners;
}

/**
 * Redresse la perspective d'une image selon 4 coins donnés (détectés automatiquement
 * OU ajustés manuellement par l'utilisateur — cette fonction ne sait pas d'où ils viennent).
 * C'est le cœur de l'ancienne extractPaperStable(), extrait pour être réutilisable.
 */
export function warpToCorners(
  sourceCanvas: HTMLCanvasElement,
  corners: Corners,
  resultWidth: number,
  resultHeight: number
): HTMLCanvasElement {
  const cv = window.cv as unknown as CvNamespace;
  const img = cv.imread(sourceCanvas);

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
