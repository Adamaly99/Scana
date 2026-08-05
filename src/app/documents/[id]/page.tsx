"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2, Pencil, Check } from "lucide-react";
import { useScanStore, type FilterType } from "@/lib/store";
import { downloadDocumentPdf } from "@/lib/pdf-export";
import { applyFilterToDataUrl } from "@/lib/filters";
import { formatDate } from "@/lib/format";

const FILTERS: { id: FilterType; label: string }[] = [
  { id: "color", label: "Couleur" },
  { id: "gray", label: "Gris" },
  { id: "bw", label: "N&B" },
];

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const documents = useScanStore((s) => s.documents);
  const setDocumentPageFilter = useScanStore((s) => s.setDocumentPageFilter);
  const deleteDocument = useScanStore((s) => s.deleteDocument);
  const renameDocument = useScanStore((s) => s.renameDocument);

  const document = documents.find((d) => d.id === params.id);

  const [pageIndex, setPageIndex] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [renderingPreview, setRenderingPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(document?.name ?? "");

  const safeIndex = document ? Math.min(pageIndex, document.pages.length - 1) : 0;
  const currentPage = document?.pages[safeIndex];

  useEffect(() => {
    if (!currentPage) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setRenderingPreview(true);
    });
    applyFilterToDataUrl(currentPage.rawDataUrl, currentPage.filter)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(currentPage.rawDataUrl);
      })
      .finally(() => {
        if (!cancelled) setRenderingPreview(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage?.id, currentPage?.filter]);

  if (!document) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-page px-8 text-center">
        <p className="font-semibold text-ink">Document introuvable</p>
        <p className="text-sm text-ink-dim">Il a peut-être été supprimé.</p>
        <Link href="/documents" className="mt-2 text-sm font-medium text-accent">
          Retour à la bibliothèque
        </Link>
      </div>
    );
  }

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadDocumentPdf(document);
    } catch {
      // silencieux, l'utilisateur peut retenter
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Supprimer "${document.name}" ? Cette action est définitive.`)) {
      deleteDocument(document.id);
      router.push("/documents");
    }
  };

  const commitRename = () => {
    renameDocument(document.id, nameDraft);
    setRenaming(false);
  };

  return (
    <div className="flex h-dvh flex-col bg-page">
      <header className="flex items-center gap-3 border-b border-line bg-card px-4 py-3">
        <Link
          href="/documents"
          aria-label="Retour aux documents"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised text-ink"
        >
          <ArrowLeft size={18} />
        </Link>

        {renaming ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commitRename()}
              className="flex-1 rounded-lg border border-line bg-page px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
            />
            <button
              onClick={commitRename}
              aria-label="Valider le nom"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink"
            >
              <Check size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setNameDraft(document.name);
              setRenaming(true);
            }}
            className="flex flex-1 items-center gap-2 overflow-hidden text-left"
          >
            <span className="truncate text-base font-bold text-ink">{document.name}</span>
            <Pencil size={13} className="shrink-0 text-ink-dim" />
          </button>
        )}

        <button
          onClick={handleDelete}
          aria-label="Supprimer le document"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-dim active:bg-raised"
        >
          <Trash2 size={18} />
        </button>
      </header>

      <p className="px-4 pt-2 text-xs text-ink-dim">
        {formatDate(document.createdAt)} · {document.pages.length} page
        {document.pages.length > 1 ? "s" : ""}
      </p>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {document.pages.length > 1 && (
          <button
            onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            disabled={safeIndex === 0}
            aria-label="Page précédente"
            className="absolute left-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card shadow disabled:opacity-30"
          >
            <ChevronLeft size={18} className="text-ink" />
          </button>
        )}

        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={`Page ${safeIndex + 1}`}
            className="max-h-full max-w-full rounded-xl border border-line object-contain shadow-sm"
            style={{ opacity: renderingPreview ? 0.6 : 1, transition: "opacity 120ms" }}
          />
        )}

        {document.pages.length > 1 && (
          <button
            onClick={() => setPageIndex((i) => Math.min(document.pages.length - 1, i + 1))}
            disabled={safeIndex === document.pages.length - 1}
            aria-label="Page suivante"
            className="absolute right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card shadow disabled:opacity-30"
          >
            <ChevronRight size={18} className="text-ink" />
          </button>
        )}

        {document.pages.length > 1 && (
          <span className="absolute bottom-2 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-medium text-white">
            {safeIndex + 1} / {document.pages.length}
          </span>
        )}
      </div>

      <div className="flex justify-center gap-2 px-6 pb-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() =>
              currentPage && setDocumentPageFilter(document.id, currentPage.id, f.id)
            }
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              currentPage?.filter === f.id
                ? "bg-accent text-accent-ink"
                : "border border-line bg-card text-ink-dim"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="px-6 pb-8">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full rounded-2xl bg-accent py-4 text-sm font-bold text-accent-ink disabled:opacity-60"
        >
          {downloading ? "Préparation…" : "Télécharger le PDF"}
        </button>
      </div>
    </div>
  );
    }
