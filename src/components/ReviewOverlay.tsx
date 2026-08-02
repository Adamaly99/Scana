"use client";

import { useEffect, useState } from "react";
import { applyFilterToDataUrl } from "@/lib/filters";
import type { FilterType } from "@/lib/store";

interface ReviewOverlayProps {
  rawDataUrl: string;
  onConfirm: (filter: FilterType) => void;
  onRetake: () => void;
}

const FILTERS: { id: FilterType; label: string }[] = [
  { id: "color", label: "Couleur" },
  { id: "gray", label: "Gris" },
  { id: "bw", label: "N&B" },
];

export default function ReviewOverlay({ rawDataUrl, onConfirm, onRetake }: ReviewOverlayProps) {
  const [filter, setFilter] = useState<FilterType>("color");
  const [previewUrl, setPreviewUrl] = useState<string>(rawDataUrl);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // setRendering(true) est différé d'un micro-tick (via Promise.resolve().then)
    // pour ne jamais déclencher de setState de façon synchrone dans le corps de l'effet.
    Promise.resolve().then(() => {
      if (!cancelled) setRendering(true);
    });

    applyFilterToDataUrl(rawDataUrl, filter)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(rawDataUrl);
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rawDataUrl, filter]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-void">
      <div className="relative flex-1 flex items-center justify-center overflow-hidden p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Page scannée"
          className="max-h-full max-w-full rounded-xl border border-line object-contain"
          style={{ opacity: rendering ? 0.6 : 1, transition: "opacity 120ms" }}
        />
      </div>

      <div className="flex justify-center gap-2 px-6 pb-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === f.id
                ? "bg-accent text-accent-ink"
                : "bg-surface text-ink-dim border border-line"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3 px-6 pb-10">
        <button
          onClick={onRetake}
          className="flex-1 rounded-2xl border border-line bg-surface py-4 text-sm font-semibold text-ink"
        >
          Reprendre
        </button>
        <button
          onClick={() => onConfirm(filter)}
          className="flex-[2] rounded-2xl bg-accent py-4 text-sm font-bold text-accent-ink"
        >
          Garder cette page
        </button>
      </div>
    </div>
  );
}
