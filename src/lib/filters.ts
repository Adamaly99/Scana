import type { FilterType } from "./store";

/**
 * Code source du Worker, en JavaScript brut (pas TypeScript), instancié via Blob URL.
 *
 * Pourquoi pas `new Worker(new URL("./worker.ts", import.meta.url))` (la méthode
 * "standard" avec les bundlers) : la documentation Turbopack affirme supporter ce
 * pattern, mais nos propres builds ont montré un fichier .ts brut copié tel quel en
 * asset statique — signe potentiel du même bug que d'autres ont rencontré avec
 * Turbopack ("Refused to execute script... MIME type not executable"). Impossible
 * de tester dans un vrai navigateur depuis cet environnement, donc plutôt que de
 * parier sur un comportement incertain d'un bundler encore jeune sur cette
 * fonctionnalité précise, on utilise la technique Blob : universellement supportée,
 * indépendante de tout bundler, aucune ambiguïté possible.
 *
 * Contrepartie assumée : la logique de traitement pixel est dupliquée ici en JS brut
 * plutôt qu'importée depuis un module partagé (un Worker via Blob ne peut pas faire
 * d'import ES ni résoudre les alias "@/..."). Si l'algorithme change, il faut le
 * changer ici ET nulle part ailleurs — c'est la seule copie, il n'y a pas de drift
 * possible avec une autre version.
 */
const WORKER_SOURCE = `
function clamp8(value) {
  return Math.min(255, Math.max(0, value));
}

function sharpen(data, width, height, amount) {
  if (amount === undefined) amount = 0.6;
  var original = new Uint8ClampedArray(data);
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          var ny = y + dy, nx = x + dx;
          if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
          var idx = (ny * width + nx) * 4;
          rSum += original[idx];
          gSum += original[idx + 1];
          bSum += original[idx + 2];
          count++;
        }
      }
      var idx2 = (y * width + x) * 4;
      var blurredR = rSum / count, blurredG = gSum / count, blurredB = bSum / count;
      data[idx2] = clamp8(original[idx2] + amount * (original[idx2] - blurredR));
      data[idx2 + 1] = clamp8(original[idx2 + 1] + amount * (original[idx2 + 1] - blurredG));
      data[idx2 + 2] = clamp8(original[idx2 + 2] + amount * (original[idx2 + 2] - blurredB));
    }
  }
}

function autoLevelsColor(data) {
  for (var channel = 0; channel < 3; channel++) {
    var histogram = new Array(256).fill(0);
    for (var i = channel; i < data.length; i += 4) histogram[data[i]]++;
    var total = data.length / 4;
    var lowCut = total * 0.01, highCut = total * 0.99;
    var cumulative = 0, low = 0, high = 255;
    for (var v = 0; v < 256; v++) {
      cumulative += histogram[v];
      if (cumulative >= lowCut) { low = v; break; }
    }
    cumulative = 0;
    for (var v2 = 0; v2 < 256; v2++) {
      cumulative += histogram[v2];
      if (cumulative >= highCut) { high = v2; break; }
    }
    var range = Math.max(high - low, 1);
    for (var j = channel; j < data.length; j += 4) {
      data[j] = clamp8(((data[j] - low) / range) * 255);
    }
  }
}

function enhanceGrayscaleContrast(data) {
  var histogram = new Array(256).fill(0);
  var pixelCount = data.length / 4;
  for (var i = 0; i < data.length; i += 4) histogram[Math.round(data[i])]++;
  var lowCut = pixelCount * 0.02, highCut = pixelCount * 0.98;
  var cumulative = 0, low = 0, high = 255;
  for (var v = 0; v < 256; v++) {
    cumulative += histogram[v];
    if (cumulative >= lowCut) { low = v; break; }
  }
  cumulative = 0;
  for (var v2 = 0; v2 < 256; v2++) {
    cumulative += histogram[v2];
    if (cumulative >= highCut) { high = v2; break; }
  }
  var range = Math.max(high - low, 1);
  for (var j = 0; j < data.length; j += 4) {
    var stretched = clamp8(((data[j] - low) / range) * 255);
    data[j] = stretched; data[j + 1] = stretched; data[j + 2] = stretched;
  }
}

function toGrayscale(data) {
  for (var i = 0; i < data.length; i += 4) {
    var gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray; data[i + 1] = gray; data[i + 2] = gray;
  }
}

function toBlackAndWhite(data) {
  toGrayscale(data);
  var histogram = new Array(256).fill(0);
  var pixelCount = data.length / 4;
  for (var i = 0; i < data.length; i += 4) histogram[Math.round(data[i])]++;
  var lowCut = pixelCount * 0.02, highCut = pixelCount * 0.98;
  var cumulative = 0, low = 0, high = 255;
  for (var v = 0; v < 256; v++) {
    cumulative += histogram[v];
    if (cumulative >= lowCut) { low = v; break; }
  }
  cumulative = 0;
  for (var v2 = 0; v2 < 256; v2++) {
    cumulative += histogram[v2];
    if (cumulative >= highCut) { high = v2; break; }
  }
  var range = Math.max(high - low, 1);
  for (var j = 0; j < data.length; j += 4) {
    var stretched = clamp8(((data[j] - low) / range) * 255);
    var value = stretched > 190 ? 255 : stretched;
    data[j] = value; data[j + 1] = value; data[j + 2] = value;
  }
}

self.onmessage = async function (event) {
  var d = event.data;
  var id = d.id, imageBitmap = d.imageBitmap, filter = d.filter, format = d.format, jpegQuality = d.jpegQuality;
  try {
    var canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    var ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Contexte 2D indisponible dans le Worker.");
    ctx.drawImage(imageBitmap, 0, 0);
    imageBitmap.close();

    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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

    var mime = format === "png" ? "image/png" : "image/jpeg";
    var blob = await canvas.convertToBlob(format === "png" ? { type: mime } : { type: mime, quality: jpegQuality });
    var reader = new FileReader();
    reader.onload = function () { self.postMessage({ id: id, dataUrl: reader.result }); };
    reader.onerror = function () { self.postMessage({ id: id, error: "Conversion en dataURL échouée." }); };
    reader.readAsDataURL(blob);
  } catch (err) {
    self.postMessage({ id: id, error: (err && err.message) || "Erreur inconnue dans le Worker." });
  }
};
`;

