import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { KiDonutChartComponent } from './ki-donut-chart.component';
import { KiPagerComponent, paginate } from './ki-pager.component';
import {
  FailoverBreakdown,
  FailoverByProviderReason,
  FailoverEvents,
  FailoverEvent,
} from '../models/stats-failover';
import { FailoverAnalyticsLabels, FAILOVER_ANALYTICS_LABELS_EN } from '../models/labels';
import { SortState, nextSort, sortGlyph, sortRows, filterRows } from './table-tools';

/**
 * v0.18.0 — Geteiltes Failover-Analytics-Panel: Donut „Failover-out / Provider"
 * (welcher Provider wurde wie oft aus der Kaskade gedroppt) plus eine
 * paginierte, sortier-/filterbare Provider×Grund-Tabelle.
 *
 * v0.19.0 — Zusätzlich eine Failover-/Toggle-Events-Timeline (letzte 50 mit
 * Datumsangaben) aus `/stats/failover`. Toggle-Umschaltungen (an/aus) tauchen
 * hier als `toggle_on`/`toggle_off` auf.
 *
 * Dependency-frei (reines SVG via `<ki-donut-chart>`), Pager nur ab `pageSize`.
 * Graceful: leere/fehlende Daten → Leer-Hinweis.
 */
@Component({
  selector: 'ki-failover-analytics',
  standalone: true,
  imports: [CommonModule, KiDonutChartComponent, KiPagerComponent],
  template: `
    <div class="ki-fa">
      <div class="ki-header">
        <div>
          <h4 class="ki-title">{{ L.title }}</h4>
          <p class="ki-subtitle">{{ L.subtitle }}</p>
        </div>
        <button (click)="reload()" class="ki-btn-refresh" title="Neu laden">↻</button>
      </div>

      <p *ngIf="loading()" class="ki-muted">{{ L.loading }}</p>

      <ng-container *ngIf="!loading()">
        <p *ngIf="allEmpty()" class="ki-empty">{{ L.empty }}</p>

        <ng-container *ngIf="!allEmpty()">
          <ng-container *ngIf="!isEmpty()">
            <div class="ki-section-label">{{ L.donutTitle }}</div>
            <ki-donut-chart [data]="donutData()" [centerLabel]="L.donutCenter"></ki-donut-chart>

            <div class="ki-section-label">{{ L.tableTitle }}</div>
            <input
              class="ki-filter"
              type="text"
              [placeholder]="L.filterPlaceholder"
              [value]="matrixFilter()"
              (input)="setMatrixFilter($any($event.target).value)" />
            <table *ngIf="byProviderReason().length > 0" class="ki-table">
              <thead>
                <tr>
                  <th class="ki-sortable" (click)="sortMatrix('provider')">{{ L.colProvider }} <span class="ki-glyph">{{ glyph('provider') }}</span></th>
                  <th class="ki-sortable" (click)="sortMatrix('reason')">{{ L.colReason }} <span class="ki-glyph">{{ glyph('reason') }}</span></th>
                  <th class="ki-right ki-sortable" (click)="sortMatrix('count')">{{ L.colCount }} <span class="ki-glyph">{{ glyph('count') }}</span></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of pageRows()">
                  <td class="ki-mono"><span class="ki-provider">{{ r.provider || '—' }}</span></td>
                  <td class="ki-tiny">{{ r.reason || '—' }}</td>
                  <td class="ki-right ki-mono">{{ r.count }}</td>
                </tr>
              </tbody>
            </table>

            <ki-pager
              [total]="matrixRows().length"
              [page]="page()"
              [pageSize]="pageSize"
              (pageChange)="page.set($event)">
            </ki-pager>
          </ng-container>

          <!-- v0.19.0 — Failover-/Toggle-Events-Timeline -->
          <ng-container *ngIf="events().recent.length > 0">
            <div class="ki-section-label">
              {{ L.timelineTitle }}
              <span class="ki-30d">30d: {{ events().total30d }}</span>
            </div>
            <p class="ki-subtitle">{{ L.timelineHint }}</p>
            <input
              class="ki-filter"
              type="text"
              [placeholder]="L.filterPlaceholder"
              [value]="eventsFilter()"
              (input)="setEventsFilter($any($event.target).value)" />
            <div class="ki-timeline">
              <div class="ki-event ki-event-head">
                <span class="ki-badge-head">{{ L.colType }}</span>
                <span class="ki-transition">{{ L.colTransition }}</span>
                <span class="ki-reason">{{ L.colReason }}</span>
                <span class="ki-when">{{ L.colWhen }}</span>
              </div>
              <div *ngFor="let e of filteredEvents()" class="ki-event">
                <span class="ki-badge" [class]="badgeClass(e.type)">{{ e.type }}</span>
                <span class="ki-mono ki-transition">{{ e.fromModel || '—' }} → {{ e.toModel || '—' }}</span>
                <span class="ki-tiny ki-reason">{{ e.reason || '' }}<span *ngIf="e.cooldownSec"> ({{ e.cooldownSec }}s)</span></span>
                <span class="ki-tiny ki-when">{{ fmtWhen(e.occurredAt) }}</span>
              </div>
            </div>
          </ng-container>
        </ng-container>
      </ng-container>
    </div>
  `,
  styles: [`
    .ki-fa { font-family: inherit; padding: 1rem 0; }
    .ki-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 1rem; margin-bottom: 1rem;
    }
    .ki-title {
      font-size: 0.85rem; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.1em; color: #1e293b; margin: 0 0 0.25rem 0;
    }
    .ki-subtitle { font-size: 0.7rem; color: #64748b; margin: 0 0 0.5rem 0; }
    .ki-btn-refresh {
      padding: 0.35rem 0.6rem; background: #e0e7ff; color: #3730a3;
      border: none; border-radius: 0.375rem; font-size: 0.8rem; cursor: pointer;
    }
    .ki-section-label {
      font-size: 0.65rem; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.08em; color: #64748b; margin: 1rem 0 0.5rem 0;
    }
    .ki-30d { margin-left: 0.5rem; font-family: ui-monospace, monospace; color: #94a3b8; }
    .ki-filter {
      width: 100%; box-sizing: border-box; padding: 0.4rem 0.6rem;
      margin-bottom: 0.5rem; border: 1px solid #e2e8f0; border-radius: 0.375rem;
      font-size: 0.8rem;
    }
    .ki-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .ki-table thead tr { border-bottom: 2px solid #e2e8f0; }
    .ki-table th {
      padding: 0.5rem 0.6rem; text-align: left; text-transform: uppercase;
      font-size: 0.6rem; font-weight: 800; letter-spacing: 0.08em; color: #64748b;
    }
    .ki-sortable { cursor: pointer; user-select: none; white-space: nowrap; }
    .ki-sortable:hover { color: #4f46e5; }
    .ki-glyph { font-size: 0.6rem; opacity: 0.6; }
    .ki-table td { padding: 0.5rem 0.6rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .ki-right { text-align: right; }
    .ki-mono { font-family: ui-monospace, monospace; }
    .ki-muted { color: #94a3b8; }
    .ki-tiny { font-size: 0.7rem; }
    .ki-provider { color: #4f46e5; font-weight: 700; }
    .ki-empty { text-align: center; padding: 1.5rem; color: #94a3b8; }
    .ki-timeline {
      background: #fff7ed; border: 1px solid #fed7aa; border-radius: 0.75rem;
      padding: 0.5rem 0.85rem;
    }
    .ki-event {
      display: flex; align-items: center; gap: 0.6rem; padding: 0.35rem 0;
      border-bottom: 1px solid #fde9d3; font-size: 0.72rem;
    }
    .ki-event:last-child { border-bottom: none; }
    .ki-event-head {
      text-transform: uppercase; font-size: 0.6rem; font-weight: 800;
      letter-spacing: 0.08em; color: #b45309; border-bottom: 2px solid #fed7aa;
    }
    .ki-badge-head {
      flex-shrink: 0; min-width: 5.5rem; text-align: center; padding: 0.1rem 0.4rem;
    }
    .ki-badge {
      flex-shrink: 0; min-width: 5.5rem; text-align: center; padding: 0.1rem 0.4rem;
      border-radius: 0.3rem; font-family: ui-monospace, monospace; font-size: 0.62rem;
      font-weight: 700;
    }
    .ki-badge-down { background: #fee2e2; color: #b91c1c; }
    .ki-badge-up   { background: #dcfce7; color: #15803d; }
    .ki-badge-on   { background: #dbeafe; color: #1d4ed8; }
    .ki-badge-off  { background: #f1f5f9; color: #475569; }
    .ki-badge-pool { background: #ede9fe; color: #6d28d9; }
    .ki-transition { color: #334155; flex: 1; }
    .ki-reason { color: #64748b; flex: 1; }
    .ki-when { color: #94a3b8; text-align: right; white-space: nowrap; }
  `],
})
export class FailoverAnalyticsComponent implements OnInit {
  private readonly api = inject(KiModelsApiService);

