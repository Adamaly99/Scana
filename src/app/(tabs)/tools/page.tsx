"use client";

import { FileText, Gauge, ScanLine, Sparkles } from "lucide-react";
import { useScanStore } from "@/lib/store";
import type { PageFormat, ScanQuality } from "@/lib/constants";

const QUALITY_OPTIONS: { value: ScanQuality; label: string; description: string }[] = [
  {
    value: "standard",
    label: "Standard",
    description: "Rapide et léger, adapté aux documents courants.",
  },
  {
    value: "high",
    label: "Haute définition",
    description: "Plus net pour les petits caractères et l’OCR, fichiers plus lourds.",
  },
];

const FORMAT_OPTIONS: { value: PageFormat; label: string; description: string }[] = [
  { value: "a4", label: "A4", description: "Format le plus courant en Europe." },
  { value: "letter", label: "Letter", description: "Format courant en Amérique du Nord." },
];

export default function ToolsPage() {
  const quality = useScanStore((state) => state.quality);
  const pageFormat = useScanStore((state) => state.pageFormat);
  const setQuality = useScanStore((state) => state.setQuality);
  const setPageFormat = useScanStore((state) => state.setPageFormat);

  return (
    <div className="flex min-h-full flex-col bg-page">
      <header className="border-b border-line bg-card px-5 py-4">
        <h1 className="text-lg font-bold text-ink">Outils</h1>
        <p className="mt-1 text-sm text-ink-dim">Prépare tes prochains scans avant la capture.</p>
      </header>

      <main className="space-y-5 px-5 py-5">
        <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Gauge size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-ink">Qualité de capture</h2>
              <p className="mt-1 text-sm leading-5 text-ink-dim">
                La haute définition améliore la lisibilité, mais demande plus de temps et d’espace.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {QUALITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setQuality(option.value)}
                aria-pressed={quality === option.value}
                className={`rounded-xl border p-3 text-left transition active:scale-[0.99] ${
                  quality === option.value
                    ? "border-accent bg-accent/10"
                    : "border-line bg-page hover:border-accent/50"
                }`}
              >
                <span className="flex items-center gap-2 font-medium text-ink">
                  <ScanLine size={16} />
                  {option.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-ink-dim">{option.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-ink">Format PDF</h2>
              <p className="mt-1 text-sm leading-5 text-ink-dim">
                Le format choisi sera utilisé lors de l’export de tes documents.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {FORMAT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPageFormat(option.value)}
                aria-pressed={pageFormat === option.value}
                className={`rounded-xl border p-3 text-left transition active:scale-[0.99] ${
                  pageFormat === option.value
                    ? "border-accent bg-accent/10"
                    : "border-line bg-page hover:border-accent/50"
                }`}
              >
                <span className="font-medium text-ink">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-ink-dim">{option.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-accent/5 p-4">
          <div className="flex items-start gap-3">
            <Sparkles size={18} className="mt-0.5 shrink-0 text-accent" />
            <p className="text-sm leading-6 text-ink-dim">
              Pour une capture plus nette, place le document sur une surface contrastée, garde le téléphone parallèle à la page et attends que le contour passe au vert.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
