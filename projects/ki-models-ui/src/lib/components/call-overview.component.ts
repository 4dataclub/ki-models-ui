import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { KiAreaChartComponent } from './ki-area-chart.component';
import { TrendPoint } from '../models/stats-trend';
import { StatsTotals } from '../models/stats-totals';
import { CallOverviewLabels, CALL_OVERVIEW_LABELS_EN } from '../models/labels';

/**
 * v0.18.0 — Geteiltes Analytics-Panel: Erfolgs-Trend (30 Tage) als Area-Chart,
 * KI-Calls-Totals-Cards (24h/7d/30d/✓/✗) und eine geschätzte-Kosten-Summary.
 *
 * Speist sich aus den genuin geteilten Endpunkten `/stats/trend` und
 * `/stats/totals` (llm-cascade → Switcher-Proxy). Kosten werden client-seitig
 * aus `outputChars30d` geschätzt: Tokens ≈ chars/4, € = tokens × Rate.
 *
 * Dependency-frei (reines SVG via `<ki-area-chart>`), keine Tailwind-Klassen.
 * Graceful: fehlende/leere Daten → Leer-Hinweis statt Crash.
 */
@Component({
  selector: 'ki-call-overview',
  standalone: true,
  imports: [CommonModule, KiAreaChartComponent],
  template: `
    <div class="ki-co">
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
          <div class="ki-section-label">{{ L.trendTitle }}</div>
          <ki-area-chart [series]="trendSeries()"></ki-area-chart>

          <div class="ki-cards">
            <div class="ki-card-stat">
              <div class="ki-card-num">{{ totals().last24h ?? 0 }}</div>
              <div class="ki-card-lbl">{{ L.card24h }}</div>
            </div>
            <div class="ki-card-stat">
              <div class="ki-card-num">{{ totals().last7d ?? 0 }}</div>
              <div class="ki-card-lbl">{{ L.card7d }}</div>
            </div>
            <div class="ki-card-stat">
              <div class="ki-card-num">{{ totals().last30d ?? 0 }}</div>
              <div class="ki-card-lbl">{{ L.card30d }}</div>
            </div>
            <div class="ki-card-stat ki-card-ok">
              <div class="ki-card-num">{{ totals().success30d ?? 0 }}</div>
              <div class="ki-card-lbl">{{ L.cardSuccess30d }}</div>
            </div>
            <div class="ki-card-stat ki-card-fail">
              <div class="ki-card-num">{{ totals().failed30d ?? 0 }}</div>
              <div class="ki-card-lbl">{{ L.cardFailed30d }}</div>
            </div>
          </div>

          <div class="ki-section-label">{{ L.costTitle }}</div>
          <div class="ki-cards">
            <div class="ki-card-stat">
              <div class="ki-card-num">{{ outputChars() | number }}</div>
              <div class="ki-card-lbl">{{ L.costChars }}</div>
            </div>
            <div class="ki-card-stat">
              <div class="ki-card-num">{{ estTokens() | number }}</div>
              <div class="ki-card-lbl">{{ L.costTokens }}</div>
            </div>
            <div class="ki-card-stat ki-card-cost">
              <div class="ki-card-num">{{ estCostLabel() }}</div>
              <div class="ki-card-lbl">{{ L.costMoney }}</div>
            </div>
          </div>
        </ng-container>
      </ng-container>
    </div>
  `,
  styles: [`
    .ki-co { font-family: inherit; padding: 1rem 0; }
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
    .ki-cards {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
      gap: 0.6rem; margin-bottom: 0.5rem;
    }
    .ki-card-stat {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem;
      padding: 0.7rem 0.8rem; text-align: center;
    }
    .ki-card-num {
      font-size: 1.3rem; font-weight: 900; color: #1e293b;
      font-variant-numeric: tabular-nums; line-height: 1;
    }
    .ki-card-lbl {
      font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.04em; color: #94a3b8; margin-top: 0.35rem;
    }
    .ki-card-ok .ki-card-num { color: #059669; }
    .ki-card-fail .ki-card-num { color: #dc2626; }
    .ki-card-cost .ki-card-num { color: #4f46e5; }
    .ki-muted { color: #94a3b8; }
    .ki-empty { text-align: center; padding: 1.5rem; color: #94a3b8; }
  `],
})
export class CallOverviewComponent implements OnInit {
  private readonly api = inject(KiModelsApiService);

  /** Konsumenten-i18n-Override. Default = englische Labels. */
  L: CallOverviewLabels = CALL_OVERVIEW_LABELS_EN;
  @Input() set labels(v: Partial<CallOverviewLabels> | undefined) {
    this.L = { ...CALL_OVERVIEW_LABELS_EN, ...(v ?? {}) };
  }

  /** Tage für den Trend. Default 30. */
  @Input() trendDays = 30;

  /** Geschätzte Kosten pro 1 Mio. Output-Tokens (in der Währung von `currency`). */
  @Input() costPerMillionTokens = 2.0;
  @Input() currency = '€';

  readonly trend = signal<TrendPoint[]>([]);
  readonly totals = signal<StatsTotals>({});
  readonly loading = signal(true);

  readonly trendSeries = computed(() =>
    this.trend().map((p) => ({ date: p.date, value: p.total })),
  );
  readonly outputChars = computed(() => this.totals().outputChars30d ?? 0);
  readonly estTokens = computed(() => Math.round(this.outputChars() / 4));
  readonly isEmpty = computed(() =>
    this.trend().length === 0 && (this.totals().last30d ?? 0) === 0,
  );

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    let pending = 2;
    const done = () => { if (--pending === 0) this.loading.set(false); };

    this.api.getStatsTrend(this.trendDays).subscribe({
      next: (t) => { this.trend.set(Array.isArray(t) ? t : []); done(); },
      error: () => { this.trend.set([]); done(); },
    });
    this.api.getStatsTotals().subscribe({
      next: (t) => { this.totals.set(t ?? {}); done(); },
      error: () => { this.totals.set({}); done(); },
    });
  }

  estCostLabel(): string {
    const cost = (this.estTokens() / 1_000_000) * this.costPerMillionTokens;
    return `${this.currency}${cost.toFixed(2)}`;
  }
}