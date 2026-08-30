/**
 * Prétraitement CLAHE pour améliorer le contraste avant détection.
 * Utile sur les fonds texturés ou faiblement éclairés.
 */
function preprocessForDetection(cv: CvNamespace, img: CvMat): CvMat {
  const gray = new cv.Mat();
  cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY);
  
  const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
  const enhanced = new cv.Mat();
  clahe.apply(gray, enhanced);
  
  gray.delete();
  clahe.delete();
  return enhanced;
}

/**
 * Détection multi-échelle : essaie plusieurs ratios de resize
 * pour attraper les petits documents (cartes de visite).
 */
function findValidCornersMultiScale(
  scanner: JScanifyInstance,
  cv: CvNamespace,
  img: CvMat,
  minAreaRatio: number
): Corners | null {
  const scales = [1.0, 0.6, 1.4]; // Original, plus petit, plus grand
  let bestCorners: Corners | null = null;
  let bestArea = 0;

  for (const scale of scales) {
    let processed = img;
    let needsDelete = false;

    if (scale !== 1.0) {
      const resized = new cv.Mat();
      cv.resize(img, resized, new cv.Size(0, 0), scale, scale, cv.INTER_LINEAR);
      processed = resized;
      needsDelete = true;
    }

    const preprocessed = preprocessForDetection(cv, processed);
    const corners = findValidCorners(scanner, cv, preprocessed, minAreaRatio);
    preprocessed.delete();
    if (needsDelete) processed.delete();

    if (corners) {
      // Convertir les coordonnées à l'échelle originale
      const scaledCorners: Corners = {
        topLeftCorner: { x: corners.topLeftCorner.x / scale, y: corners.topLeftCorner.y / scale },
        topRightCorner: { x: corners.topRightCorner.x / scale, y: corners.topRightCorner.y / scale },
        bottomLeftCorner: { x: corners.bottomLeftCorner.x / scale, y: corners.bottomLeftCorner.y / scale },
        bottomRightCorner: { x: corners.bottomRightCorner.x / scale, y: corners.bottomRightCorner.y / scale },
      };

      const area = cv.contourArea(
        cv.matFromArray(4, 1, cv.CV_32FC2, [
          scaledCorners.topLeftCorner.x, scaledCorners.topLeftCorner.y,
          scaledCorners.topRightCorner.x, scaledCorners.topRightCorner.y,
          scaledCorners.bottomRightCorner.x, scaledCorners.bottomRightCorner.y,
          scaledCorners.bottomLeftCorner.x, scaledCorners.bottomLeftCorner.y,
        ])
      );

      if (area > bestArea) {
        bestArea = area;
        bestCorners = scaledCorners;
      }
    }
  }

  return bestCorners;
}
