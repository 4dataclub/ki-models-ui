import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { LogSnippetRow } from '../models/log-snippet';

/**
 * v0.20.0 — Prompt-Log-Panel: zeigt die zuletzt geloggten Prompt-Snippets
 * (Zeitpunkt/Service/Modell/Provider/Kategorie/Snippet/Status) aus
 * `GET {base}/stats/log-snippets?limit=N`.
 *
 * Ehrlicher Hinweis: Snippets entstehen NUR, wenn das Setting
 * `logPromptSnippet` AN ist UND der Traffic durch die Cascade lief. Der
 * direkte cloud+Anthropic-Pfad umgeht die Cascade → dort wird nichts geloggt.
 *
 * Card/Section-Struktur analog `<ki-call-overview>` / `<ki-failover-analytics>`.
 * Graceful: leeres Array → erklärender Leer-Hinweis statt Crash.
 */
@Component({
  selector: 'ki-log-snippets',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ki-ls">
      <div class="ki-header">
        <div>
          <h4 class="ki-title">{{ title }}</h4>
          <p class="ki-subtitle">{{ subtitle }}</p>
        </div>
        <button (click)="reload()" class="ki-btn-refresh" title="Neu laden">↻</button>
      </div>

      <p *ngIf="loading()" class="ki-muted">Lade Prompt-Log…</p>

      <ng-container *ngIf="!loading()">
        <div *ngIf="rows().length === 0" class="ki-empty">
          <p class="ki-empty-head">Keine Prompt-Snippets vorhanden.</p>
          <p class="ki-empty-body">
            Snippets werden nur geschrieben, wenn „Prompt-Logging“
            (<code>logPromptSnippet</code>) aktiv ist UND der Traffic durch die
            Cascade läuft. Der direkte cloud+Anthropic-Pfad umgeht die Cascade
            und wird nicht geloggt.
          </p>
        </div>

        <table *ngIf="rows().length > 0" class="ki-table">
          <thead>
            <tr>
              <th>Zeitpunkt</th>
              <th>Service</th>
              <th>Modell</th>
              <th>Provider</th>
              <th>Kategorie</th>
              <th>Snippet</th>
              <th class="ki-center">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of rows()">
              <td class="ki-tiny ki-when">{{ fmtWhen(r.calledAt) }}</td>
              <td class="ki-tiny">{{ r.service || '—' }}</td>
              <td class="ki-mono ki-tiny">{{ r.model || '—' }}</td>
              <td class="ki-tiny"><span class="ki-provider">{{ r.provider || '—' }}</span></td>
              <td class="ki-tiny">{{ r.category || '—' }}</td>
              <td class="ki-snippet">{{ r.promptSnippet }}</td>
              <td class="ki-center">
                <span class="ki-badge" [class.ki-badge-ok]="r.success" [class.ki-badge-fail]="!r.success">
                  {{ r.success ? 'OK' : 'Fehler' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </ng-container>
    </div>
  `,
  styles: [`
    .ki-ls { font-family: inherit; padding: 1rem 0; }
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
    .ki-muted { color: #94a3b8; }
    .ki-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .ki-table thead tr { border-bottom: 2px solid #e2e8f0; }
    .ki-table th {
      padding: 0.5rem 0.6rem; text-align: left; text-transform: uppercase;
      font-size: 0.6rem; font-weight: 800; letter-spacing: 0.08em; color: #64748b;
      white-space: nowrap;
    }
    .ki-table td { padding: 0.5rem 0.6rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .ki-center { text-align: center; }
    .ki-mono { font-family: ui-monospace, monospace; }
    .ki-tiny { font-size: 0.7rem; }
    .ki-when { white-space: nowrap; color: #94a3b8; }
    .ki-provider { color: #4f46e5; font-weight: 700; }
    .ki-snippet {
      font-size: 0.72rem; color: #334155; max-width: 28rem;
      overflow-wrap: anywhere; white-space: pre-wrap; line-height: 1.35;
    }
    .ki-badge {
      display: inline-block; padding: 0.1rem 0.4rem; border-radius: 0.3rem;
      font-size: 0.62rem; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .ki-badge-ok   { background: #dcfce7; color: #15803d; }
    .ki-badge-fail { background: #fee2e2; color: #b91c1c; }
    .ki-empty {
      background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 0.5rem;
      padding: 1.25rem 1.5rem; text-align: center;
    }
    .ki-empty-head { font-weight: 700; color: #475569; margin: 0 0 0.4rem 0; font-size: 0.85rem; }
    .ki-empty-body { color: #64748b; margin: 0; font-size: 0.72rem; line-height: 1.5; }
    .ki-empty-body code {
      font-family: ui-monospace, monospace; font-size: 0.68rem;
      background: #e2e8f0; padding: 0.05rem 0.25rem; border-radius: 0.2rem;
    }
  `],
})
export class LogSnippetsComponent implements OnInit {
  private readonly api = inject(KiModelsApiService);

  /** Titel oben — überschreibbar pro Konsument. */
  @Input() title = 'Prompt-Log';
  @Input() subtitle =
    'Zuletzt geloggte Prompt-Snippets. Nur befüllt, wenn Prompt-Logging AN ist und Traffic durch die Cascade lief.';

  /** Wie viele Snippets geladen werden. Default 50. */
  @Input() limit = 50;

  readonly rows = signal<LogSnippetRow[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.getLogSnippets(this.limit).subscribe({
      next: (r) => { this.rows.set(Array.isArray(r) ? r : []); this.loading.set(false); },
      error: () => { this.rows.set([]); this.loading.set(false); },
    });
  }

  fmtWhen(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString([], {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
