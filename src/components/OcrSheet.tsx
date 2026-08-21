"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, ShieldCheck } from "lucide-react";
import { createOcrCacheKey, getLocalOcrResult, saveLocalOcrResult } from "@/lib/local-db";
import { runOcr } from "@/lib/ocr";

interface OcrSheetProps {
  open: boolean;
  onClose: () => void;
  imageDataUrl: string;
  pageId: string;
  filter: string;
  width: number;
  height: number;
}

type Status = "idle" | "running" | "done" | "error";

export default function OcrSheet({
  open,
  onClose,
  imageDataUrl,
  pageId,
  filter,
  width,
  height,
}: OcrSheetProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let cancelled = false;
    const cacheKey = createOcrCacheKey(filter, width, height);

    Promise.resolve().then(() => {
      if (!cancelled) {
        setStatus("running");
        setProgress(0);
        setText("");
        setConfidence(null);
        setErrorMessage(null);
        setCopied(false);
      }
    });

    (async () => {
      try {
        const cached = await getLocalOcrResult(pageId, cacheKey);
        if (cached) {
          if (!cancelled) {
            setText(cached.text);
            setConfidence(cached.confidence);
            setProgress(1);
            setStatus("done");
          }
          return;
        }

        const result = await runOcr(imageDataUrl, {
          signal: controller.signal,
          onProgress: (value, stage) => {
            if (!cancelled && stage === "recognizing text") setProgress(value);
          },
        });

        await saveLocalOcrResult({
          pageId,
          cacheKey,
          text: result.text,
          confidence: result.confidence,
          language: "fra+eng",
          processedAt: Date.now(),
        });

        if (!cancelled) {
          setText(result.text);
          setConfidence(result.confidence);
          setProgress(1);
          setStatus("done");
        }
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        setErrorMessage(
          error instanceof Error && error.message
            ? error.message
            : "Le moteur OCR local n’a pas pu terminer la lecture.",
        );
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, imageDataUrl, pageId, filter, width, height, retryToken]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setErrorMessage("Le presse-papiers n’est pas disponible dans ce navigateur.");
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/50">
      <button className="absolute inset-0" aria-label="Fermer" onClick={onClose} />

      <div className="relative z-10 flex max-h-[80vh] flex-col rounded-t-3xl border-t border-line bg-card pb-6 shadow-2xl">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line" />

        <div className="flex items-center justify-between px-6 pt-4">
          <div>
            <h2 className="font-semibold text-ink">Texte extrait</h2>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-dim">
              <ShieldCheck size={12} className="text-accent" />
              Traitement local, aucune image envoyée
            </p>
          </div>
          <button onClick={onClose} className="text-sm text-ink-dim">
            Fermer
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pt-4">
          {status === "running" && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2 size={24} className="animate-spin text-accent" />
              <p className="text-sm text-ink-dim">
                {progress > 0
                  ? `Lecture du texte… ${Math.round(progress * 100)}%`
                  : "Préparation du moteur OCR local…"}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-raised">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-150"
                  style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
                />
              </div>
              <p className="px-6 text-xs text-ink-dim">
                Le premier lancement peut être plus long. Le moteur et les modèles sont ensuite
                conservés par le navigateur.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="py-10 text-center">
              <p className="text-sm text-danger">{errorMessage}</p>
              <button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setRetryToken((value) => value + 1);
                }}
                className="mt-4 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
              >
                Fermer et réessayer
              </button>
            </div>
          )}

          {status === "done" &&
            (text.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-dim">
                Aucun texte détecté sur cette page.
              </p>
            ) : (
              <>
                {confidence !== null && (
                  <p className="mb-3 text-xs text-ink-dim">
                    Confiance moyenne : {Math.round(confidence)} % · Résultat conservé localement
                  </p>
                )}
                <p className="whitespace-pre-wrap pb-4 text-sm text-ink">{text}</p>
              </>
            ))}
        </div>

        {status === "done" && text.length > 0 && (
          <div className="px-6 pt-2">
            <button
              onClick={handleCopy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-sm font-bold text-accent-ink"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copié !" : "Copier le texte"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
