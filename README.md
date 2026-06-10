# @4dataclub/ki-models-ui

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
│   │  │ <ki-add-      │  │     @4dataclub/       │  │ <ki-add-     │  │  │
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
import { KI_MODELS_API_BASE } from '@4dataclub/ki-models-ui';

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
} from '@4dataclub/ki-models-ui';

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

## Kategorien — generisch seit v0.10.0

Jedes Modell hat eine `category` (Routing-Stempel). Die Library schreibt
**keine** Kategorien vor — Konsumenten entscheiden selbst, welche Kategorien
ihre Cascade hat. Beispiele:

| Konsument | Kategorien                          | Bedeutung                                          |
|-----------|-------------------------------------|----------------------------------------------------|
| EduPro    | `utility` / `content` / `general`   | Task-Typ (Audits vs. Lehr-Content vs. Fallback)    |
| Switcher  | `cloud` / `free-only`               | Kosten-Tier (Premium vs. Rate-Limited-Free)        |
| (Beispiel)| `local` / `cloud` / `general`       | Wenn Ollama-Modelle lokal danebenlaufen sollen     |

**Wie funktioniert das visuell?**

```
┌──────────────────────────────────────────────────────┐
│   Models-Tabelle gruppiert nach Kategorie            │
│                                                      │
│   ┌─ CLOUD ──────────────────────────────────────┐   │
│   │  Premium-Modelle, eigener Cooldown           │   │
│   │  • anthropic:claude-opus-4-7      [ON]       │   │
│   │  • gemini:gemini-2.5-pro          [ON]       │   │
│   └──────────────────────────────────────────────┘   │
│                                                      │
│   ┌─ FREE ONLY ──────────────────────────────────┐   │
│   │  Kostenfreie OpenRouter-Modelle              │   │
│   │  • openrouter:deepseek-v3:free    [ON]       │   │
│   │  • openrouter:llama-3.3:free      [ON]       │   │
│   └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

**Was muss der Konsument tun?** Drei Inputs an `<ki-models-table>`:

```html
<ki-models-table
  [categoryTitles]="{ cloud: 'Cloud — Premium', 'free-only': 'Free Tier' }"
  [categoryHints]="{
    cloud: 'Bezahlte Tier-Modelle, eigener Cooldown.',
    'free-only': 'Kostenfrei via OpenRouter, kein Cooldown.'
  }"
  [categoryOrder]="['cloud', 'free-only']"
