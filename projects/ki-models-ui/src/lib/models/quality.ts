/**
 * v0.7.1 — Quality-Stats pro Modell (siehe llm-cascade ≥ 0.7.2).
 *
 * Wird vom Endpoint `GET {base}/stats/quality?sortBy=worst-first` als
 * Liste geliefert. Default-Sortierung „worst-first" weil Admin
 * Probleme sehen will, nicht die laufenden Top-Modelle.
 */

import { ModelQuality } from './ai-model';

/**
 * Zeile in der Quality-Stats-Tabelle. Kombiniert {@link ModelQuality}
 * mit minimalen Modell-Identifiern und einem `kill`-Boolean-Marker für
 * UX-Highlighting (rotes Badge).
 */
export interface QualityStatRow extends ModelQuality {
  id: number;
  provider: string;
  modelId: string;
  displayName: string | null;
  category: string | null;
  enabled: boolean;

  /** True wenn `tier === 'kill'` — für CSS-Klassen / Highlighting. */
  kill: boolean;

  /** Frei lesbares Icon-Mapping vom Backend: ★ ◐ ▽ ✗ ? */
  tierIcon: string;
}
