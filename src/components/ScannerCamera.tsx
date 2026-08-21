"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOpenCv } from "@/hooks/useOpenCv";
import {
  ACCENT_COLOR,
  DETECTION_INTERVAL_MS,
  JPEG_QUALITY,
  OUTPUT_DIMENSIONS,
  PREVIEW_MAX_WIDTH,
  STABILITY_DURATION_MS,
  STABILITY_TOLERANCE_PX,
} from "@/lib/constants";
import {
  cornersAreClose,
  detectCorners,
  highlightPaperStable,
  warpToCorners,
  type Corners,
} from "@/lib/paper-detect";
import { useScanStore } from "@/lib/store";

export interface CaptureResult {
  /** Résultat auto-recadré (ou null si aucun document n'a pu être détecté) */
  croppedDataUrl: string | null;
  /** Photo brute complète, jamais jetée — permet le recadrage manuel */
  rawFrameDataUrl: string;
  /** Coins auto-détectés (pré-remplissent l'ajustement manuel), null si échec */
  detectedCorners: Corners | null;
  width: number;
  height: number;
}

type CameraStatus = "requesting" | "granted" | "denied" | "unsupported";

interface ScannerCameraProps {
  onCapture: (result: CaptureResult) => void;
}

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  switch (name) {
    case "NotAllowedError":
      return "L’accès à la caméra est refusé. Autorise la caméra pour ce site dans les réglages du navigateur, puis réessaie.";
    case "NotFoundError":
      return "Aucune caméra disponible sur cet appareil. Vérifie qu’une caméra est bien connectée et réessaie.";
    case "NotReadableError":
      return "La caméra est déjà utilisée par une autre application. Ferme-la, puis réessaie.";
    case "OverconstrainedError":
      return "La caméra ne prend pas en charge les réglages demandés. Nous allons réessayer avec un mode compatible.";
    case "SecurityError":
      return "Le navigateur bloque l’accès caméra. Ouvre Scana depuis son adresse HTTPS officielle.";
    default:
      return "Impossible d’accéder à la caméra. Vérifie les permissions du navigateur et réessaie.";
  }
}

