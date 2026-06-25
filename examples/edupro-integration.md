# EduPro-Integration — exakte Consumer-Anleitung (v0.18.0)

> **Ziel:** Eine andere Claude-Session kann EduPro so aufsetzen, dass die
> KI-Modell-Verwaltung **exakt genauso läuft wie im Switcher** — ohne Kontext
> aus dieser Session. Diese Datei ist die maßgebliche Referenz.

**Referenz-Implementierung (Goldstandard):** Der Switcher-Host
`claude-code-switcher/angular-frontend/src/app/app.component.ts` zeigt den
fertigen Einbau von `<ki-models-page>`. Wenn etwas hier unklar ist, ist diese
Datei die Quelle der Wahrheit — alles unten ist daraus abgeleitet.

---

## 0. Mentales Modell — was die Library stellt, was der Consumer stellt

Die Library liefert **eine einzige Komponente** `<ki-models-page>`, die ALLE
KI-Sektionen in kanonischer Reihenfolge rendert:

```
Verwaltung:   cascades-view → models-table →
              add-model-form → api-keys-section → privacy-settings
Supermodell:  supermodel-matrix   (nur sichtbar wenn supermodelOn = true)
Statistiken:  provider-servers → models-quality-stats → models-performance →
              models-cooldown-state → call-overview → failover-analytics →
              delegation-live
```

> **Seit v0.18.0:** Das Semantic-Routing-Panel (`<ki-routing-decisions>`) und
> das Cascade-Cooldown-Override-Panel (`<ki-cascade-cooldown>`) werden vom
> Composer **nicht mehr gerendert**. Beide Komponenten bleiben exportiert
> (Opt-in für Fremdnutzer), aber `<ki-models-page>` zeigt sie nicht. Die
> Routing-**Funktion** (`SemanticCategoryRouter`) läuft im Backend unverändert
> headless weiter — nur die Anzeige ist weg.
>
> **Neu in v0.18.0:** Zwei geteilte Analytics-Panels — `<ki-call-overview>`
> (Erfolgs-Trend 30 Tage + KI-Calls-Totals + geschätzte Kosten) und
> `<ki-failover-analytics>` (Failover-out/Provider als Donut + Provider×Grund-
> Tabelle, paginiert). Lange Tabellen haben jetzt durchgängig einen Pager
> (`pageSize` Default 25). **EduPro-Domänen-Charts (nach Dienst / nach
> Zielsprache) sind NICHT im Composer** — die bleiben EduPro-eigen, da sie auf
> `service`/`lang` im Call-Log basieren, was die Switcher/Supermodell-Welt
> (Routing nach `category`) nicht loggt.
```

**Der Consumer (EduPro) stellt selbst bereit:**
1. Ein Angular-17-Standalone-Setup mit `provideHttpClient()`.
2. Die Injection `KI_MODELS_API_BASE` (wohin die Library ihre REST-Calls schickt).
3. Ein Backend, das den **Backend-Vertrag** (Abschnitt 6) unter dieser Base bedient.
4. Optional: deutsche Labels + Kategorie-Reihenfolge via `KiModelsPageConfig`.
5. Optional: die Pool/Supermodell-Achse (`activePool`, `supermodelOn`) — nur
   relevant, wenn EduPro die Supermodell-Matrix nutzen will.

**Switcher-spezifisches Chrome, das EduPro NICHT übernimmt:**
Status-Bar, Quota-Banner, Modus-Panel (Manuell/Auto + Pool-Toggle), der
Claude-Restart-Button, der `/api/switch`-Aufruf und das `gemini→google`-Mapping.
Das ist Switcher-Failover-Logik und hat in EduPro keine Entsprechung.

---

## 1. Dependency installieren

Erste Iteration über das lokale Tarball (Library ist noch nicht auf einer
Registry):

```bash
# In ki-models-ui: Library bauen + packen
npx ng build ki-models-ui
cd dist/ki-models-ui && npm pack
# erzeugt: 4dataclub-ki-models-ui-0.18.0.tgz

# In EduPro:
cd <edupro>/angular-frontend
npm i /pfad/zu/ki-models-ui/dist/ki-models-ui/4dataclub-ki-models-ui-0.18.0.tgz
```

Peer-Dependencies: Angular 17 (`@angular/core`, `@angular/common`,
`@angular/common/http`) — EduPro hat die bereits.

---

## 2. `app.config.ts` — HttpClient + API-Base

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { KI_MODELS_API_BASE } from '@4dataclub/ki-models-ui';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... bestehende EduPro-Provider ...
    provideHttpClient(),
    { provide: KI_MODELS_API_BASE, useValue: '/api/admin' }, // EduPro: /api/admin
  ],
};
```

