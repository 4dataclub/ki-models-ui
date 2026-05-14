# Publishing `@dataclub/ki-models-ui`

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
@dataclub:registry=https://npm.pkg.github.com
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
#   @dataclub:registry=https://npm.pkg.github.com

# vendor-Workaround entfernen
rm -rf vendor
npm uninstall @dataclub/ki-models-ui
npm install @dataclub/ki-models-ui@^0.1.0

# Dockerfile-Anpassung: COPY vendor entfernen
# package.json: file:vendor/... → ^0.1.0 (passiert automatisch durch npm install)
```

### Switcher

Analog:

```bash
cd ~/Downloads/ki-projekte/claude-switcher/angular-frontend
rm -rf vendor
npm uninstall @dataclub/ki-models-ui
npm install @dataclub/ki-models-ui@^0.1.0
```

Dann beide Repos: Dockerfile `COPY vendor ./vendor` entfernen, package.json
zeigt nur noch `"@dataclub/ki-models-ui": "^0.1.0"`.

## CI/CD-Auto-Publish (optional, später)

`.github/workflows/publish.yml` kann auf `git tag v*` triggern:

```yaml
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://npm.pkg.github.com'
      - run: npm ci
      - run: npx ng build ki-models-ui
      - run: cd dist/ki-models-ui && npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Aktuell läuft das manuell — Auto-Publish ist Phase L.5+.
