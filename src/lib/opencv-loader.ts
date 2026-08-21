const OPENCV_SRC = "/opencv/opencv.js";
const SCRIPT_ID = "opencv-js-runtime";

let loadingPromise: Promise<void> | null = null;

/**
 * Charge opencv.js (une seule fois, mise en cache via loadingPromise) et résout
 * seulement quand le runtime WASM est réellement prêt (cv.Mat existe).
 * Rejette si l’asset local échoue à charger.
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
    const finalizeWhenReady = () => {
      if (window.cv && window.cv.Mat) {
        resolve();
        return;
      }
      if (window.cv) {
        window.cv.onRuntimeInitialized = () => resolve();
      } else {
        reject(new Error("opencv.js chargé mais l'objet cv est introuvable."));
      }
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.cv && window.cv.Mat) {
        resolve();
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
      loadingPromise = null;
      reject(new Error("Échec du chargement local d’OpenCV.js."));
    };
    document.body.appendChild(script);
  });

  return loadingPromise;
}
