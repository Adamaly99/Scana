"use client";

export default function GlobalError() {
  return (
    <html>
      <body>
        <div style={{ padding: 40, textAlign: "center" }}>
          <h1>Une erreur est survenue</h1>
          <p>Rechargez la page pour réessayer.</p>
        </div>
      </body>
    </html>
  );
}