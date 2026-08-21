import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Scana — Scanner & Éditeur PDF",
    short_name: "Scana",
    description:
      "Scanner de documents et éditeur PDF, 100% hors-ligne, sans compte, sans publicité.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF7F0",
    theme_color: "#2563EB",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
