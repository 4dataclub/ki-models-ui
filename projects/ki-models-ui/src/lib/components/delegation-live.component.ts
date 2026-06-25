import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { DelegationCall } from '../models/delegation-call';

/**
 * v0.17.0 — Live-Browser-Watcher für Delegations-Calls.
 *
 * Zeigt die letzten `maxRows` Delegations-Calls in einer kompakten Tabelle.
 * - Zeit (toLocaleTimeString), ✓/✗-Status (grün/rot), Provider:Modell,
 *   [Service], Output-Chars, und — falls `logPromptSnippet` AN — der Snippet.
 * - Auto-Refresh alle `autoRefreshSec` Sekunden (Default 5s).
 * - Graceful 404/Fehler → leerer Zustand, kein Crash.
 *
 * Konsumenten-Use-Case:
 * - Switcher/EduPro: ersetzt den Bash-Watcher; einbettbar in Admin-Tabs.
 */
@Component({
  selector: 'ki-delegation-live',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ki-dl">
      <div class="ki-header">
        <div>
          <h4 class="ki-title">{{ title }}</h4>
          <p class="ki-subtitle">{{ subtitle }}</p>
        </div>
        <button (click)="reload()" class="ki-btn-refresh" title="Jetzt neu laden">↻</button>
      </div>

      <p *ngIf="loading()" class="ki-muted">Lade Delegations-Calls…</p>

      <p *ngIf="!loading() && error()" class="ki-empty">
        Delegation-Log nicht verfügbar.
      </p>

      <p *ngIf="!loading() && !error() && rows().length === 0" class="ki-empty">
        Noch keine Delegations-Calls.
      </p>

      <table *ngIf="!loading() && !error() && rows().length > 0" class="ki-table">
        <thead>
          <tr>
            <th></th>
            <th>Zeit</th>
            <th>Provider : Modell</th>
            <th>[Service]</th>
            <th class="ki-right">Chars</th>
            <th class="ki-snippet-head">Snippet</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of rows()"
              [class.ki-row-ok]="r.success"
              [class.ki-row-fail]="!r.success">
            <td class="ki-icon">
              <span *ngIf="r.success" class="ki-status-ok">✓</span>
              <span *ngIf="!r.success" class="ki-status-fail">✗</span>
            </td>
            <td class="ki-mono ki-tiny">{{ formatTime(r.calledAt) }}</td>
            <td class="ki-mono ki-tiny">
              <span class="ki-provider">{{ r.provider || '—' }}</span>
              <span *ngIf="r.provider && r.model">:</span>
              <span *ngIf="r.model" class="ki-model">{{ r.model }}</span>
              <span *ngIf="!r.provider && !r.model">—</span>
            </td>
            <td class="ki-tiny ki-muted">{{ r.service || '—' }}</td>
            <td class="ki-right ki-mono ki-tiny">{{ r.outputChars != null ? r.outputChars : '—' }}</td>
            <td class="ki-snippet ki-tiny ki-muted">
              <span *ngIf="r.promptSnippet">{{ r.promptSnippet }}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <p class="ki-foot ki-tiny ki-muted">
        Auto-Refresh alle {{ autoRefreshSec }}s · max. {{ maxRows }} Einträge.
      </p>
    </div>
  `,
  styles: [`
    .ki-dl { font-family: inherit; padding: 1rem 0; }
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
    .ki-table td { padding: 0.45rem 0.6rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .ki-row-ok { }
    .ki-row-fail { background: linear-gradient(90deg, #fef2f2 0%, transparent 100%); }
    .ki-icon { width: 2rem; text-align: center; }
    .ki-right { text-align: right; }
    .ki-mono { font-family: ui-monospace, monospace; }
    .ki-muted { color: #94a3b8; }
    .ki-tiny { font-size: 0.7rem; }
    .ki-provider { color: #4f46e5; font-weight: 700; margin-right: 0.15rem; }
    .ki-model { color: #0f172a; }
    .ki-status-ok { color: #059669; font-weight: 800; font-size: 0.9rem; }
    .ki-status-fail { color: #dc2626; font-weight: 800; font-size: 0.9rem; }
    .ki-snippet { max-width: 20rem; word-break: break-word; white-space: pre-wrap; }
    .ki-snippet-head { min-width: 6rem; }
    .ki-empty { text-align: center; padding: 1.5rem; color: #94a3b8; }
    .ki-foot { margin-top: 0.75rem; font-style: italic; }
  `],
})
export class DelegationLiveComponent implements OnInit, OnDestroy {
  private readonly api = inject(KiModelsApiService);

  @Input() title = 'Delegationen — Live';
  @Input() subtitle = 'Letzte Aufrufe der Kaskade. Auto-Refresh.';

  /** Auto-Refresh-Intervall in Sekunden. Default 5s. 0 deaktiviert. */
  @Input() autoRefreshSec = 5;

  /** Maximale Anzahl angezeigter Zeilen. */
  @Input() maxRows = 50;

  readonly rows = signal<DelegationCall[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

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
    this.api.getDelegationCalls().subscribe({
      next: (calls) => {
        const list = Array.isArray(calls) ? calls : [];
        this.rows.set(list.slice(0, this.maxRows));
        this.error.set(false);
        this.loading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  formatTime(calledAt: string): string {
    try {
      const d = new Date(calledAt);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleTimeString();
    } catch {
      return '—';
    }
  }
}