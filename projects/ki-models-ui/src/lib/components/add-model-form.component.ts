import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { AiModel, AiModelCreate } from '../models/ai-model';

/**
 * Form um ein neues AI-Modell zur Cascade hinzuzufügen.
 *
 * **Skeleton** — Phase L.2 portiert: Provider-Dropdown (mit allen unterstützten
 * Providern), Model-ID-Combobox (mit Autocomplete pro Provider), settingKey-
 * Auswahl (Default `<provider>ApiKey` oder freie Eingabe), Submit-Validation.
 *
 * **Event:** `(modelCreated)` emittet das neue Model nach erfolgreichem POST,
 * Konsument kann die Models-Tabelle reloaden.
 */
@Component({
  selector: 'ki-add-model-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <form class="ki-add-model-form" (ngSubmit)="onSubmit()">
      <!-- TODO L.2: Provider-Dropdown + Model-ID-Combobox + settingKey-Select -->
      <input [(ngModel)]="provider" name="provider" placeholder="provider (z.B. gemini)" required />
      <input [(ngModel)]="modelId" name="modelId" placeholder="modelId (z.B. gemini-2.5-flash)" required />
      <input [(ngModel)]="apiKeySettingKey" name="apiKeySettingKey" placeholder="apiKeySettingKey (optional)" />
      <button type="submit" [disabled]="submitting()">Hinzufügen</button>
      <p *ngIf="error()" class="error">{{ error() }}</p>
    </form>
  `,
  styles: [`
    .ki-add-model-form { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .ki-add-model-form input { padding: 0.4rem; border: 1px solid #ccc; border-radius: 4px; }
    .error { color: #b91c1c; }
  `],
})
export class AddModelFormComponent {
  @Output() modelCreated = new EventEmitter<AiModel>();

  private readonly api = inject(KiModelsApiService);

  provider = '';
  modelId = '';
  apiKeySettingKey = '';

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  onSubmit(): void {
    if (!this.provider || !this.modelId) return;
    this.submitting.set(true);
    this.error.set(null);
    const body: AiModelCreate = {
      provider: this.provider,
      modelId: this.modelId,
      apiKeySettingKey: this.apiKeySettingKey || `${this.provider}ApiKey`,
    };
    this.api.createModel(body).subscribe({
      next: (created) => {
        this.modelCreated.emit(created);
        this.provider = '';
        this.modelId = '';
        this.apiKeySettingKey = '';
        this.submitting.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Fehler beim Anlegen');
        this.submitting.set(false);
      },
    });
  }
}
