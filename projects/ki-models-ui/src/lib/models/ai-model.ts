/**
 * Routing-Kategorie für die Cascade. Frei wählbarer Identifier
 * (`[a-z0-9_-]{1,50}` — siehe llm-cascade `ApiController.normalizeCategory`).
 * Die gültigen Kategorien leben in der DB des Konsumenten, nicht im Code:
 *   - EduPro nutzt z.B. `utility` / `content` / `general` (Task-Typ).
 *   - Switcher nutzt z.B. `cloud` / `free-only` (Kosten-Tier).
 *   - Konsumenten mit lokalen Modellen ergänzen z.B. `local` / `ollama`.
 *
 * Bis v0.9.x war der Typ auf `'utility' | 'content' | 'general'` beschränkt;
 * seit v0.10.0 generisch. Konsumenten geben die UI-Labels über die Inputs
 * `[categoryTitles]` / `[categoryHints]` / `[categoryOrder]` an die
 * Models-Table-Komponente weiter.
 */
export type AiModelCategory = string;

/**
 * Well-known Kategorien-IDs als Convenience-Konstanten — KEIN Enum.
 * Konsumenten dürfen jeden String nutzen, der dem Identifier-Format genügt.
 * Diese Liste wird intern nur noch als Default-Order verwendet, falls der
 * Konsument keinen `[categoryOrder]`-Input liefert UND Modelle exakt diese
 * Kategorien haben (rückwärtskompatibel zu v0.9.x EduPro-Setup).
 */
export const AI_MODEL_CATEGORIES_DEFAULT_ORDER: readonly string[] = ['utility', 'content', 'general'];

/** @deprecated Seit v0.10.0 — siehe {@link AI_MODEL_CATEGORIES_DEFAULT_ORDER}. */
export const AI_MODEL_CATEGORIES = AI_MODEL_CATEGORIES_DEFAULT_ORDER;

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

  /**
   * Routing-Kategorie für zweistufige Cascade (Phase R, llm-cascade ≥ 0.3.0):
   *   - `utility` : i18n, Audits, Verifier (günstige/freie Modelle bevorzugt).
   *   - `content` : Lehrinhalte, Prüfungen, Chat (Qualitäts-Modelle).
   *   - `general` : Fallback, in beiden Cascades sichtbar.
   *   - `undefined`/leer : Backward-Compat — wird vom Backend als "general" behandelt.
   */
  category?: AiModelCategory;

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

  /**
   * v0.11.3 — true wenn das Modell keinen API-Key braucht (z.B. Ollama lokal).
   * Backend (llm-cascade ≥ 0.6.1) liefert das pro Modell. Frontend rendert
   * dann ein „Lokal"-Badge statt „Key fehlt" und keyConfigured ist immer true.
   * Optional, defaultet auf false bei aelteren Backends (Backward-Compat).
   */
  keyless?: boolean;

  /** Aktuelle Cooldown-Restzeit in Sekunden (Backend kalkuliert). */
  cooldownRemainingSec?: number;
}

/** Body für `POST /ai-models` — Create. Felder optional die das Backend defaultet. */
export interface AiModelCreate {
  provider: string;
  modelId: string;
  displayName?: string;
  category?: AiModelCategory;
  apiKeySettingKey?: string;
  enabled?: boolean;
  orderIdx?: number;
  cooldown503OverrideSec?: number | null;
}

/** Body für `PUT /ai-models/{id}` — Update (Partial). */
export type AiModelUpdate = Partial<Omit<AiModel, 'id' | 'autoDisabled' | 'autoDisabledReason' | 'autoDisabledAt' | 'keyConfigured' | 'cooldownRemainingSec'>>;
