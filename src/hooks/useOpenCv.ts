"use client";

import { useEffect, useState } from "react";
import { loadOpenCv } from "@/lib/opencv-loader";

export type OpenCvStatus = "loading" | "ready" | "error";

export function useOpenCv(): { status: OpenCvStatus; errorMessage: string | null } {
  const [status, setStatus] = useState<OpenCvStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

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
