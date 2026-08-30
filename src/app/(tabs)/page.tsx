"use client";

import Link from "next/link";
import { Camera, Plus, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useScanStore } from "@/lib/store";
import DocumentCard from "@/components/DocumentCard";

export default function HomePage() {
  const t = useTranslations("home");
  const hasHydrated = useScanStore((s) => s.hasHydrated);
  const documents = useScanStore((s) => s.documents);
  const hasSeenDataWarning = useScanStore((s) => s.hasSeenDataWarning);
  const setHasSeenDataWarning = useScanStore((s) => s.setHasSeenDataWarning);

  return (
    <div className="flex min-h-full flex-col">
      <header className="px-6 pb-2 pt-6">
        <p className="text-2xl font-extrabold text-ink">{t("greeting")}</p>
        <p className="mt-1 text-sm text-ink-dim">{t("subtitle")}</p>
      </header>

      {hasHydrated && !hasSeenDataWarning && (
        <div className="mx-6 mt-4 rounded-2xl border border-line bg-card p-4">
          <div className="flex items-start gap-2.5">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold text-ink">{t("dataWarningTitle")}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-dim">{t("dataWarningBody")}</p>
            </div>
          </div>
          <button
            onClick={setHasSeenDataWarning}
            className="mt-3 rounded-full bg-accent px-4 py-2 text-xs font-bold text-accent-ink"
          >
            {t("understood")}
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
            <span className="block text-base font-bold">{t("newScan")}</span>
            <span className="block text-xs opacity-90">{t("newScanHint")}</span>
          </span>
        </Link>
      </div>

      <div className="flex-1 px-6 pt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{t("recent")}</h2>
          {documents.length > 0 && (
            <Link href="/documents" className="text-xs font-medium text-accent">
              {t("seeAll")}
            </Link>
          )}
        </div>

        {!hasHydrated ? null : documents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-12 text-center">
            <Plus size={20} className="text-ink-dim" />
            <p className="text-sm font-medium text-ink">{t("emptyTitle")}</p>
            <p className="px-8 text-xs text-ink-dim">{t("emptyHint")}</p>
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
