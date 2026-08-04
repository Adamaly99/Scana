"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useScanStore } from "@/lib/store";
import SortablePageThumb from "./SortablePageThumb";
import { buildPdfFromPages, downloadPdfBytes, generatePdfFilename } from "@/lib/pdf-export";

interface PageDrawerProps {
  open: boolean;
  onClose: () => void;
}

function defaultDocName(): string {
  const formatted = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return `Scan du ${formatted}`;
}

export default function PageDrawer({ open, onClose }: PageDrawerProps) {
  const router = useRouter();
  const pages = useScanStore((s) => s.pages);
  const setPageOrder = useScanStore((s) => s.setPageOrder);
  const saveCurrentAsDocument = useScanStore((s) => s.saveCurrentAsDocument);

  const [docName, setDocName] = useState(defaultDocName);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Régénère un nom par défaut à chaque ouverture (pas à chaque frappe de l'utilisateur).
  // Différé via microtask pour ne jamais appeler setState de façon synchrone dans l'effet.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setDocName(defaultDocName());
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // distance de 8px avant qu'un glisser ne s'active : évite qu'un simple tap
  // (ex: sur le bouton supprimer) ne déclenche un drag par erreur.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  if (!open) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = pages.map((p) => p.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...ids];
    reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, String(active.id));
    setPageOrder(reordered);
  };

  const handleExport = async () => {
    if (pages.length === 0 || exporting) return;
    setExporting(true);
    setExportError(null);
    setProgress({ done: 0, total: pages.length });
    try {
      const bytes = await buildPdfFromPages(pages, (done, total) =>
        setProgress({ done, total })
      );
      downloadPdfBytes(bytes, generatePdfFilename());
      saveCurrentAsDocument(docName);
      onClose();
      router.push("/");
    } catch {
      setExportError("L'export a échoué. Réessaie.");
    } finally {
      setExporting(false);
      setProgress(null);
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/50">
      <button className="absolute inset-0" aria-label="Fermer" onClick={onClose} />

      <div className="relative z-10 flex max-h-[85vh] flex-col rounded-t-3xl border-t border-line bg-card pb-6 shadow-2xl">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line" />

        <div className="flex items-center justify-between px-6 pt-4">
          <h2 className="font-semibold text-ink">
            {pages.length} page{pages.length > 1 ? "s" : ""} scannée{pages.length > 1 ? "s" : ""}
          </h2>
          <button onClick={onClose} className="text-sm text-ink-dim">
            Fermer
          </button>
        </div>

        {pages.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-ink-dim">
            Aucune page pour l&apos;instant. Scanne ton premier document.
          </p>
        ) : (
          <>
            <p className="px-6 pb-2 pt-3 text-center text-[11px] font-medium text-ink-dim">
              MAINTIENS ET GLISSE POUR RÉORDONNER
            </p>

            <div className="overflow-y-auto px-6">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-3 gap-3 pb-4">
                    {pages.map((page, index) => (
                      <SortablePageThumb key={page.id} page={page} index={index} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            <div className="px-6 pt-2">
              <label className="mb-1.5 block text-xs font-medium text-ink-dim">
                Nom du document
              </label>
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="Nom du document"
                className="w-full rounded-xl border border-line bg-page px-4 py-3 text-sm text-ink outline-none focus:border-accent"
              />
            </div>

            {exportError && (
              <p className="px-6 pb-2 pt-2 text-center text-sm text-danger">{exportError}</p>
            )}

            <div className="px-6 pt-3">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full rounded-2xl bg-accent py-4 text-sm font-bold text-accent-ink disabled:opacity-50"
              >
                {exporting
                  ? `Enregistrement… ${progress ? `${progress.done}/${progress.total}` : ""}`
                  : `Enregistrer le document (${pages.length} page${pages.length > 1 ? "s" : ""})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
