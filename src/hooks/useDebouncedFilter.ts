import { useRef, useCallback } from "react";
import type { FilterType } from "@/lib/store";

export function useDebouncedFilter() {
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = useCallback((
    filter: FilterType,
    dataUrl: string,
    onApply: (url: string) => void,
    onError: () => void
  ) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    abortRef.current = new AbortController();
    const controller = abortRef.current;

    timeoutRef.current = setTimeout(async () => {
      try {
        const { applyFilterToDataUrl } = await import("@/lib/filters");
        const result = await applyFilterToDataUrl(dataUrl, filter);
        if (!controller.signal.aborted) {
          onApply(result);
        }
      } catch {
        if (!controller.signal.aborted) {
          onError();
        }
      }
    }, 150); // 150ms debounce

    return () => {
      controller.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { apply };
}
