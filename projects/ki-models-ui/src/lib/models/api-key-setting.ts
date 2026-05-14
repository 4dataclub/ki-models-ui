/**
 * API-Key-Setting (generischer settingKey-basierter Eintrag).
 * Mapped 1:1 auf llm-cascade's `app_settings`-Row.
 */
export interface ApiKeySetting {
  /** Logischer Key, z.B. `geminiApiKey`, `openaiApiKey`, `anthropicApiKey`. */
  settingKey: string;

  /** Gemaskter Wert (Backend liefert nur Maskiertes — Klartext nie). */
  valueMasked: string;

  /** True wenn ein nicht-leerer Wert hinterlegt ist. */
  configured: boolean;

  /** Optional: Quelle des Werts — `db` (Admin-UI gesetzt) oder `env` (Boot-Default). */
  keySource?: 'db' | 'env' | null;

  /** Optional: env-Variablen-Name aus dem das Setting initial gespiegelt wurde. */
  envVar?: string | null;

  /** True wenn das Setting zu den eingebauten Default-Keys gehört (statt dynamisch generiert). */
  isDefault?: boolean;
}

/** Body für `POST /api-keys/setting/{key}` — value setzen oder leeren. */
export interface ApiKeySettingUpdate {
  value: string;
}