> **Switcher nutzt `/api`**, EduPro nutzt `/api/admin`. Die Library hängt an
> diese Base nur **relative** Pfade (`/ai-models`, `/cascades`, `/settings`, …).
> Die Base ist der EINZIGE Routing-Unterschied zwischen den Produkten.

---

## 3. Minimal-Mount (mit EduPro-Defaults)

Ein nackter Mount funktioniert sofort und rendert alle Sektionen mit
englischen/generischen Default-Labels:

```typescript
import { Component } from '@angular/core';
import { ModelsPageComponent } from '@4dataclub/ki-models-ui';

@Component({
  selector: 'app-ki-admin',
  standalone: true,
  imports: [ModelsPageComponent],
  template: `<ki-models-page></ki-models-page>`,
})
export class KiAdminComponent {}
```

Damit ist die Supermodell-Matrix **nicht** sichtbar (`supermodelOn` Default
`false` — so gewollt für beide Produkte).

---

## 4. Voll-Mount — exakt wie Switcher (deutsche Labels + Config)

Dies ist die 1:1-Spiegelung dessen, was der Switcher-Host macht. EduPro
übernimmt davon, was es braucht (Labels/Reihenfolge); die Pool/Supermodell-
Achse nur, wenn die Matrix gewünscht ist.

```typescript
import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ModelsPageComponent,
  KiModelsPageConfig,
} from '@4dataclub/ki-models-ui';

@Component({
  selector: 'app-ki-admin',
  standalone: true,
  imports: [CommonModule, ModelsPageComponent],
  template: `
    <ki-models-page
      [config]="pageConfig"
      [activePool]="activePool"
      [supermodelOn]="supermodelOn"
      [localOrchestratorPending]="localOrchestratorPending"
      (activeModelChanged)="onActiveModel($event)"
      (modelChanged)="reload()"
      (modelCreated)="reload()"
      (keyChanged)="reload()"
    ></ki-models-page>
  `,
})
export class KiAdminComponent {
  @ViewChild(ModelsPageComponent) modelsPage?: ModelsPageComponent;

  // ── Pool/Supermodell-Achse ──────────────────────────────────────────
  // WICHTIG: supermodelOn DEFAULTS FALSE (Matrix erscheint nur, wenn ON
  // geschaltet wird). Wenn EduPro KEINE Supermodell-Matrix will, einfach
  // weglassen — dann bleibt sie unsichtbar.
  activePool = 'cloud';
  supermodelOn = false;
  localOrchestratorPending = false;

  // ── Config-Bundle: alle deutschen Labels + Kategorie-Reihenfolge ─────
  get pageConfig(): KiModelsPageConfig {
    return {
      // Deutsche Labels pro Sektion (EduPro-i18n-Strings einsetzen):
      modelsTableLabels:    MODELS_TABLE_LABELS_DE,
      addModelFormLabels:   ADD_MODEL_FORM_LABELS_DE,
      cascadesViewLabels:   CASCADES_VIEW_LABELS_DE,
      cascadeChainLabels:   FAILOVER_CHAIN_LABELS_DE,
      apiKeysSectionLabels: API_KEYS_SECTION_LABELS_DE,
      providerServersLabels: PROVIDER_SERVERS_LABELS_DE,

      // Kategorie-Hinweise (Untertitel pro Cascade):
      cascadeHints: this.cascadeHints,
      categoryHints: this.cascadeHints,

      // Dynamische Anzeige-Titel aus /api/categories (displayName||humanize):
      categoryTitles: this.categoryTitles,
      // Reihenfolge der Sektionen in der Modell-Tabelle:
      categoryOrder: this.cascadeOrder,

      // Provider, die OHNE API-Key nutzbar sind (Switcher: anthropic via OAuth):
      keylessProviders: ['anthropic'],
      // Default-Kategorie pro Provider beim Anlegen:
      defaultCategoryByProvider: {
        anthropic: 'cloud', gemini: 'cloud', openai: 'cloud',
        deepseek: 'cloud', openrouter: 'free-only',
        ollama: 'general', openai_compat: 'general',
      },

      // "Als aktiv setzen"-Button pro Zeile (Switcher: an; EduPro: nach Bedarf):
      showActiveAction: true,
      activeModelId: this.activeModelId,
    };
  }

  cascadeHints: Record<string, string> = {
    cloud:       'Bezahlte Tier-Modelle (Anthropic / Google / OpenRouter).',
    'free-only': 'Kostenfreie OpenRouter-Modelle — rate-limited.',
    general:     'Globaler Fallback — wenn kein Bereich passt.',
  };
  cascadeOrder: string[] = [
    'cloud', 'free-only', 'local',
    'orchestrator-cloud', 'orchestrator-free', 'orchestrator-local',
    'implement-cloud', 'review-cloud', 'research-cloud', 'dispatch-cloud',
    'implement-free', 'review-free', 'dispatch-free',
    'implement-local', 'review-local', 'dispatch-local',
    'general',
  ];
  categoryTitles: Record<string, string> = {}; // aus /api/categories befüllen
  activeModelId: string | null = null;

  onActiveModel(m: { provider: string; modelId: string }): void {
    // EduPro-spezifisch: was bei "Als aktiv setzen" passieren soll.
    // (Switcher ruft hier /api/switch — EduPro typischerweise NICHT.)
  }

  reload(): void {
    this.modelsPage?.reload(); // lädt Tabelle + Cascades + Matrix neu
  }
}
```

