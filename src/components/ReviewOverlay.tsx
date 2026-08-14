"use client";

import { useEffect, useState } from "react";
import { Crop, RotateCw } from "lucide-react";
import { applyFilterToDataUrl } from "@/lib/filters";
import { rotateDataUrl90 } from "@/lib/rotate";
import type { FilterType } from "@/lib/store";
import type { CaptureResult } from "@/components/ScannerCamera";
import ManualCropOverlay from "@/components/ManualCropOverlay";

interface ReviewOverlayProps {
  capture: CaptureResult;
  onConfirm: (finalDataUrl: string, filter: FilterType, width: number, height: number) => void;
  onRetake: () => void;
}

const FILTERS: { id: FilterType; label: string }[] = [
  { id: "color", label: "Couleur" },
  { id: "gray", label: "Gris" },
  { id: "bw", label: "N&B" },
];

export default function ReviewOverlay({ capture, onConfirm, onRetake }: ReviewOverlayProps) {
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(capture.croppedDataUrl);
  const [dimensions, setDimensions] = useState({ width: capture.width, height: capture.height });
  const [filter, setFilter] = useState<FilterType>("color");
  const [previewUrl, setPreviewUrl] = useState<string | null>(capture.croppedDataUrl);
  const [rendering, setRendering] = useState(false);
  const [rotating, setRotating] = useState(false);
  // Si l'auto-détection a échoué (croppedDataUrl est null), on ouvre directement
  // l'ajustement manuel — il n'y a de toute façon rien d'autre à montrer.
  const [cropOpen, setCropOpen] = useState(capture.croppedDataUrl === null);

  useEffect(() => {
    if (!croppedDataUrl) return;
    let cancelled = false;

    // setRendering(true) différé d'un micro-tick pour ne jamais déclencher de
    // setState de façon synchrone dans le corps de l'effet.
    Promise.resolve().then(() => {
      if (!cancelled) setRendering(true);
    });

    applyFilterToDataUrl(croppedDataUrl, filter)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(croppedDataUrl);
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [croppedDataUrl, filter]);

  const handleCropConfirm = (newCroppedDataUrl: string) => {
    setCroppedDataUrl(newCroppedDataUrl);
    setDimensions({ width: capture.width, height: capture.height });
    setCropOpen(false);
  };

  const handleRotate = async () => {
    if (!croppedDataUrl || rotating) return;
    setRotating(true);
    try {
      const result = await rotateDataUrl90(croppedDataUrl, "cw");
      setCroppedDataUrl(result.dataUrl);
      setDimensions({ width: result.width, height: result.height });
    } catch {
      // Échec silencieux : l'utilisateur peut réessayer.
    } finally {
      setRotating(false);
    }
  };

  if (cropOpen) {
    return (
      <ManualCropOverlay
        rawFrameDataUrl={capture.rawFrameDataUrl}
        initialCorners={capture.detectedCorners}
        outputWidth={capture.width}
        outputHeight={capture.height}
        onConfirm={handleCropConfirm}
        onCancel={() => {
          // On avait déjà un résultat auto-cropé valide : on y revient simplement.
          // Sinon (l'auto avait échoué), il n'y a rien à revoir : on reprend la photo.
          if (croppedDataUrl) setCropOpen(false);
          else onRetake();
        }}
      />
    );
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-page">
      <div className="relative flex-1 flex items-center justify-center overflow-hidden p-4">
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Page scannée"
            className="max-h-full max-w-full rounded-xl border border-line object-contain shadow-sm"
            style={{ opacity: rendering ? 0.6 : 1, transition: "opacity 120ms" }}
          />
        )}
      </div>

      <div className="flex items-center justify-center gap-2 px-6 pb-3">
        <button
          onClick={() => setCropOpen(true)}
          className="flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-xs font-medium text-ink-dim"
        >
          <Crop size={14} />
          Ajuster le cadrage
        </button>
        <button
          onClick={handleRotate}
          disabled={rotating}
          className="flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-xs font-medium text-ink-dim disabled:opacity-50"
        >
          <RotateCw size={14} />
          Pivoter
        </button>
      </div>

      <div className="flex justify-center gap-2 px-6 pb-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === f.id
                ? "bg-accent text-accent-ink"
                : "border border-line bg-card text-ink-dim"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3 px-6 pb-10">
        <button
          onClick={onRetake}
          className="flex-1 rounded-2xl border border-line bg-card py-4 text-sm font-semibold text-ink"
        >
          Reprendre
        </button>
        <button
          onClick={() =>
            croppedDataUrl && onConfirm(croppedDataUrl, filter, dimensions.width, dimensions.height)
          }
          disabled={!croppedDataUrl}
          className="flex-[2] rounded-2xl bg-accent py-4 text-sm font-bold text-accent-ink disabled:opacity-50"
        >
          Garder cette page
        </button>
      </div>
    </div>
  );
                   }
