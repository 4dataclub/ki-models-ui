/**
 * Ein KI-Modell in der Cascade. Felder spiegeln die llm-cascade API +
 * konsumentenspezifische Erweiterungen.
 */
export interface AiModel {
  /** Numerische DB-ID (vergeben vom Backend). */
  id: number;

  /** Provider-Kürzel: `gemini`, `openai`, `anthropic`, `openrouter`, `deepseek`, `openai_compat`. */
  provider: string;

  /** Modell-ID innerhalb des Providers, z.B. `gemini-2.5-flash`, `gpt-4o`. */
  modelId: string;

  /** Optional: Anzeigename in der UI. Wenn leer, wird `provider:modelId` gerendert. */
  displayName?: string | null;

  /** Settings-Key unter dem der API-Key liegt. Default: `<provider>ApiKey`. */
  apiKeySettingKey: string;

  /** Aktiviert in der Cascade-Reihe. */
  enabled: boolean;

  /** Reihenfolge in der Cascade-Chain (kleinere Werte = höhere Priorität). */
  orderIdx: number;

  /** Optional: Pro-Modell 503-Cooldown-Override in Sekunden. */
  cooldown503OverrideSec?: number | null;

  /** Vom Backend auto-disabled (z.B. nach mehrfachem Test-Failure). */
  autoDisabled: boolean;

  /** Grund für Auto-Disable, falls gesetzt. */
  autoDisabledReason?: string | null;

  /** ISO-Timestamp wann Auto-Disable getriggert wurde. */
  autoDisabledAt?: string | null;

  /** True wenn der zugehörige API-Key konfiguriert ist (vom Backend ermittelt). */
  keyConfigured: boolean;

  /** Aktuelle Cooldown-Restzeit in Sekunden (Backend kalkuliert). */
  cooldownRemainingSec?: number;
}

/** Body für `POST /ai-models` — Create. Felder optional die das Backend defaultet. */
export interface AiModelCreate {
  provider: string;
  modelId: string;
  displayName?: string;
  apiKeySettingKey?: string;
  enabled?: boolean;
  orderIdx?: number;
  cooldown503OverrideSec?: number | null;
}

/** Body für `PUT /ai-models/{id}` — Update (Partial). */
export type AiModelUpdate = Partial<Omit<AiModel, 'id' | 'autoDisabled' | 'autoDisabledReason' | 'autoDisabledAt' | 'keyConfigured' | 'cooldownRemainingSec'>>;
