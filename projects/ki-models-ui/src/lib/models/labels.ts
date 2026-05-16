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
  confirmDelete: (id) => `Delete model "${id}"?`,
};

export interface AddModelFormLabels {
  title: string;
  fieldModelId: string;
  fieldApiKeySettingKey: string;
  fieldDisplayName: string;
  fieldCooldownOverride: string;
  btnAdd: string;
  btnAdding: string;
  hint: string;
  errorRequired: string;
  errorFailed: string;
  providerOptions: { value: string; label: string }[];
}

export const ADD_MODEL_FORM_LABELS_EN: AddModelFormLabels = {
  title: 'Add Model',
  fieldModelId: 'Model ID (e.g. gemini-2.5-flash)',
  fieldApiKeySettingKey: 'API-Key Setting',
  fieldDisplayName: 'Display Name (optional)',
  fieldCooldownOverride: 'Cooldown 503 override (sec, optional)',
  btnAdd: 'Add Model',
  btnAdding: 'Adding…',
  hint: 'The API key setting holds the actual key value — it lives in the API-Keys section below. Multiple models may share the same setting key.',
  errorRequired: 'Provider, Model ID and Setting Key are required',
  errorFailed: 'Failed to add model',
  providerOptions: [
    { value: 'gemini',        label: 'Gemini (Google)' },
    { value: 'openai',        label: 'OpenAI (api.openai.com)' },
    { value: 'anthropic',     label: 'Anthropic (Claude)' },
    { value: 'openrouter',    label: 'OpenRouter' },
    { value: 'deepseek',      label: 'DeepSeek (api.deepseek.com)' },
    { value: 'openai_compat', label: 'Custom (self-hosted OpenAI API)' },
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
