import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { KiDonutChartComponent } from './ki-donut-chart.component';
import { KiPagerComponent, paginate } from './ki-pager.component';
import { FailoverBreakdown, FailoverByProviderReason } from '../models/stats-failover';
import { FailoverAnalyticsLabels, FAILOVER_ANALYTICS_LABELS_EN } from '../models/labels';

/**
 * v0.18.0 — Geteiltes Failover-Analytics-Panel: Donut „Failover-out / Provider"
 * (welcher Provider wurde wie oft aus der Kaskade gedroppt) plus eine
 * paginierte Provider×Grund-Tabelle.
 *
 * Speist sich aus `/stats/failover-breakdown` (llm-cascade → Switcher-Proxy).
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
        <p *ngIf="isEmpty()" class="ki-empty">{{ L.empty }}</p>

        <ng-container *ngIf="!isEmpty()">
          <div class="ki-section-label">{{ L.donutTitle }}</div>
          <ki-donut-chart [data]="donutData()" [centerLabel]="L.donutCenter"></ki-donut-chart>

          <div class="ki-section-label">{{ L.tableTitle }}</div>
          <table *ngIf="byProviderReason().length > 0" class="ki-table">
            <thead>
              <tr>
                <th>{{ L.colProvider }}</th>
                <th>{{ L.colReason }}</th>
                <th class="ki-right">{{ L.colCount }}</th>
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
            [total]="byProviderReason().length"
            [page]="page()"
            [pageSize]="pageSize"
            (pageChange)="page.set($event)">
          </ki-pager>
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
    .ki-subtitle { font-size: 0.7rem; color: #64748b; margin: 0; }
    .ki-btn-refresh {
      padding: 0.35rem 0.6rem; background: #e0e7ff; color: #3730a3;
      border: none; border-radius: 0.375rem; font-size: 0.8rem; cursor: pointer;
    }
    .ki-section-label {
      font-size: 0.65rem; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.08em; color: #64748b; margin: 1rem 0 0.5rem 0;
    }
    .ki-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .ki-table thead tr { border-bottom: 2px solid #e2e8f0; }
    .ki-table th {
      padding: 0.5rem 0.6rem; text-align: left; text-transform: uppercase;
      font-size: 0.6rem; font-weight: 800; letter-spacing: 0.08em; color: #64748b;
    }
    .ki-table td { padding: 0.5rem 0.6rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .ki-right { text-align: right; }
    .ki-mono { font-family: ui-monospace, monospace; }
    .ki-muted { color: #94a3b8; }
    .ki-tiny { font-size: 0.7rem; }
    .ki-provider { color: #4f46e5; font-weight: 700; }
    .ki-empty { text-align: center; padding: 1.5rem; color: #94a3b8; }
  `],
})
export class FailoverAnalyticsComponent implements OnInit {
  private readonly api = inject(KiModelsApiService);

  /** Konsumenten-i18n-Override. Default = englische Labels. */
  L: FailoverAnalyticsLabels = FAILOVER_ANALYTICS_LABELS_EN;
  @Input() set labels(v: Partial<FailoverAnalyticsLabels> | undefined) {
    this.L = { ...FAILOVER_ANALYTICS_LABELS_EN, ...(v ?? {}) };
  }

  /** Seitengröße der Provider×Grund-Tabelle. Default 25. */
  @Input() pageSize = 25;

  readonly breakdown = signal<FailoverBreakdown>({ byProvider: [], byProviderReason: [], byReason: [] });
  readonly loading = signal(true);
  readonly page = signal(0);

  readonly byProviderReason = computed<FailoverByProviderReason[]>(
    () => this.breakdown().byProviderReason ?? [],
  );
  readonly donutData = computed(() =>
    (this.breakdown().byProvider ?? []).map((p) => ({
      key: p.provider,
      label: p.provider,
      count: p.failovers,
    })),
  );
  readonly pageRows = computed(() => paginate(this.byProviderReason(), this.page(), this.pageSize));
  readonly isEmpty = computed(() =>
    (this.breakdown().byProvider ?? []).length === 0 &&
    this.byProviderReason().length === 0,
  );

  ngOnInit(): void {
    this.reload();
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
  }
}