import * as Sentry from "@sentry/nextjs";

/**
 * Configuration volontairement minimale : uniquement la détection d'erreurs.
 * Pas de replay de session, pas de traçage de performance, pas de collecte
 * de données personnelles — cohérent avec le positionnement "zéro tracking"
 * de Scana. Le DSN n'est pas un secret (voir docs.sentry.io), sûr à garder en dur.
 */
Sentry.init({
  dsn: "https://d7e98ec0f0a743303304fc5533dfb81a@o4511925938814976.ingest.de.sentry.io/4511925954740304",
});

// Recommandé par Sentry même sans traçage de performance activé : garde une trace
// des changements de page menant à une erreur (contexte utile au diagnostic).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
