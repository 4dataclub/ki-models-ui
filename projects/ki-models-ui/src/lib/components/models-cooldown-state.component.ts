import { Component, Input, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { CooldownRow } from '../models/cooldown';
import { KiPagerComponent, paginate } from './ki-pager.component';
import { SortState, nextSort, sortGlyph, sortRows, filterRows } from './table-tools';

/**
 * v0.14.0 — Cooldown + Auto-Disable State pro Modell.
 *
 * Zeigt:
 * - rote Zeile bei `autoDisabled=true` (System hat das Modell gekillt)
 * - gelbe Zeile bei `cooldownRemainingSec > 0` (Modell hat gerade Fehler, kommt zurück)
 * - grüne / neutrale Zeile für gesunde Modelle
 * - Live-Auto-Refresh alle 30s damit der Cooldown-Counter live runterläuft
 *
 * Konsumenten-Use-Case:
 * - EduPro: ersetzt die `/admin/stats/gemini`-Card im Operations-Tab
 * - Switcher: kann embedded werden für Cooldown-Visibilität
 */
@Component({
  selector: 'ki-models-cooldown-state',
  standalone: true,
  imports: [CommonModule, KiPagerComponent],
  template: `
    <div class="ki-cd">
      <div class="ki-header">
        <div>
          <h4 class="ki-title">{{ title }}</h4>
          <p class="ki-subtitle">{{ subtitle }}</p>
        </div>
        <button (click)="reload()" class="ki-btn-refresh" title="Jetzt neu laden">↻</button>
      </div>

      <p *ngIf="loading()" class="ki-muted">Lade Cooldown-State…</p>
      <p *ngIf="!loading() && rows().length === 0" class="ki-empty">
        Keine Modelle konfiguriert.
      </p>

      <input *ngIf="rows().length > 0"
        class="ki-filter" type="text" placeholder="Filtern…"
        [value]="filter()" (input)="setFilter($any($event.target).value)" />

      <table *ngIf="rows().length > 0" class="ki-table">
        <thead>
          <tr>
            <th></th>
            <th class="ki-sortable" (click)="sortCol('modelId')">Modell <span class="ki-glyph">{{ glyph('modelId') }}</span></th>
            <th class="ki-sortable" (click)="sortCol('category')">Kategorie <span class="ki-glyph">{{ glyph('category') }}</span></th>
            <th class="ki-right">Status</th>
            <th>Grund</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of pageRows()"
              [class.ki-row-killed]="r.autoDisabled"
              [class.ki-row-cooldown]="!r.autoDisabled && liveRemaining(r) > 0">
            <td class="ki-icon">
              {{ statusIcon(r) }}
            </td>
            <td class="ki-mono">
              <span class="ki-provider">{{ r.provider }}</span>
              <strong>{{ r.modelId }}</strong>
              <div *ngIf="r.displayName" class="ki-tiny ki-muted">{{ r.displayName }}</div>
            </td>
            <td class="ki-tiny">{{ r.category || '—' }}</td>
            <td class="ki-right ki-mono">
              <span *ngIf="r.autoDisabled" class="ki-status-killed">KILLED</span>
              <span *ngIf="!r.autoDisabled && liveRemaining(r) > 0" class="ki-status-cooldown">
                {{ formatCooldown(liveRemaining(r)) }}
              </span>
              <span *ngIf="!r.autoDisabled && liveRemaining(r) === 0 && r.enabled" class="ki-status-ok">
                ready
              </span>
              <span *ngIf="!r.autoDisabled && liveRemaining(r) === 0 && !r.enabled" class="ki-status-off">
                off
              </span>
            </td>
            <td class="ki-tiny ki-muted ki-reason">
              {{ r.autoDisabledReason || '—' }}
            </td>
          </tr>
        </tbody>
      </table>

      <ki-pager
        [total]="viewRows().length"
        [page]="page()"
        [pageSize]="pageSize"
        (pageChange)="page.set($event)">
      </ki-pager>

      <p class="ki-foot ki-tiny ki-muted">
        Auto-Refresh alle {{ autoRefreshSec }}s. Cooldown-Zähler lebt im
        Backend, hier wird er nur visualisiert.
      </p>
    </div>
  `,
  styles: [`
    .ki-cd { font-family: inherit; padding: 1rem 0; }
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
    .ki-table td { padding: 0.55rem 0.6rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .ki-row-killed { background: linear-gradient(90deg, #fef2f2 0%, transparent 100%); }
    .ki-row-cooldown { background: linear-gradient(90deg, #fffbeb 0%, transparent 100%); }
    .ki-icon { font-size: 1.2rem; text-align: center; width: 2rem; }
    .ki-right { text-align: right; }
    .ki-mono { font-family: ui-monospace, monospace; }
    .ki-muted { color: #94a3b8; }
    .ki-tiny { font-size: 0.7rem; }
    .ki-provider { color: #4f46e5; font-weight: 700; margin-right: 0.4rem; }
    .ki-reason { max-width: 24rem; word-break: break-word; }
    .ki-status-killed {
      background: #fee2e2; color: #991b1b; padding: 0.2rem 0.5rem;
      border-radius: 0.25rem; font-size: 0.7rem; font-weight: 800;
    }
    .ki-status-cooldown {
      background: #fef3c7; color: #92400e; padding: 0.2rem 0.5rem;
      border-radius: 0.25rem; font-size: 0.7rem; font-weight: 700;
    }
    .ki-status-ok { color: #059669; font-weight: 700; font-size: 0.7rem; }
    .ki-status-off { color: #94a3b8; font-weight: 600; font-size: 0.7rem; }
    .ki-empty { text-align: center; padding: 1.5rem; color: #94a3b8; }
    .ki-foot { margin-top: 0.75rem; font-style: italic; }
  `],
})
export class ModelsCooldownStateComponent implements OnInit, OnDestroy {
  private readonly api = inject(KiModelsApiService);

  @Input() title = 'Cooldown-State — pro Modell';
  @Input() subtitle = 'Live-Status: KILLED (rot) → Cooldown (gelb) → ready (grün).';

  /** Auto-Refresh-Intervall in Sekunden. Default 30s. 0 disabled. */
  @Input() autoRefreshSec = 30;

  /** Seitengröße. Pager nur sichtbar wenn mehr Zeilen. Kein Page-Reset beim
   *  Auto-Refresh — paginate() klemmt defensiv. */
  @Input() pageSize = 10;

  readonly rows = signal<CooldownRow[]>([]);
  readonly loading = signal(true);
  readonly page = signal(0);
  readonly filter = signal('');
  readonly sort = signal<SortState>({ key: null, dir: null });
  readonly viewRows = computed(() =>
    sortRows(
      filterRows(this.rows(), this.filter(), ['provider', 'modelId', 'displayName', 'category', 'autoDisabledReason']),
      this.sort(),
    ),
  );
  readonly pageRows = computed(() => paginate(this.viewRows(), this.page(), this.pageSize));

  glyph(key: string): string { return sortGlyph(this.sort(), key); }
  sortCol(key: string): void { this.sort.set(nextSort(this.sort(), key)); this.page.set(0); }
  setFilter(v: string): void { this.filter.set(v); this.page.set(0); }

  /** v0.15.0 — 1s-Tick, lässt den Cooldown-Zähler zwischen den Reloads sichtbar
   *  runterlaufen. `fetchedAt` = Zeitpunkt des letzten Backend-Werts. */
  readonly tick = signal(Date.now());
  private fetchedAt = Date.now();

  private timer: ReturnType<typeof setInterval> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.reload();
    if (this.autoRefreshSec > 0) {
      this.timer = setInterval(() => this.reload(), this.autoRefreshSec * 1000);
    }
    // Sekunden-Tick für die Live-Anzeige — rein lokal, kein API-Traffic.
    this.tickTimer = setInterval(() => this.tick.set(Date.now()), 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.timer = null;
    this.tickTimer = null;
  }

  reload(): void {
    this.loading.set(true);
    this.api.getCooldownState().subscribe({
      next: (rows) => {
        this.rows.set(Array.isArray(rows) ? rows : []);
        this.fetchedAt = Date.now();
        this.tick.set(this.fetchedAt);
        this.loading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.loading.set(false);
      },
    });
  }

  /**
   * v0.15.0 — Live-Restzeit: Backend-Wert minus seither vergangene Sekunden.
   * Liest {@link tick}, damit die Anzeige jede Sekunde neu berechnet wird.
   */
  liveRemaining(r: CooldownRow): number {
    const elapsed = Math.floor((this.tick() - this.fetchedAt) / 1000);
    return Math.max(0, (r.cooldownRemainingSec ?? 0) - elapsed);
  }

  statusIcon(r: CooldownRow): string {
    if (r.autoDisabled) return '✗';
    if (this.liveRemaining(r) > 0) return '⏳';
    if (!r.enabled) return '○';
    return '✓';
  }

  /**
   * Cooldown-Sekunden lesbar machen.
   * 0-90s: "Xs", 90s-90min: "Xm", 90min+: "Xh"
   */
  formatCooldown(sec: number): string {
    if (sec < 90) return `${sec}s`;
    if (sec < 5400) return `${Math.round(sec / 60)}m`;
    return `${Math.round(sec / 3600)}h`;
  }
}
