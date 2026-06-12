/**
 * v0.15.0 — Benannter Inferenz-Server (llm-cascade ≥ 0.8.0).
 *
 * Lokale Modelle (Ollama) laufen normalerweise auf „localhost". Über benannte
 * Server kann ein Modell seine Inferenz an einen externen Rechner (z.B. eine
 * GPU-Maschine) auslagern. Ein Server ist der Default (`isDefault`), der für
 * Ollama-Modelle ohne explizite Auswahl genutzt wird.
 *
 * Backend-Vertrag (Konsument-Base-URL):
 * ```
 * GET    {base}/provider-servers           → ProviderServer[]
 * PUT    {base}/provider-servers/{name}     → { ok }   body: { baseUrl, isDefault?, description? }
 * DELETE {base}/provider-servers/{name}     → { ok }   (Default nicht löschbar)
 * ```
 */
export interface ProviderServer {
  /** Frei wählbarer Name als PK (`[a-z0-9_-]{1,50}`), z.B. „localhost", „gpu-firma". */
  name: string;

  /** Volle Base-URL inkl. `/v1` (OpenAI-kompatibel), z.B. `http://ollama:11434/v1`. */
  baseUrl: string;

  /** Default-Server für Modelle ohne explizite Auswahl. Nur einer pro DB; nicht löschbar. */
  isDefault?: boolean;

  /** Optionaler Beschreibungstext (was läuft auf dem Server?). */
  description?: string | null;
}

/** Body für `PUT {base}/provider-servers/{name}` — Upsert (Partial). */
export interface ProviderServerUpsert {
  baseUrl: string;
  isDefault?: boolean;
  description?: string | null;
}
