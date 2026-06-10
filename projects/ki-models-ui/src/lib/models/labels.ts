/**
 * Label-Maps für i18n-Override.
 *
 * Konsumenten (EduPro mit i18n-Pipe, Switcher mit eigenen Strings) übergeben
 * via `<ki-… [labels]="myLabels">` ihre eigenen Strings. Library nutzt sensible
 * englische Defaults wenn nichts überschrieben wird.
 */

export interface ModelsTableLabels {
  refresh: string;
  loading: string;
  empty: string;
  colNum: string;
  colProvider: string;
  colModelId: string;
  colKey: string;
  colEnabled: string;
  colStatus: string;
  colCategory: string;
  colActions: string;
  keySet: string;
  keyMissing: string;
  on: string;
  off: string;
  autoDisabled: string;
  free: string;
  toggleNeedsKey: string;
  btnTest: string;
  btnReenable: string;
  btnDelete: string;
  /** „Als aktiv setzen" — nur sichtbar wenn `[showActiveAction]="true"`. */
  btnSetActive: string;
  /** Badge-Text für die Zeile des aktiven Modells. */
  activeBadge: string;
  /** Kategorie-Sektion-Überschriften (Phase R). */
  categoryUtility: string;
  categoryContent: string;
  categoryGeneral: string;
  /** Sub-Beschreibung pro Kategorie (kleine graue Zeile unter dem Header). */
  categoryUtilityHint: string;
  categoryContentHint: string;
  categoryGeneralHint: string;
  confirmDelete: (modelId: string) => string;
}

export const MODELS_TABLE_LABELS_EN: ModelsTableLabels = {
  refresh: 'Refresh',
  loading: 'Loading models…',
  empty: 'No models configured. Use the form below to add one.',
  colNum: '#',
  colProvider: 'Provider',
  colModelId: 'Model ID',
  colKey: 'Key',
  colEnabled: 'Enabled',
  colStatus: 'Status',
  colCategory: 'Category',
  colActions: 'Actions',
  keySet: 'Key set',
  keyMissing: 'Key missing',
  on: 'ON',
  off: 'OFF',
  autoDisabled: 'Auto-disabled',
  free: 'Free',
  toggleNeedsKey: 'Key required before enabling',
  btnTest: 'Test',
  btnReenable: 'Re-enable',
  btnDelete: 'Delete',
  btnSetActive: 'Use now',
  activeBadge: 'ACTIVE',
  categoryUtility: 'Utility',
  categoryContent: 'Content',
  categoryGeneral: 'General (fallback)',
  categoryUtilityHint: 'Translations, audits, verifier — cheap/free models preferred.',
  categoryContentHint: 'Lesson content, exams, chat — quality matters.',
  categoryGeneralHint: 'Used in both cascades when category-specific models are exhausted.',
  confirmDelete: (id) => `Delete model "${id}"?`,
};

export interface AddModelFormLabels {
  title: string;
  fieldModelId: string;
  fieldApiKeySettingKey: string;
  fieldDisplayName: string;
  fieldCategory: string;
  fieldCooldownOverride: string;
  btnAdd: string;
  btnAdding: string;
  hint: string;
  errorRequired: string;
  errorFailed: string;
  providerOptions: { value: string; label: string }[];
  /**
   * Optionen im Kategorie-Dropdown der Add-Model-Form. Seit v0.10.0 generisch
   * (`value: string`), damit Konsumenten ihre eigenen Kategorien anbieten
   * können (z.B. Switcher: `cloud`/`free-only`, EduPro: `utility`/`content`/
   * `general`). Werte müssen dem Format `[a-z0-9_-]{1,50}` entsprechen
   * (siehe llm-cascade `ApiController.normalizeCategory`).
   */
  categoryOptions: { value: string; label: string }[];
}

