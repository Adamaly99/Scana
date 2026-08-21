"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Évite toute divergence serveur/client au premier rendu : on lit l'état
    // réel seulement une fois monté côté navigateur, différé d'un micro-tick
    // pour ne jamais appeler setState de façon synchrone dans le corps de l'effet.
    Promise.resolve().then(() => setIsOffline(!navigator.onLine));

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-xs font-medium text-white">
      <WifiOff size={13} />
      Hors-ligne — tes documents restent accessibles, l&apos;OCR et le scan peuvent être limités.
    </div>
  );
}
