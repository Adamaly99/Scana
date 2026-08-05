"use client";

import { useState } from "react";
import { Share2, Download } from "lucide-react";
import type { ScanDocument, ScannedPage } from "@/lib/store";
import { buildPdfFromPages, sanitizeFilename, uint8ArrayToBlob } from "@/lib/pdf-export";
import { applyFilterToDataUrl } from "@/lib/filters";
import { shareOrDownload, downloadBlob } from "@/lib/share";

type ExportFormat = "pdf" | "jpg" | "png";

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  document: ScanDocument;
  /** Page actuellement affichée — nécessaire pour un export JPG/PNG (page unique) */
  currentPage?: ScannedPage;
}

const FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: "pdf", label: "PDF", hint: "Document complet" },
  { id: "jpg", label: "JPG", hint: "Page actuelle" },
  { id: "png", label: "PNG", hint: "Page actuelle" },
];

async function buildExport(
  document: ScanDocument,
  format: ExportFormat,
  currentPage: ScannedPage | undefined
): Promise<{ blob: Blob; filename: string; mime: string }> {
  const baseName = sanitizeFilename(document.name);

  if (format === "pdf") {
    const bytes = await buildPdfFromPages(document.pages);
    return { blob: uint8ArrayToBlob(bytes, "application/pdf"), filename: `${baseName}.pdf`, mime: "application/pdf" };
  }

  if (!currentPage) {
    throw new Error("Aucune page sélectionnée.");
  }

  const mime = format === "jpg" ? "image/jpeg" : "image/png";
  const dataUrl = await applyFilterToDataUrl(
    currentPage.rawDataUrl,
    currentPage.filter,
    format === "jpg" ? "jpeg" : "png"
  );
  const blob = await (await fetch(dataUrl)).blob();
  return { blob, filename: `${baseName}.${format}`, mime };
}

export default function ShareSheet({ open, onClose, document, currentPage }: ShareSheetProps) {
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { blob, filename, mime } = await buildExport(document, format, currentPage);
      await shareOrDownload(blob, filename, mime);
      onClose();
    } catch {
      setError("L'export a échoué. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { blob, filename } = await buildExport(document, format, currentPage);
      downloadBlob(blob, filename);
      onClose();
    } catch {
      setError("L'export a échoué. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/50">
      <button className="absolute inset-0" aria-label="Fermer" onClick={onClose} />

      <div className="relative z-10 rounded-t-3xl border-t border-line bg-card pb-8 shadow-2xl">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line" />

        <div className="flex items-center justify-between px-6 pt-4">
          <h2 className="font-semibold text-ink">Partager le document</h2>
          <button onClick={onClose} className="text-sm text-ink-dim">
            Fermer
          </button>
        </div>

        <p className="px-6 pb-2 pt-4 text-xs font-medium text-ink-dim">EXPORTER EN</p>
        <div className="flex gap-2 px-6">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`flex-1 rounded-xl border px-3 py-3 text-center ${
                format === f.id ? "border-accent bg-accent/10" : "border-line bg-card"
              }`}
            >
              <span
                className={`block text-sm font-bold ${
                  format === f.id ? "text-accent" : "text-ink"
                }`}
              >
                {f.label}
              </span>
              <span className="block text-[10px] text-ink-dim">{f.hint}</span>
            </button>
          ))}
        </div>

        {error && <p className="px-6 pt-3 text-center text-sm text-danger">{error}</p>}

        <div className="flex gap-3 px-6 pt-6">
          <button
            onClick={handleDownload}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-card py-4 text-sm font-semibold text-ink disabled:opacity-50"
          >
            <Download size={16} /> Télécharger
          </button>
          <button
            onClick={handleShare}
            disabled={busy}
            className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-sm font-bold text-accent-ink disabled:opacity-50"
          >
            <Share2 size={16} /> {busy ? "Préparation…" : "Partager"}
          </button>
        </div>
      </div>
    </div>
  );
}