### `KiModelsPageConfig` — alle Felder (alle optional)

| Feld | Zweck |
|---|---|
| `cascadesViewLabels`, `cascadeChainLabels`, `modelsTableLabels`, `addModelFormLabels`, `apiKeysSectionLabels`, `providerServersLabels`, `callOverviewLabels`, `failoverAnalyticsLabels` | Label-Overrides pro Sektion (`Partial<…Labels>`) |
| `cascadeHints` / `categoryHints` | `Record<name, hint>` — Untertitel pro Cascade/Kategorie |
| `cascadeProviderOptions` | `{value,label}[]` — Provider-Dropdown der Cascades-View |
| `categoryTitles` | `Record<name, title>` — Anzeige-Titel (sonst humanized) |
| `categoryOrder` | `string[]` — Reihenfolge der Tabellen-Sektionen |
| `keylessProviders` | `string[]` — Provider ohne Key-Pflicht |
| `defaultCategoryByProvider` | `Record<provider, category>` — Vorauswahl im Add-Form |
| `showActiveAction` | `boolean` — "Als aktiv"-Button pro Zeile (Default `false`) |
| `activeModelId` | `string\|null` — markiert die aktive Zeile |
| `qualityTitle/Subtitle`, `performanceTitle/Subtitle`, `cooldownTitle/Subtitle`, `privacyTitle/Subtitle`, `delegationTitle/Subtitle` | Überschriften der Statistik-Sektionen |
| `costMapping`, `costCurrency`, `usdToEur` | Kosten-Anzeige der Performance-Sektion |
| `cooldownAutoRefreshSec`, `delegationAutoRefreshSec`, `delegationMaxRows` | Refresh/Limits |
| `analyticsPageSize` | `number` — Pager-Schwelle der Failover-Tabelle (Default 25) |
| `analyticsCostPerMillionTokens` | `number` — €/1M-Token für die Kosten-Schätzung in `call-overview` (Default 2.0) |

---

## 5. Pool/Supermodell-Achse (nur wenn Matrix gewünscht)

Die Matrix-Inputs werden direkt am `<ki-models-page>` gesetzt (Pass-through):

| Input | Typ | Bedeutung |
|---|---|---|
| `activePool` | `string` | `cloud` / `free` / `local` — welcher Pool aktiv ist |
| `supermodelOn` | `boolean` | **Default `false`**. Nur `true` → Matrix sichtbar |
| `localOrchestratorPending` | `boolean` | local-Orchestrator gewählt, aber kein lokales Modell aktiv (fail-closed-Warnung) |
| `supermodelPools` | `string[]?` | Default `['cloud','free','local']` |
| `supermodelRoles` | `string[]?` | Default `['orchestrator','implement','review','research','dispatch']` |
| `supermodelDisabled` | `boolean?` | Matrix als "demnächst" deaktiviert anzeigen |

Wenn EduPro die Matrix **nicht** braucht: alle drei Inputs weglassen →
`supermodelOn` bleibt `false` → Sektion unsichtbar. Kein Backend-Aufwand.

---

## 6. Backend-Vertrag — das MUSS der Consumer bedienen

Alle Pfade relativ zur `KI_MODELS_API_BASE`. EduPro: `/api/admin/*`,
Switcher: `/api/*`. Die mit *v0.17.0* markierten sind neu (für Privacy-Toggle +
Delegations-Live).

