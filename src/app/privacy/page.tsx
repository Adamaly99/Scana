import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Confidentialité — Scana",
  description: "Comment Scana traite les documents, l’OCR local et les données techniques.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-page px-5 py-8 text-ink">
      <article className="mx-auto max-w-2xl rounded-3xl border border-line bg-card p-6 shadow-sm sm:p-10">
        <Link href="/profile" className="text-sm font-semibold text-accent hover:underline">
          ← Retour au profil
        </Link>
        <h1 className="mt-6 text-2xl font-bold">Politique de confidentialité</h1>
        <p className="mt-2 text-sm text-ink-dim">Dernière mise à jour : 22 août 2026</p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-ink-dim">
          <section>
            <h2 className="text-base font-bold text-ink">En bref</h2>
            <p className="mt-2">
              Scana est conçu en mode local-first. Les images de documents et les résultats OCR sont
              traités et conservés sur l’appareil. Scana ne propose pas de compte, de synchronisation
              cloud ou d’abonnement dans la version actuelle.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink">Caméra et documents</h2>
            <p className="mt-2">
              L’autorisation caméra sert uniquement à capturer les documents. Les images capturées,
              les PDF générés et les résultats OCR sont stockés dans le stockage local du navigateur
              ou de l’application. Les images sont chiffrées localement avec AES-GCM avant leur
              enregistrement dans IndexedDB. Elles ne sont pas envoyées à un service OCR externe.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink">OCR et traitement</h2>
            <p className="mt-2">
              L’OCR utilise des workers et des modèles chargés localement. Le texte est reconnu sur
              l’appareil, puis le résultat peut être conservé dans le cache local chiffré. La qualité
              dépend de la netteté, de la lumière, de l’orientation et du type de document.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink">Données techniques de diagnostic</h2>
            <p className="mt-2">
              La version de production inclut Sentry pour détecter les erreurs techniques. Ce service
              peut recevoir des informations techniques nécessaires au diagnostic, comme le type de
              navigateur ou d’appareil, la version de l’application, la route concernée et la trace
              d’erreur. Scana n’utilise pas Sentry pour envoyer volontairement les images, les PDF ou
              le texte OCR. Cette configuration doit être vérifiée avant chaque publication et déclarée
              fidèlement dans la section Sécurité des données de Google Play.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink">Suppression et conservation</h2>
            <p className="mt-2">
              Les données locales restent sur l’appareil jusqu’à leur suppression par l’utilisateur,
              la suppression des données de l’application ou la désinstallation selon la plateforme.
              Le bouton « Effacer définitivement » dans Profil supprime les métadonnées, les images,
              le cache OCR, les réglages et la clé de chiffrement locale. Cette action est irréversible.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink">Responsabilité de l’utilisateur</h2>
            <p className="mt-2">
              Comme les documents sont conservés localement, l’utilisateur doit exporter les PDF
              importants avant de changer d’appareil, d’effacer les données du navigateur ou de
              désinstaller l’application. Scana ne peut pas récupérer une clé locale supprimée.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink">Contact</h2>
            <p className="mt-2">
              Avant publication commerciale, cette section doit être complétée avec une adresse de
              support contrôlée par l’éditeur et les informations légales de l’entreprise ou de la
              personne responsable de Scana.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
