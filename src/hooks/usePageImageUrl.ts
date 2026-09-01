"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { getImageBlob } from "@/lib/image-store";

export interface PageImageUrlResult {
  url: string | null;
  ref: React.RefObject<HTMLDivElement | null>;
}

export function usePageImageUrl(
  pageId: string | undefined
): PageImageUrlResult {
  const [url, setUrl] =
    useState<string | null>(null);

  const [isVisible, setIsVisible] =
    useState(false);

  const ref =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    if (
      typeof IntersectionObserver ===
      "undefined"
    ) {
      setIsVisible(true);
      return;
    }

    const observer =
      new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        },
        {
          rootMargin: "200px",
        }
      );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!pageId || !isVisible) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    getImageBlob(pageId)
      .then((blob) => {
        if (
          cancelled ||
          !blob
        ) {
          return;
        }

        objectUrl =
          URL.createObjectURL(blob);

        setUrl(objectUrl);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error(
            "Impossible de charger l'image:",
            error
          );

          setUrl(null);
        }
      });

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(
          objectUrl
        );
      }
    };
  }, [pageId, isVisible]);

  return {
    url,
    ref,
  };
}