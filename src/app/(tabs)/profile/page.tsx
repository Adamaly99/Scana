"use client";

import { ExternalLink, HardDrive, LockKeyhole, ShieldCheck, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { clearLocalData } from "@/lib/local-db";

export default function ProfilePage() {
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const handleClearLocalData = async () => {
    if (
      !window.confirm(
        "Effacer définitivement tous les documents, résultats OCR et réglages de cet appareil ? Cette action est irréversible.",
      )
    ) {
      return;
    }

    setIsClearing(true);
    setClearError(null);
    try {
      await clearLocalData();
      window.location.reload();
    } catch {
      setClearError("La suppression n’a pas pu être terminée. Réessaie.");
      setIsClearing(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-page">
      <header className="border-b border-line bg-card px-5 py-4">
        <h1 className="text-lg font-bold text-ink">Profil</h1>
        <p className="mt-1 text-sm text-ink-dim">À propos de Scana et de tes données.</p>
      </header>

      <main className="space-y-5 px-5 py-5">
        <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <UserRound size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-ink">Scana local</h2>
              <p className="mt-1 text-sm leading-5 text-ink-dim">
                Aucun compte n’est nécessaire pour scanner, enregistrer et partager tes documents.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
          <h2 className="font-semibold text-ink">Confidentialité</h2>
          <div className="flex gap-3">
            <LockKeyhole size={18} className="mt-0.5 shrink-0 text-accent" />
            <p className="text-sm leading-6 text-ink-dim">
              Les documents sont conservés localement sur cet appareil. Scana ne les envoie pas automatiquement vers un compte ou un serveur.
            </p>
          </div>
          <div className="flex gap-3">
            <HardDrive size={18} className="mt-0.5 shrink-0 text-accent" />
            <p className="text-sm leading-6 text-ink-dim">
              Exporte les documents importants avant de changer d’appareil ou d’effacer les données du navigateur.
            </p>
          </div>
          <div className="flex gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" />
            <p className="text-sm leading-6 text-ink-dim">
              La synchronisation cloud et les abonnements ne sont pas activés dans cette version.
            </p>
          </div>
          <Link href="/privacy" className="inline-block text-sm font-semibold text-accent hover:underline">
            Lire la politique de confidentialité
          </Link>
        </section>

        <section className="rounded-2xl border border-red-200 bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Trash2 size={18} className="mt-0.5 shrink-0 text-red-600" />
            <div>
              <h2 className="font-semibold text-ink">Supprimer les données locales</h2>
              <p className="mt-2 text-sm leading-6 text-ink-dim">
                Cette action supprime définitivement les documents, les images chiffrées, le cache OCR, les réglages et la clé de chiffrement de cet appareil.
              </p>
              <button
                type="button"
                onClick={handleClearLocalData}
                disabled={isClearing}
                className="mt-4 rounded-xl border border-red-300 px-4 py-3 text-sm font-bold text-red-700 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isClearing ? "Suppression…" : "Effacer définitivement"}
              </button>
              {clearError ? <p className="mt-3 text-sm font-medium text-red-700">{clearError}</p> : null}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
          <h2 className="font-semibold text-ink">Besoin d’aide ?</h2>
          <p className="mt-2 text-sm leading-6 text-ink-dim">
            Commence par les réglages de qualité et de format, puis utilise l’export depuis la fiche du document pour conserver une copie.
          </p>
          <Link
            href="/tools"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-ink active:scale-95"
          >
            Ouvrir les outils
            <ExternalLink size={16} />
          </Link>
        </section>

        <p className="text-center text-xs text-ink-dim">Scana · Version MVP locale</p>
      </main>
    </div>
  );
}
