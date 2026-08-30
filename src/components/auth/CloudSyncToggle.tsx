"use client";

import { useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useScanStore } from "@/lib/store";
import { uploadDocument } from "@/lib/cloud/sync-engine";

export default function CloudSyncToggle() {
  const t = useTranslations("auth");
  const user = useScanStore((s) => s.user);
  const syncEnabled = useScanStore((s) => s.syncEnabled);
  const documents = useScanStore((s) => s.documents);
  const [syncing, setSyncing] = useState(false);

  if (!user) return null;

  const handleSync = async () => {
    if (!syncEnabled || syncing) return;
    setSyncing(true);
    try {
      const deviceId = navigator.userAgent.slice(0, 50); // Simple device ID
      for (const doc of documents.slice(0, 5)) { // Batch limit
        await uploadDocument(user.id, doc, deviceId);
      }
      useScanStore.getState().setLastSyncAt(Date.now());
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {syncEnabled ? <Cloud size={20} className="text-accent" /> : <CloudOff size={20} className="text-ink-dim" />}
          <div>
            <p className="text-sm font-semibold text-ink">
              {syncEnabled ? t("syncEnabled") : t("syncDisabled")}
            </p>
            <p className="text-xs text-ink-dim">
              {t("lastSync", { date: new Date().toLocaleDateString() })}
            </p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing || !syncEnabled}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-raised text-ink disabled:opacity-40"
        >
          <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}
