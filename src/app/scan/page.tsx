"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ScannerCamera from "@/components/ScannerCamera";
import ReviewOverlay from "@/components/ReviewOverlay";
import PageDrawer from "@/components/PageDrawer";
import { useScanStore, type FilterType } from "@/lib/store";

interface PendingCapture {
  rawDataUrl: string;
  width: number;
  height: number;
}

export default function ScanPage() {
  const router = useRouter();
  const pages = useScanStore((s) => s.pages);
  const addPage = useScanStore((s) => s.addPage);

  const [pending, setPending] = useState<PendingCapture | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleCapture = useCallback((dataUrl: string, width: number, height: number) => {
    setPending({ rawDataUrl: dataUrl, width, height });
  }, []);

  const handleConfirm = useCallback(
    (filter: FilterType) => {
      if (!pending) return;
      addPage({
        rawDataUrl: pending.rawDataUrl,
        filter,
        width: pending.width,
        height: pending.height,
      });
      setPending(null);
    },
    [pending, addPage]
  );

  const handleRetake = useCallback(() => {
    setPending(null);
  }, []);

  return (
    <main className="flex h-dvh flex-col bg-camera-bg">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => router.push("/")}
          aria-label="Retour à l'accueil"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-camera-surface text-camera-ink"
        >
          <ArrowLeft size={18} />
        </button>

        <button
          onClick={() => setDrawerOpen(true)}
          disabled={pages.length === 0}
          className="flex items-center gap-2 rounded-full border border-camera-line bg-camera-surface px-3 py-1.5 disabled:opacity-40"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-xs font-medium text-camera-ink-dim">
            {pages.length} page{pages.length > 1 ? "s" : ""}
          </span>
        </button>
      </div>

      <div className="relative flex flex-1 flex-col">
        <ScannerCamera onCapture={handleCapture} />

        {pending && (
          <ReviewOverlay
            rawDataUrl={pending.rawDataUrl}
            onConfirm={handleConfirm}
            onRetake={handleRetake}
          />
        )}

        <PageDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </div>
    </main>
  );
}
