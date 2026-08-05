/** Déclenche le téléchargement d'un blob quelconque (PDF, JPG, PNG...). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Tente le partage natif (WhatsApp, Email, Drive, etc. apparaissent automatiquement
 * dans la feuille de partage du téléphone — inutile de coder chaque appli à la main).
 * Si l'appareil/navigateur ne supporte pas le partage de fichiers (courant sur desktop),
 * on retombe silencieusement sur un téléchargement classique.
 */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  mimeType: string
): Promise<void> {
  const file = new File([blob], filename, { type: mimeType });

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (err) {
      // L'utilisateur a annulé le partage (AbortError) : ne rien faire, pas d'erreur.
      if (err instanceof Error && err.name === "AbortError") return;
      // Autre échec de partage : on retombe sur le téléchargement ci-dessous.
    }
  }

  downloadBlob(blob, filename);
}
