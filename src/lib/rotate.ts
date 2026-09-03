export type RotateDirection = "left" | "right";

export async function rotateImageBlob90(
  blob: Blob,
  direction: RotateDirection
): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  if (direction === "right") {
    canvas.width = img.height;
    canvas.height = img.width;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((Math.PI / 180) * 90);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
  } else {
    canvas.width = img.height;
    canvas.height = img.width;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((Math.PI / 180) * -90);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
  }

  const rotatedBlob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), blob.type || "image/jpeg");
  });

  return {
    blob: rotatedBlob,
    width: canvas.width,
    height: canvas.height,
  };
}