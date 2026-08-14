export type RotateDirection = "cw" | "ccw";

/**
 * Pivote un Blob image de 90°. Les dimensions s'inversent (largeur ↔ hauteur) —
 * l'appelant doit toujours utiliser les nouvelles dimensions retournées, jamais
 * les anciennes.
 */
export async function rotateImageBlob90(
  blob: Blob,
  direction: RotateDirection
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.height;
  canvas.height = bitmap.width;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D non disponible sur cet appareil.");

  if (direction === "cw") {
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
  } else {
    ctx.translate(0, canvas.height);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const rotatedBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.95);
  });
  if (!rotatedBlob) throw new Error("La rotation a échoué.");

  return { blob: rotatedBlob, width: canvas.width, height: canvas.height };
}

/** Variante dataURL — pour la page en cours de revue, pas encore sauvegardée en Blob. */
export async function rotateDataUrl90(
  dataUrl: string,
  direction: RotateDirection
): Promise<{ dataUrl: string; width: number; height: number }> {
  const sourceBlob = await (await fetch(dataUrl)).blob();
  const { blob: rotatedBlob, width, height } = await rotateImageBlob90(sourceBlob, direction);

  const rotatedDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Conversion en dataURL échouée."));
    reader.readAsDataURL(rotatedBlob);
  });

  return { dataUrl: rotatedDataUrl, width, height };
}
