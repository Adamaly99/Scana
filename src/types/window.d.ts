export {};

declare global {
  interface Window {
    // OpenCV.js n'expose pas de types officiels — surface minimale utilisée dans ce projet.
    cv: {
      Mat: unknown;
      onRuntimeInitialized?: () => void;
    } & Record<string, unknown>;
  }
}
