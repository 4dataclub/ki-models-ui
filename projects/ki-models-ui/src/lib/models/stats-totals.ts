/**
 * v0.18.0 — KI-Calls-Totals für die Übersichts-Cards in `<ki-call-overview>`.
 * Quelle: `GET {base}/stats/totals`. Alle Felder optional, weil das Backend
 * bei Cascade-unreachable ein leeres Objekt liefert (graceful fallback).
 */
export interface StatsTotals {
  last24h?: number;
  last7d?: number;
  last30d?: number;
  success30d?: number;
  failed30d?: number;
  /** Summe Output-Chars (30d) — Basis für die Kosten-Schätzung. */
  outputChars30d?: number;
}