"use client";

import { useEffect, useState } from "react";
import { getImageBlob } from "@/lib/image-store";

/**
 * Résout l'image binaire d'une page en URL affichable par <img>.
 * Révoque automatiquement l'URL précédente au changement de page ou au démontage,
 * pour ne jamais fuir de mémoire (chaque createObjectURL doit être révoqué).
 */
export function usePageImageUrl(pageId: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pageId) {
      Promise.resolve().then(() => setUrl(null));
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    getImageBlob(pageId).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pageId]);

  return url;
}
