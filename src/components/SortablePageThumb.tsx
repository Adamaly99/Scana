"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useScanStore, type ScannedPage } from "@/lib/store";

interface SortablePageThumbProps {
  page: ScannedPage;
  index: number;
}

export default function SortablePageThumb({ page, index }: SortablePageThumbProps) {
  const removePage = useScanStore((s) => s.removePage);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative touch-none"
      {...attributes}
      {...listeners}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={page.rawDataUrl}
        alt={`Page ${index + 1}`}
        className="aspect-[3/4] w-full rounded-lg border border-line object-cover"
        draggable={false}
      />
      <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-medium text-white">
        {index + 1}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          removePage(page.id);
        }}
        aria-label={`Supprimer la page ${index + 1}`}
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-xs text-white"
      >
        ✕
      </button>
    </div>
  );
        }
