"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        {/* NextError est le composant d'erreur par défaut de Next.js. Son type exige
        un statusCode ; l'App Router n'exposant pas de code de statut pour ces
        erreurs, on passe simplement 0 pour un message générique. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
