/**
 * Semantic-Routing-Modelle (Phase v0.11.0 — passend zu llm-cascade ≥ 0.6.0).
 *
 * Konzept: Caller schickt einen freien Task-Beschreibungs-String (`purpose`)
 * mit `POST /generate` statt einer hardcoded `category`. llm-cascade laesst
 * einen Mini-LLM-Call entscheiden welche der in `category_meta` gepflegten
 * Kategorien am besten passt. Ergebnis wird gecached (in-mem LRU, 24h TTL).
 *
 * Das Admin-UI nutzt diese Endpoints zur Cache-Inspection + manueller
 * Steuerung + Test-Preview (purpose-String eintippen, sehen welche Kategorie
 * gewaehlt wird, ohne den eigentlichen Generate-Call durchzufuehren).
 */

/** Eintrag im Routing-Cache. Liefert `GET {base}/routing/cache.entries[]`. */
export interface RoutingCacheEntry {
  /** SHA-256 hex des trimmed lowercase purpose — Cache-Key. */
  purposeHash: string;
  /** Preview des original purpose-Strings. */
  purpose: string;
  /** Die vom Router gewaehlte Kategorie. */
  category: string;
  /** Wie lange ist der Eintrag schon im Cache. */
  ageSeconds: number;
  /** Restlebenszeit bevor er evictet wird (0 = jetzt abgelaufen). */
  expiresInSeconds: number;
}

/** Counter-Stats aus `GET {base}/routing/cache.stats`. */
export interface RoutingCacheStats {
  /** Aktuelle Anzahl Cache-Eintraege. */
  cacheSize: number;
  /** Maximalkapazitaet (LRU evictet darueber). */
  cacheCapacity: number;
  /** TTL pro Eintrag in Sekunden (24h = 86400). */
  ttlSeconds: number;
  /** Wie oft wurde der Cache erfolgreich getroffen (kein LLM-Call). */
  hits: number;
  /** Wie oft musste ein neuer LLM-Routing-Call laufen. */
  misses: number;
  /** Wie oft musste auf "general" zurueckgefallen werden (Fehler / kein Match). */
  failures: number;
}

/** Vollstaendige Response von `GET {base}/routing/cache`. */
export interface RoutingCache {
  stats: RoutingCacheStats;
  entries: RoutingCacheEntry[];
}

/** Response von `POST {base}/routing/test`. */
export interface RoutingTestResult {
  /** Der gesendete purpose-String. */
  purpose: string;
  /** Die vom Router gewaehlte Kategorie (cached oder frisch entschieden). */
  category: string;
  /** Wie lange der Routing-Call dauerte (Cache-Hit = ~0ms, Miss = LLM-Roundtrip). */
  latencyMs: number;
}
