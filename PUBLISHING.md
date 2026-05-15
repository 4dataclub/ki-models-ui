# Publishing `@4dataclub/ki-models-ui`

Phase L.5 (2026-05-15): Library auf **GitHub Packages npm Registry** publishen,
damit EduPro + Switcher den `vendor/`-Tarball-Workaround beseitigen können.

## Voraussetzungen

### 1. GitHub Personal Access Token (Classic) mit Scope `write:packages`

Im [GitHub Settings → Developer Settings → Personal Access Tokens (Classic)](https://github.com/settings/tokens)
einen neuen Token erstellen — Scope `write:packages` (+ `read:packages` falls noch nicht
da). Speichern als z.B. `GITHUB_NPM_TOKEN`.

### 2. Lokales `~/.npmrc`

```ini
//npm.pkg.github.com/:_authToken=<TOKEN>
@4dataclub:registry=https://npm.pkg.github.com
```

> **Wichtig:** `~/.npmrc` ist user-level — niemals ins Repo committen. Das
> Repo enthält nur `publishConfig` in `package.json`, kein Token.

## Publish-Workflow

```bash
# 1. Library frisch bauen
cd ~/Downloads/ki-projekte/ki-models-ui
npx ng build ki-models-ui

# 2. In dist/ wechseln + publishen
cd dist/ki-models-ui
npm publish
```

`npm publish` liest `publishConfig.registry` aus dem Built-Package und pusht
zu `https://npm.pkg.github.com/4dataclub/ki-models-ui`.

## Version-Bumping

Bei Breaking-Changes / Feature-Adds:

```bash
cd ~/Downloads/ki-projekte/ki-models-ui/projects/ki-models-ui
npm version patch   # 0.1.0 → 0.1.1 (bug fix)
npm version minor   # 0.1.0 → 0.2.0 (additive)
npm version major   # 0.1.0 → 1.0.0 (breaking)
```

Dann `ng build` + `cd dist/ki-models-ui && npm publish`.

## Konsumenten umstellen (nach erstem Publish)

### EduPro

```bash
cd ~/Downloads/ki-projekte/edupro-learning-platform/angular-frontend

# Stelle sicher dass ~/.npmrc dataclub-scope auf GitHub-Registry mappt:
#   @4dataclub:registry=https://npm.pkg.github.com

# vendor-Workaround entfernen
rm -rf vendor
npm uninstall @4dataclub/ki-models-ui
npm install @4dataclub/ki-models-ui@^0.1.0

# Dockerfile-Anpassung: COPY vendor entfernen
# package.json: file:vendor/... → ^0.1.0 (passiert automatisch durch npm install)
```

### Switcher

Analog:

```bash
cd ~/Downloads/ki-projekte/claude-switcher/angular-frontend
rm -rf vendor
npm uninstall @4dataclub/ki-models-ui
npm install @4dataclub/ki-models-ui@^0.1.0
```

Dann beide Repos: Dockerfile `COPY vendor ./vendor` entfernen, package.json
zeigt nur noch `"@4dataclub/ki-models-ui": "^0.1.0"`.

## CI/CD-Auto-Publish

`.github/workflows/publish.yml` ist konfiguriert:

- **Trigger:** push von Tag `v*` (z.B. `v0.1.0`, `v0.2.0`) **oder** manuell
  via GitHub-UI „Run workflow".
- **Was passiert:** Checkout → Node-20 + GitHub-Packages-Registry-Setup →
  `npm ci` → `npx ng build ki-models-ui` → `npm publish` aus `dist/ki-models-ui/`.
- **Token:** `GITHUB_TOKEN` (vom Actions-Runner mit `packages: write`-Permission).
  Kein Personal-Access-Token nötig für CI-Runs.

**Release-Workflow:**

```bash
cd ~/Downloads/ki-projekte/ki-models-ui/projects/ki-models-ui
npm version patch    # 0.1.0 → 0.1.1  (oder minor/major)
cd ../..
git push --follow-tags
# → GitHub Actions startet automatisch + publisht zu npm.pkg.github.com
```

Manueller Publish (lokal, ohne CI) bleibt parallel möglich — siehe oberhalb.