  /** Konsumenten-i18n-Override. Default = englische Labels. */
  L: FailoverAnalyticsLabels = FAILOVER_ANALYTICS_LABELS_EN;
  @Input() set labels(v: Partial<FailoverAnalyticsLabels> | undefined) {
    this.L = { ...FAILOVER_ANALYTICS_LABELS_EN, ...(v ?? {}) };
  }

  /** Seitengröße der Provider×Grund-Tabelle. Default 10. */
  @Input() pageSize = 10;

  readonly breakdown = signal<FailoverBreakdown>({ byProvider: [], byProviderReason: [], byReason: [] });
  readonly events = signal<FailoverEvents>({ recent: [], total30d: 0 });
  readonly loading = signal(true);
  readonly page = signal(0);

  readonly matrixFilter = signal('');
  readonly matrixSort = signal<SortState>({ key: null, dir: null });
  readonly eventsFilter = signal('');

  readonly byProviderReason = computed<FailoverByProviderReason[]>(
    () => this.breakdown().byProviderReason ?? [],
  );
  readonly matrixRows = computed<FailoverByProviderReason[]>(() =>
    sortRows(
      filterRows(this.byProviderReason(), this.matrixFilter(), ['provider', 'reason']),
      this.matrixSort(),
    ),
  );
  readonly donutData = computed(() =>
    (this.breakdown().byProvider ?? []).map((p) => ({
      key: p.provider,
      label: p.provider,
      count: p.failovers,
    })),
  );
  readonly pageRows = computed(() => paginate(this.matrixRows(), this.page(), this.pageSize));
  readonly filteredEvents = computed<FailoverEvent[]>(() =>
    filterRows(this.events().recent, this.eventsFilter(), ['type', 'fromModel', 'toModel', 'reason']),
  );
  readonly isEmpty = computed(() =>
    (this.breakdown().byProvider ?? []).length === 0 &&
    this.byProviderReason().length === 0,
  );
  readonly allEmpty = computed(() => this.isEmpty() && this.events().recent.length === 0);

