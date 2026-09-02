# Scana

Scana est une application Next.js (App Router) pour scanner et éditer des PDF hors-ligne (PWA). Ce dépôt contient le code source TypeScript, les scripts pour préparer les assets OCR, et la configuration de build.

## Démarrage rapide

Prérequis:
- Node 18+ et pnpm installés

Installer les dépendances:

```bash
pnpm install
```

Lancer en développement:

```bash
pnpm run dev
```

Construire (prépare d'abord les assets OCR):

```bash
pnpm run build
```

Préparer manuellement les assets OCR (si nécessaire):

```bash
pnpm run prepare:ocr
# ou
node scripts/prepare-ocr-assets.mjs
```

## Remarques
- Le script `prepare:ocr` copie les fichiers nécessaires de `tesseract.js` et `@tesseract.js-data` dans `public/ocr/v7`.
- Si vous déployez sur Vercel, un push sur `main` déclenchera normalement un déploiement si le projet est connecté.
- Si la build échoue après ces corrections, je peux lancer une passe supplémentaire pour corriger les erreurs TypeScript/ESLint restantes.
