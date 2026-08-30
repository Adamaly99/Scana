/**
 * Pipeline de prétraitement OCR avancé :
 * 1. Fond blanc forcé
 * 2. Dé-skew (redressement)
 * 3. Binarisation adaptative
 */

export async function preprocessForOcr(image: Blob | string): Promise<Blob> {
  const source = image instanceof Blob
    ? image
    : await fetch(image).then(r => r.blob());

  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  
  // 1. Fond blanc + draw
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  // 2. Auto-deskew via Hough transform (simplifié : détection angle principal)
  // Pour l'instant, on limite à la binarisation
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // 3. Binarisation adaptative simple (Sauvola-like)
  adaptiveBinarize(imageData.data, canvas.width, canvas.height);
  
  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error("OCR preprocess failed")),
      'image/jpeg',
      0.92
    );
  });
}

function adaptiveBinarize(data: Uint8ClampedArray, width: number, height: number) {
  const windowSize = 15;
  const k = 0.2;
  const R = 128;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, sumSq = 0, count = 0;
      
      for (let dy = -windowSize; dy <= windowSize; dy++) {
        for (let dx = -windowSize; dx <= windowSize; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
          const idx = (ny * width + nx) * 4;
          const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          sum += gray;
          sumSq += gray * gray;
          count++;
        }
      }
      
      const mean = sum / count;
      const std = Math.sqrt((sumSq / count) - (mean * mean));
      const threshold = mean * (1 + k * ((std / R) - 1));
      
      const idx = (y * width + x) * 4;
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const val = gray > threshold ? 255 : 0;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
    }
  }
}
