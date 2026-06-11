/**
 * v0.14.0 — Cooldown-State pro Modell. Liefert vom Endpoint
 * `GET {base}/cooldown-state` (cascade ≥ 0.7.6).
 *
 * Wird vom Library-Component {@code <ki-models-cooldown-state>} angezeigt.
 * Probleme (autoDisabled ODER cooldownRemainingSec > 0) stehen oben.
 */
export interface CooldownRow {
  id: number;
  provider: string;
  modelId: string;
  displayName: string | null;
  category: string | null;
  enabled: boolean;

  /** System-Auto-Disable (z.B. nach mehrfachem API-Fehler oder Quality auto-disable). */
  autoDisabled: boolean;
  /** Lesbarer Grund warum auto-disabled wurde. */
  autoDisabledReason: string | null;
  /** ISO-Timestamp wann auto-disable getriggert wurde. */
  autoDisabledAt: string | null;

  /** Sekunden bis das Modell wieder probiert werden darf. 0 = frei. */
  cooldownRemainingSec: number;
}
