"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useScanStore } from "@/lib/store";
import DocumentCard from "@/components/DocumentCard";

export default function DocumentsPage() {
  const hasHydrated = useScanStore((s) => s.hasHydrated);
  const documents = useScanStore((s) => s.documents);
  const deleteDocument = useScanStore((s) => s.deleteDocument);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) => d.name.toLowerCase().includes(q));
  }, [documents, query]);

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Supprimer "${name}" ? Cette action est définitive.`)) {
      deleteDocument(id);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line bg-card px-5 py-4">
        <h1 className="text-lg font-bold text-ink">Documents</h1>
      </header>

      <div className="px-5 pt-4">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5">
          <Search size={16} className="text-ink-dim" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un document..."
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-dim"
          />
        </div>
      </div>

      <div className="flex-1 px-5 pt-4">
        {!hasHydrated ? null : documents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-16 text-center">
            <p className="text-sm font-medium text-ink">Aucun document pour l&apos;instant</p>
            <p className="px-8 text-xs text-ink-dim">
              Scanne ton premier document, il apparaîtra ici.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-dim">
            Aucun document ne correspond à &quot;{query}&quot;.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5 pb-6">
            {filtered.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onDelete={() => handleDelete(doc.id, doc.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
