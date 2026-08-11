import type { FilterType } from "./store";

/**
 * Code source du Worker, en JavaScript brut (pas TypeScript), instancié via Blob URL.
 * Voir la note historique : on évite `new Worker(new URL(...))` car son support par
 * Turbopack restait ambigu dans nos tests de build. La technique Blob est
 * universellement supportée, indépendante de tout bundler.
 *
 * mode "buffer" : retourne les octets bruts encodés (JPEG/PNG), transférés en zero-copy —
 * utilisé pour la construction PDF et l'export fichier, jamais de détour par le texte base64.
 * mode "dataUrl" : retourne une dataURL affichable directement par <img src>.
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
  var id = d.id, imageBitmap = d.imageBitmap, filter = d.filter, format = d.format, jpegQuality = d.jpegQuality, mode = d.mode;
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

    if (mode === "buffer") {
      var buffer = await blob.arrayBuffer();
      self.postMessage({ id: id, buffer: buffer, mime: mime }, [buffer]);
    } else {
      var reader = new FileReader();
      reader.onload = function () { self.postMessage({ id: id, dataUrl: reader.result }); };
      reader.onerror = function () { self.postMessage({ id: id, error: "Conversion en dataURL échouée." }); };
      reader.readAsDataURL(blob);
    }
  } catch (err) {
    self.postMessage({ id: id, error: (err && err.message) || "Erreur inconnue dans le Worker." });
  }
};
`;

interface PendingRequest {
  resolve: (result: { dataUrl?: string; buffer?: ArrayBuffer; mime?: string }) => void;
  reject: (err: Error) => void;
}

/**
 * Taille du pool de Workers. 3 est un compromis : assez pour un vrai gain de
 * parallélisme sur le multi-pages (la plupart des téléphones ont 4-8 cœurs, même
 * les bas de gamme), sans saturer la mémoire d'un appareil modeste avec trop
 * d'OffscreenCanvas actifs en même temps.
 */
const POOL_SIZE = 3;
const workerPool: Worker[] = [];
let nextWorkerIndex = 0;
let requestCounter = 0;
const pending = new Map<string, PendingRequest>();

function handleWorkerMessage(
  e: MessageEvent<{ id: string; dataUrl?: string; buffer?: ArrayBuffer; mime?: string; error?: string }>
) {
  const { id, dataUrl, buffer, mime, error } = e.data;
  const request = pending.get(id);
  if (!request) return;
  pending.delete(id);
  if (error) request.reject(new Error(error));
  else if (dataUrl) request.resolve({ dataUrl });
  else if (buffer) request.resolve({ buffer, mime });
  else request.reject(new Error("Réponse du Worker invalide."));
}

function createPoolWorker(): Worker {
  const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  const w = new Worker(blobUrl);
  w.onmessage = handleWorkerMessage;
  w.onerror = () => {
    // Une erreur sur CE Worker ne doit rejeter que les requêtes qui lui étaient
    // destinées, mais on ne trace pas facilement "quelle requête est allée où" —
    // par sécurité on rejette tout ce qui est en attente plutôt que de laisser
    // des promesses pendre indéfiniment si un Worker du pool meurt.
    pending.forEach((request) => request.reject(new Error("Un Worker de filtrage a échoué.")));
    pending.clear();
  };
  return w;
}

function getNextWorker(): Worker {
  if (workerPool.length === 0) {
    for (let i = 0; i < POOL_SIZE; i++) workerPool.push(createPoolWorker());
  }
  const w = workerPool[nextWorkerIndex % workerPool.length];
  nextWorkerIndex++;
  return w;
}

async function dispatchToWorker(
  sourceDataUrl: string,
  filter: FilterType,
  format: "jpeg" | "png",
  jpegQuality: number,
  mode: "dataUrl" | "buffer"
): Promise<{ dataUrl?: string; buffer?: ArrayBuffer; mime?: string }> {
  const sourceBlob = await (await fetch(sourceDataUrl)).blob();
  const imageBitmap = await createImageBitmap(sourceBlob);

  const id = `filter_${Date.now()}_${++requestCounter}`;
  const w = getNextWorker();

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, imageBitmap, filter, format, jpegQuality, mode }, [imageBitmap]);
  });
}

/**
 * Applique un filtre à une image source et renvoie une nouvelle dataURL, prête pour
 * <img src>. Ne modifie jamais l'image d'origine — recalculée depuis l'image source.
 * sourceDataUrl accepte aussi bien une dataURL (data:...) qu'une URL blob (blob:...).
 */
export async function applyFilterToDataUrl(
  sourceDataUrl: string,
  filter: FilterType,
  format: "jpeg" | "png" = "jpeg",
  jpegQuality = 0.92
): Promise<string> {
  const result = await dispatchToWorker(sourceDataUrl, filter, format, jpegQuality, "dataUrl");
  if (!result.dataUrl) throw new Error("Le Worker n'a pas renvoyé de dataURL.");
  return result.dataUrl;
}

/**
 * Applique un filtre et renvoie directement un Blob des octets encodés — sans jamais
 * passer par le texte base64 (ni à l'aller ni au retour). Utilisé partout où le
 * résultat final est un fichier (PDF, export JPG/PNG), jamais un <img src> direct.
 */
export async function applyFilterToBlob(
  sourceDataUrl: string,
  filter: FilterType,
  format: "jpeg" | "png" = "jpeg",
  jpegQuality = 0.92
): Promise<Blob> {
  const result = await dispatchToWorker(sourceDataUrl, filter, format, jpegQuality, "buffer");
  if (!result.buffer || !result.mime) throw new Error("Le Worker n'a pas renvoyé de données.");
  return new Blob([result.buffer], { type: result.mime });
}
