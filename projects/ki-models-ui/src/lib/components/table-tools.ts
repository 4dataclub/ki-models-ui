/**
 * v0.19.0 — Dependency-freie Sortier-/Filter-Helfer für die Stats-Tabellen.
 * Reine Funktionen, kein Angular — von mehreren Komponenten geteilt, damit
 * alle Tabellen identisch sortieren/filtern.
 */

export type SortDir = 'asc' | 'desc' | null;

export interface SortState {
  key: string | null;
  dir: SortDir;
}

/**
 * Klick auf eine Spalte: zyklus asc → desc → aus. Klick auf andere Spalte
 * startet wieder bei asc.
 */
export function nextSort(state: SortState, key: string): SortState {
  if (state.key !== key) return { key, dir: 'asc' };
  if (state.dir === 'asc') return { key, dir: 'desc' };
  if (state.dir === 'desc') return { key: null, dir: null };
  return { key, dir: 'asc' };
}

/** Sortier-Glyph für den Spaltenkopf. */
export function sortGlyph(state: SortState, key: string): string {
  if (state.key !== key) return '⇅';
  return state.dir === 'asc' ? '▲' : state.dir === 'desc' ? '▼' : '⇅';
}

function cmp(a: unknown, b: unknown): number {
  const an = typeof a === 'number';
  const bn = typeof b === 'number';
  if (an && bn) return (a as number) - (b as number);
  const as = a == null ? '' : String(a);
  const bs = b == null ? '' : String(b);
  return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
}

/** Stabile Kopie sortiert nach `state.key`. `dir=null` → Originalreihenfolge. */
export function sortRows<T extends Record<string, any>>(rows: T[], state: SortState): T[] {
  if (!state.key || !state.dir) return rows;
  const key = state.key;
  const factor = state.dir === 'asc' ? 1 : -1;
  return [...rows].sort((x, y) => factor * cmp(x[key], y[key]));
}

/**
 * Case-insensitive Substring-Filter. Durchsucht `fields` (oder alle Werte
 * der Zeile, wenn nicht angegeben). Leerer Query → unverändert.
 */
export function filterRows<T extends Record<string, any>>(
  rows: T[],
  query: string,
  fields?: (keyof T)[],
): T[] {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const values = fields ? fields.map((f) => row[f]) : Object.values(row);
    return values.some((v) => v != null && String(v).toLowerCase().includes(q));
  });
}
