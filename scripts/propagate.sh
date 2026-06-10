#!/bin/bash
# ============================================================================
#  propagate.sh — automatischer Library-Update-Workflow für ki-models-ui
#  Konsumenten (claude-switcher + edupro-learning-platform).
#
#  Ein-Befehl-Workflow:
#    1. Library lokal bauen + Tarball packen
#    2. In jedes Konsumenten-Repo:
#       - main pullen
#       - Branch chore/bump-ki-models-ui-X.Y.Z erstellen
#       - Tarball in vendor/ kopieren, alten Tarball löschen
#       - package.json + package-lock.json updaten
#       - commit + push
#       - PR erstellen + mergen (optional --no-merge zum Stop nach PR)
#       - Branch via scripts/archive-branch.sh archivieren (wenn vorhanden)
#
#  Voraussetzungen:
#    - cwd: ki-models-ui Repo-Root
#    - Library-Version in projects/ki-models-ui/package.json ist die zu
#      propagierende Version (bumpe sie VOR diesem Skript)
#    - gh CLI mit repo-scope-Auth (für PR + Merge)
#    - Konsumenten-Repos liegen im selben Parent-Verzeichnis wie ki-models-ui
#
#  Verwendung:
#    bash scripts/propagate.sh              # bauen + propagieren + mergen
#    bash scripts/propagate.sh --no-merge   # bauen + propagieren, PR offen lassen
#    bash scripts/propagate.sh --dry-run    # nur prüfen, nichts committen
# ============================================================================
set -euo pipefail

LIB_REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PARENT_DIR="$(cd "$LIB_REPO_ROOT/.." && pwd)"

# Konsumenten-Liste — hier neue Konsumenten ergänzen wenn die Lib breiter genutzt wird.
CONSUMERS=(
  "claude-switcher:angular-frontend"
  "edupro-learning-platform:angular-frontend"
)

# CLI-Flags
DRY_RUN=false
MERGE=true
for arg in "$@"; do
  case "$arg" in
    --dry-run)  DRY_RUN=true;  echo "==> DRY-RUN — keine Commits/Pushes/Merges" ;;
    --no-merge) MERGE=false;   echo "==> --no-merge — PRs werden NICHT auto-gemerged" ;;
    *)          echo "Unbekanntes Flag: $arg"; exit 1 ;;
  esac
done

# 1. Library bauen + Version aus package.json lesen
cd "$LIB_REPO_ROOT"
VERSION="$(node -p "require('./projects/ki-models-ui/package.json').version")"
echo "==> Library-Version: $VERSION"
TARBALL_NAME="4dataclub-ki-models-ui-${VERSION}.tgz"

echo "==> Library bauen (npx ng build ki-models-ui)…"
npx ng build ki-models-ui >/dev/null

