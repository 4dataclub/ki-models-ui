import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * v0.18.0 — Dependency-freier Pager für alle Tabellen, deren Einträge zu
 * lang werden. Rein presentational: nimmt `total`/`page`/`pageSize` und
 * emittiert `pageChange`. Sichtbar NUR wenn `total > pageSize` — bei kurzen
 * Tabellen rendert die Komponente nichts (kein DOM, kein Platzverbrauch).
 *
 * Seiten sind 0-basiert. Konsumenten halten die aktuelle Seite selbst und
 * slicen ihre Daten mit dem `paginate()`-Helper.
 */
@Component({
  selector: 'ki-pager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="total > pageSize" class="ki-pager">
      <button class="ki-pg-btn" [disabled]="page <= 0"
              (click)="go(page - 1)" title="Zurück">‹</button>
      <span class="ki-pg-info">
        {{ rangeStart }}–{{ rangeEnd }} / {{ total }}
      </span>
      <button class="ki-pg-btn" [disabled]="page >= lastPage"
              (click)="go(page + 1)" title="Weiter">›</button>
    </div>
  `,
  styles: [`
    .ki-pager {
      display: flex; align-items: center; justify-content: flex-end;
      gap: 0.6rem; margin-top: 0.6rem; font-size: 0.7rem; color: #64748b;
    }
    .ki-pg-btn {
      min-width: 1.6rem; padding: 0.2rem 0.5rem; background: #f1f5f9;
      color: #334155; border: 1px solid #e2e8f0; border-radius: 0.375rem;
      font-size: 0.85rem; font-weight: 800; cursor: pointer; line-height: 1;
    }
    .ki-pg-btn:disabled { opacity: 0.4; cursor: default; }
    .ki-pg-btn:not(:disabled):hover { background: #e0e7ff; color: #3730a3; }
    .ki-pg-info { font-variant-numeric: tabular-nums; font-weight: 700; }
  `],
})
export class KiPagerComponent {
  @Input() total = 0;
  @Input() page = 0;
  @Input() pageSize = 10;
  @Output() pageChange = new EventEmitter<number>();

  get lastPage(): number {
    return Math.max(0, Math.ceil(this.total / this.pageSize) - 1);
  }

  get rangeStart(): number {
    return this.total === 0 ? 0 : this.page * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.total, (this.page + 1) * this.pageSize);
  }

  go(p: number): void {
    const clamped = Math.max(0, Math.min(p, this.lastPage));
    if (clamped !== this.page) this.pageChange.emit(clamped);
  }
}

/**
 * Slice-Helper passend zum {@link KiPagerComponent}. Schneidet die aktuelle
 * Seite aus einem Array. Klemmt die Seite defensiv, falls die Datenmenge
 * zwischen Renders schrumpft.
 */
export function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const lastPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
  const p = Math.max(0, Math.min(page, lastPage));
  const start = p * pageSize;
  return rows.slice(start, start + pageSize);
}