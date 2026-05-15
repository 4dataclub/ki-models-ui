# Switcher-Integration (Phase L.4)

Switcher ist aktuell Vanilla-JS + Tailwind-CDN. Phase L.4 migriert auf
Angular 17 Standalone und importiert die Library. Skeleton-Schritte:

## 1. Angular-Workspace im Switcher-Repo

```bash
cd ~/Downloads/ki-projekte/claude-switcher
npx --yes @angular/cli@17 new angular-frontend --routing --style=css --standalone
```

## 2. Library installieren

```bash
cd angular-frontend
npm i @4dataclub/ki-models-ui
# (Phase L.5 published auf Registry; erste Iteration via tarball)
```

## 3. `app.config.ts`

```typescript
import { provideHttpClient } from '@angular/common/http';
import { KI_MODELS_API_BASE } from '@4dataclub/ki-models-ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    { provide: KI_MODELS_API_BASE, useValue: '/api' },   // Switcher direkt, kein /admin
  ],
};
```

## 4. AppComponent — Library + Switcher-spezifische Components

Switcher hat ZUSÄTZLICH:

- **Banner-Display** (Quota-Warnung über `~/.claude/.switcher-restart` Marker)
- **Restart-Button** für Claude-CLI
- **Modus-Panel** (Manual / Auto-Failover Chain-Editor) — gehört in Library (Phase L.2)

```html
<div class="container">
  <!-- Switcher-only: Quota-Banner -->
  <app-quota-banner></app-quota-banner>

  <!-- Library: Cascade-Verwaltung -->
  <ki-cascade-cooldown></ki-cascade-cooldown>
  <ki-models-table
    (activeModelChanged)="onActiveSelected($event)"
  ></ki-models-table>
  <ki-add-model-form (modelCreated)="reload()"></ki-add-model-form>
  <ki-api-keys-section></ki-api-keys-section>

  <!-- Switcher-only: Aktion -->
  <app-restart-button></app-restart-button>
</div>
```

```typescript
import { AiModel, ModelsTableComponent, ...} from '@4dataclub/ki-models-ui';

@Component({
  /* ... */
})
export class AppComponent {
  onActiveSelected(model: AiModel) {
    // Switcher-spezifisch: HTTP-Call zum Switcher-Backend
    // POST /api/switch  + Wrapper schreibt Restart-Marker
    this.api.switchActive(model.provider, model.modelId).subscribe();
  }
}
```

## 5. nginx-Setup behalten

`nginx.conf` (im `switcher-frontend`-Container) muss weiter `/api/*` zu
`switcher-backend:2000` proxyen. Library-Calls gegen `/api/ai-models` etc.
landen so beim Java-Backend (PR #7 hat die Routes hinzugefügt).

## 6. Verifikation

```bash
docker compose build switcher-frontend
docker compose up -d --force-recreate --no-deps switcher-frontend
curl http://localhost:2000/api/cascade-models   # Library spricht hier
```

Plus Browser-Test in Incognito auf `http://localhost:2000`.
