#!/usr/bin/env bash
set -euo pipefail

# scripts/sync-pnpm.sh
# Synchronise le pnpm-lock.yaml avec package.json, ajoute & commite les changements, puis pousse.
# Usage: ./scripts/sync-pnpm.sh [branch]
# Si aucune branche n'est fournie, le script poussera vers 'main' par défaut.

BRANCH=${1:-main}

echo "1) Vérification de pnpm..."
if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm n'est pas installé. Installez-le avec: npm install -g pnpm" >&2
  exit 1
fi

echo "2) Synchronisation du lockfile (pnpm install)..."
pnpm install

echo "3) Ajout des fichiers modifiés..."
git add .

# Vérifier s'il y a quelque chose à committer
if git diff --cached --quiet; then
  echo "Aucun changement à committer."
  exit 0
fi

echo "4) Commit des changements..."
git commit -m "fix: correction complète des fichiers, imports manquants et synchronisation du lockfile"

echo "5) Push vers origin/${BRANCH} (déclenchera le déploiement Vercel)..."
git push origin "${BRANCH}"

echo "Terminé."