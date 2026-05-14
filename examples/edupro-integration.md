# EduPro-Integration (Phase L.3)

Wenn EduPro auf die Library umgestellt wird, sind das die Änderungen:

## 1. Dependency installieren

```bash
cd ~/Downloads/ki-projekte/edupro-learning-platform/angular-frontend
npm i @dataclub/ki-models-ui
```

(Erste Iteration: lokales `npm pack`-Tarball linken. Phase L.5 publishet
auf eine Registry.)

## 2. `app.config.ts` ergänzen

```typescript
import { provideHttpClient } from '@angular/common/http';
import { KI_MODELS_API_BASE } from '@dataclub/ki-models-ui';

export const appConfig: ApplicationConfig = {
  providers: [
    // bestehende provider …
    provideHttpClient(),
    { provide: KI_MODELS_API_BASE, useValue: '/api/admin' },
  ],
};
```

## 3. Admin-Component „KI-Modelle"-Tab ersetzen

Vorher (inline 600+ LOC in `admin.component.ts`):

```html
<div *ngIf="activeTab === 'ai-models'">
  <!-- alle Custom-Templates: Modell-Tabelle, Add-Form, Cooldown-Toggle,
       API-Keys-Section, alles inline … -->
</div>
```

Nachher:

```html
<div *ngIf="activeTab === 'ai-models'">
  <ki-cascade-cooldown></ki-cascade-cooldown>
  <ki-models-table (modelChanged)="onModelChange()"></ki-models-table>
  <ki-add-model-form (modelCreated)="onModelChange()"></ki-add-model-form>
  <ki-api-keys-section></ki-api-keys-section>
</div>
```

```typescript
// admin.component.ts
import {
  ModelsTableComponent,
  AddModelFormComponent,
  CascadeCooldownComponent,
  ApiKeysSectionComponent,
} from '@dataclub/ki-models-ui';

@Component({
  imports: [
    // bestehende imports …
    ModelsTableComponent,
    AddModelFormComponent,
    CascadeCooldownComponent,
    ApiKeysSectionComponent,
  ],
})
export class AdminComponent {
  onModelChange() {
    // optional: toast oder eigene Liste re-fetchen
  }
}
```

## 4. Bestehende Backend-Endpoints (kein Change)

EduPro's `AppController.java` hat schon:

- `GET /api/admin/ai-models`
- `POST/PUT/DELETE /api/admin/ai-models` + `/test` + `/reorder`
- `GET /api/admin/api-keys` + `POST /api/admin/api-keys/setting/{key}`
- `GET/PUT /api/admin/cascade-config`

→ Backend bleibt unangetastet.

## 5. Verifikation

```bash
docker compose build --no-cache frontend
docker compose up -d --force-recreate --no-deps frontend
```

Browser-Test in Incognito (laut `feedback_djavid_tests_in_incognito`):
Admin → KI-Modelle-Tab → alle Funktionen wie vorher (CRUD, Toggle, Test,
Reorder, Cooldown-Tri-State, Keys).
