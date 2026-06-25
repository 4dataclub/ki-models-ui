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

## Eine Frage, drei Türen — wer wählt die Kategorie?

Die Mechanismen oben füllen pro Call **denselben einen `category`-Schlitz**.
Stell dir die Cascade als **Poststelle mit beschrifteten Fächern** vor: jede
Anfrage ist ein Brief, der in genau **ein** Fach muss. Es gibt **eine Frage** —
*„welches Fach / welcher Spezialist?"* — und drei Türen zur Antwort, mit fester
Präzedenz (`ApiController` im Backend):

```
 ① Body-`category`          → explizites Etikett (der Caller weiß es schon)
   │   schlägt …
 ② preferredCategory-Toggle → manueller Override (Pool-/Bereich-Hebel in der UI)
   │   schlägt …
 ③ purpose                  → SemanticCategoryRouter rät aus dem Inhalt
```

**Immer nur EINE Tür pro Brief** (① > ② > ③), nie zwei gleichzeitig. Das ist
genau der Mechanismus, den die `<ki-cascade-mode-panel>`-Komponente bedient:
ein Klick auf ein Bereich-Tab setzt ② (`preferredCategory`), das „Auto"-Tab
leert ihn wieder → zurück auf ③.

**Dieselbe Library, zwei Produkte — andere Tür:**

```
EduPro:    Briefe ohne Etikett → Tür ③ klassifiziert nach Task-Typ (1 Achse)
  ┌─────────┬──────┬─────────┬─────────┐
  │ Content │ Dev  │ Utility │ General │   ← Router/Toggle wählt
  └─────────┴──────┴─────────┴─────────┘

Switcher:  Orchestrator-Agent klebt Etiketten vorher → Tür ① (2 Achsen)
                cloud      free      local   ← Pool: Hebel ②
  orchestr. │ o-cloud  │ o-free  │ o-local │
  implement │ i-cloud  │ i-free  │ i-local │  ← Rolle: Etikett ①
  review …  │   …      │   …     │   …     │
```

Beide Konsumenten nutzen **dieselben Komponenten + denselben Backend-Pfad** —
der Unterschied ist nur, **wer** die Kategorie wählt und auf welcher Achse,
nicht der Code. (Die Matrix-Darstellung ist generisch: Achsen werden aus der
Backend-Kategorienliste abgeleitet; ein Produkt ohne Compound-Kategorien zeigt
die Rollen-Achse einfach nicht.)

## Konsumenten-Unterschied: Auto vs. Manuell

Nicht jeder Konsument will dass das System komplett autonom entscheidet.
EduPro vertraut Auto-Escalation, **Switcher will manuelle Kontrolle**.

```
Switcher heute:                                Switcher Vision (v0.12.0 mit Pattern):
─────────────────                              ──────────────────────────────────────
User: Provider wechseln manuell                 User: purpose="..." + escalate-Toggle
   ↓                                                ↓
Switcher routet hart auf                          Semantic Router liest descriptions:
einen ausgewählten Provider                         cloud: "Premium, voller Cooldown"
                                                    free-only: "Kostenfrei, rate-limited"
                                                    local: "Ollama lokal" ← description
                                                                            sagt was er kann
                                                    ↓
                                                  Simple Tasks → free-only / local
                                                  Komplexe Tasks → cloud (last resort)
                                                    ↓
                                                  Auto-Escalation bei „Output reicht nicht"
                                                  ABER: User kann pro Anfrage sagen
                                                  „bleib bei Tier X, escaliere NIE auf Cloud"
```

**Wie die Library das löst — neuer Input `[escalationMode]`:**

```html
<!-- Switcher: User entscheidet manuell -->
<ki-cascades-view
  [escalationMode]="userMode"          <!-- 'auto' | 'manual' -->
  [manualTier]="0"                     <!-- nur bei 'manual' relevant -->
  (escalationModeChange)="userMode = $event"
></ki-cascades-view>

<!-- EduPro: läuft autonom, kein Toggle -->
<ki-cascades-view [escalationMode]="'auto'"></ki-cascades-view>
```

