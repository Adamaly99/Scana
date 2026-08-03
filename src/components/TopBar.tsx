"use client";

interface TopBarProps {
  pageCount: number;
  onOpenDrawer: () => void;
}

function ScanaMark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3.5 1.5h6l3 3v10a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z"
          stroke="white"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M9.5 1.5v3h3" stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function TopBar({ pageCount, onOpenDrawer }: TopBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-line bg-card px-5 py-4">
      <span className="flex items-center gap-2">
        <ScanaMark />
        <span className="text-lg font-bold tracking-tight text-ink">Scana</span>
      </span>

      <button
        onClick={onOpenDrawer}
        disabled={pageCount === 0}
        className="flex items-center gap-2 rounded-full border border-line bg-raised px-3 py-1.5 disabled:opacity-40"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        <span className="text-xs font-medium text-ink-dim">
          {pageCount} page{pageCount > 1 ? "s" : ""}
        </span>
      </button>
    </header>
  );
}
