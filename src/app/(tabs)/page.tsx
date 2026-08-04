"use client";

import Link from "next/link";
import { useState } from "react";
import { Camera, Plus } from "lucide-react";
import { useScanStore, type ScanDocument } from "@/lib/store";
import { buildPdfFromPages, downloadPdfBytes } from "@/lib/pdf-export";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "document";
}

export default function HomePage() {
  const hasHydrated = useScanStore((s) => s.hasHydrated);
  const documents = useScanStore((s) => s.documents);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleRedownload = async (doc: ScanDocument) => {
    if (downloadingId) return;
    setDownloadingId(doc.id);
    try {
      const bytes = await buildPdfFromPages(doc.pages);
      downloadPdfBytes(bytes, `${sanitizeFilename(doc.name)}.pdf`);
    } catch {
      // Échec silencieux : l'utilisateur peut retenter, pas bloquant pour la navigation.
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="px-6 pb-2 pt-6">
        <p className="text-2xl font-extrabold text-ink">Bonjour 👋</p>
        <p className="mt-1 text-sm text-ink-dim">
          Prêt à scanner quelque chose d&apos;important aujourd&apos;hui ?
        </p>
      </header>

      <div className="px-6 pt-4">
        <Link
          href="/scan"
          className="flex items-center gap-4 rounded-2xl bg-accent px-5 py-4 text-accent-ink"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <Camera size={22} />
          </span>
          <span>
            <span className="block text-base font-bold">Nouveau scan</span>
            <span className="block text-xs opacity-90">
              Document, reçu, carte d&apos;identité…
            </span>
          </span>
        </Link>
      </div>

      <div className="flex-1 px-6 pt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Récents</h2>
          {documents.length > 0 && (
            <Link href="/documents" className="text-xs font-medium text-accent">
              Voir tout
            </Link>
          )}
        </div>

        {!hasHydrated ? null : documents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-12 text-center">
            <Plus size={20} className="text-ink-dim" />
            <p className="text-sm font-medium text-ink">Aucun document pour l&apos;instant</p>
            <p className="px-8 text-xs text-ink-dim">
              Scanne ton premier document, il apparaîtra ici.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 pb-6">
            {documents.slice(0, 8).map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleRedownload(doc)}
                disabled={downloadingId === doc.id}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-3 text-left disabled:opacity-60"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={doc.pages[0]?.rawDataUrl}
                  alt=""
                  className="h-14 w-11 rounded-md border border-line object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {doc.name}
                  </span>
                  <span className="block text-xs text-ink-dim">
                    {formatDate(doc.createdAt)} · {doc.pages.length} page
                    {doc.pages.length > 1 ? "s" : ""}
                  </span>
                </span>
                <span className="shrink-0 rounded-md bg-raised px-2 py-1 text-[10px] font-bold text-ink-dim">
                  {downloadingId === doc.id ? "…" : "PDF"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