interface PendingRequest {
  resolve: (dataUrl: string) => void;
  reject: (err: Error) => void;
}

let worker: Worker | null = null;
let requestCounter = 0;
const pending = new Map<string, PendingRequest>();

function getWorker(): Worker {
  if (!worker) {
    const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    worker = new Worker(blobUrl);
    // Le Worker est un singleton conservé pour toute la session — pas besoin de
    // révoquer l'URL blob (coût mémoire négligeable, évite tout risque de
    // révocation prématurée avant que le Worker ait fini de charger le script).

    worker.onmessage = (
      e: MessageEvent<{ id: string; dataUrl?: string; error?: string }>
    ) => {
      const { id, dataUrl, error } = e.data;
      const request = pending.get(id);
      if (!request) return;
      pending.delete(id);
      if (error) request.reject(new Error(error));
      else if (dataUrl) request.resolve(dataUrl);
      else request.reject(new Error("Réponse du Worker invalide."));
    };

    worker.onerror = () => {
      // Erreur globale du Worker : on rejette tout ce qui est en attente plutôt
      // que de laisser des promesses pendre indéfiniment.
      pending.forEach((request) => request.reject(new Error("Le Worker de filtrage a échoué.")));
      pending.clear();
    };
  }
  return worker;
}

/**
 * Applique un filtre à une image source et renvoie une nouvelle dataURL.
 * Ne modifie jamais l'image d'origine — le filtre est toujours recalculé depuis l'image source.
 * Tout le calcul pixel se fait dans un Web Worker : l'interface ne gèle jamais pendant
 * le traitement, même en qualité "haute" sur un appareil modeste.
 *
 * sourceDataUrl accepte aussi bien une dataURL (data:...) qu'une URL blob (blob:...).
 */
export async function applyFilterToDataUrl(
  sourceDataUrl: string,
  filter: FilterType,
  format: "jpeg" | "png" = "jpeg",
  jpegQuality = 0.92
): Promise<string> {
  const sourceBlob = await (await fetch(sourceDataUrl)).blob();
  const imageBitmap = await createImageBitmap(sourceBlob);

  const id = `filter_${Date.now()}_${++requestCounter}`;
  const w = getWorker();

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, imageBitmap, filter, format, jpegQuality }, [imageBitmap]);
  });
}