export default function ScannerCamera({ onCapture }: ScannerCameraProps) {
  const { status: cvStatus, errorMessage: cvError } = useOpenCv();
  const quality = useScanStore((s) => s.quality);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const workingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDetectionAtRef = useRef(0);
  const detectionBusyRef = useRef(false);
  const capturingRef = useRef(false);
  const lastCornersRef = useRef<Corners | null>(null);
  const displayedCornersRef = useRef<Corners | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const isStableRef = useRef(false);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("requesting");
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [isStable, setIsStable] = useState(false);
  const [cameraAttempt, setCameraAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (typeof window === "undefined") return;
      setCameraStatus("requesting");
      setCameraErrorMsg(null);

      if (!window.isSecureContext) {
        throw Object.assign(new Error("insecure"), { code: "insecure" as const });
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error("unsupported"), { code: "unsupported" as const });
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        });
      } catch (error) {
        // Certains navigateurs refusent une contrainte de résolution trop ambitieuse.
        // Le second essai garde la caméra mobile fonctionnelle avec des contraintes minimales.
        if (error instanceof DOMException && error.name === "OverconstrainedError") {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
        } else {
          throw error;
        }
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraStatus("granted");
      setCameraErrorMsg(null);
    };

    start().catch((error: Error & { code?: string }) => {
      if (cancelled) return;
      if (error.code === "insecure") {
        setCameraStatus("unsupported");
        setCameraErrorMsg("La caméra nécessite une connexion HTTPS ou localhost.");
      } else if (error.code === "unsupported") {
        setCameraStatus("unsupported");
        setCameraErrorMsg("Ce navigateur ne supporte pas l’accès caméra.");
      } else {
        setCameraStatus("denied");
        setCameraErrorMsg(cameraErrorMessage(error));
      }
    });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraAttempt]);

  useEffect(() => {
    if (cvStatus !== "ready") return;
    let active = true;
    import("jscanify/client").then(({ default: JScanify }) => {
      if (active) scannerRef.current = new JScanify();
    });
    return () => {
      active = false;
      scannerRef.current = null;
    };
  }, [cvStatus]);

  useEffect(() => {
    if (cvStatus !== "ready" || cameraStatus !== "granted") return;

    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!video || !overlayCanvas) return;

    let active = true;
    lastDetectionAtRef.current = 0;

    const detectFrame = (timestamp: number) => {
      if (!active) return;
      if (timestamp - lastDetectionAtRef.current >= DETECTION_INTERVAL_MS) {
        lastDetectionAtRef.current = timestamp;

        if (!detectionBusyRef.current && !capturingRef.current) {
          const scanner = scannerRef.current;
          if (scanner && video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth && video.videoHeight) {
            const width = Math.min(PREVIEW_MAX_WIDTH, video.videoWidth);
            const height = Math.max(1, Math.round(video.videoHeight * (width / video.videoWidth)));

            if (!workingCanvasRef.current) workingCanvasRef.current = document.createElement("canvas");
            const working = workingCanvasRef.current;
            working.width = width;
            working.height = height;
            const workingCtx = working.getContext("2d", { willReadFrequently: true });

            if (workingCtx) {
              workingCtx.drawImage(video, 0, 0, width, height);
              if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
                overlayCanvas.width = width;
                overlayCanvas.height = height;
              }

              detectionBusyRef.current = true;
              try {
                const corners = highlightPaperStable(scanner, working, overlayCanvas, {
                  color: ACCENT_COLOR,
                  thickness: 4,
                  previousCorners: displayedCornersRef.current,
                  smoothing: 0.35,
                });
                const now = performance.now();

                if (!corners) {
                  lastCornersRef.current = null;
                  displayedCornersRef.current = null;
                  stableSinceRef.current = null;
                  if (isStableRef.current) {
                    isStableRef.current = false;
                    setIsStable(false);
                  }
                } else {
                  displayedCornersRef.current = corners;
                  const previous = lastCornersRef.current;
                  const closeEnough = previous && cornersAreClose(previous, corners, STABILITY_TOLERANCE_PX);
                  if (!closeEnough) stableSinceRef.current = now;
                  lastCornersRef.current = corners;

                  const stableDuration = now - (stableSinceRef.current ?? now);
                  const nextStable = stableDuration >= STABILITY_DURATION_MS;
                  if (nextStable !== isStableRef.current) {
                    isStableRef.current = nextStable;
                    setIsStable(nextStable);
                  }
                }
              } catch {
                // Une frame OpenCV ratée ne doit jamais interrompre le flux vidéo.
              } finally {
                detectionBusyRef.current = false;
              }
            }
          }
        }
      }
      animationFrameRef.current = requestAnimationFrame(detectFrame);
    };

    animationFrameRef.current = requestAnimationFrame(detectFrame);
    return () => {
      active = false;
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      lastCornersRef.current = null;
      displayedCornersRef.current = null;
      stableSinceRef.current = null;
      isStableRef.current = false;
      setIsStable(false);
    };
  }, [cvStatus, cameraStatus]);

  const handleRetry = useCallback(() => {
    if (cvStatus === "error") {
      window.location.reload();
      return;
    }
    setCaptureNotice(null);
    setCameraAttempt((attempt) => attempt + 1);
  }, [cvStatus]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const scanner = scannerRef.current;
    if (!video || !scanner || capturingRef.current) return;
    if (!video.videoWidth || !video.videoHeight) return;

    capturingRef.current = true;
    setCapturing(true);
    setCaptureNotice(null);
    setIsStable(false);

    requestAnimationFrame(() => {
      try {
        const fullCanvas = document.createElement("canvas");
        fullCanvas.width = video.videoWidth;
        fullCanvas.height = video.videoHeight;
        const ctx = fullCanvas.getContext("2d");
        if (!ctx) throw new Error("Canvas indisponible");
        ctx.drawImage(video, 0, 0);

        const rawFrameDataUrl = fullCanvas.toDataURL("image/jpeg", 0.92);
        const { width: outputWidth, height: outputHeight } = OUTPUT_DIMENSIONS[quality];
        const corners = detectCorners(scanner, fullCanvas);

        if (!corners) {
          onCapture({
            croppedDataUrl: null,
            rawFrameDataUrl,
            detectedCorners: null,
            width: outputWidth,
            height: outputHeight,
          });
          return;
        }

        const extracted = warpToCorners(fullCanvas, corners, outputWidth, outputHeight);
        const croppedDataUrl = extracted.toDataURL("image/jpeg", JPEG_QUALITY[quality]);
        onCapture({
          croppedDataUrl,
          rawFrameDataUrl,
          detectedCorners: corners,
          width: outputWidth,
          height: outputHeight,
        });
      } catch {
        setCaptureNotice("La capture a échoué. Réessaie ou utilise Ajuster le cadrage.");
      } finally {
        capturingRef.current = false;
        setCapturing(false);
      }
    });
  }, [onCapture, quality]);

  const isLoading = cvStatus === "loading" || cameraStatus === "requesting";
  const hasBlockingError = cvStatus === "error" || cameraStatus === "denied" || cameraStatus === "unsupported";
  const errorMessage = cvStatus === "error" ? cvError : cameraErrorMsg;

  return (
    <div className="relative flex flex-1 flex-col bg-camera-bg">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <div className="relative max-h-full max-w-full">
          <video ref={videoRef} autoPlay muted playsInline className="block max-h-full max-w-full rounded-2xl" />
          <canvas
            ref={overlayCanvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full rounded-2xl"
          />
        </div>

        {isLoading && !hasBlockingError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-camera-bg">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-camera-line border-t-accent" />
            <p className="text-xs font-medium tracking-wide text-camera-ink-dim">
              {cvStatus !== "ready" ? "CHARGEMENT DU MOTEUR DE SCAN…" : "ACCÈS CAMÉRA…"}
            </p>
          </div>
        )}

        {hasBlockingError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-camera-bg px-8 text-center">
            <p className="font-semibold text-camera-ink">Accès caméra indisponible</p>
            <p className="text-sm text-camera-ink-dim">{errorMessage ?? "Une erreur est survenue."}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-accent-ink active:scale-95"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>

      {captureNotice && (
        <div className="mx-6 mb-3 rounded-xl border border-camera-line bg-camera-surface px-4 py-2 text-center text-sm text-camera-ink-dim">
          {captureNotice}
        </div>
      )}

      <div className="flex items-center justify-center pb-10 pt-4">
        <button
          type="button"
          onClick={handleCapture}
          disabled={isLoading || hasBlockingError || capturing}
          aria-label={isStable ? "Document stable, capturer" : "Capturer le document"}
          className={`relative h-20 w-20 rounded-full border-4 border-camera-ink/80 transition duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 ${
            isStable ? "bg-success" : "bg-accent"
          }`}
        >
          {capturing && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent-ink border-t-transparent" />
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