**Was im UI dabei sichtbar wird (Switcher):**

```
┌────────────────────────────────────────────────────────────────────┐
│  ◆ Escalation-Modus:  (◉) Auto    ( ) Manuell — Stop bei Tier 0   │
│                                                                     │
│  Auto:    Backend escaliert bei Validator-Fail auf nächsten Tier  │
│  Manuell: Bleibt im selektierten Tier. Kein Cloud-Switching.      │
└────────────────────────────────────────────────────────────────────┘
```

**Konsumenten-Konfig-Tabelle:**

| App | Default-Modus | UI-Toggle? | Use-Case |
|---|---|---|---|
| **EduPro** | `auto` | nein, transparent | System soll selbst entscheiden |
| **Switcher** | `manual` | ja, prominent | User will Kontrolle, Datenschutz |
| **andere zukünftige Apps** | wählbar | beliebig | konsumenten-spezifisch |

---

## Hardware-Safety (umgesetzt — v0.15.0)

**Anforderung:** Die Library darf keine Modelle als „aktivierbar" anbieten,
wenn die Server-Hardware nicht reicht. Sonst killt ein zu großes Ollama-
Modell den ganzen Server beim Laden.

**Backend (llm-cascade ≥ 0.7.0) liefert pro Modell:**

```ts
interface AiModel {
  ...
  hardwareCompatible?: boolean;  // false = Server kann das nicht
  hardwareReason?: string;       // "Modell braucht 18 GB, frei nur 4.5 GB"
}
```

**Library-Verhalten (`<ki-models-table>`, seit v0.15.0):**
- Bei `hardwareCompatible=false` ein rotes Badge „⚠ Hardware unzureichend" +
  der `hardwareReason`-Text **direkt sichtbar** (gekürzt, voller Text per Hover)
  — man erkennt sofort warum.
- Enable-Toggle ist **disabled** (nur OFF→ON gesperrt; ein bereits aktives
  Modell bleibt abschaltbar). Tooltip erklärt den Grund.
- **Dynamisch:** die Sperre hängt am Live-Feld `hardwareCompatible`, das das
  Backend bei jedem `GET /ai-models` neu berechnet. Sobald die Hardware reicht
  (mehr RAM, **externer Server** zugewiesen, kleineres Modell) → nach ↻ Reload
  ist der Toggle automatisch wieder offen.

→ **Der User kann den Server NICHT versehentlich lahmlegen** — sieht aber
warum und wie er's lösen kann.

---

## Inferenz-Server pro Modell (v0.15.0)

Lokale Modelle (Ollama) laufen normalerweise auf „localhost". Über benannte
**Inferenz-Server** kann ein Modell seine Berechnung an einen externen Rechner
(z.B. eine GPU-Maschine) auslagern — Default bleibt localhost. Cloud-Provider
(Gemini, OpenRouter…) sind nicht betroffen (feste Endpoints).

- **`<ki-provider-servers>`** — eigene Komponente: Server anlegen/ändern/löschen,
  einen als Default markieren (Default nicht löschbar).
