/**
 * v0.14.0 — Performance-Stats pro Modell. Liefert vom Endpoint
 * `GET {base}/stats/performance?sortBy=...` (cascade ≥ 0.7.6).
 *
 * Wird vom Library-Component {@code <ki-models-performance>} angezeigt.
 * Cost-Schaetzung passiert nur clientseitig — der Konsument liefert sein
 * eigenes `costMapping` (USD pro 1M Output-Tokens pro Provider).
 */
export interface PerformanceRow {
  provider: string;
  model: string;
  /** Gesamt-Anzahl Calls in den letzten 30 Tagen. */
  calls: number;
  /** Anzahl erfolgreicher Calls. */
  success: number;
  /** Success-Rate als Anteil (0.0 - 1.0). */
  successRate: number;
  /** Durchschnitt output_chars pro Call (gerundet auf integer). */
  avgChars: number;
  /** Summe output_chars (für Cost-Schaetzung im Frontend). */
  totalChars: number;
}
