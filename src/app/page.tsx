"use client";

import { useCallback, useState } from "react";
import ScannerCamera from "@/components/ScannerCamera";
import ReviewOverlay from "@/components/ReviewOverlay";
import TopBar from "@/components/TopBar";
import PageDrawer from "@/components/PageDrawer";
import { useScanStore, type FilterType } from "@/lib/store";

interface PendingCapture {
  rawDataUrl: string;
  width: number;
  height: number;
}

export default function Home() {
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
    <main className="flex h-dvh flex-col">
      <TopBar pageCount={pages.length} onOpenDrawer={() => setDrawerOpen(true)} />

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