- **`<ki-add-model-form>`** + **`<ki-models-table>`** — Dropdown „Inferenz-Server"
  pro Modell (nur für `ollama`/`openai_compat`; Cloud zeigt „—").
- Backend: `ProviderServerResolver` (llm-cascade ≥ 0.8.0) löst die effektive
  Server-URL auf und routet den echten Call dorthin.

```
GET    {base}/provider-servers           → ProviderServer[]
PUT    {base}/provider-servers/{name}     → { ok }   { baseUrl, isDefault?, description? }
DELETE {base}/provider-servers/{name}     → { ok }   (Default nicht löschbar)
```

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

## Cooldown-Live-Anzeige (v0.15.0)

`<ki-models-cooldown-state>` und `<ki-cascades-view>` zeigen den Cooldown-Zähler
jetzt **live**: ein lokaler 1-Sekunden-Tick rechnet die Backend-Restzeit sichtbar
runter (kein zusätzlicher API-Traffic), und `<ki-cascades-view>` pollt zusätzlich
alle `autoRefreshSec` (Default 30s) neu. Vorher fror der Wert zwischen den Reloads
ein bzw. lud nur einmal — der Status „aktualisierte sich nicht".

---

## Single-Source-Seite `<ki-models-page>` (v0.17.0)

Statt jede `<ki-*>`-Sektion einzeln zu mounten, rendert **`<ki-models-page>`**
die komplette KI-Modell-Admin-Seite in kanonischer Reihenfolge (Verwaltung →
Supermodell → Statistiken). Ein nacktes `<ki-models-page></ki-models-page>`
funktioniert mit deutschen Defaults; alle Labels/Kategorie-Configs werden über
ein optionales `[config]`-Bündel (`KiModelsPageConfig`) durchgereicht. Ziel:
**Konsumenten mounten eine einzige Komponente — keine produktspezifische
Snowflake.**

```html
<ki-models-page
  [config]="pageConfig"
  [activePool]="activePool()"
  [supermodelOn]="supermodel()"
  (activeModelChanged)="onSwitchToModel($event)"
  (modelChanged)="reload()"
></ki-models-page>
```

Enthaltene Sektionen: `ki-cascade-cooldown`, `ki-cascades-view`,
`ki-models-table`, `ki-add-model-form`, `ki-api-keys-section`,
`ki-privacy-settings`, `ki-supermodel-matrix`, `ki-provider-servers`,
`ki-models-quality-stats`, `ki-models-performance`, `ki-models-cooldown-state`,
`ki-routing-decisions`, `ki-delegation-live`. `reload()` ist öffentlich — der
Host ruft es nach Pool-/Config-Wechsel (lädt Tabelle, Cascades-View und Matrix neu).

### Neue Komponenten (v0.17.0)

- **`<ki-supermodel-matrix>`** — Rollen-im-Pool-Matrix (Compound-Kategorien
  `<role>-<pool>`). Achsen konfigurierbar (`[pools]`, `[roles]`), Default
  cloud/free/local × orchestrator/implement/review/research/dispatch.
  **`[supermodelOn]` Default FALSE** — rendert nichts, bis der Host explizit
  einschaltet. `[disabled]=true` → sichtbar, aber gedimmt/gesperrt (EduPro-
  Vorschau). Kein Compound-Kategorie-Match → ruhiger Empty-State statt Crash.
- **`<ki-privacy-settings>`** — Datenschutz-Toggle für `logPromptSnippet`.
  **Default AUS (fail-closed)**; AN speichert pro Delegations-Call max. 160
  Zeichen Prompt-Ausschnitt (nur Debug/Live-Watch). Liest/schreibt via
  `getSettings()`/`setSetting()`.
- **`<ki-delegation-live>`** — Browser-Watcher der letzten Cascade-Aufrufe
  (Zeit, ✓/✗, `provider:model`, `[service]`, Output-Chars, Prompt-Snippet
  falls vorhanden). Auto-Refresh (`[autoRefreshSec]`, Default 5s), `[maxRows]`.

### Neue Service-Methoden (`KiModelsApiService`, v0.17.0)

```ts
getSettings(): Observable<AppSetting[]>                 // GET  {base}/settings
setSetting(key: string, value: string): Observable<…>   // POST {base}/settings/{key}
getDelegationCalls(): Observable<DelegationCall[]>       // GET  {base}/stats/calls
```

Neue Interfaces: `AppSetting { key; value }`,
`DelegationCall { id; calledAt; provider; model; service; success; outputChars; promptSnippet }`.

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
| GET    | `{base}/provider-servers`                   | Inferenz-Server-Liste (v0.15.0)        |
| PUT    | `{base}/provider-servers/{name}`            | Server anlegen/ändern (v0.15.0)        |
| DELETE | `{base}/provider-servers/{name}`            | Server löschen (Default nicht löschbar)|
| GET    | `{base}/settings`                           | App-Settings (`AppSetting[]`, v0.17.0) |
| POST   | `{base}/settings/{key}`                     | Setting setzen (`{value}`, v0.17.0)    |
| GET    | `{base}/stats/calls`                        | Delegations-Calls (`DelegationCall[]`, v0.17.0) |

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
