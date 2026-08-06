"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOpenCv } from "@/hooks/useOpenCv";
import {
  ACCENT_COLOR,
  DETECTION_INTERVAL_MS,
  OUTPUT_HEIGHT,
  OUTPUT_WIDTH,
  PREVIEW_MAX_WIDTH,
} from "@/lib/constants";
import { enhanceDocument } from "@/lib/enhance";

type CameraStatus = "requesting" | "granted" | "denied" | "unsupported";

interface ScannerCameraProps {
  onCapture: (dataUrl: string, width: number, height: number) => void;
}

export default function ScannerCamera({ onCapture }: ScannerCameraProps) {
  const { status: cvStatus, errorMessage: cvError } = useOpenCv();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const workingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const detectionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("requesting");
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);

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

  // 3. Boucle de détection live (throttled) — dessine le contour détecté sur le canvas visible
  useEffect(() => {
    if (cvStatus !== "ready" || cameraStatus !== "granted") return;

    const video = videoRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!video || !previewCanvas) return;

    const tick = () => {
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

      try {
        const highlighted = scanner.highlightPaper(working, {
          color: ACCENT_COLOR,
          thickness: 4,
        });
        previewCanvas.width = w;
        previewCanvas.height = h;
        const previewCtx = previewCanvas.getContext("2d");
        previewCtx?.drawImage(highlighted, 0, 0);
      } catch {
        // Une frame ratée ne doit jamais casser la boucle de détection.
      }
    };

    detectionTimerRef.current = setInterval(tick, DETECTION_INTERVAL_MS);
    return () => {
      if (detectionTimerRef.current) clearInterval(detectionTimerRef.current);
    };
  }, [cvStatus, cameraStatus]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const scanner = scannerRef.current;
    if (!video || !scanner || capturing) return;
    if (!video.videoWidth || !video.videoHeight) return;

    setCapturing(true);
    setCaptureNotice(null);

    // Petite pause pour laisser l'UI afficher l'état "capturing" avant le calcul (peut prendre qq centaines de ms)
    requestAnimationFrame(async () => {
      try {
        const fullCanvas = document.createElement("canvas");
        fullCanvas.width = video.videoWidth;
        fullCanvas.height = video.videoHeight;
        const ctx = fullCanvas.getContext("2d");
        if (!ctx) throw new Error("Canvas indisponible");
        ctx.drawImage(video, 0, 0);

        const extracted = scanner.extractPaper(fullCanvas, OUTPUT_WIDTH, OUTPUT_HEIGHT);

        if (!extracted) {
          setCaptureNotice("Aucun document détecté. Rapproche-toi et vérifie l'éclairage.");
          setCapturing(false);
          return;
        }

        const rawDataUrl = extracted.toDataURL("image/jpeg", 0.92);
        // Améliorer automatiquement la qualité du scan (débruite + contraste)
        const enhancedDataUrl = await enhanceDocument(rawDataUrl);
        onCapture(enhancedDataUrl, OUTPUT_WIDTH, OUTPUT_HEIGHT);
      } catch {
        setCaptureNotice("La capture a échoué. Réessaie.");
      } finally {
        setCapturing(false);
      }
    });
  }, [capturing, onCapture]);

  const isLoading = cvStatus === "loading" || cameraStatus === "requesting";
  const hasBlockingError =
    cvStatus === "error" || cameraStatus === "denied" || cameraStatus === "unsupported";

  return (
    <div className="relative flex-1 flex flex-col bg-camera-bg">
      {/* Flux vidéo caché — sert uniquement de source pour le canvas de prévisualisation */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="hidden"
      />

      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <canvas
          ref={previewCanvasRef}
          className="max-h-full max-w-full rounded-2xl"
        />

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
          aria-label="Capturer le document"
          className="relative h-20 w-20 rounded-full border-4 border-camera-ink/80 bg-accent disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-transform"
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
