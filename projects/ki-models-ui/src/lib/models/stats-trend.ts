/**
 * v0.18.0 — Ein Punkt im Erfolgs-Trend (Calls pro Tag). Quelle:
 * `GET {base}/stats/trend?days=30`. Konsumiert von `<ki-call-overview>`.
 */
export interface TrendPoint {
  /** ISO-Datum (YYYY-MM-DD). */
  date: string;
  /** Calls insgesamt an dem Tag. */
  total: number;
  /** Davon erfolgreich. */
  success: number;
  /** Davon fehlgeschlagen (= total - success). */
  failed: number;
}