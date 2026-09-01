"use client";

import {
  useCallback,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  ArrowLeft,
} from "lucide-react";

import ScannerCamera, {
  type CaptureResult,
} from "@/components/ScannerCamera";

import ReviewOverlay from "@/components/ReviewOverlay";

import PageDrawer from "@/components/PageDrawer";

import {
  useScanStore,
  type FilterType,
} from "@/lib/store";

export default function ScanPage() {
  const router = useRouter();

  const pages = useScanStore(
    (state) => state.pages
  );

  const addPage = useScanStore(
    (state) => state.addPage
  );

  const [
    pending,
    setPending,
  ] =
    useState<CaptureResult | null>(
      null
    );

  const [
    drawerOpen,
    setDrawerOpen,
  ] = useState(false);

  const handleCapture =
    useCallback(
      (result: CaptureResult) => {
        setPending(result);
      },
      []
    );

  const handleConfirm =
    useCallback(
      async (
        finalDataUrl: string,
        filter: FilterType,
        width: number,
        height: number
      ) => {
        await addPage({
          dataUrl: finalDataUrl,
          filter,
          width,
          height,
        });

        setPending(null);
      },
      [addPage]
    );

  const handleRetake =
    useCallback(() => {
      setPending(null);
    }, []);

  return (
    <main className="flex h-dvh flex-col bg-camera-bg">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() =>
            router.push("/")
          }
          aria-label="Retour à l'accueil"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-camera-surface text-camera-ink"
        >
          <ArrowLeft size={18} />
        </button>

        <button
          type="button"
          onClick={() =>
            setDrawerOpen(true)
          }
          disabled={
            pages.length === 0
          }
          className="flex items-center gap-2 rounded-full border border-camera-line bg-camera-surface px-3 py-1.5 disabled:opacity-40"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />

          <span className="text-xs font-medium text-camera-ink-dim">
            {pages.length} page
            {pages.length > 1
              ? "s"
              : ""}
          </span>
        </button>
      </div>

      <div className="relative flex flex-1 flex-col">
        <ScannerCamera
          onCapture={
            handleCapture
          }
        />

        {pending && (
          <ReviewOverlay
            capture={pending}
            onConfirm={
              handleConfirm
            }
            onRetake={
              handleRetake
            }
          />
        )}

        <PageDrawer
          open={drawerOpen}
          onClose={() =>
            setDrawerOpen(false)
          }
        />
      </div>
    </main>
  );
}