  ngOnInit(): void {
    this.reload();
  }

  glyph(key: string): string {
    return sortGlyph(this.matrixSort(), key);
  }

  sortMatrix(key: string): void {
    this.matrixSort.set(nextSort(this.matrixSort(), key));
    this.page.set(0);
  }

  setMatrixFilter(v: string): void {
    this.matrixFilter.set(v);
    this.page.set(0);
  }

  setEventsFilter(v: string): void {
    this.eventsFilter.set(v);
  }

  badgeClass(type: string): string {
    switch (type) {
      case 'switch_down': return 'ki-badge-down';
      case 'switch_up':
      case 'promote_primary': return 'ki-badge-up';
      case 'toggle_on':
      case 'supermodel_on': return 'ki-badge-on';
      case 'toggle_off':
      case 'supermodel_off': return 'ki-badge-off';
      case 'pool_switch': return 'ki-badge-pool';
      default: return 'ki-badge-off';
    }
  }

  fmtWhen(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString([], {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }

  reload(): void {
    this.loading.set(true);
    this.page.set(0);
    this.api.getStatsFailoverBreakdown().subscribe({
      next: (b) => {
        this.breakdown.set(b ?? { byProvider: [], byProviderReason: [], byReason: [] });
        this.loading.set(false);
      },
      error: () => {
        this.breakdown.set({ byProvider: [], byProviderReason: [], byReason: [] });
        this.loading.set(false);
      },
    });
    this.api.getStatsFailover().subscribe({
      next: (e) => this.events.set(e ?? { recent: [], total30d: 0 }),
      error: () => this.events.set({ recent: [], total30d: 0 }),
    });
  }
}