></ki-models-table>
```

Wenn der Konsument **nichts** angibt: Backward-Compat — `utility`/`content`/
`general` bekommen die englischen Defaults aus den Labels, alles andere wird
capitalized (`free-only` → `Free Only`). Sortiert wird dann nach erstem
Auftreten in der Modell-Liste (= globaler `orderIdx`).

**Validierung am Backend:** `llm-cascade` akzeptiert jeden String nach
`[a-z0-9_-]{1,50}` — alles andere fällt auf `general` zurück. Siehe
[`ApiController.normalizeCategory`](https://github.com/4dataclub/llm-cascade/blob/main/src/main/java/com/dataclub/llmcascade/controller/ApiController.java).

---

## Kategorien als Tiers — die zentrale Architektur-Idee

Die `category_meta.orderIdx` ist nicht nur „UI-Sortierung" — sie definiert
**Eskalations-Tiers**. Lokale, billige Modelle stehen in Tier 0; Cloud-Premium
in Tier N. Wenn ein Modell die Aufgabe nicht packt, eskaliert llm-cascade
automatisch auf das nächste Tier (Auto-Escalation, ab `llm-cascade ≥ 0.7.0`).

```
┌──────────────────────────────────────────────────────────────────────┐
│  Kategorien WERDEN zu Tiers                                          │
│                                                                       │
│  category    orderIdx   Modelle                  Tier-Charakter      │
│  ────────    ────────   ───────────────────────  ─────────────────── │
│  utility            0   ollama:llama3.2:3b       Tier 0: lokal,     │
│                         ollama:gemma3:4b           simpel, gratis    │
│                                                                       │
│  content            1   gemini-2.5-flash         Tier 1: Cloud      │
│                         gemini-2.5-flash-lite      mittel, billig    │
│                                                                       │
│  dev                2   gemini-2.5-pro           Tier 2: Cloud      │
│                         claude-opus-4-7            premium, komplex  │
│                                                                       │
│  general           99   (was übrig bleibt)       globaler Fallback  │
└──────────────────────────────────────────────────────────────────────┘
```

**Was du als Admin im UI definierst** (alles ohne Code-Edit):
- **Kategorien + descriptions** — Semantic Router weiß was wofür
- **`orderIdx`** — Tier-Reihenfolge für Eskalation
- **Modelle pro Kategorie** — was probiert wird

→ User-controllable, ohne Neustart wirksam (Cache wird bei jedem
`PUT /categories/{name}` invalidiert).

---

## Drei Routing-Mechanismen

Der Caller hat drei Möglichkeiten, wie er die Cascade nutzt. Sie kombinieren
sich beliebig:

### 1. Explizite Kategorie (klassisch, immer verfügbar)

```ts
POST /api/generate
{ "prompt": "...", "category": "content" }
```

llm-cascade probiert nur Modelle mit `category=content` (plus `general` als
Fallback). Failover bei HTTP-Fehler innerhalb derselben Kategorie.

### 2. Semantic Routing via `purpose` (seit v0.6.0 — live)

```ts
POST /api/generate
{ "prompt": "...", "purpose": "übersetze deutsche i18n keys nach französisch" }
```

llm-cascade macht einen Mini-LLM-Call mit den `category_meta.description`-
Texten und entscheidet welche Kategorie passt. Resultat wird gecached
(LRU 1000 Slots, 24h TTL, key = SHA-256 des purpose). Cache invalidiert
sich automatisch bei jedem `PUT/DELETE /api/categories/{name}`.

### 3. Auto-Escalation via `escalate` (geplant — v0.7.0)

```ts
POST /api/generate
{
  "prompt": "Generiere Mathe-Übung 7. Klasse",
  "purpose": "Lehrcontent für Schulkinder",
  "escalate": true,
  "validatorSchema": { ... JSON-Schema ... }
}
```

llm-cascade entscheidet **alles selbst**:

```
┌──────────────────────────────────────────────────────────────────┐
│  [1] Semantic Router wählt Initial-Tier:                         │
│      Liest category_meta.description aller Kategorien.           │
│      → Antwort: „content" (z.B. weil description „Lehrcontent")  │
│                                                                   │
│  [2] Versuche Initial-Tier (alle Modelle in content):            │
│      gemini-2.5-flash → Antwort                                  │
│      Validator-Pipeline:                                          │
│        • JSON.parse() ok?                                        │
│        • validatorSchema-Match?                                  │
│        • Quality-Heuristik (Refusal-Phrasen, Min-Length)         │
│      ✗ Schema-fail → ESCALATE                                    │
│                                                                   │
│  [3] Auto-Escalation auf nächstes Tier (orderIdx +1):            │
│      → Tier „dev"                                                │
│      gemini-2.5-pro → Antwort                                    │
│      Validator → ✓ pass → RETURN                                 │
└──────────────────────────────────────────────────────────────────┘
```

**Vorteil:** Caller-Code wird minimal — er braucht nichts über Modelle
wissen, nur seinen `purpose` beschreiben und ein Schema mitschicken.

---

## Dynamisches Routing pro Caller — Beispiel-Use-Cases

Jeder Caller (Service, Agent) liefert seinen eigenen `purpose`. Der Router
entscheidet pro Call individuell:

```
ExercisePoolService          purpose="Mathe-Übung 7. Klasse"           → content
VocabularyI18nService        purpose="übersetze i18n keys nach FR"     → utility
ExamGeneratorService         purpose="Prüfung schwierig + Erklärungen" → content/dev
TesterAgent                  purpose="Test-Cases für UserService Java" → dev
BackendAgent                 purpose="Spring Boot Endpoint generieren" → dev
FrontendAgent                purpose="Angular Component User-Profil"   → dev
ProjektleiterAgent           purpose="Sprint-Plan aus 12 PRs"          → content/dev
ChatAgent (kindgerecht)      purpose="Schüler-Chat Photosynthese"      → content
SwitcherClaude (lokal-first) purpose="schneller Refactor Java"         → free-only/local
```

→ **Eine Cascade-API, beliebig viele Caller, jeder bekommt seinen optimalen
Routing-Pfad.** Du als Admin definierst nur die Kategorien + descriptions.

---

## Hardware-Realitäts-Check

Lokale Modelle hängen an Server-Hardware:

| Modell                | RAM-Bedarf | Status auf CPU-Only mit 8 GB RAM |
|-----------------------|-----------:|----------------------------------|
| `llama3.2:3b`         | ~2 GB      | ✓ stabil                         |
| `gemma3:4b`           | ~3 GB      | ✓ stabil                         |
| `qwen2.5:7b-instruct` | ~5 GB      | ✗ OOM-Crash beim Laden          |
| `qwen3-coder:30b`     | ~18 GB     | ✗ braucht GPU mit 24 GB VRAM    |
| `gemma4:24b`          | ~16 GB     | ✗ braucht GPU mit 16 GB VRAM    |
| `llama3.1:70b`        | ~40 GB     | ✗ braucht GPU-Cluster           |

**Konsequenz:** Auf CPU-Only-Servern stehen in Tier 0 nur 3-4B-Modelle.
Tier 1+ MUSS Cloud sein. Für „echtes lokal-only" → 16+ GB VRAM-Hardware.

Die Library schreibt das aber nicht vor — wer Firma-Hardware hat, kann
auch `qwen3-coder:30b` oder `gemma4:24b` in `utility` packen. Die
Vorschlagsliste im Add-Form (v0.11.5) deckt beides ab.

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
npm i ../ki-models-ui/dist/ki-models-ui/4dataclub-ki-models-ui-0.1.0.tgz
```

---

## Roadmap (Plan-File: `~/.claude/plans/was-ist-stand-delightful-wilkinson.md`)

| Phase | Inhalt                                                | Status   |
|-------|-------------------------------------------------------|----------|
| L.1   | Skeleton — Repo, Workspace, Stub-Components, API-Service, Interfaces, README | ✓ |
| L.2   | Components voll portiert aus EduPro (Tabelle, Add-Form, Cooldown, Keys) | ✓ |
| L.2b  | `@Input() labels`-Pattern für i18n-Override pro Component | ✓ |
| L.3   | EduPro auf Library umgestellt (admin „KI-Modelle"-Tab) | ✓ |
| L.4   | Switcher Vanilla → Angular + Library + Switcher-spezifische Components + SSE | ✓ |
| L.5   | npm-Publish auf GitHub Packages Registry — siehe [PUBLISHING.md](PUBLISHING.md) | Setup ✓ — Publish manuell |

---

## Lizenz

Privat — `4dataclub`-internal. Keine externe Verteilung ohne Absprache.
