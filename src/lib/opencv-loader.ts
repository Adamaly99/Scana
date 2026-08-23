const OPENCV_SRC = "https://docs.opencv.org/4.7.0/opencv.js";
const SCRIPT_ID = "opencv-js-runtime";
/** Au-delà de ce délai, on abandonne plutôt que de laisser l'utilisateur bloqué
 * indéfiniment sur "Chargement…" — une connexion lente (fréquente sur la cible
 * de l'app) qui ne coupe jamais franchement ne déclencherait sinon jamais
 * script.onerror, et le bouton "Réessayer" n'apparaîtrait donc jamais. */
const LOAD_TIMEOUT_MS = 20_000;

let loadingPromise: Promise<void> | null = null;

/**
 * Charge opencv.js (une seule fois, mise en cache via loadingPromise) et résout
 * seulement quand le runtime WASM est réellement prêt (cv.Mat existe).
 * Rejette si le script échoue à charger (ex: pas de connexion) ou si le
 * chargement dépasse LOAD_TIMEOUT_MS (ex: connexion présente mais très lente).
 */
export function loadOpenCv(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV ne peut être chargé que côté navigateur."));
  }

  if (window.cv && window.cv.Mat) {
    return Promise.resolve();
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = new Promise((resolve, reject) => {
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      loadingPromise = null;
      reject(
        new Error(
          "Le chargement du moteur de scan prend trop de temps — vérifie ta connexion et réessaie."
        )
      );
    }, LOAD_TIMEOUT_MS);

    const succeed = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve();
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      loadingPromise = null;
      reject(err);
    };

    const finalizeWhenReady = () => {
      if (window.cv && window.cv.Mat) {
        succeed();
        return;
      }
      if (window.cv) {
        window.cv.onRuntimeInitialized = () => succeed();
      } else {
        fail(new Error("opencv.js chargé mais l'objet cv est introuvable."));
      }
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.cv && window.cv.Mat) {
        succeed();
      } else {
        existing.addEventListener("load", finalizeWhenReady, { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = OPENCV_SRC;
    script.async = true;
    script.onload = finalizeWhenReady;
    script.onerror = () => {
      fail(new Error("Échec du chargement d'OpenCV.js — vérifie ta connexion internet."));
    };
    document.body.appendChild(script);
  });

  return loadingPromise;
}
