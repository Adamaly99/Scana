"use client";

interface TopBarProps {
  pageCount: number;
  onOpenDrawer: () => void;
}

export default function TopBar({ pageCount, onOpenDrawer }: TopBarProps) {
  return (
    <header className="flex items-center justify-between px-5 pt-5 pb-3">
      <span className="text-lg font-extrabold tracking-tight text-ink">
        Scan<span className="text-accent">Pro</span>
      </span>

      <button
        onClick={onOpenDrawer}
        disabled={pageCount === 0}
        className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 disabled:opacity-40"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        <span className="font-mono text-xs text-ink-dim">
          {pageCount} page{pageCount > 1 ? "s" : ""}
        </span>
      </button>
    </header>
  );
}