export const ADD_MODEL_FORM_LABELS_EN: AddModelFormLabels = {
  title: 'Add Model',
  fieldModelId: 'Model ID (e.g. gemini-2.5-flash)',
  fieldApiKeySettingKey: 'API-Key Setting',
  fieldDisplayName: 'Display Name (optional)',
  fieldCategory: 'Category',
  fieldCooldownOverride: 'Cooldown 503 override (sec, optional)',
  btnAdd: 'Add Model',
  btnAdding: 'Adding…',
  hint: 'The API key setting holds the actual key value — it lives in the API-Keys section below. Multiple models may share the same setting key. Category routes the request: utility for translations/audits, content for lessons/exams, general for both.',
  errorRequired: 'Provider, Model ID and Setting Key are required',
  errorFailed: 'Failed to add model',
  providerOptions: [
    { value: 'gemini',        label: 'Gemini (Google)' },
    { value: 'openai',        label: 'OpenAI (api.openai.com)' },
    { value: 'anthropic',     label: 'Anthropic (Claude)' },
    { value: 'openrouter',    label: 'OpenRouter' },
    { value: 'deepseek',      label: 'DeepSeek (api.deepseek.com)' },
    { value: 'ollama',        label: 'Ollama (local)' },
    { value: 'openai_compat', label: 'Custom (self-hosted OpenAI API)' },
  ],
  categoryOptions: [
    { value: 'utility', label: 'Utility — translations, audits, verifier' },
    { value: 'content', label: 'Content — lessons, exams, chat' },
    { value: 'general', label: 'General — fallback for both' },
  ],
};

export interface CascadeCooldownLabels {
  title: string;
  subtitle: string;
  default: string;
  forceOn: string;
  forceOff: string;
  effectiveOn: string;
  effectiveOff: string;
  hint: string;
  loading: string;
  errorLoad: string;
}

export const CASCADE_COOLDOWN_LABELS_EN: CascadeCooldownLabels = {
  title: 'Cascade Cooldown',
  subtitle: 'Override the per-model cooldown behaviour globally.',
  default: 'Default',
  forceOn: 'Force ON',
  forceOff: 'Force OFF',
  effectiveOn: 'Effective: ON',
  effectiveOff: 'Effective: OFF',
  hint: 'Default = each model decides for itself. Force ON keeps cooldowns even when a model would skip them. Force OFF removes all cooldowns globally — use with care, useful for testing.',
  loading: 'Loading cascade config…',
  errorLoad: 'Failed to load cascade config.',
};

export interface ApiKeysSectionLabels {
  title: string;
  subtitle: string;
  fieldSettingKey: string;
  fieldValue: string;
  btnShow: string;
  btnHide: string;
  btnSave: string;
  btnSaving: string;
  listTitle: string;
  colSettingKey: string;
  colSource: string;
  colValue: string;
  colActions: string;
  sourceDb: string;
  sourceEnv: string;
  sourceMissing: string;
  btnEdit: string;
  btnClear: string;
  empty: string;
  hint: string;
  confirmClear: (settingKey: string) => string;
}

export const API_KEYS_SECTION_LABELS_EN: ApiKeysSectionLabels = {
  title: 'API Keys',
  subtitle: 'One value per setting-key. Multiple models referencing the same setting-key share the credential.',
  fieldSettingKey: 'Setting Key',
  fieldValue: 'Key value (empty to clear)',
  btnShow: 'Show',
  btnHide: 'Hide',
  btnSave: 'Save Key',
  btnSaving: 'Saving…',
  listTitle: 'Configured Keys',
  colSettingKey: 'Setting Key',
  colSource: 'Source',
  colValue: 'Value',
  colActions: 'Actions',
  sourceDb: 'DB (admin)',
  sourceEnv: 'ENV (boot)',
  sourceMissing: 'missing',
  btnEdit: 'Edit',
  btnClear: 'Clear',
  empty: 'No keys configured yet. Use the form above to add one.',
  hint: "Keys are stored in the consumer's settings table and never echoed to clients in plain text. The value is only used server-side to authenticate model calls.",
  confirmClear: (k) => `Clear DB-stored value for "${k}"? (Env fallback may still apply.)`,
};

/**
 * Labels für `<ki-failover-chain>`. Konsument kann alle oder einzelne Strings
 * überschreiben — Defaults sind englisch.
 */
