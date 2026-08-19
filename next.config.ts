import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: "lytechub",
  project: "scana",
  // N'affiche les logs d'upload des source maps que dans un environnement CI (Vercel).
  silent: !process.env.CI,
});
