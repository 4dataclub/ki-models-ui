/**
 * Cascade-Bereich (Phase S' — 2026-05-21).
 *
 * Jeder Bereich ist eine eigenständige Failover-Chain mit eigenem
 * Cooldown-Timer + Sticky-Pointer. Bereiche heißen frei (z.B. "content",
 * "utility", "general" in EduPro; "free-only", "cloud-premium" in
 * Switcher) — Backend liefert sie dynamisch, UI rendert eine Karte pro.
 */
export interface Cascade {
  /** Eindeutiger Cascade-Name, kommt direkt aus `ai_model_config.category`. */
  name: string;

  /** Aktuell aktives Modell als `provider:modelId` oder leer wenn Cascade leer. */
  currentModel: string;

  /**
   * Pro Modell Restliche Cooldown-Sekunden (0 = frei).
   * Key: `provider:modelId`.
   */
  cooldownSec: Record<string, number>;
}
