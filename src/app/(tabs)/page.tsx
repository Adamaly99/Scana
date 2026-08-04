"use client";

import Link from "next/link";
import { Camera, Plus } from "lucide-react";
import { useScanStore } from "@/lib/store";
import DocumentCard from "@/components/DocumentCard";

export default function HomePage() {
  const hasHydrated = useScanStore((s) => s.hasHydrated);
  const documents = useScanStore((s) => s.documents);

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
              <DocumentCard key={doc.id} document={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
