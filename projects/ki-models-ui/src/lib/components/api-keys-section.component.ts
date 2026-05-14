import { Component, EventEmitter, Input, Output, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { ApiKeySetting } from '../models/api-key-setting';
import { ApiKeysSectionLabels, API_KEYS_SECTION_LABELS_EN } from '../models/labels';

interface KeyOption {
  settingKey: string;
  brand: string;
}

/**
 * Section zur Verwaltung aller API-Keys (settingKey-basiert).
 *
 * **Form (oben):** settingKey-Picker + Value-Input (mit Show/Hide) + Save-Button.
 * Konsument kann beim Add eines neuen Models einen settingKey wählen, der noch
 * keinen Value hat — der bleibt offen bis er hier gesetzt wird.
 *
 * **Status-Liste (unten):** alle konfigurierten settingKeys mit:
 * - Badge: Source (`db` vom Admin gesetzt oder `env` vom Boot-Default)
 * - Wert maskiert
 * - Actions: Edit (lädt in Form oben), Clear (löscht den DB-Override)
 *
 * **Event:** `(keyChanged)` emittet bei jedem Save/Clear damit Konsument seine
 * Modell-Liste neu laden kann (key-Konfiguration ändert sich → Models-Status
 * `keyConfigured` ändert sich).
 */
@Component({
  selector: 'ki-api-keys-section',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ki-keys-section">
      <h4 class="ki-section-title">{{ L.title }}</h4>
      <p class="ki-subtitle">{{ L.subtitle }}</p>

      <!-- Add/Edit Form -->
      <div class="ki-form-grid">
        <select [(ngModel)]="settingKey" class="ki-input ki-mono">
          <option value="" disabled>{{ L.fieldSettingKey }}</option>
          <option *ngFor="let k of keyOptions()" [value]="k.settingKey">
            {{ k.settingKey }} — {{ k.brand }}
          </option>
        </select>

        <div class="ki-input-wrap">
          <input [(ngModel)]="value"
                 [type]="showValue() ? 'text' : 'password'"
                 [placeholder]="L.fieldValue"
                 autocomplete="off"
                 spellcheck="false"
                 class="ki-input ki-mono ki-input-with-toggle" />
          <button type="button" (click)="showValue.set(!showValue())" class="ki-show-toggle">
            {{ showValue() ? L.btnHide : L.btnShow }}
          </button>
        </div>

        <button (click)="save()"
                [disabled]="!canSave() || saving()"
                class="ki-btn-primary">
          {{ saving() ? L.btnSaving : L.btnSave }}
        </button>
      </div>

      <!-- Status-Liste -->
      <ng-container *ngIf="configuredKeys().length > 0; else noKeys">
        <h5 class="ki-list-title">{{ L.listTitle }}</h5>
        <div class="ki-table-wrap">
          <table class="ki-table">
            <thead>
              <tr>
                <th>{{ L.colSettingKey }}</th>
                <th>{{ L.colSource }}</th>
                <th>{{ L.colValue }}</th>
                <th class="ki-right">{{ L.colActions }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let k of configuredKeys()">
                <td class="ki-mono">
                  <strong>{{ k.settingKey }}</strong>
                </td>
                <td>
                  <span class="ki-badge"
                        [class.ki-badge-db]="k.keySource === 'db'"
                        [class.ki-badge-env]="k.keySource !== 'db'">
                    {{ k.keySource === 'db' ? L.sourceDb : (k.configured ? L.sourceEnv : L.sourceMissing) }}
                  </span>
                </td>
                <td class="ki-mono ki-value">{{ k.valueMasked || '…' }}</td>
                <td class="ki-right">
                  <button (click)="editKey(k)" class="ki-btn-secondary">{{ L.btnEdit }}</button>
                  <button *ngIf="k.keySource === 'db'"
                          (click)="clearKey(k)"
                          [disabled]="clearing() === k.settingKey"
                          class="ki-btn-danger">
                    {{ clearing() === k.settingKey ? '…' : L.btnClear }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>
      <ng-template #noKeys>
        <p class="ki-empty">{{ L.empty }}</p>
      </ng-template>

      <p class="ki-hint">{{ L.hint }}</p>
    </div>
  `,
  styles: [`
    .ki-keys-section { font-family: inherit; padding: 1.5rem 0; }
    .ki-section-title {
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #475569;
      margin-bottom: 0.5rem;
    }
    .ki-subtitle { color: #64748b; font-size: 0.75rem; font-weight: 700; margin-bottom: 1.25rem; }
    .ki-list-title {
      font-size: 0.625rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #94a3b8;
      margin: 1.5rem 0 0.75rem;
    }
    .ki-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; }
    .ki-input {
      padding: 0.75rem;
      background: #f8fafc;
      border: 2px solid #f1f5f9;
      border-radius: 0.75rem;
      font-size: 0.875rem;
      font-weight: 700;
    }
    .ki-mono { font-family: ui-monospace, monospace; }
    .ki-input-wrap { position: relative; }
    .ki-input-with-toggle { width: 100%; padding-right: 4rem; box-sizing: border-box; }
    .ki-show-toggle {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      padding: 0.25rem 0.5rem;
      font-size: 0.625rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
    }
    .ki-btn-primary {
      grid-column: span 2;
      padding: 0.75rem 1rem;
      background: #dc2626;
      color: white;
      border: none;
      border-radius: 1rem;
      text-transform: uppercase;
      font-weight: 800;
      letter-spacing: 0.1em;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .ki-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .ki-btn-secondary, .ki-btn-danger {
      padding: 0.3rem 0.7rem;
      border-radius: 0.375rem;
      font-size: 0.625rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: none;
      cursor: pointer;
    }
    .ki-btn-secondary { background: #f1f5f9; color: #1e293b; margin-right: 0.25rem; }
    .ki-btn-danger { background: #fee2e2; color: #991b1b; }
    .ki-btn-danger:disabled { opacity: 0.4; cursor: not-allowed; }
    .ki-table-wrap { overflow-x: auto; }
    .ki-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .ki-table thead { border-bottom: 1px solid #f1f5f9; }
    .ki-table th {
      padding: 0.5rem 0.5rem;
      text-align: left;
      text-transform: uppercase;
      font-size: 0.625rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: #94a3b8;
    }
    .ki-table td { padding: 0.75rem 0.5rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .ki-right { text-align: right; }
    .ki-badge {
      display: inline-block;
      padding: 0.25rem 0.7rem;
      border-radius: 999px;
      font-size: 0.625rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .ki-badge-db { background: #d1fae5; color: #065f46; }
    .ki-badge-env { background: #e2e8f0; color: #475569; }
    .ki-value { color: #64748b; }
    .ki-empty { color: #94a3b8; font-style: italic; font-size: 0.75rem; font-weight: 700; }
    .ki-hint { color: #94a3b8; font-size: 0.7rem; font-weight: 700; margin-top: 1rem; }
  `],
})
export class ApiKeysSectionComponent {
  @Output() keyChanged = new EventEmitter<string>();

  @Input() set labels(v: Partial<ApiKeysSectionLabels> | undefined) {
    this.L = { ...API_KEYS_SECTION_LABELS_EN, ...(v ?? {}) };
  }
  L: ApiKeysSectionLabels = API_KEYS_SECTION_LABELS_EN;

  private readonly api = inject(KiModelsApiService);

  readonly loading = signal(true);
  readonly keys = signal<ApiKeySetting[]>([]);

  // Form state
  settingKey = '';
  value = '';
  readonly showValue = signal(false);
  readonly saving = signal(false);
  readonly clearing = signal<string | null>(null);

  /** Bekannte Default-Settings + ihre Brand-Labels (für Add-Form Vorschläge). */
  private readonly defaultCards: KeyOption[] = [
    { settingKey: 'geminiApiKey',     brand: 'Gemini (Google)' },
    { settingKey: 'openaiApiKey',     brand: 'OpenAI' },
    { settingKey: 'anthropicApiKey',  brand: 'Anthropic' },
    { settingKey: 'openrouterApiKey', brand: 'OpenRouter' },
    { settingKey: 'deepseekApiKey',   brand: 'DeepSeek' },
    { settingKey: 'customApiKey',     brand: 'Custom (OpenAI-compat)' },
  ];

  readonly configuredKeys = computed(() => this.keys().filter((k) => k.configured));

  /** Default-Settings + dynamische (aus DB) als Options im Dropdown. */
  keyOptions(): KeyOption[] {
    const fromApi = new Set(this.keys().map((k) => k.settingKey));
    const dynamic = Array.from(fromApi)
      .filter((k) => !this.defaultCards.find((d) => d.settingKey === k))
      .map((k) => ({ settingKey: k, brand: 'Custom' }));
    return [...this.defaultCards, ...dynamic].sort((a, b) => a.settingKey.localeCompare(b.settingKey));
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.listKeys().subscribe({
      next: (list) => {
        this.keys.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  canSave(): boolean {
    return !!this.settingKey && !this.saving();
  }

  save(): void {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.api.setKey(this.settingKey, { value: this.value }).subscribe({
      next: () => {
        this.keyChanged.emit(this.settingKey);
        this.value = '';
        this.showValue.set(false);
        this.saving.set(false);
        this.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  editKey(k: ApiKeySetting): void {
    this.settingKey = k.settingKey;
    this.value = '';
    this.showValue.set(false);
  }

  clearKey(k: ApiKeySetting): void {
    if (!confirm(this.L.confirmClear(k.settingKey))) return;
    this.clearing.set(k.settingKey);
    this.api.setKey(k.settingKey, { value: '' }).subscribe({
      next: () => {
        this.keyChanged.emit(k.settingKey);
        this.clearing.set(null);
        this.reload();
      },
      error: () => this.clearing.set(null),
    });
  }
}
