"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Crop,
  RotateCw,
} from "lucide-react";

import {
  rotateDataUrl90,
} from "@/lib/rotate";

import type {
  FilterType,
} from "@/lib/store";

import type {
  CaptureResult,
} from "@/components/ScannerCamera";

import ManualCropOverlay from "@/components/ManualCropOverlay";

import {
  useDebouncedFilter,
} from "@/hooks/useDebouncedFilter";

interface ReviewOverlayProps {
  capture: CaptureResult;

  onConfirm: (
    finalDataUrl: string,
    filter: FilterType,
    width: number,
    height: number
  ) => void | Promise<void>;

  onRetake: () => void;
}

const FILTERS: {
  id: FilterType;
  label: string;
}[] = [
  {
    id: "color",
    label: "Couleur",
  },
  {
    id: "gray",
    label: "Gris",
  },
  {
    id: "bw",
    label: "N&B",
  },
];

function getImageDimensions(
  dataUrl: string
): Promise<{
  width: number;
  height: number;
}> {
  return new Promise(
    (resolve, reject) => {
      const image =
        new Image();

      image.onload = () => {
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      };

      image.onerror = () => {
        reject(
          new Error(
            "Impossible de lire les dimensions de l'image."
          )
        );
      };

      image.src = dataUrl;
    }
  );
}

export default function ReviewOverlay({
  capture,
  onConfirm,
  onRetake,
}: ReviewOverlayProps) {
  const [
    croppedDataUrl,
    setCroppedDataUrl,
  ] = useState<string | null>(
    capture.croppedDataUrl
  );

  const [
    dimensions,
    setDimensions,
  ] = useState({
    width: capture.width,
    height: capture.height,
  });

  const [
    filter,
    setFilter,
  ] = useState<FilterType>(
    "color"
  );

  const [
    previewUrl,
    setPreviewUrl,
  ] = useState<string | null>(
    capture.croppedDataUrl
  );

  const [
    rendering,
    setRendering,
  ] = useState(false);

  const [
    rotating,
    setRotating,
  ] = useState(false);

  const [
    confirming,
    setConfirming,
  ] = useState(false);

  const [
    confirmError,
    setConfirmError,
  ] = useState<string | null>(
    null
  );

  const [
    cropOpen,
    setCropOpen,
  ] = useState(
    capture.croppedDataUrl === null
  );

  const {
    apply: applyDebouncedFilter,
  } = useDebouncedFilter();

  useEffect(() => {
    if (!croppedDataUrl) {
      setPreviewUrl(null);
      return;
    }

    let cancelled = false;
    let cleanup:
      | (() => void)
      | undefined;

    setRendering(true);

    cleanup =
      applyDebouncedFilter(
        filter,
        croppedDataUrl,
        (url) => {
          if (cancelled) {
            return;
          }

          setPreviewUrl(url);
          setRendering(false);
        },
        () => {
          if (cancelled) {
            return;
          }

          setPreviewUrl(
            croppedDataUrl
          );

          setRendering(false);
        }
      );

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [
    croppedDataUrl,
    filter,
    applyDebouncedFilter,
  ]);

  const handleCropConfirm =
    async (
      newCroppedDataUrl: string
    ) => {
      setCroppedDataUrl(
        newCroppedDataUrl
      );

      try {
        const size =
          await getImageDimensions(
            newCroppedDataUrl
          );

        setDimensions(size);
      } catch {
        setDimensions({
          width: capture.width,
          height: capture.height,
        });
      }

      setCropOpen(false);
    };

  const handleConfirm =
    async () => {
      if (
        !croppedDataUrl ||
        rendering ||
        rotating ||
        confirming
      ) {
        return;
      }

      setConfirming(true);
      setConfirmError(null);

      try {
        await onConfirm(
          croppedDataUrl,
          filter,
          dimensions.width,
          dimensions.height
        );
      } catch (error) {
        console.error(
          "Erreur sauvegarde page:",
          error
        );

        setConfirmError(
          "La page n’a pas pu être enregistrée. Vérifie l’espace disponible puis réessaie."
        );
      } finally {
        setConfirming(false);
      }
    };

  const handleRotate =
    async () => {
      if (
        !croppedDataUrl ||
        rotating
      ) {
        return;
      }

      setRotating(true);

      try {
        const result =
          await rotateDataUrl90(
            croppedDataUrl,
            "cw"
          );

        setCroppedDataUrl(
          result.dataUrl
        );

        setDimensions({
          width: result.width,
          height: result.height,
        });
      } catch (error) {
        console.error(
          "Erreur rotation:",
          error
        );
      } finally {
        setRotating(false);
      }
    };

  if (cropOpen) {
    return (
      <ManualCropOverlay
        rawFrameDataUrl={
          capture.rawFrameDataUrl
        }
        initialCorners={
          capture.detectedCorners
        }
        outputWidth={
          capture.width
        }
        outputHeight={
          capture.height
        }
        onConfirm={
          handleCropConfirm
        }
        onCancel={() => {
          if (croppedDataUrl) {
            setCropOpen(false);
          } else {
            onRetake();
          }
        }}
      />
    );
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-page">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Page scannée"
            className="max-h-full max-w-full rounded-xl border border-line object-contain shadow-sm"
            style={{
              opacity:
                rendering
                  ? 0.6
                  : 1,
              transition:
                "opacity 120ms",
            }}
          />
        )}

        {!previewUrl &&
          !rendering && (
            <p className="text-sm text-ink-dim">
              Aperçu indisponible.
            </p>
          )}
      </div>

      <div className="flex items-center justify-center gap-2 px-6 pb-3">
        <button
          type="button"
          onClick={() =>
            setCropOpen(true)
          }
          className="flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-xs font-medium text-ink-dim"
        >
          <Crop size={14} />
          Ajuster le cadrage
        </button>

        <button
          type="button"
          onClick={handleRotate}
          disabled={
            rotating ||
            !croppedDataUrl
          }
          className="flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-xs font-medium text-ink-dim disabled:opacity-50"
        >
          <RotateCw size={14} />
          {rotating
            ? "Rotation…"
            : "Pivoter"}
        </button>
      </div>

      {confirmError && (
        <p
          className="px-6 pb-2 text-center text-sm text-danger"
          role="alert"
        >
          {confirmError}
        </p>
      )}

      <div className="flex justify-center gap-2 px-6 pb-4">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() =>
              setFilter(item.id)
            }
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === item.id
                ? "bg-accent text-accent-ink"
                : "border border-line bg-card text-ink-dim"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3 px-6 pb-10">
        <button
          type="button"
          onClick={onRetake}
          className="flex-1 rounded-2xl border border-line bg-card py-4 text-sm font-semibold text-ink"
        >
          Reprendre
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={
            !croppedDataUrl ||
            rendering ||
            rotating ||
            confirming
          }
          className="flex-[2] rounded-2xl bg-accent py-4 text-sm font-bold text-accent-ink disabled:opacity-50"
        >
          {confirming
            ? "Enregistrement…"
            : rendering
              ? "Préparation…"
              : "Garder cette page"}
        </button>
      </div>
    </div>
  );
}