"use client";

import Link from "next/link";
import { Camera, Plus, TriangleAlert } from "lucide-react";
import { useScanStore } from "@/lib/store";
import DocumentCard from "@/components/DocumentCard";

export default function HomePage() {
  const hasHydrated = useScanStore((state) => state.hasHydrated);
  const documents = useScanStore((state) => state.documents);
  const hasSeenDataWarning = useScanStore(
    (state) => state.hasSeenDataWarning
  );
  const setHasSeenDataWarning = useScanStore(
    (state) => state.setHasSeenDataWarning
  );

  return (
    <div className="flex min-h-full flex-col">
      <header className="px-6 pb-2 pt-6">
        <p className="text-2xl font-extrabold text-ink">Bonjour</p>
        <p className="mt-1 text-sm text-ink-dim">
          Scannez, organisez et exportez vos documents.
        </p>
      </header>

      {hasHydrated && !hasSeenDataWarning && (
        <div className="mx-6 mt-4 rounded-2xl border border-line bg-card p-4">
          <div className="flex items-start gap-2.5">
            <TriangleAlert
              size={18}
              className="mt-0.5 shrink-0 text-warning"
            />

            <div>
              <p className="text-sm font-semibold text-ink">
                Vos documents restent sur cet appareil
              </p>

              <p className="mt-1 text-xs leading-relaxed text-ink-dim">
                Scana fonctionne localement. Vos scans sont enregistrés dans
                le stockage de votre appareil et ne sont pas envoyés vers un
                serveur.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={setHasSeenDataWarning}
            className="mt-3 rounded-full bg-accent px-4 py-2 text-xs font-bold text-accent-ink"
          >
            Compris
          </button>
        </div>
      )}

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
              Numériser un document
            </span>
          </span>
        </Link>
      </div>

      <div className="flex-1 px-6 pt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">
            Documents récents
          </h2>

          {documents.length > 0 && (
            <Link
              href="/documents"
              className="text-xs font-medium text-accent"
            >
              Voir tout
            </Link>
          )}
        </div>

        {!hasHydrated ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-[80px] animate-pulse rounded-2xl border border-line bg-card"
              />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-12 text-center">
            <Plus size={20} className="text-ink-dim" />

            <p className="text-sm font-medium text-ink">
              Aucun document
            </p>

            <p className="px-8 text-xs text-ink-dim">
              Votre prochain scan apparaîtra ici.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 pb-6">
            {documents.slice(0, 8).map((document) => (
              <DocumentCard key={document.id} document={document} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}