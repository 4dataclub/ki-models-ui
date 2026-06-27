import { Component, Input, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { FailoverEvent, FailoverEvents } from '../models/stats-failover';
import { ModeEventsLabels, MODE_EVENTS_LABELS_EN } from '../models/labels';
import { filterRows } from './table-tools';

/**
 * v0.20.0 — Eigene Liste der Modus-/Toggle-Umschaltungen.
 *
 * Speist sich aus `/stats/failover` wie {@link import('./failover-analytics.component')},
 * zeigt aber NUR Host-/Toggle-Events:
 * `toggle_on` / `toggle_off` (Modell an/aus), `pool_switch` (Pool-Wechsel),
 * `supermodel_on` / `supermodel_off` (Supermodell-Achse).
 *
 * Gedacht für den „Modus"-Bereich im Switcher (neben dem Pool-/Supermodell-Panel),
 * damit man dort die letzten Schaltvorgänge mit Datum sieht. Header + absolute
 * Datumsangabe + Filter; Auto-Refresh damit Live-Toggles auftauchen.
 */
@Component({
  selector: 'ki-mode-events',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ki-me">
      <div class="ki-header">
        <div>
          <h4 class="ki-title">{{ L.title }}</h4>
          <p class="ki-subtitle">{{ L.subtitle }}</p>
        </div>
        <button (click)="reload()" class="ki-btn-refresh" title="Neu laden">↻</button>
      </div>

      <p *ngIf="loading()" class="ki-muted">{{ L.loading }}</p>

      <ng-container *ngIf="!loading()">
        <p *ngIf="modeEvents().length === 0" class="ki-empty">{{ L.empty }}</p>

        <ng-container *ngIf="modeEvents().length > 0">
          <input
            class="ki-filter"
            type="text"
            [placeholder]="L.filterPlaceholder"
            [value]="filter()"
            (input)="setFilter($any($event.target).value)" />

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
              <span class="ki-tiny ki-reason">{{ e.reason || '' }}</span>
              <span class="ki-tiny ki-when">{{ fmtWhen(e.occurredAt) }}</span>
            </div>
          </div>
        </ng-container>
      </ng-container>
    </div>
  `,
  styles: [`
    .ki-me { font-family: inherit; }
    .ki-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 1rem; margin-bottom: 0.75rem;
    }
    .ki-title {
      font-size: 0.7rem; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.1em; color: #1e293b; margin: 0 0 0.2rem 0;
    }
    .ki-subtitle { font-size: 0.7rem; color: #64748b; margin: 0; }
    .ki-btn-refresh {
      padding: 0.35rem 0.6rem; background: #e0e7ff; color: #3730a3;
      border: none; border-radius: 0.375rem; font-size: 0.8rem; cursor: pointer;
    }
    .ki-filter {
      width: 100%; box-sizing: border-box; padding: 0.4rem 0.6rem;
      margin-bottom: 0.5rem; border: 1px solid #e2e8f0; border-radius: 0.375rem;
      font-size: 0.8rem;
    }
    .ki-muted { color: #94a3b8; font-size: 0.8rem; }
    .ki-mono { font-family: ui-monospace, monospace; }
    .ki-tiny { font-size: 0.7rem; }
    .ki-empty { text-align: center; padding: 1.25rem; color: #94a3b8; font-size: 0.8rem; }
    .ki-timeline {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem;
      padding: 0.5rem 0.85rem;
    }
    .ki-event {
      display: flex; align-items: center; gap: 0.6rem; padding: 0.35rem 0;
      border-bottom: 1px solid #eef2f7; font-size: 0.72rem;
    }
    .ki-event:last-child { border-bottom: none; }
    .ki-event-head {
      text-transform: uppercase; font-size: 0.6rem; font-weight: 800;
      letter-spacing: 0.08em; color: #64748b; border-bottom: 2px solid #e2e8f0;
    }
    .ki-badge-head {
      flex-shrink: 0; min-width: 6.5rem; text-align: center; padding: 0.1rem 0.4rem;
    }
    .ki-badge {
      flex-shrink: 0; min-width: 6.5rem; text-align: center; padding: 0.1rem 0.4rem;
      border-radius: 0.3rem; font-family: ui-monospace, monospace; font-size: 0.62rem;
      font-weight: 700;
    }
    .ki-badge-down { background: #fee2e2; color: #b91c1c; }
    .ki-badge-up   { background: #dcfce7; color: #15803d; }
    .ki-badge-on   { background: #dbeafe; color: #1d4ed8; }
    .ki-badge-off  { background: #f1f5f9; color: #475569; }
    .ki-badge-pool { background: #ede9fe; color: #6d28d9; }
    .ki-badge-switch { background: #e0e7ff; color: #3730a3; }
    .ki-transition { color: #334155; flex: 1; }
    .ki-reason { color: #64748b; flex: 1; }
    .ki-when { color: #94a3b8; text-align: right; white-space: nowrap; }
  `],
})
export class ModeEventsComponent implements OnInit, OnDestroy {
  private readonly api = inject(KiModelsApiService);

  /** Konsumenten-i18n-Override. Default = englische Labels. */
  L: ModeEventsLabels = MODE_EVENTS_LABELS_EN;
  @Input() set labels(v: Partial<ModeEventsLabels> | undefined) {
    this.L = { ...MODE_EVENTS_LABELS_EN, ...(v ?? {}) };
  }

  /** Auto-Refresh-Intervall in Sekunden. Default 10s. 0 deaktiviert. */
  @Input() autoRefreshSec = 10;

  /** Event-Typen die als „Modus-/Toggle-Umschaltung" gelten. */
  private static readonly MODE_TYPES = new Set([
    'toggle_on', 'toggle_off', 'pool_switch', 'supermodel_on', 'supermodel_off',
    'model_switch',
  ]);

  readonly events = signal<FailoverEvent[]>([]);
  readonly loading = signal(true);
  readonly filter = signal('');

  readonly modeEvents = computed<FailoverEvent[]>(() =>
    this.events().filter((e) => ModeEventsComponent.MODE_TYPES.has(e.type)),
  );
  readonly filteredEvents = computed<FailoverEvent[]>(() =>
    filterRows(this.modeEvents(), this.filter(), ['type', 'fromModel', 'toModel', 'reason']),
  );

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.reload();
    if (this.autoRefreshSec > 0) {
      this.timer = setInterval(() => this.reload(), this.autoRefreshSec * 1000);
    }
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setFilter(v: string): void { this.filter.set(v); }

  reload(): void {
    this.api.getStatsFailover().subscribe({
      next: (e: FailoverEvents) => {
        this.events.set(Array.isArray(e?.recent) ? e.recent : []);
        this.loading.set(false);
      },
      error: () => {
        this.events.set([]);
        this.loading.set(false);
      },
    });
  }

  badgeClass(type: string): string {
    switch (type) {
      case 'toggle_on':
      case 'supermodel_on': return 'ki-badge-on';
      case 'toggle_off':
      case 'supermodel_off': return 'ki-badge-off';
      case 'pool_switch': return 'ki-badge-pool';
      case 'model_switch': return 'ki-badge-switch';
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
}
