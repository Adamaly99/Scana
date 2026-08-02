"use client";

import { useScanStore } from "@/lib/store";

interface PageDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function PageDrawer({ open, onClose }: PageDrawerProps) {
  const pages = useScanStore((s) => s.pages);
  const removePage = useScanStore((s) => s.removePage);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/60">
      <button
        className="absolute inset-0"
        aria-label="Fermer"
        onClick={onClose}
      />

      <div className="relative z-10 max-h-[75vh] rounded-t-3xl border-t border-line bg-surface pb-8">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line" />

        <div className="flex items-center justify-between px-6 pt-4">
          <h2 className="font-semibold text-ink">
            {pages.length} page{pages.length > 1 ? "s" : ""} scannée{pages.length > 1 ? "s" : ""}
          </h2>
          <button onClick={onClose} className="text-sm text-ink-dim">
            Fermer
          </button>
        </div>

        {pages.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-ink-dim">
            Aucune page pour l&apos;instant. Scanne ton premier document.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 overflow-y-auto px-6 pt-4">
            {pages.map((page, index) => (
              <div key={page.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.rawDataUrl}
                  alt={`Page ${index + 1}`}
                  className="aspect-[3/4] w-full rounded-lg border border-line object-cover"
                />
                <span className="absolute left-1.5 top-1.5 rounded-full bg-void/80 px-2 py-0.5 font-mono text-[10px] text-ink">
                  {index + 1}
                </span>
                <button
                  onClick={() => removePage(page.id)}
                  aria-label={`Supprimer la page ${index + 1}`}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-void/80 text-xs text-ink"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="px-6 pt-6 text-center font-mono text-[11px] text-ink-dim">
          FUSION · RÉORDONNER · EXPORT PDF — ÉTAPE 2
        </p>
      </div>
    </div>
  );
}
