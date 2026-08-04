"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { ScanDocument } from "@/lib/store";
import { downloadDocumentPdf } from "@/lib/pdf-export";
import { formatDate } from "@/lib/format";

interface DocumentCardProps {
  document: ScanDocument;
  onDelete?: () => void;
}

export default function DocumentCard({ document, onDelete }: DocumentCardProps) {
  const [downloading, setDownloading] = useState(false);

  const handlePress = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadDocumentPdf(document);
    } catch {
      // Échec silencieux : l'utilisateur peut retenter, pas bloquant.
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-2xl border border-line bg-card p-3">
      <button
        onClick={handlePress}
        disabled={downloading}
        className="flex flex-1 items-center gap-3 text-left disabled:opacity-60"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={document.pages[0]?.rawDataUrl}
          alt=""
          className="h-14 w-11 rounded-md border border-line object-cover"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{document.name}</span>
          <span className="block text-xs text-ink-dim">
            {formatDate(document.createdAt)} · {document.pages.length} page
            {document.pages.length > 1 ? "s" : ""}
          </span>
        </span>
        <span className="shrink-0 rounded-md bg-raised px-2 py-1 text-[10px] font-bold text-ink-dim">
          {downloading ? "…" : "PDF"}
        </span>
      </button>

      {onDelete && (
        <button
          onClick={onDelete}
          aria-label={`Supprimer ${document.name}`}
          className="shrink-0 rounded-full p-2.5 text-ink-dim active:bg-raised"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
