/**
 * Display-Metadaten pro Routing-Kategorie (Phase v0.10.0).
 *
 * Quelle: `GET {base}/categories` (z.B. llm-cascade `CategoryMeta`). Wird
 * vom `<ki-cascades-view>` für Title + Hint pro Bereich genutzt; der User
 * kann beide Felder per Inline-Edit überschreiben (`PUT {base}/categories/{name}`).
 *
 * Felder die `null` / leer sind, fallen in der UI auf:
 *   - `displayName` → capitalized `name` (`free-only` → `Free Only`)
 *   - `description` → `[hintByCascade]`-Input vom Konsumenten ODER `L.defaultHint`
 */
export interface Category {
  /** Identifier, identisch zu `AiModelConfig.category`. */
  name: string;
  /** Anzeige-Titel im UI. `null` = Fallback auf capitalized `name`. */
  displayName?: string | null;
  /** Erklär-Satz unter dem Titel. `null` = Fallback auf Konsumenten-Default. */
  description?: string | null;
  /** Optionale UI-Reihenfolge. Niedrigere Werte zuerst, `null` ans Ende. */
  orderIdx?: number | null;
}

/** Body für `PUT {base}/categories/{name}`. Partial — fehlende Felder bleiben unverändert. */
export interface CategoryUpdate {
  displayName?: string | null;
  description?: string | null;
  orderIdx?: number | null;
}
