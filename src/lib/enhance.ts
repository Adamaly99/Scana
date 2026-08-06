/**
 * Améliore la qualité visuelle d'un scan :
 * - Débruitage Gaussian
 * - CLAHE (Contrast Limited Adaptive Histogram Equalization)
 * - Thresholding adaptatif pour le N&B particulièrement
 *
 * Tout en client-side Canvas, sans librairie externe.
 */

/**
 * Gaussian Blur : réduit le bruit en lissant les pixels. Noyau 3x3 fixe
 * pour ne pas détruire les détails fins de l'écriture.
 */
function gaussianBlur(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const result = new ImageData(width, height);
  const kernel = [
    [1, 2, 1],
    [2, 4, 2],
    [1, 2, 1],
  ];
  const sum = 16;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0,
        g = 0,
        b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const i = ((y + ky) * width + (x + kx)) * 4;
          const w = kernel[ky + 1][kx + 1];
          r += data[i] * w;
          g += data[i + 1] * w;
          b += data[i + 2] * w;
        }
      }
      const idx = (y * width + x) * 4;
      result.data[idx] = r / sum;
      result.data[idx + 1] = g / sum;
      result.data[idx + 2] = b / sum;
      result.data[idx + 3] = data[idx + 3]; // alpha
    }
  }
  return result;
}

/**
 * CLAHE (Contrast Limited Adaptive Histogram Equalization) :
 * améliore le contraste localement, rend les zones sombres claires
 * et les zones claires plus contrastées, sans over-amplifier le bruit.
 * Simplifié : divise l'image en tiles, applique l'égalisation à chaque tile.
 */
function clahe(imageData: ImageData, tileSize: number = 32, clipLimit: number = 2): ImageData {
  const { data, width, height } = imageData;
  const result = new ImageData(width, height);

  // Convertir en grayscale si nécessaire (pour plus de cohérence)
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  // Appliquer l'égalisation adaptative par tile
  for (let ty = 0; ty < height; ty += tileSize) {
    for (let tx = 0; tx < width; tx += tileSize) {
      const tileH = Math.min(tileSize, height - ty);
      const tileW = Math.min(tileSize, width - tx);

      // Histogramme du tile
      const hist = new Array(256).fill(0);
      for (let y = ty; y < ty + tileH; y++) {
        for (let x = tx; x < tx + tileW; x++) {
          hist[gray[y * width + x]]++;
        }
      }

      // Clipping et équalization
      const clipValue = Math.max(1, (clipLimit * tileW * tileH) / 256);
      let clipped = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > clipValue) {
          clipped += hist[i] - clipValue;
          hist[i] = clipValue;
        }
      }
      const redistribute = clipped / 256;
      for (let i = 0; i < 256; i++) {
        hist[i] += redistribute;
      }

      // Cumulative histogram (LUT)
      const cdf = new Array(256);
      let sum = 0;
      for (let i = 0; i < 256; i++) {
        sum += hist[i];
        cdf[i] = Math.round((sum / (tileW * tileH)) * 255);
      }

      // Appliquer la LUT au tile
      for (let y = ty; y < ty + tileH; y++) {
        for (let x = tx; x < tx + tileW; x++) {
          const idx = y * width + x;
          const oldVal = gray[idx];
          const newVal = cdf[oldVal];

          const dataIdx = idx * 4;
          result.data[dataIdx] = newVal;
          result.data[dataIdx + 1] = newVal;
          result.data[dataIdx + 2] = newVal;
          result.data[dataIdx + 3] = data[dataIdx + 3];
        }
      }
    }
  }

  return result;
}

/**
 * Thresholding adaptatif (Otsu) : idéal pour les documents N&B où
 * on veut un fond blanc pur et du texte noir pur, sans gris.
 * Aggressif : force le choix binaire sans nuances.
 */
function otsuThreshold(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const result = new ImageData(width, height);

  // Histogramme
  const hist = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    hist[gray]++;
  }

  // Trouver le threshold Otsu
  const total = width * height;
  let sum = 0,
    sumB = 0,
    wB = 0,
    wF = 0,
    maxVar = 0,
    threshold = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * hist[i];
  }
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;

    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);

    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = i;
    }
  }

  // Appliquer le threshold
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    const value = gray > threshold ? 255 : 0;
    result.data[i] = value;
    result.data[i + 1] = value;
    result.data[i + 2] = value;
    result.data[i + 3] = data[i + 3];
  }

  return result;
}

/**
 * Pipeline d'enhancement complet :
 * 1. Gaussian blur (débruite)
 * 2. CLAHE (améliore le contraste)
 * 3. Optionnellement, seuil Otsu si on veut un N&B pur
 *
 * Retourne une dataURL avec l'image améliorée.
 */
export async function enhanceDocument(
  sourceDataUrl: string,
  applyOtsu: boolean = false
): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Impossible de charger l'image."));
    img.src = sourceDataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D non disponible.");

  ctx.drawImage(img, 0, 0);
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Pipeline
  imageData = gaussianBlur(imageData);
  imageData = clahe(imageData);
  if (applyOtsu) {
    imageData = otsuThreshold(imageData);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.95);
}
