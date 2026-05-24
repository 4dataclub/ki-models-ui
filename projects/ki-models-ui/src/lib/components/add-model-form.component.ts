import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { AiModel, AiModelCreate } from '../models/ai-model';
import { ApiKeySetting } from '../models/api-key-setting';
import { AddModelFormLabels, ADD_MODEL_FORM_LABELS_EN } from '../models/labels';

/**
 * Form um ein neues AI-Modell zur Cascade hinzuzufügen.
 *
 * **Felder:**
 * - Provider-Dropdown (gemini, openai, anthropic, openrouter, deepseek, openai_compat)
 * - Model-ID-Combobox mit Provider-spezifischen Vorschlägen (datalist)
 * - apiKeySettingKey-Auswahl (vorbelegt aus existierenden API-Keys + Default per Provider)
 * - DisplayName (optional)
 * - Cooldown503OverrideSec (optional)
 * - Add-Button
 *
 * **Event:** `(modelCreated)` emittet das neue Model nach erfolgreichem POST.
 *
 * **Provider-Default-Keys:** Beim Provider-Wechsel wird `apiKeySettingKey`
 * automatisch auf `<provider>ApiKey` umgestellt (Convenience).
 */
@Component({
  selector: 'ki-add-model-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <form class="ki-add-model-form" (ngSubmit)="onSubmit()" #f="ngForm">
      <h4 class="ki-form-title">{{ L.title }}</h4>

      <div class="ki-grid">
        <select [(ngModel)]="provider"
                name="provider"
                (change)="onProviderChange()"
                class="ki-input">
          <option *ngFor="let p of L.providerOptions" [value]="p.value">{{ p.label }}</option>
        </select>

        <input [(ngModel)]="modelId"
               name="modelId"
               list="ki-model-id-suggestions"
               [placeholder]="L.fieldModelId"
               class="ki-input ki-mono"
               required />
        <datalist id="ki-model-id-suggestions">
          <option *ngFor="let s of modelIdSuggestions()" [value]="s"></option>
        </datalist>

        <select [(ngModel)]="apiKeySettingKey"
                name="apiKeySettingKey"
                class="ki-input ki-mono">
          <option value="" disabled>{{ L.fieldApiKeySettingKey }}</option>
          <option *ngFor="let k of keyOptions()" [value]="k.settingKey">
            {{ k.settingKey }} {{ k.configured ? '✓' : '' }}
          </option>
        </select>

        <select [(ngModel)]="category"
                name="category"
                class="ki-input"
                [attr.aria-label]="L.fieldCategory">
          <option *ngFor="let c of L.categoryOptions" [value]="c.value">{{ c.label }}</option>
        </select>

        <input [(ngModel)]="displayName"
               name="displayName"
               [placeholder]="L.fieldDisplayName"
               class="ki-input" />

        <input [(ngModel)]="cooldown503OverrideSec"
               name="cooldown503OverrideSec"
               type="number"
               [placeholder]="L.fieldCooldownOverride"
               class="ki-input" />

        <button type="submit"
                [disabled]="submitting() || !provider || !modelId || !apiKeySettingKey"
                class="ki-btn-primary">
          {{ submitting() ? L.btnAdding : L.btnAdd }}
        </button>
      </div>

      <p *ngIf="error()" class="ki-error">{{ error() }}</p>
      <p class="ki-hint">{{ L.hint }}</p>
    </form>
  `,
  styles: [`
    .ki-add-model-form { font-family: inherit; padding: 1rem 0; border-top: 1px solid #e2e8f0; }
    .ki-form-title {
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #475569;
      margin-bottom: 0.75rem;
    }
    .ki-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .ki-input {
      padding: 0.75rem;
      background: #f8fafc;
      border: 2px solid #f1f5f9;
      border-radius: 0.75rem;
      font-size: 0.875rem;
      font-weight: 700;
    }
    .ki-mono { font-family: ui-monospace, monospace; }
    .ki-btn-primary {
      padding: 0.75rem 1rem;
      background: #0f172a;
      color: white;
      border: none;
      border-radius: 1rem;
      text-transform: uppercase;
      font-weight: 800;
      letter-spacing: 0.1em;
      font-size: 0.75rem;
      cursor: pointer;
      grid-column: span 2;
    }
    .ki-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .ki-error { color: #b91c1c; font-weight: 700; margin-top: 0.5rem; font-size: 0.75rem; }
    .ki-hint { color: #94a3b8; font-size: 0.7rem; font-weight: 700; margin-top: 0.75rem; }
  `],
})
export class AddModelFormComponent {
  @Output() modelCreated = new EventEmitter<AiModel>();

  @Input() set labels(v: Partial<AddModelFormLabels> | undefined) {
    this.L = { ...ADD_MODEL_FORM_LABELS_EN, ...(v ?? {}) };
  }
  L: AddModelFormLabels = ADD_MODEL_FORM_LABELS_EN;

  private readonly api = inject(KiModelsApiService);

  // Form state
  provider = 'gemini';
  modelId = '';
  apiKeySettingKey = 'geminiApiKey';
  displayName = '';
  /**
   * Aktuell gewählte Kategorie. Default `'content'` (Backward-Compat zu
   * EduPro-Setup). Konsumenten mit anderen Kategorie-Schemata setzen den
   * Default über `[defaultCategoryByProvider]` (siehe unten) oder ändern
   * `categoryOptions` in den Labels — die erste Option wird dann beim
   * Provider-Wechsel selektiert wenn kein Match passt.
   */
  category: string = 'content';
  cooldown503OverrideSec: number | null = null;

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly keys = signal<ApiKeySetting[]>([]);

  private readonly defaultSettingKey: Record<string, string> = {
    gemini:        'geminiApiKey',
    openai:        'openaiApiKey',
    anthropic:     'anthropicApiKey',
    openrouter:    'openrouterApiKey',
    deepseek:      'deepseekApiKey',
    ollama:        'ollamaApiKey',
    openai_compat: 'customApiKey',
  };

  /**
   * Default-Kategorie pro Provider — heuristisch, weil typische Use-Cases klar
   * sind. User kann immer überschreiben.
   *   gemini       → content (Lehrmaterial, hochwertige Generierung)
   *   ollama       → utility (lokal, billig, gut für Übersetzungen)
   *   openrouter   → general (Mischbestand, oft Fallback)
   *   andere       → general
   */
  /**
   * Default-Kategorie pro Provider (Backward-Compat zum EduPro-Schema
   * `utility`/`content`/`general`). Konsumenten mit eigenem Schema
   * (z.B. Switcher mit `cloud`/`free-only`) überschreiben das via
   * `[defaultCategoryByProvider]`.
   */
  @Input() defaultCategoryByProvider: Record<string, string> = {
    gemini:        'content',
    openai:        'content',
    anthropic:     'content',
    openrouter:    'general',
    deepseek:      'utility',
    ollama:        'utility',
    openai_compat: 'general',
  };

  private readonly modelIdSuggestionsByProvider: Record<string, string[]> = {
    gemini: [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.5-pro',
      'gemini-3-flash-preview',
      'gemini-3-pro-preview',
    ],
    ollama: [
      'gemma3:4b',
      'gemma3:12b',
      'qwen2.5:7b',
      'llama3.2:3b',
    ],
    openai: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4.1',
      'gpt-4.1-mini',
      'o1-mini',
      'o1-preview',
    ],
    anthropic: [
      'claude-opus-4-7',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ],
    openrouter: [
      'deepseek/deepseek-v4-flash',
      'deepseek/deepseek-v4-pro',
      'deepseek/deepseek-chat-v3.1',
      'meta-llama/llama-3.3-70b-instruct:free',
      'openai/gpt-oss-120b:free',
    ],
    deepseek: [
      'deepseek-v4-flash',
      'deepseek-v4-pro',
      'deepseek-chat',
    ],
    openai_compat: [],
  };

  ngOnInit(): void {
    this.api.listKeys().subscribe({
      next: (list) => this.keys.set(list),
      error: () => this.keys.set([]),
    });
  }

  onProviderChange(): void {
    const def = this.defaultSettingKey[this.provider];
    if (def) this.apiKeySettingKey = def;
    const cat = this.defaultCategoryByProvider[this.provider];
    if (cat) this.category = cat;
  }

  modelIdSuggestions(): string[] {
    return this.modelIdSuggestionsByProvider[this.provider] ?? [];
  }

  /** Existierende Settings als Optionen + Default-Settings die noch nicht in DB sind. */
  keyOptions(): { settingKey: string; configured: boolean }[] {
    const existing = new Map<string, boolean>(this.keys().map((k) => [k.settingKey, k.configured]));
    // Default-settingKeys aus dem Mapping ergänzen (auch wenn DB sie noch nicht hat)
    Object.values(this.defaultSettingKey).forEach((sk) => {
      if (!existing.has(sk)) existing.set(sk, false);
    });
    return Array.from(existing.entries())
      .map(([settingKey, configured]) => ({ settingKey, configured }))
      .sort((a, b) => a.settingKey.localeCompare(b.settingKey));
  }

  onSubmit(): void {
    if (!this.provider || !this.modelId || !this.apiKeySettingKey) return;
    this.submitting.set(true);
    this.error.set(null);
    const body: AiModelCreate = {
      provider: this.provider.trim(),
      modelId: this.modelId.trim(),
      apiKeySettingKey: this.apiKeySettingKey.trim(),
      displayName: this.displayName?.trim() || undefined,
      category: this.category,
      cooldown503OverrideSec: this.cooldown503OverrideSec,
    };
    this.api.createModel(body).subscribe({
      next: (created) => {
        this.modelCreated.emit(created);
        this.modelId = '';
        this.displayName = '';
        this.cooldown503OverrideSec = null;
        this.submitting.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? this.L.errorFailed);
        this.submitting.set(false);
      },
    });
  }
}