export interface CascadesViewLabels {
  /** "Lädt Cascade-Bereiche…" beim ersten Render. */
  loading: string;
  /** Hauptzeile wenn Backend leere Liste oder /cascades nicht kennt. */
  empty: string;
  /** Sekundärzeile wenn empty — Hinweis was zu tun ist. */
  emptyHint: string;
  /** Default-Hint pro Cascade-Karte wenn nicht via [hintByCascade] gesetzt. */
  defaultHint: string;
  /** "Cooldown-Status"-Sektion-Header. */
  cooldownTitle: string;
  /** Anzeige wenn cooldown=0. */
  statusFree: string;
  /** Anzeige wenn cooldown>0 — Präfix vor dem Sekunden-Wert. */
  statusCooldown: string;
  /** Tooltip/Hint für die klickbare Description (v0.10.0 Inline-Edit). */
  editHintTooltip: string;
  /** Placeholder im Textfeld wenn description leer ist (v0.10.0). */
  editHintPlaceholder: string;
  /** Speichern-Button-Label im Edit-Mode (v0.10.0). */
  editHintSave: string;
  /** Abbrechen-Button-Label im Edit-Mode (v0.10.0). */
  editHintCancel: string;
  /** Tooltip beim Trash-Icon das die category_meta löscht (v0.11.1). */
  deleteMetaTooltip: string;
  /** Confirm-Dialog-Text vor dem DELETE — bekommt den Anzeige-Titel der Cascade. */
  deleteMetaConfirm: (cascadeTitle: string) => string;
}

export const CASCADES_VIEW_LABELS_EN: CascadesViewLabels = {
  loading: 'Loading cascade areas…',
  empty: 'No cascade areas configured yet.',
  emptyHint: 'Add at least one model with a category to see it as a cascade card here.',
  defaultHint: 'Independent failover chain — own cooldown timer + sticky pointer.',
  cooldownTitle: 'Cooldown status',
  statusFree: 'free',
  statusCooldown: 'cooldown',
  editHintTooltip: 'Click to edit description',
  editHintPlaceholder: 'Describe what this cascade is for (e.g. "Premium tier — paid models, own cooldown")…',
  editHintSave: 'Save',
  editHintCancel: 'Cancel',
  deleteMetaTooltip: 'Delete display texts (models stay)',
  deleteMetaConfirm: (title) =>
    `Delete display texts for "${title}"? Models stay; remove them in the Models table to make the cascade disappear entirely.`,
};

export interface FailoverChainLabels {
  title: string;
  description: string;
  addRow: string;
  removeRowTitle: string;
  moveUpTitle: string;
  moveDownTitle: string;
  currentStep: string;
  positionLabel: (pos: number, provider: string, model: string) => string;
  promote: string;
  hint: string;
  emptyState: string;
}

export const FAILOVER_CHAIN_LABELS_EN: FailoverChainLabels = {
  title: 'Failover Chain',
  description: 'Order in which models are tried when one hits a quota / 503.',
  addRow: 'Add stage',
  removeRowTitle: 'Remove',
  moveUpTitle: 'Move up',
  moveDownTitle: 'Move down',
  currentStep: 'Current stage:',
  positionLabel: (pos, provider, model) => `Stage ${pos + 1} (${provider} · ${model})`,
  promote: '↶ Back to stage 1',
  hint: 'On quota error, the wrapper switches to the next stage and restarts.',
  emptyState: 'No stages configured. Add one to start.',
};

/**
 * Labels für `<ki-routing-decisions>` (Phase v0.11.0). Konsumenten überschreiben
 * via [labels]-Input; Defaults sind englisch.
 */
export interface RoutingDecisionsLabels {
  title: string;
  subtitle: string;
  statSize: string;
  statHits: string;
  statMisses: string;
  statFailures: string;
  testLabel: string;
  testPlaceholder: string;
  btnTest: string;
  testing: string;
  entriesTitle: string;
  btnClearAll: string;
  btnClearOne: string;
  loading: string;
  empty: string;
  colPurpose: string;
  colCategory: string;
  colExpires: string;
  colActions: string;
  confirmClearAll: string;
}

export const ROUTING_DECISIONS_LABELS_EN: RoutingDecisionsLabels = {
  title: 'Semantic Routing Cache',
  subtitle: 'Recent task-description → category routing decisions. Cached 24h.',
  statSize: 'Cached',
  statHits: 'Hits',
  statMisses: 'Misses',
  statFailures: 'Fallbacks',
  testLabel: 'Test a task description',
  testPlaceholder: 'e.g. "translate German i18n keys to English"',
  btnTest: 'Route it',
  testing: 'Routing…',
  entriesTitle: 'Cache entries',
  btnClearAll: 'Clear all',
  btnClearOne: 'Remove entry',
  loading: 'Loading…',
  empty: 'No routing decisions cached yet. Test one above, or wait for a real `purpose`-call.',
  colPurpose: 'Task description',
  colCategory: 'Chosen category',
  colExpires: 'Expires in',
  colActions: 'Actions',
  confirmClearAll: 'Clear the entire routing cache? All future requests will be re-routed.',
};