| Method | Pfad | Zweck |
|--------|------|-------|
| GET    | `{base}/ai-models` | Liste aller Modelle |
| POST   | `{base}/ai-models` | Neues Modell anlegen |
| PUT    | `{base}/ai-models/{id}` | Modell ändern (Partial) |
| DELETE | `{base}/ai-models/{id}` | Modell löschen |
| POST   | `{base}/ai-models/{id}/test` | Connectivity-Test |
| POST   | `{base}/ai-models/reorder` | Reihenfolge (`{orderedIds}`) |
| POST   | `{base}/ai-models/{id}/toggle` | Enable/Disable (`{enabled}`) |
| GET    | `{base}/api-keys` | Setting-Keys (maskiert) |
| POST   | `{base}/api-keys/setting/{key}` | Key setzen (`{value}`) |
| GET/PUT | `{base}/cascade-config` | Cooldown-Override-State |
| GET    | `{base}/cascades`, `{base}/cascades/{name}` | Cascade-Liste/-Detail |
| GET    | `{base}/categories` | Kategorie-Metas |
| PUT/DELETE | `{base}/categories/{name}` | Kategorie umbenennen/löschen |
| GET    | `{base}/stats/quality?sortBy=`, `{base}/stats/performance?sortBy=` | Statistiken |
| GET    | `{base}/cooldown-state` | Cooldown pro Modell |
| GET    | `{base}/provider-servers`, PUT/DELETE `…/{name}` | Inferenz-Server (v0.15.0) |
| GET    | `{base}/settings` | App-Settings `AppSetting[]` *(v0.17.0)* |
| POST   | `{base}/settings/{key}` | Setting setzen (`{value}`) *(v0.17.0)* |
| GET    | `{base}/stats/calls` | Delegations-Calls `DelegationCall[]` *(v0.17.0)* |
| GET    | `{base}/stats/trend?days=30` | Erfolgs-Trend `TrendPoint[]` (`{date,total,success,failed}`) *(v0.18.0)* |
| GET    | `{base}/stats/totals` | KI-Calls-Totals `StatsTotals` (`{last24h,last7d,last30d,success30d,failed30d,outputChars30d}`) *(v0.18.0)* |
| GET    | `{base}/stats/failover-breakdown` | Failover-Aufschlüsselung `FailoverBreakdown` (`{byProvider,byProviderReason,byReason}`) *(v0.18.0)* |

**Graceful fallback:** Fehlt ein Statistik-/Settings-Endpoint (Backend < Feature),
zeigt die jeweilige Sektion einen leeren/neutralen Zustand statt zu crashen.
Pflicht für ein funktionierendes Grundgerüst sind nur `ai-models`, `api-keys`,
`cascade-config`, `cascades`, `categories`.

**Adapter-Pattern:** Hat EduPro abweichende Routen, kann `KiModelsApiService`
per Subclass + Provider-Override ersetzt werden — die Components hängen am
Service, nicht an den URLs.

Schemas: TypeScript-Interfaces in
`projects/ki-models-ui/src/lib/models/` (`ai-model.ts`, `app-setting.ts`,
`delegation-call.ts`, `provider-server.ts`, …).

---

## 7. Verifikation

```bash
# Frontend bauen + neu hochziehen
docker compose build frontend
docker compose up -d --force-recreate --no-deps frontend

# Backend-Vertrag stichprobenartig prüfen (Base = /api/admin):
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:<port>/api/admin/ai-models
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:<port>/api/admin/settings
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:<port>/api/admin/stats/calls
# v0.18.0-Analytics:
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:<port>/api/admin/stats/trend?days=30"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:<port>/api/admin/stats/totals
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:<port>/api/admin/stats/failover-breakdown
```

Browser-Test (Inkognito): Admin → KI-Modelle-Tab → alle Sektionen da, CRUD +
Toggle + Test + Reorder + Keys + Datenschutz-Toggle funktionieren; die
Analytics-Panels (Erfolgs-Trend + Totals + Failover-Donut) zeigen Daten oder
einen sauberen Leerzustand; Pager nur bei langen Tabellen sichtbar. Kein
Semantic-Routing-Panel, kein Cascade-Cooldown-Override-Panel mehr.
Supermodell-Matrix bleibt aus, solange `supermodelOn=false`.

---

## 8. Checkliste für die EduPro-Session (Kurzform)

- [ ] `4dataclub-ki-models-ui-0.18.0.tgz` gebaut + in EduPro installiert
- [ ] `provideHttpClient()` + `{ provide: KI_MODELS_API_BASE, useValue: '/api/admin' }`
- [ ] Inline-KI-Sektion durch ein einziges `<ki-models-page [config]="…">` ersetzt
- [ ] Deutsche Labels + `categoryOrder` + `categoryTitles` (aus `/api/categories`) gesetzt
- [ ] `supermodelOn` **bleibt false** (außer Matrix ist explizit gewünscht)
- [ ] Backend-Vertrag (Abschnitt 6) unter `/api/admin/*` vollständig bedient
- [ ] `(modelChanged|modelCreated|keyChanged)` → `modelsPage.reload()`
- [ ] Switcher-Chrome (Banner/Restart/Switch/Mode-Panel) NICHT übernommen
- [ ] Inkognito-Browser-Test grün