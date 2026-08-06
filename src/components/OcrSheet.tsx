"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Loader2 } from "lucide-react";
import { runOcr } from "@/lib/ocr";

interface OcrSheetProps {
  open: boolean;
  onClose: () => void;
  imageDataUrl: string;
}

type Status = "idle" | "running" | "done" | "error";

export default function OcrSheet({ open, onClose, imageDataUrl }: OcrSheetProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    Promise.resolve().then(() => {
      if (!cancelled) {
        setStatus("running");
        setProgress(0);
        setText("");
        setCopied(false);
      }
    });

    runOcr(imageDataUrl, (p, s) => {
      if (!cancelled && s === "recognizing text") setProgress(p);
    })
      .then((result) => {
        if (cancelled) return;
        setText(result);
        setStatus("done");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [open, imageDataUrl]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // silencieux : le presse-papiers peut être refusé selon le contexte, pas bloquant
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/50">
      <button className="absolute inset-0" aria-label="Fermer" onClick={onClose} />

      <div className="relative z-10 flex max-h-[80vh] flex-col rounded-t-3xl border-t border-line bg-card pb-6 shadow-2xl">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line" />

        <div className="flex items-center justify-between px-6 pt-4">
          <h2 className="font-semibold text-ink">Texte extrait</h2>
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
                  : "Préparation du moteur OCR…"}
              </p>
              <p className="px-6 text-xs text-ink-dim">
                Premier lancement un peu plus long (téléchargement du moteur), les
                suivants seront plus rapides.
              </p>
            </div>
          )}

          {status === "error" && (
            <p className="py-10 text-center text-sm text-danger">
              L&apos;extraction a échoué. Vérifie ta connexion et réessaie.
            </p>
          )}

          {status === "done" &&
            (text.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-dim">
                Aucun texte détecté sur cette page.
              </p>
            ) : (
              <p className="whitespace-pre-wrap pb-4 text-sm text-ink">{text}</p>
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
