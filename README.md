# @dataclub/ki-models-ui

Geteilte **Angular-Library** für die KI-Modell-Admin-UI von EduPro + Switcher.
Komponenten zur Cascade-Verwaltung, API-Key-Konfiguration und Modell-Tabelle —
einmal implementiert, in beiden Konsumenten genutzt.

Backend-Vertrag spiegelt die [`llm-cascade`-Sidecar](https://github.com/4dataclub/llm-cascade)
plus Konsumenten-eigene Proxy-Endpoints.

---

## Architektur

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   ┌─────────────────────┐                       ┌────────────────────┐  │
│   │ EduPro Admin (Tab   │                       │ Switcher Admin-UI  │  │
│   │ „KI-Modelle")       │                       │ (Vanilla → Angular │  │
│   │                     │                       │  Migration L.4)    │  │
│   │  ┌───────────────┐  │                       │  ┌──────────────┐  │  │
│   │  │ <ki-models-   │  │                       │  │ <ki-models-  │  │  │
│   │  │  table />     │  │                       │  │  table />    │  │  │
│   │  │ <ki-add-      │  │     @dataclub/        │  │ <ki-add-     │  │  │
│   │  │  model-form />│  │     ki-models-ui      │  │  model-form />│ │  │
│   │  │ <ki-cascade-  │  │ ◄───imports both ────►│  │ <ki-cascade- │  │  │
│   │  │  cooldown />  │  │                       │  │  cooldown /> │  │  │
│   │  │ <ki-api-keys- │  │                       │  │ <ki-api-keys-│  │  │
│   │  │  section />   │  │                       │  │  section />  │  │  │
│   │  └───────────────┘  │                       │  └──────────────┘  │  │
│   │                     │                       │  + Switcher-only:  │  │
│   │   + EduPro-only:    │                       │    Banner-Display, │  │
│   │     i18n-Keys,      │                       │    Restart-Button  │  │
│   │     Toast-Notifs    │                       │                    │  │
│   └─────────┬───────────┘                       └─────────┬──────────┘  │
│             │                                             │             │
│             │  HTTP via KiModelsApiService                │             │
│             ▼                                             ▼             │
│   ┌─────────────────────┐                       ┌────────────────────┐  │
│   │ EduPro Java-Backend │                       │ Switcher Java-Back │  │
│   │ /api/admin/*        │                       │ /api/*             │  │
│   │ (proxy zu cascade)  │                       │ (proxy zu cascade) │  │
│   └─────────┬───────────┘                       └─────────┬──────────┘  │
│             │                                             │             │
│             └───────────────────┬─────────────────────────┘             │
│                                 ▼                                       │
│                       ┌──────────────────────┐                          │
│                       │  llm-cascade Sidecar │                          │
│                       │  Spring Boot 3       │                          │
│                       │  /api/generate       │                          │
│                       │  /api/models CRUD    │                          │
│                       │  /api/settings       │                          │
│                       │  /api/health/keys    │                          │
│                       └──────────────────────┘                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Quick-Start

### Konsumenten-Setup (EduPro / Switcher / sonstige)

```typescript
// app.config.ts (Angular 17 Standalone)
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { KI_MODELS_API_BASE } from '@dataclub/ki-models-ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    { provide: KI_MODELS_API_BASE, useValue: '/api/admin' },  // EduPro
    // oder { provide: KI_MODELS_API_BASE, useValue: '/api' } für Switcher
  ],
};
```

### Komponenten einbinden

```html
<!-- admin.component.html -->
<ki-models-table
  (activeModelChanged)="onActiveModel($event)"
  (modelChanged)="reloadList()"
></ki-models-table>

<ki-add-model-form (modelCreated)="reloadList()"></ki-add-model-form>

<ki-cascade-cooldown></ki-cascade-cooldown>

<ki-api-keys-section></ki-api-keys-section>
```

```typescript
// admin.component.ts
import {
  ModelsTableComponent,
  AddModelFormComponent,
  CascadeCooldownComponent,
  ApiKeysSectionComponent,
  AiModel,
} from '@dataclub/ki-models-ui';

@Component({
  standalone: true,
  imports: [
    ModelsTableComponent,
    AddModelFormComponent,
    CascadeCooldownComponent,
    ApiKeysSectionComponent,
  ],
  templateUrl: './admin.component.html',
})
export class AdminComponent {
  onActiveModel(model: AiModel) {
    // Switcher: ccr-Restart-Marker schreiben.
    // EduPro: kein-op, oder Toast.
  }
  reloadList() {
    /* Konsument kann seine eigene Modell-Liste reloaden */
  }
}
```

---

## Backend-Vertrag

Konsumenten-Backend muss folgende Endpoints unter der konfigurierten Base
(`KI_MODELS_API_BASE`) bereitstellen. EduPro hat diese in `/api/admin/*`,
Switcher in `/api/*`.

| Method | Pfad                                        | Zweck                                  |
|--------|---------------------------------------------|----------------------------------------|
| GET    | `{base}/ai-models`                          | Liste aller Modelle                    |
| POST   | `{base}/ai-models`                          | Neues Modell anlegen                   |
| PUT    | `{base}/ai-models/{id}`                     | Modell ändern (Partial)                |
| DELETE | `{base}/ai-models/{id}`                     | Modell löschen                         |
| POST   | `{base}/ai-models/{id}/test`                | Connectivity-Test (returns latency/error) |
| POST   | `{base}/ai-models/reorder`                  | Reihenfolge ändern (`{orderedIds}`)    |
| POST   | `{base}/ai-models/{id}/toggle`              | Enable/Disable (`{enabled}`)           |
| GET    | `{base}/api-keys`                           | Liste aller Setting-Keys (maskiert)    |
| POST   | `{base}/api-keys/setting/{key}`             | Key setzen (`{value}`)                 |
| GET    | `{base}/cascade-config`                     | Cooldown-Override-State                |
| PUT    | `{base}/cascade-config`                     | Cooldown-Override setzen               |

Detaillierte Schemas: siehe TypeScript-Interfaces in
[`projects/ki-models-ui/src/lib/models/`](projects/ki-models-ui/src/lib/models/).

**Adapter-Pattern:** Wenn ein Konsument abweichende Routen hat (z.B. legacy-
endpoints), kann `KiModelsApiService` per Subclass + Provider-Override ersetzt
werden — die Components abstrahieren über den Service, nicht über die URLs
direkt.

---

## Build + Develop

```bash
# Library bauen
npx ng build ki-models-ui

# Library + lokal in einen Konsumenten linken
cd dist/ki-models-ui && npm pack
# Im Konsumenten:
npm i ../ki-models-ui/dist/ki-models-ui/dataclub-ki-models-ui-0.1.0.tgz
```

---

## Roadmap (Plan-File: `~/.claude/plans/was-ist-stand-delightful-wilkinson.md`)

| Phase | Inhalt                                                | Aufwand   |
|-------|-------------------------------------------------------|-----------|
| **L.1** | **Skeleton** — Repo, Workspace, leere Components, API-Service, Interfaces, README. **Aktueller Stand.** | ~3h ✓ |
| L.2   | Components portieren aus EduPro (volle UI: Tabelle, Add-Form, Cooldown, Keys) | ~6-8h |
| L.3   | EduPro auf Library umstellen                          | ~2h       |
| L.4   | Switcher von Vanilla auf Angular + Library importieren | ~10-12h   |
| L.5   | npm-Publish `@dataclub/ki-models-ui` 0.1.0             | ~30min    |

---

## Lizenz

Privat — `4dataclub`-internal. Keine externe Verteilung ohne Absprache.
