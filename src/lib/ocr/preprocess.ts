export async function preprocessForOcr(image: Blob | string): Promise<Blob | string> {
  if (typeof image === "string") {
    const res = await fetch(image);
    return await res.blob();
  }
  return image;
}
