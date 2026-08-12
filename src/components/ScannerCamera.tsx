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

export default function ScannerCamera({ onCapture }: ScannerCameraProps) {
  const { status: cvStatus, errorMessage: cvError } = useOpenCv();
  const quality = useScanStore((s) => s.quality);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const workingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const detectionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectionBusyRef = useRef(false);
  const lastCornersRef = useRef<Corners | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const isStableRef = useRef(false);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("requesting");
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [isStable, setIsStable] = useState(false);

  // 1. Démarre la caméra dès le montage (en parallèle du chargement d'OpenCV)
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (typeof window === "undefined") return;

      if (!window.isSecureContext) {
        throw Object.assign(new Error("insecure"), { code: "insecure" as const });
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error("unsupported"), { code: "unsupported" as const });
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraStatus("granted");
    };

    start().catch((err: Error & { code?: string }) => {
      if (cancelled) return;
      if (err.code === "insecure") {
        setCameraStatus("unsupported");
        setCameraErrorMsg(
          "La caméra nécessite une connexion HTTPS (ou localhost). Déploie sur Vercel ou teste en localhost."
        );
      } else if (err.code === "unsupported") {
        setCameraStatus("unsupported");
        setCameraErrorMsg("Ce navigateur ne supporte pas l'accès caméra.");
      } else {
        setCameraStatus("denied");
        setCameraErrorMsg(
          err.name === "NotAllowedError"
            ? "Accès caméra refusé. Autorise la caméra dans les réglages du navigateur."
            : "Impossible d'accéder à la caméra sur cet appareil."
        );
      }
    });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // 2. Instancie jscanify une fois OpenCV prêt
  useEffect(() => {
    if (cvStatus !== "ready") return;
    let active = true;
    import("jscanify/client").then(({ default: JScanify }) => {
      if (active) scannerRef.current = new JScanify();
    });
    return () => {
      active = false;
    };
  }, [cvStatus]);

  // 3. Boucle de détection live (throttled) — dessine juste le contour sur un calque
  // transparent superposé à la vidéo. La vidéo elle-même reste toujours fluide,
  // indépendamment du rythme de détection.
  useEffect(() => {
    if (cvStatus !== "ready" || cameraStatus !== "granted") return;

    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!video || !overlayCanvas) return;

    const tick = () => {
      // Empêche les détections de s'empiler si un appareil est trop lent pour suivre
      // le rythme des 250ms — c'était la cause probable des formes qui s'affolent.
      if (detectionBusyRef.current) return;

      const scanner = scannerRef.current;
      if (!scanner || video.readyState < video.HAVE_CURRENT_DATA) return;
      if (!video.videoWidth || !video.videoHeight) return;

      const scale = PREVIEW_MAX_WIDTH / video.videoWidth;
      const w = PREVIEW_MAX_WIDTH;
      const h = Math.round(video.videoHeight * scale);

      if (!workingCanvasRef.current) {
        workingCanvasRef.current = document.createElement("canvas");
      }
      const working = workingCanvasRef.current;
      working.width = w;
      working.height = h;
      const workingCtx = working.getContext("2d");
      if (!workingCtx) return;
      workingCtx.drawImage(video, 0, 0, w, h);

      // Le calque transparent doit avoir la même résolution interne que le canvas
      // d'analyse pour que les coordonnées du contour tombent au bon endroit —
      // redimensionner efface le canvas, donc on ne le fait que si ça a changé.
      if (overlayCanvas.width !== w || overlayCanvas.height !== h) {
        overlayCanvas.width = w;
        overlayCanvas.height = h;
      }

      detectionBusyRef.current = true;
      try {
        const corners = highlightPaperStable(scanner, working, overlayCanvas, {
          color: ACCENT_COLOR,
          thickness: 4,
        });

        const now = Date.now();

        if (!corners) {
          // Rien détecté cette frame : le minuteur de stabilité repart de zéro.
          lastCornersRef.current = null;
          stableSinceRef.current = null;
          if (isStableRef.current) {
            isStableRef.current = false;
            setIsStable(false);
          }
        } else {
          const last = lastCornersRef.current;
          const closeEnough = last && cornersAreClose(last, corners, STABILITY_TOLERANCE_PX);

          if (!closeEnough) {
            // Le contour a "sauté" (ou c'est la première détection) : redémarre le minuteur.
            stableSinceRef.current = now;
          }
          lastCornersRef.current = corners;

          const stableDuration = now - (stableSinceRef.current ?? now);
          const nowStable = stableDuration >= STABILITY_DURATION_MS;
          if (nowStable !== isStableRef.current) {
            isStableRef.current = nowStable;
            setIsStable(nowStable);
          }
        }
      } catch {
        // Une frame ratée ne doit jamais casser la boucle de détection.
      } finally {
        detectionBusyRef.current = false;
      }
    };

    detectionTimerRef.current = setInterval(tick, DETECTION_INTERVAL_MS);
    return () => {
      if (detectionTimerRef.current) clearInterval(detectionTimerRef.current);
      // Repart de zéro à chaque (re)montage de la boucle (ex: retour sur l'écran caméra).
      lastCornersRef.current = null;
      stableSinceRef.current = null;
      isStableRef.current = false;
      setIsStable(false);
    };
  }, [cvStatus, cameraStatus]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const scanner = scannerRef.current;
    if (!video || !scanner || capturing) return;
    if (!video.videoWidth || !video.videoHeight) return;

    setCapturing(true);
    setCaptureNotice(null);
    lastCornersRef.current = null;
    stableSinceRef.current = null;
    isStableRef.current = false;
    setIsStable(false);

    // Petite pause pour laisser l'UI afficher l'état "capturing" avant le calcul (peut prendre qq centaines de ms)
    requestAnimationFrame(() => {
      try {
        const fullCanvas = document.createElement("canvas");
        fullCanvas.width = video.videoWidth;
        fullCanvas.height = video.videoHeight;
        const ctx = fullCanvas.getContext("2d");
        if (!ctx) throw new Error("Canvas indisponible");
        ctx.drawImage(video, 0, 0);

        // La photo brute est TOUJOURS conservée — c'est elle qui permet le recadrage
        // manuel si l'auto-détection échoue ou tombe à côté.
        const rawFrameDataUrl = fullCanvas.toDataURL("image/jpeg", 0.92);
        const { width: outputWidth, height: outputHeight } = OUTPUT_DIMENSIONS[quality];

        const corners = detectCorners(scanner, fullCanvas);

        if (!corners) {
          // Plus de cul-de-sac "réessaie" : on part quand même en review, avec
          // un recadrage manuel à faire (aucun contour n'a pu servir de point de départ).
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
        setCaptureNotice("La capture a échoué. Réessaie.");
      } finally {
        setCapturing(false);
      }
    });
  }, [capturing, onCapture, quality]);

  const isLoading = cvStatus === "loading" || cameraStatus === "requesting";
  const hasBlockingError =
    cvStatus === "error" || cameraStatus === "denied" || cameraStatus === "unsupported";

  return (
    <div className="relative flex-1 flex flex-col bg-camera-bg">
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="block max-h-full max-w-full rounded-2xl"
          />
          <canvas
            ref={overlayCanvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full rounded-2xl"
          />
        </div>

        {isLoading && !hasBlockingError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-camera-bg">
            <div className="h-8 w-8 rounded-full border-2 border-camera-line border-t-accent animate-spin" />
            <p className="text-xs font-medium text-camera-ink-dim tracking-wide">
              {cvStatus !== "ready" ? "CHARGEMENT DU MOTEUR DE SCAN…" : "ACCÈS CAMÉRA…"}
            </p>
          </div>
        )}

        {hasBlockingError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-camera-bg px-8 text-center">
            <p className="text-camera-ink font-semibold">Oups.</p>
            <p className="text-sm text-camera-ink-dim">{cameraErrorMsg ?? cvError}</p>
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
          onClick={handleCapture}
          disabled={isLoading || hasBlockingError || capturing}
          aria-label={isStable ? "Document stable, capturer" : "Capturer le document"}
          className={`relative h-20 w-20 rounded-full border-4 border-camera-ink/80 transition duration-200 disabled:cursor-not-allowed disabled:opacity-30 active:scale-95 ${
            isStable ? "bg-success" : "bg-accent"
          }`}
        >
          {capturing && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="h-6 w-6 rounded-full border-2 border-accent-ink border-t-transparent animate-spin" />
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
