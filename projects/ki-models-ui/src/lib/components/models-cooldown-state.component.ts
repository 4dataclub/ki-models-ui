import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { CooldownRow } from '../models/cooldown';

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
  imports: [CommonModule],
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

      <table *ngIf="rows().length > 0" class="ki-table">
        <thead>
          <tr>
            <th></th>
            <th>Modell</th>
            <th>Kategorie</th>
            <th class="ki-right">Status</th>
            <th>Grund</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of rows()"
              [class.ki-row-killed]="r.autoDisabled"
              [class.ki-row-cooldown]="!r.autoDisabled && r.cooldownRemainingSec > 0">
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
              <span *ngIf="!r.autoDisabled && r.cooldownRemainingSec > 0" class="ki-status-cooldown">
                {{ formatCooldown(r.cooldownRemainingSec) }}
              </span>
              <span *ngIf="!r.autoDisabled && r.cooldownRemainingSec === 0 && r.enabled" class="ki-status-ok">
                ready
              </span>
              <span *ngIf="!r.autoDisabled && r.cooldownRemainingSec === 0 && !r.enabled" class="ki-status-off">
                off
              </span>
            </td>
            <td class="ki-tiny ki-muted ki-reason">
              {{ r.autoDisabledReason || '—' }}
            </td>
          </tr>
        </tbody>
      </table>

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
    .ki-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .ki-table thead tr { border-bottom: 2px solid #e2e8f0; }
    .ki-table th {
      padding: 0.5rem 0.6rem; text-align: left; text-transform: uppercase;
      font-size: 0.6rem; font-weight: 800; letter-spacing: 0.08em; color: #64748b;
    }
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

  readonly rows = signal<CooldownRow[]>([]);
  readonly loading = signal(true);

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

  reload(): void {
    this.loading.set(true);
    this.api.getCooldownState().subscribe({
      next: (rows) => {
        this.rows.set(Array.isArray(rows) ? rows : []);
        this.loading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.loading.set(false);
      },
    });
  }

  statusIcon(r: CooldownRow): string {
    if (r.autoDisabled) return '✗';
    if (r.cooldownRemainingSec > 0) return '⏳';
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
