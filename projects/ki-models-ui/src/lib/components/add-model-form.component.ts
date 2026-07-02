import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { AiModel, AiModelCreate } from '../models/ai-model';
import { ApiKeySetting } from '../models/api-key-setting';
import { Category } from '../models/category';
import { ProviderServer } from '../models/provider-server';
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

        <!-- v0.10.2: <input list> statt <select> — bestehende Kategorien werden
             als Vorschläge angezeigt, der User kann aber auch eine NEUE Kategorie
             frei tippen (z.B. "local", "ollama") und damit eine neue Cascade
             implizit anlegen. Backend (llm-cascade ≥ 0.5.0) akzeptiert jeden
             Identifier nach [a-z0-9_-]{1,50} und fällt sonst auf "general" zurück.
             -->
        <input [(ngModel)]="category"
               name="category"
               list="ki-category-suggestions"
               [placeholder]="L.fieldCategory"
               [attr.aria-label]="L.fieldCategory"
               class="ki-input ki-mono"
               (change)="onCategoryInput()" />
        <datalist id="ki-category-suggestions">
          <option *ngFor="let c of categoryDropdownOptions()" [value]="c.value">{{ c.label }}</option>
        </datalist>

        <input [(ngModel)]="displayName"
               name="displayName"
               [placeholder]="L.fieldDisplayName"
               class="ki-input" />

        <input [(ngModel)]="cooldown503OverrideSec"
               name="cooldown503OverrideSec"
               type="number"
               [placeholder]="L.fieldCooldownOverride"
               class="ki-input" />

        <!-- v0.15.0 — Inferenz-Server nur für lokale/self-hosted Provider
             (Ollama / openai_compat). Cloud-Provider haben feste Endpoints. -->
        <select *ngIf="provider === 'ollama' || provider === 'openai_compat'"
                [(ngModel)]="providerServerName"
                name="providerServerName"
                class="ki-input ki-mono"
                [attr.aria-label]="L.fieldProviderServer">
          <option value="">{{ L.providerServerDefault }}</option>
          <option *ngFor="let s of providerServers()" [value]="s.name">{{ s.name }}</option>
        </select>

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
  /** v0.15.0 — gewählter Inferenz-Server (leer = Default „localhost"). */
  providerServerName = '';

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly keys = signal<ApiKeySetting[]>([]);
  /** v0.15.0 — benannte Server fürs Dropdown (leer wenn Backend < 0.8.0). */
  readonly providerServers = signal<ProviderServer[]>([]);

  /**
   * Kategorien aus dem Backend (v0.10.0 — `GET {base}/categories`). Wird im
   * `ngOnInit` befüllt; bei 404 (Backend ohne CategoryMeta-Endpoint) bleibt
   * das leer und das Dropdown fällt auf `L.categoryOptions` zurück
   * (Konsumenten-Labels — Backward-Compat zu EduPros utility/content/general).
   */
  readonly categoriesFromBackend = signal<Category[]>([]);

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
  /**
   * Supermodell-Modus (Switcher-Konsument). Steuert das Kategorie-Dropdown:
   *
   *  - `true`  → nur Rollen-Areas (orchestrator/implement/review/research/dispatch)
   *              werden im Datalist angeboten. Der Router routet Rollen-Compounds
   *              (`{role}-{pool}`) nur bei expliziter Kategorie-Adressierung, daher
   *              gehört das UI-Anlegen im AN-Modus zu diesem Set.
   *  - `false` → nur AUS-Areas (alles ausser den 5 Rollen). Aktuell z.B.
   *              general/dev/utility/content plus die Pool-Fallback-Namen
   *              (cloud/free/local). Freie Areas kann der User weiterhin
   *              per Freitext-Eingabe anlegen.
   *  - `undefined` → kein Filter (EduPro-Verhalten, alle Kategorien sichtbar).
   */
  @Input() supermodelOn?: boolean;

  /** Areas die im supermodel=AN-Modus als AN-Compounds klassifiziert werden. */
  private readonly ROLE_AREAS = new Set([
    'orchestrator', 'implement', 'review', 'research', 'dispatch'
  ]);

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
    // Ollama-Vorschläge — sortiert grob nach Größe (klein → groß).
    // Kleine Modelle (≤7B) laufen auf CPU-only-Servern; größere brauchen GPU
    // mit min. der angegebenen VRAM. Die ID ist nur ein Tipp im Dropdown —
    // Ollama pullt das Modell beim ersten Call automatisch wenn lokal nicht
    // vorhanden. Wer auf einer Firmen-Maschine mit 16+ GB VRAM arbeitet,
    // wählt entsprechend größere Modelle für mehr Qualität.
    ollama: [
      // ── Klein (CPU-tauglich, < 8 GB RAM) ──
      'llama3.2:3b',           // 2 GB
      'gemma3:4b',             // 3 GB
      'qwen2.5:7b-instruct',   // 5 GB (knapp auf 8 GB RAM)
      'gemma3:12b',            // 8 GB (braucht GPU für gute Speed)
      // ── Mittel (GPU empfohlen, 12-16 GB VRAM) ──
      'gemma2:27b',            // ~16 GB VRAM
      'qwen2.5:14b-instruct',  // ~10 GB VRAM
      'llama3.1:8b',           // 6 GB VRAM
      // ── Groß (16-24 GB VRAM, Firmen-Hardware) ──
      'gemma4:24b',            // ~16 GB VRAM (analog XDA-Artikel)
      'qwen3-coder:30b',       // ~18 GB VRAM (Coding-Workhorse)
      'qwen2.5:32b-instruct',  // ~20 GB VRAM
      // ── Sehr groß (40+ GB VRAM / Multi-GPU) ──
      'llama3.1:70b',          // ~40 GB VRAM
      'qwen2.5:72b-instruct',  // ~45 GB VRAM
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
      // Cloud-Hosted-Variante grosser Open-Source-Modelle — wenn man die
      // selbe Modell-Familie nutzen will ohne eigene GPU-Hardware. Praktisch
      // als Mittel-Tier zwischen lokal-klein und Premium-Cloud.
      'deepseek/deepseek-v4-flash',
      'deepseek/deepseek-v4-pro',
      'deepseek/deepseek-chat-v3.1',
      'meta-llama/llama-3.3-70b-instruct',
      'meta-llama/llama-3.3-70b-instruct:free',
      'meta-llama/llama-3.1-405b-instruct',
      'qwen/qwen3-coder-30b',
      'qwen/qwen-2.5-72b-instruct',
      'google/gemma-4-24b',
      'google/gemma-2-27b-it',
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
    this.api.listProviderServers().subscribe({
      next: (list) => this.providerServers.set(list ?? []),
      error: () => this.providerServers.set([]),
    });
    this.api.listCategories().subscribe({
      next: (list) => {
        this.categoriesFromBackend.set(Array.isArray(list) ? list : []);
        // Wenn das aktuell selektierte `category` nicht im Backend-Set steckt
        // (z.B. EduPro mit utility/content/general gegen Switcher-Schema cloud/
        // free-only), nimm die erste Backend-Kategorie als Default — sonst
        // submitted die Form einen ungültigen Wert.
        const opts = this.categoryDropdownOptions();
        if (opts.length && !opts.some(o => o.value === this.category)) {
          this.category = opts[0].value;
        }
      },
      error: () => this.categoriesFromBackend.set([]),
    });
  }

  onProviderChange(): void {
    const def = this.defaultSettingKey[this.provider];
    if (def) this.apiKeySettingKey = def;
    const cat = this.defaultCategoryByProvider[this.provider];
    // Default-Category nur setzen wenn sie auch im Dropdown ist (sonst hätte
    // der User eine selektierte Kategorie die das Dropdown nicht anzeigt).
    if (cat && this.categoryDropdownOptions().some(o => o.value === cat)) {
      this.category = cat;
    }
  }

  modelIdSuggestions(): string[] {
    return this.modelIdSuggestionsByProvider[this.provider] ?? [];
  }

  /**
   * Normalisiert die Kategorie-Eingabe live während des Tippens
   * — lowercase, Trim, Whitespace → `-`. Erlaubte Zeichen sind
   * `[a-z0-9_-]{1,50}`; alles andere wird stillschweigend entfernt
   * (Backend würde sonst auf `general` zurückfallen). v0.10.2 — Folge
   * der Umstellung von `<select>` auf `<input list>` damit neue
   * Kategorien per Freitext angelegt werden können.
   */
  onCategoryInput(): void {
    const raw = (this.category ?? '').toString().trim().toLowerCase();
    const cleaned = raw.replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 50);
    if (cleaned !== this.category) this.category = cleaned;
  }

  /**
   * Optionen für das Kategorie-Dropdown. Reihenfolge:
   *   1. Backend-Kategorien (`/api/categories`) — wenn vorhanden, nutzt
   *      `displayName` falls gesetzt sonst Capitalized `name`.
   *   2. `L.categoryOptions` aus den Labels (Konsumenten-Default) — Fallback
   *      für Backend-Versionen ohne CategoryMeta-Endpoint.
   *
   * So bekommt jeder Konsument automatisch SEINE Kategorien (Switcher:
   * cloud/free-only/…, EduPro: utility/content/general) ohne dass die
   * Library oder der Konsument das hardcodieren muss.
   */
  categoryDropdownOptions(): { value: string; label: string }[] {
    const backend = this.categoriesFromBackend();
    const source = backend.length > 0
      ? backend.map(c => ({
          value: c.name,
          label: c.displayName?.trim() || this.prettifyCategory(c.name),
        }))
      : this.L.categoryOptions;
    return this.applyModeFilter(source);
  }

  /**
   * Filtert Kategorien nach {@link supermodelOn}. Ein Category-Name matcht als
   * Rollen-Compound wenn er entweder exakt einem Rollen-Namen entspricht
   * (`implement`) oder dem Muster `{role}-{suffix}` folgt (`implement-cloud`).
   */
  private applyModeFilter(
    opts: { value: string; label: string }[]
  ): { value: string; label: string }[] {
    if (this.supermodelOn === undefined) return opts;
    return opts.filter(o => {
      const isRole = this.isRoleCategory(o.value);
      return this.supermodelOn ? isRole : !isRole;
    });
  }

  private isRoleCategory(name: string): boolean {
    const n = (name ?? '').toLowerCase();
    if (this.ROLE_AREAS.has(n)) return true;
    const dash = n.indexOf('-');
    if (dash <= 0) return false;
    return this.ROLE_AREAS.has(n.substring(0, dash));
  }

  private prettifyCategory(c: string): string {
    return c.replace(/[-_]+/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
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
      providerServerName: this.providerServerName || undefined,
    };
    this.api.createModel(body).subscribe({
      next: (created) => {
        this.modelCreated.emit(created);
        this.modelId = '';
        this.displayName = '';
        this.cooldown503OverrideSec = null;
        this.providerServerName = '';
        this.submitting.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? this.L.errorFailed);
        this.submitting.set(false);
      },
    });
  }
}
