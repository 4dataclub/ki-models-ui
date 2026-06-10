import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { QualityStatRow } from '../models/quality';

/**
 * v0.7.1 / Library v0.12.0 — Quality-Bewertung pro Modell aus den letzten
 * 30 Tagen, sortiert worst-first (KILL-Kandidaten oben).
 *
 * <h3>Was zeigt das?</h3>
 * Eine simple Tabelle pro Modell mit:
 *  - Tier-Icon (★ top / ◐ ok / ▽ weak / ✗ kill)
 *  - Quality-Score (0.0 - 2.0+)
 *  - Success-Rate, Avg-Chars, Anzahl Calls
 *  - Rotes Highlighting für KILL-Kandidaten
 *
 * <h3>Wofür?</h3>
 * Admin sieht auf einen Blick welche Modelle nicht laufen. Statt durch
 * eine lange Liste zu scrollen ist das problematische ganz oben.
 *
 * <h3>Konsument-Use-Case:</h3>
 * - EduPro: in den Operations-Tab embedded, ersetzt die alte AI-Quality-Card
 * - Switcher: in Stats-Tab embedded
 */
@Component({
  selector: 'ki-models-quality-stats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ki-quality-stats">
      <div class="ki-header">
        <div>
          <h4 class="ki-title">{{ title }}</h4>
          <p class="ki-subtitle">{{ subtitle }}</p>
        </div>
        <div class="ki-controls">
          <label class="ki-tiny ki-muted">Sortierung:</label>
          <select [(ngModel)]="sortBy" (change)="reload()" class="ki-select">
            <option value="worst-first">Schlechteste zuerst</option>
            <option value="best-first">Beste zuerst</option>
            <option value="calls-desc">Meist genutzte zuerst</option>
          </select>
          <button (click)="reload()" class="ki-btn-refresh">↻</button>
        </div>
      </div>

      <p *ngIf="loading()" class="ki-muted">Lade Quality-Stats…</p>
      <p *ngIf="!loading() && rows().length === 0" class="ki-empty">
        Noch keine Stats — Modelle wurden in den letzten 30 Tagen nicht aufgerufen.
      </p>

      <table *ngIf="rows().length > 0" class="ki-table">
        <thead>
          <tr>
            <th></th>
            <th>Modell</th>
            <th>Kategorie</th>
            <th class="ki-right">Score</th>
            <th class="ki-right">Erfolg</th>
            <th class="ki-right">Calls (30d)</th>
            <th class="ki-right">Ø Chars</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of rows()"
              [class.ki-row-kill]="r.kill"
              [class.ki-row-weak]="r.tier === 'weak'">
            <td class="ki-tier-icon" [class]="'ki-tier-' + r.tier">{{ r.tierIcon }}</td>
            <td class="ki-mono">
              <span class="ki-provider">{{ r.provider }}</span>
              <strong>{{ r.modelId }}</strong>
              <div *ngIf="r.displayName" class="ki-tiny ki-muted">{{ r.displayName }}</div>
            </td>
            <td class="ki-tiny">{{ r.category || '—' }}</td>
            <td class="ki-right ki-mono">
              <strong [class]="'ki-tier-' + r.tier">{{ r.score | number:'1.2-2' }}</strong>
            </td>
            <td class="ki-right">{{ (r.successRate * 100) | number:'1.0-1' }}%</td>
            <td class="ki-right">{{ r.callsLast30d }}</td>
            <td class="ki-right ki-tiny ki-muted">{{ r.avgChars }}</td>
            <td>
              <span *ngIf="r.kill" class="ki-kill-badge" title="Empfehlung: deaktivieren">DISABLE</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .ki-quality-stats { font-family: inherit; padding: 1rem 0; }
    .ki-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 1rem; margin-bottom: 1rem;
    }
    .ki-title {
      font-size: 0.85rem; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.1em; color: #1e293b; margin: 0 0 0.25rem 0;
    }
    .ki-subtitle { font-size: 0.7rem; color: #64748b; margin: 0; }
    .ki-controls { display: flex; gap: 0.5rem; align-items: center; }
    .ki-select {
      padding: 0.35rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 0.375rem;
      font-size: 0.75rem; background: white;
    }
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
    .ki-row-kill { background: linear-gradient(90deg, #fef2f2 0%, transparent 100%); }
    .ki-row-weak { background: linear-gradient(90deg, #fffbeb 0%, transparent 100%); }
    .ki-right { text-align: right; }
    .ki-mono { font-family: ui-monospace, monospace; }
    .ki-muted { color: #94a3b8; }
    .ki-tiny { font-size: 0.7rem; }
    .ki-provider { color: #4f46e5; font-weight: 700; margin-right: 0.4rem; }
    .ki-tier-icon { font-size: 1.2rem; text-align: center; width: 2.2rem; }
    .ki-tier-top { color: #059669; font-weight: 800; }
    .ki-tier-ok { color: #d97706; font-weight: 800; }
    .ki-tier-weak { color: #ea580c; font-weight: 800; }
    .ki-tier-kill { color: #dc2626; font-weight: 800; }
    .ki-tier-unknown { color: #94a3b8; }
    .ki-kill-badge {
      background: #fee2e2; color: #991b1b; padding: 0.2rem 0.4rem;
      border-radius: 0.25rem; font-size: 0.6rem; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .ki-empty { text-align: center; padding: 1.5rem; color: #94a3b8; }
  `],
})
export class ModelsQualityStatsComponent implements OnInit {
  private readonly api = inject(KiModelsApiService);

  /** Label oben — überschreibbar pro Konsument. */
  @Input() title = 'KI-Qualität — Stats der letzten 30 Tage';
  @Input() subtitle = 'Schlechte Modelle stehen oben. KILL-Kandidaten sollten deaktiviert werden.';

  sortBy: 'worst-first' | 'best-first' | 'calls-desc' = 'worst-first';

  readonly rows = signal<QualityStatRow[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.getQualityStats(this.sortBy).subscribe({
      next: (rows) => {
        this.rows.set(Array.isArray(rows) ? rows : []);
        this.loading.set(false);
      },
      error: () => {
        // Backend < 0.7.2: leere Liste, kein Crash
        this.rows.set([]);
        this.loading.set(false);
      },
    });
  }
}