echo "==> Tarball packen…"
cd "$LIB_REPO_ROOT/dist/ki-models-ui"
rm -f ./*.tgz
npm pack >/dev/null
TARBALL_PATH="$LIB_REPO_ROOT/dist/ki-models-ui/$TARBALL_NAME"
if [ ! -f "$TARBALL_PATH" ]; then
  echo "FEHLER: Tarball nicht gebaut: $TARBALL_PATH"; exit 1
fi
echo "    → $TARBALL_PATH"

# 2. Pro Konsument: branch + tarball-swap + commit + PR + (optional) merge
for entry in "${CONSUMERS[@]}"; do
  REPO_NAME="${entry%%:*}"
  FRONTEND_DIR="${entry##*:}"
  CONSUMER_ROOT="$PARENT_DIR/$REPO_NAME"
  FRONTEND_ROOT="$CONSUMER_ROOT/$FRONTEND_DIR"

  echo ""
  echo "==> Konsument: $REPO_NAME ($FRONTEND_DIR)"
  if [ ! -d "$CONSUMER_ROOT/.git" ]; then
    echo "    SKIP — kein git-Repo unter $CONSUMER_ROOT"; continue
  fi
  if [ ! -d "$FRONTEND_ROOT/vendor" ]; then
    echo "    SKIP — kein vendor/-Ordner unter $FRONTEND_ROOT"; continue
  fi

  cd "$CONSUMER_ROOT"

  # Pull main + fresh branch
  BRANCH="chore/bump-ki-models-ui-${VERSION}"
  echo "    → git checkout main + pull --rebase"
  if ! git checkout main >/dev/null 2>&1; then
    echo "    SKIP — main checkout failed (uncommitted changes?)"; continue
  fi
  git pull --rebase --quiet

  # Falls Branch schon existiert (vom Re-Run), löschen + neu
  git branch -D "$BRANCH" 2>/dev/null || true
  git checkout -b "$BRANCH" >/dev/null

  # Alten Tarball finden + entfernen (sofern er nicht der gleiche Name ist)
  OLD_TARBALL="$(ls "$FRONTEND_ROOT/vendor/" | grep -E '^4dataclub-ki-models-ui-[0-9]+\.[0-9]+\.[0-9]+\.tgz$' | grep -v "$TARBALL_NAME" | head -1 || true)"
  if [ -n "$OLD_TARBALL" ] && [ "$OLD_TARBALL" != "$TARBALL_NAME" ]; then
    echo "    → entferne alten Tarball: $OLD_TARBALL"
    if [ "$DRY_RUN" = false ]; then
      git rm "$FRONTEND_DIR/vendor/$OLD_TARBALL" >/dev/null
    fi
  fi

  # Neuen Tarball kopieren — vendor/-Ordner notfalls neu anlegen (git entfernt
  # leere Ordner nach `git rm` der letzten Datei, deshalb mkdir -p).
  mkdir -p "$FRONTEND_ROOT/vendor"
  echo "    → kopiere $TARBALL_NAME nach vendor/"
  cp "$TARBALL_PATH" "$FRONTEND_ROOT/vendor/"

  # package.json + package-lock.json updaten
  echo "    → package.json + package-lock.json refreshen"
  cd "$FRONTEND_ROOT"
  sed -i.bak -E "s|file:vendor/4dataclub-ki-models-ui-[0-9]+\.[0-9]+\.[0-9]+\.tgz|file:vendor/$TARBALL_NAME|" package.json
  rm -f package.json.bak

  # Lock-File neu generieren (npm install --package-lock-only ist robust)
  rm -rf node_modules/@4dataclub package-lock.json
  npm install --silent --no-audit --no-fund 2>&1 | tail -3

  cd "$CONSUMER_ROOT"
  git add "$FRONTEND_DIR/package.json" "$FRONTEND_DIR/package-lock.json" "$FRONTEND_DIR/vendor/$TARBALL_NAME"

  if [ "$DRY_RUN" = true ]; then
    echo "    (dry-run: kein commit/push/PR)"
    git status --short
    git checkout main >/dev/null 2>&1
    git branch -D "$BRANCH" >/dev/null 2>&1
    continue
  fi

  # Commit
  if git diff --cached --quiet; then
    echo "    SKIP — keine Änderungen (Repo war schon auf $VERSION)"
    git checkout main >/dev/null
    git branch -D "$BRANCH" >/dev/null
    continue
  fi

  COMMIT_MSG="chore(deps): bump ki-models-ui → $VERSION

Automatisch propagiert via ki-models-ui/scripts/propagate.sh.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
  git commit -q -m "$COMMIT_MSG"

  # Push + PR
  echo "    → git push + gh pr create"
  git push -q -u origin "$BRANCH" 2>&1 | tail -3 || true
  PR_URL="$(gh pr create --base main \
    --title "chore(deps): bump ki-models-ui → $VERSION" \
    --body "Automatisch propagiert via ki-models-ui/scripts/propagate.sh." 2>&1 | tail -1)"
  echo "    → PR: $PR_URL"

  # Optional mergen
  if [ "$MERGE" = true ]; then
    echo "    → gh pr merge --merge"
    gh pr merge --merge "$PR_URL" >/dev/null 2>&1 || gh pr merge --merge >/dev/null 2>&1 || true
  fi

  # Branch archivieren (sofern Skript da ist)
  if [ -x "$CONSUMER_ROOT/scripts/archive-branch.sh" ]; then
    sleep 1  # GitHub etwas Zeit damit den merge sieht
    git checkout main >/dev/null 2>&1
    git pull --rebase --quiet
    echo "    → archive-branch.sh $BRANCH"
    bash "$CONSUMER_ROOT/scripts/archive-branch.sh" "$BRANCH" 2>&1 | tail -1 || true
  fi
done

echo ""
echo "==> Fertig. Library v$VERSION in alle Konsumenten propagiert."
if [ "$MERGE" = false ]; then
  echo "    --no-merge: PRs sind erstellt, aber NICHT gemerged."
fi
