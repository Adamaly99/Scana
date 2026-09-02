"use client";

import { useEffect, useState, useRef } from "react";
import { loadOpenCv } from "@/lib/opencv-loader";

export type OpenCvStatus = "idle" | "loading" | "ready" | "error";

export function useOpenCv(preload = false): { status: OpenCvStatus; errorMessage: string | null } {
  const [status, setStatus] = useState<OpenCvStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!preload || loadedRef.current) return;

    // Préchargement silencieux
    if (typeof (window as any).requestIdleCallback === "function") {
      // requestIdleCallback n'est pas toujours présent dans les définitions TS
      (window as any).requestIdleCallback(() => {
        loadOpenCv().catch(() => undefined);
      }, { timeout: 5000 });
    }
  }, [preload]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    let cancelled = false;

    setStatus("loading");
    loadOpenCv()
      .then(() => {
        if (!cancelled) setStatus("ready");
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { status, errorMessage };
}
