import type { FilterType } from "./store";

/**
 * Charge une dataURL dans un HTMLImageElement.
 * Rejette proprement si l'image ne charge pas (fichier corrompu, etc.)
 */
export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image scannée."));
    img.src = dataUrl;
  });
}

function canvasFromImage(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D non disponible sur cet appareil.");
  ctx.drawImage(img, 0, 0);
  return canvas;
}

function clamp8(value: number): number {
  return Math.min(255, Math.max(0, value));
}

/**
 * Netteté (unsharp mask) : renforce les contours en soustrayant une version floue
 * de l'image à l'originale, amplifiée. C'est ce qui donne l'aspect "net, scanné"
 * plutôt que "photo floue" — l'ingrédient qui manquait dans la version précédente.
 * Toujours appliqué en premier, quel que soit le filtre choisi ensuite.
 */
function sharpen(data: Uint8ClampedArray, width: number, height: number, amount = 0.6): void {
  const original = new Uint8ClampedArray(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rSum = 0,
        gSum = 0,
        bSum = 0,
        count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
          const idx = (ny * width + nx) * 4;
          rSum += original[idx];
          gSum += original[idx + 1];
          bSum += original[idx + 2];
          count++;
        }
      }
      const idx = (y * width + x) * 4;
      const blurredR = rSum / count;
      const blurredG = gSum / count;
      const blurredB = bSum / count;
      data[idx] = clamp8(original[idx] + amount * (original[idx] - blurredR));
      data[idx + 1] = clamp8(original[idx + 1] + amount * (original[idx + 1] - blurredG));
      data[idx + 2] = clamp8(original[idx + 2] + amount * (original[idx + 2] - blurredB));
    }
  }
}

/**
 * Auto-levels couleur : étire le contraste de chaque canal R/G/B indépendamment
 * (percentiles 1%/99%). Blancs plus blancs, couleurs plus vives — sans jamais
 * désaturer l'image (contrairement à l'ancienne version qui forçait le gris).
 */
function autoLevelsColor(data: Uint8ClampedArray): void {
  for (let channel = 0; channel < 3; channel++) {
    const histogram = new Array(256).fill(0);
    for (let i = channel; i < data.length; i += 4) {
      histogram[data[i]]++;
    }
    const total = data.length / 4;
    const lowCut = total * 0.01;
    const highCut = total * 0.99;

    let cumulative = 0;
    let low = 0;
    let high = 255;
    for (let v = 0; v < 256; v++) {
      cumulative += histogram[v];
      if (cumulative >= lowCut) {
        low = v;
        break;
      }
    }
    cumulative = 0;
    for (let v = 0; v < 256; v++) {
      cumulative += histogram[v];
      if (cumulative >= highCut) {
        high = v;
        break;
      }
    }
    const range = Math.max(high - low, 1);

    for (let i = channel; i < data.length; i += 4) {
      data[i] = clamp8(((data[i] - low) / range) * 255);
    }
  }
}

/**
 * Contraste adaptatif pour le filtre Gris : étirement de contraste (percentiles 2%/98%),
 * sans seuillage dur (contrairement au N&B) — garde un dégradé naturel mais net.
 */
function enhanceGrayscaleContrast(data: Uint8ClampedArray): void {
  const histogram = new Array(256).fill(0);
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    histogram[Math.round(data[i])]++;
  }

  const lowCut = pixelCount * 0.02;
  const highCut = pixelCount * 0.98;
  let cumulative = 0;
  let low = 0;
  let high = 255;
  for (let v = 0; v < 256; v++) {
    cumulative += histogram[v];
    if (cumulative >= lowCut) {
      low = v;
      break;
    }
  }
  cumulative = 0;
  for (let v = 0; v < 256; v++) {
    cumulative += histogram[v];
    if (cumulative >= highCut) {
      high = v;
      break;
    }
  }
  const range = Math.max(high - low, 1);

  for (let i = 0; i < data.length; i += 4) {
    const stretched = clamp8(((data[i] - low) / range) * 255);
    data[i] = stretched;
    data[i + 1] = stretched;
    data[i + 2] = stretched;
  }
}

/** Convertit en niveaux de gris (luminance perceptuelle). Modifie les pixels en place. */
function toGrayscale(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
}

/**
 * Effet "document" : niveaux de gris + étirement de contraste (percentiles 2%/98%)
 * puis seuillage doux. Donne un fond quasi-blanc et un texte foncé net,
 * sans les erreurs d'un seuillage fixe sur des scans mal éclairés.
 */
function toBlackAndWhite(data: Uint8ClampedArray): void {
  toGrayscale(data);

  // Histogramme des niveaux de gris pour trouver les percentiles 2% / 98%
  const histogram = new Array(256).fill(0);
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    histogram[Math.round(data[i])]++;
  }

  const lowCut = pixelCount * 0.02;
  const highCut = pixelCount * 0.98;
  let cumulative = 0;
  let low = 0;
  let high = 255;
  for (let v = 0; v < 256; v++) {
    cumulative += histogram[v];
    if (cumulative >= lowCut) {
      low = v;
      break;
    }
  }
  cumulative = 0;
  for (let v = 0; v < 256; v++) {
    cumulative += histogram[v];
    if (cumulative >= highCut) {
      high = v;
      break;
    }
  }
  const range = Math.max(high - low, 1);

  for (let i = 0; i < data.length; i += 4) {
    const stretched = clamp8(((data[i] - low) / range) * 255);
    // Seuillage doux : pousse vers le blanc au-dessus de 190, garde le texte lisible en dessous
    const value = stretched > 190 ? 255 : stretched;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
}

/**
 * Applique un filtre à une image source et renvoie une nouvelle dataURL.
 * Ne modifie jamais l'image d'origine — le filtre est toujours recalculé depuis rawDataUrl.
 * Format JPEG par défaut (qualité 0.92) ; PNG disponible pour l'export image.
 *
 * La netteté (sharpen) est TOUJOURS appliquée en premier, quel que soit le filtre —
 * c'est ce qui donne l'effet "scanné net" plutôt que "photo de téléphone". Ensuite :
 * - "color" : auto-levels par canal, la couleur d'origine est toujours préservée
 * - "gray"  : niveaux de gris + contraste adaptatif (dégradé naturel)
 * - "bw"    : niveaux de gris + contraste + seuillage dur (fond blanc pur, texte noir pur)
 */
export async function applyFilterToDataUrl(
  sourceDataUrl: string,
  filter: FilterType,
  format: "jpeg" | "png" = "jpeg"
): Promise<string> {
  const img = await loadImage(sourceDataUrl);
  const canvas = canvasFromImage(img);
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D non disponible sur cet appareil.");

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  sharpen(imageData.data, canvas.width, canvas.height);

  if (filter === "color") {
    autoLevelsColor(imageData.data);
  } else if (filter === "gray") {
    toGrayscale(imageData.data);
    enhanceGrayscaleContrast(imageData.data);
  } else {
    toBlackAndWhite(imageData.data);
  }

  ctx.putImageData(imageData, 0, 0);
  return format === "png" ? canvas.toDataURL(mime) : canvas.toDataURL(mime, 0.92);
        }
