"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import type { ScanDocument } from "@/lib/store";
import { formatDate } from "@/lib/format";
import { usePageImageUrl } from "@/hooks/usePageImageUrl";

interface DocumentCardProps {
  document: ScanDocument;
  onDelete?: () => void;
}

export default function DocumentCard({
  document,
  onDelete,
}: DocumentCardProps) {
  const firstPageId = document.pages[0]?.id;

  const {
    url: thumbnailUrl,
    ref: thumbnailRef,
  } = usePageImageUrl(firstPageId);

  return (
    <div className="flex items-center gap-1 rounded-2xl border border-line bg-card p-3">
      <Link
        href={`/documents/${document.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div
          ref={thumbnailRef}
          className="h-14 w-11 shrink-0 overflow-hidden rounded-md border border-line bg-raised"
        >
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="h-full w-full animate-pulse bg-raised" />
          )}
        </div>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">
            {document.name}
          </span>

          <span className="block text-xs text-ink-dim">
            {formatDate(document.createdAt)} · {document.pages.length}{" "}
            {document.pages.length === 1 ? "page" : "pages"}
          </span>
        </span>

        <span className="shrink-0 rounded-md bg-raised px-2 py-1 text-[10px] font-bold text-ink-dim">
          PDF
        </span>
      </Link>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Supprimer ${document.name}`}
          className="shrink-0 rounded-full p-2.5 text-ink-dim active:bg-raised"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}