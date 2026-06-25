# Switcher-Integration — Referenz-Host (v0.17.0)

Der Switcher ist die **Referenz-Implementierung** für `<ki-models-page>`.
Wer EduPro (oder einen neuen Consumer) anbindet, schaut hierher und in die
lebende Quelle:

> **Goldstandard-Datei:**
> `claude-code-switcher/angular-frontend/src/app/app.component.ts`

Diese Datei zeigt den vollständigen, produktiven Einbau. Die generische
Consumer-Anleitung steht in [`edupro-integration.md`](edupro-integration.md).

---

## Was der Switcher konkret macht

1. **API-Base:** `{ provide: KI_MODELS_API_BASE, useValue: '/api' }`
   (Switcher-Backend direkt, kein `/admin`-Prefix). nginx im
   `switcher-frontend`-Container proxy't `/api/*` → `switcher-backend:2000`.

2. **Ein einziges `<ki-models-page>`** rendert die komplette KI-Verwaltung —
   identisch zu EduPro, keine Switcher-Sonderflocke mehr. Übergeben wird ein
   `KiModelsPageConfig`-Getter mit deutschen Labels, der Pool/Compound-
   Reihenfolge (`cascadeOrder`) und `keylessProviders: ['anthropic']`
   (Anthropic via Max-OAuth braucht keinen `sk-ant`-Key).

3. **Pool/Supermodell-Achse** wird per `[activePool]` / `[supermodelOn]` /
   `[localOrchestratorPending]` hineingereicht. Der State kommt aus
   `/api/status` + `/api/supermodel` und wird via SSE (`/api/events`,
   Events `mode` + `supermodel`) live gespiegelt. Bei Pool-Wechsel ruft der
   Host `modelsPage.reload()`.

4. **Switcher-spezifisches Chrome drumherum** (NICHT in der Library, NICHT von
   EduPro zu übernehmen):
   - `<sw-status-bar>` — aktueller Provider/Modell/Quota
   - `<sw-banner>` — Quota-Warnung + "Jetzt switchen"
   - `<sw-mode-panel>` — Manuell vs. Auto-Failover + Pool-Toggle + Supermodell-Schalter
   - Claude-Restart-Button
   - `onSwitchToModel()` mappt cascade-`gemini` → switcher-`google` und ruft
     `/api/switch` (schreibt `~/.claude/.switcher-restart`, Wrapper startet
     Claude Code neu). **Das ist reine Switcher-Failover-Logik.**

---

## Verifikation (Switcher)

```bash
cd ~/claude-switcher
docker compose build switcher-frontend switcher-backend
docker compose up -d --force-recreate switcher-frontend switcher-backend

# Backend-Vertrag (Base = /api):
curl -s -o /dev/null -w "ai-models %{http_code}\n"  http://localhost:2000/api/ai-models
curl -s -o /dev/null -w "settings %{http_code}\n"   http://localhost:2000/api/settings
curl -s -o /dev/null -w "stats/calls %{http_code}\n" http://localhost:2000/api/stats/calls
```

Dann Browser auf `http://localhost:2000` (Inkognito): alle Sektionen,
Pool-Toggle, Supermodell-Matrix (nur bei Schalter AN), Statistiken.

> **Achtung Live-Test:** POST auf `/api/switch`, `/api/mode`, `/api/supermodel`
> schreiben den Restart-Marker → der Wrapper killt + restartet die laufende
> Claude-Code-Session. Diese Klicks gehören in die Hand des Nutzers, nicht in
> einen autonomen Lauf.