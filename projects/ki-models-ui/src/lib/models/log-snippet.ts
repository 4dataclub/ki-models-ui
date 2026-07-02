/**
 * v0.20.0 — Eine Zeile im Prompt-Log. Quelle:
 * `GET {base}/stats/log-snippets?limit=50` (absteigend nach `calledAt`).
 * Konsumiert von `<ki-log-snippets>`.
 *
 * Snippets existieren nur, wenn das Setting `logPromptSnippet` AN ist UND
 * der Traffic durch die Cascade lief. Der direkte cloud+Anthropic-Pfad
 * umgeht die Cascade und wird nicht geloggt.
 */
export interface LogSnippetRow {
  /** DB-ID des Log-Eintrags. */
  id: number;
  /** Aufrufender Service. */
  service: string;
  /** Sprache/Locale des Prompts (falls erkannt). */
  lang?: string | null;
  /** Anzahl Output-Zeichen (falls bekannt). */
  outputChars?: number | null;
  /** Ob der Call erfolgreich war. */
  success: boolean;
  /** Verwendetes Modell (falls bekannt). */
  model?: string | null;
  /** Provider des Modells (falls bekannt). */
  provider?: string | null;
  /** Routing-Kategorie/Area (falls bekannt). */
  category?: string | null;
  /** Gekürzter Prompt-Ausschnitt. */
  promptSnippet: string;
  /** ISO-8601-Zeitpunkt des Calls. */
  calledAt?: string | null;
}
