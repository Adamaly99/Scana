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
    const stretched = ((data[i] - low) / range) * 255;
    const clamped = Math.min(255, Math.max(0, stretched));
    // Seuillage doux : pousse vers le blanc au-dessus de 190, garde le texte lisible en dessous
    const value = clamped > 190 ? 255 : clamped;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
}

/**
 * Applique un filtre à une image source et renvoie une nouvelle dataURL (JPEG qualité 0.92).
 * Ne modifie jamais l'image d'origine — le filtre est toujours recalculé depuis rawDataUrl.
 */
export async function applyFilterToDataUrl(
  sourceDataUrl: string,
  filter: FilterType
): Promise<string> {
  const img = await loadImage(sourceDataUrl);
  const canvas = canvasFromImage(img);

  if (filter === "color") {
    return canvas.toDataURL("image/jpeg", 0.92);
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D non disponible sur cet appareil.");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  if (filter === "gray") {
    toGrayscale(imageData.data);
  } else {
    toBlackAndWhite(imageData.data);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}
