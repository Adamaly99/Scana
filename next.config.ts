import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Désactivé en développement pour ne jamais gêner l'itération avec du cache
  // périmé — actif uniquement pour le vrai build de production (Vercel).
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(withSerwist(nextConfig), {
  org: "lytechub",
  project: "scana",
  // N'affiche les logs d'upload des source maps que dans un environnement CI (Vercel).
  silent: !process.env.CI,
});
