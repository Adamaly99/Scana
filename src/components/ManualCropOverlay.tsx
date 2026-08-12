"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { warpToCorners, type Corners } from "@/lib/paper-detect";

interface PctPoint {
  xPct: number;
  yPct: number;
}

interface PctCorners {
  topLeftCorner: PctPoint;
  topRightCorner: PctPoint;
  bottomLeftCorner: PctPoint;
  bottomRightCorner: PctPoint;
}

type CornerKey = keyof PctCorners;

const CORNER_ORDER: CornerKey[] = [
  "topLeftCorner",
  "topRightCorner",
  "bottomRightCorner",
  "bottomLeftCorner",
];

/** Rectangle par défaut (marge de 10%) quand aucune détection auto n'est disponible. */
const DEFAULT_CORNERS: PctCorners = {
  topLeftCorner: { xPct: 10, yPct: 10 },
  topRightCorner: { xPct: 90, yPct: 10 },
  bottomLeftCorner: { xPct: 10, yPct: 90 },
  bottomRightCorner: { xPct: 90, yPct: 90 },
};

function clampPct(v: number): number {
  return Math.min(100, Math.max(0, v));
}

function pixelCornersToPct(corners: Corners, naturalW: number, naturalH: number): PctCorners {
  const toPct = (p: { x: number; y: number }) => ({
    xPct: clampPct((p.x / naturalW) * 100),
    yPct: clampPct((p.y / naturalH) * 100),
  });
  return {
    topLeftCorner: toPct(corners.topLeftCorner),
    topRightCorner: toPct(corners.topRightCorner),
    bottomLeftCorner: toPct(corners.bottomLeftCorner),
    bottomRightCorner: toPct(corners.bottomRightCorner),
  };
}

interface ManualCropOverlayProps {
  /** Photo brute complète (jamais recadrée), sur laquelle on ajuste les 4 coins */
  rawFrameDataUrl: string;
  /** Coins auto-détectés en pixels de l'image brute — null si l'auto-détection a échoué */
  initialCorners: Corners | null;
  outputWidth: number;
  outputHeight: number;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

export default function ManualCropOverlay({
  rawFrameDataUrl,
  initialCorners,
  outputWidth,
  outputHeight,
  onConfirm,
  onCancel,
}: ManualCropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [corners, setCorners] = useState<PctCorners>(DEFAULT_CORNERS);
  const [processing, setProcessing] = useState(false);

  // Une fois les dimensions réelles de la photo connues, on convertit les coins
  // auto-détectés (en pixels) vers le pourcentage utilisé par l'affichage.
  useEffect(() => {
    if (!naturalSize) return;
    if (initialCorners) {
      const converted = pixelCornersToPct(initialCorners, naturalSize.w, naturalSize.h);
      Promise.resolve().then(() => setCorners(converted));
    }
  }, [naturalSize, initialCorners]);

  const updateCorner = (key: CornerKey, clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const xPct = clampPct(((clientX - rect.left) / rect.width) * 100);
    const yPct = clampPct(((clientY - rect.top) / rect.height) * 100);
    setCorners((prev) => ({ ...prev, [key]: { xPct, yPct } }));
  };

  const handleReset = () => {
    if (!naturalSize) return;
    setCorners(
      initialCorners ? pixelCornersToPct(initialCorners, naturalSize.w, naturalSize.h) : DEFAULT_CORNERS
    );
  };

  const handleConfirm = async () => {
    if (!naturalSize || processing) return;
    setProcessing(true);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Impossible de charger l'image."));
        img.src = rawFrameDataUrl;
      });

      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = naturalSize.w;
      sourceCanvas.height = naturalSize.h;
      const ctx = sourceCanvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponible.");
      ctx.drawImage(img, 0, 0);

      const pixelCorners: Corners = {
        topLeftCorner: {
          x: (corners.topLeftCorner.xPct / 100) * naturalSize.w,
          y: (corners.topLeftCorner.yPct / 100) * naturalSize.h,
        },
        topRightCorner: {
          x: (corners.topRightCorner.xPct / 100) * naturalSize.w,
          y: (corners.topRightCorner.yPct / 100) * naturalSize.h,
        },
        bottomLeftCorner: {
          x: (corners.bottomLeftCorner.xPct / 100) * naturalSize.w,
          y: (corners.bottomLeftCorner.yPct / 100) * naturalSize.h,
        },
        bottomRightCorner: {
          x: (corners.bottomRightCorner.xPct / 100) * naturalSize.w,
          y: (corners.bottomRightCorner.yPct / 100) * naturalSize.h,
        },
      };

      const resultCanvas = warpToCorners(sourceCanvas, pixelCorners, outputWidth, outputHeight);
      const dataUrl = resultCanvas.toDataURL("image/jpeg", 0.92);
      onConfirm(dataUrl);
    } catch {
      // Échec silencieux : on reste sur l'écran d'ajustement, l'utilisateur peut réessayer.
    } finally {
      setProcessing(false);
    }
  };

  const polygonPoints = CORNER_ORDER.map((k) => `${corners[k].xPct},${corners[k].yPct}`).join(" ");

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={onCancel}
          aria-label="Annuler"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <X size={18} />
        </button>
        <p className="text-sm font-medium text-white">Ajuste les 4 coins du document</p>
        <button
          onClick={handleReset}
          aria-label="Réinitialiser le cadrage"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        <div ref={containerRef} className="relative touch-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={rawFrameDataUrl}
            alt="Photo brute à recadrer"
            className="block max-h-[60vh] max-w-full select-none"
            draggable={false}
            onLoad={(e) => {
              const el = e.currentTarget;
              setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
            }}
          />

          {naturalSize && (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <polygon
                points={polygonPoints}
                fill="rgba(37,99,235,0.25)"
                stroke="#2563eb"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}

          {naturalSize &&
            CORNER_ORDER.map((key) => (
              <div
                key={key}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  updateCorner(key, e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    updateCorner(key, e.clientX, e.clientY);
                  }
                }}
                style={{ left: `${corners[key].xPct}%`, top: `${corners[key].yPct}%` }}
                className="absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-[3px] border-white bg-accent shadow-lg"
              />
            ))}
        </div>
      </div>

      <div className="px-6 pb-10 pt-2">
        <button
          onClick={handleConfirm}
          disabled={!naturalSize || processing}
          className="w-full rounded-2xl bg-accent py-4 text-sm font-bold text-accent-ink disabled:opacity-50"
        >
          {processing ? "Traitement…" : "Valider le recadrage"}
        </button>
      </div>
    </div>
  );
}
