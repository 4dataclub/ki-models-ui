import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { PerformanceRow } from '../models/performance';

/**
 * v0.14.0 — Performance-Tabelle pro Modell der letzten 30 Tage.
 *
 * Zeigt: provider · model · calls · success% · avg chars · est cost.
 *
 * Cost-Spalte erscheint nur wenn der Konsument ein {@link costMapping}
 * (USD pro 1M Output-Tokens pro Provider) liefert. Beispiel:
 * ```ts
 * costMapping = {
 *   gemini: 0.30,        // Gemini 2.5 Flash output
 *   anthropic: 5.00,     // Claude Sonnet/Haiku output (Approx)
 *   openrouter: 0.40,    // Avg DeepSeek/Llama free → small paid
 *   openai: 2.00,
 *   ollama: 0,           // lokal = kostenlos
 * }
 * ```
 *
 * Konsumenten-Use-Case:
 * - EduPro: ersetzt die alte `/admin/stats/llm-performance`-Tabelle im
 *   Operations-Tab
 * - Switcher: kann embedded werden in der Stats-Section (optional)
 */
@Component({
  selector: 'ki-models-performance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ki-perf">
      <div class="ki-header">
        <div>
          <h4 class="ki-title">{{ title }}</h4>
          <p class="ki-subtitle">{{ subtitle }}</p>
        </div>
        <div class="ki-controls">
          <label class="ki-tiny ki-muted">Sort:</label>
          <select [(ngModel)]="sortBy" (change)="reload()" class="ki-select">
            <option value="calls-desc">Meiste Calls</option>
            <option value="success-desc">Beste Success-Rate</option>
            <option value="chars-desc">Meiste Chars</option>
          </select>
          <button (click)="reload()" class="ki-btn-refresh" title="Tabelle neu laden">↻</button>
        </div>
      </div>

      <p *ngIf="loading()" class="ki-muted">Lade Performance-Stats…</p>
      <p *ngIf="!loading() && rows().length === 0" class="ki-empty">
        Keine Calls in den letzten 30 Tagen.
      </p>

      <table *ngIf="rows().length > 0" class="ki-table">
        <thead>
          <tr>
            <th>Modell</th>
            <th class="ki-right">Calls</th>
            <th class="ki-right">Erfolg</th>
            <th class="ki-right">Ø Chars</th>
            <th *ngIf="hasCost" class="ki-right">Cost (30d)</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of rows()">
            <td class="ki-mono">
              <span class="ki-provider">{{ r.provider }}</span>
              <strong>{{ r.model }}</strong>
            </td>
            <td class="ki-right ki-mono">{{ r.calls }}</td>
            <td class="ki-right">
              <span [class]="successClass(r.successRate)">
                {{ (r.successRate * 100) | number:'1.0-1' }}%
              </span>
            </td>
            <td class="ki-right ki-tiny ki-muted">{{ r.avgChars }}</td>
            <td *ngIf="hasCost" class="ki-right ki-mono">
              {{ estCost(r) | number:'1.2-4' }} {{ costCurrency }}
            </td>
          </tr>
        </tbody>
      </table>

      <p *ngIf="hasCost" class="ki-cost-note">
        Cost geschätzt aus output_chars × {{ costNote }}.
        Free-Tier-Calls = 0 (Provider ohne Mapping kosten 0).
      </p>
    </div>
  `,
  styles: [`
    .ki-perf { font-family: inherit; padding: 1rem 0; }
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
    .ki-table td { padding: 0.55rem 0.6rem; border-bottom: 1px solid #f1f5f9; }
    .ki-right { text-align: right; }
    .ki-mono { font-family: ui-monospace, monospace; }
    .ki-muted { color: #94a3b8; }
    .ki-tiny { font-size: 0.7rem; }
    .ki-provider { color: #4f46e5; font-weight: 700; margin-right: 0.4rem; }
    .ki-success-good { color: #059669; font-weight: 700; }
    .ki-success-ok { color: #d97706; font-weight: 700; }
    .ki-success-bad { color: #dc2626; font-weight: 800; }
    .ki-empty { text-align: center; padding: 1.5rem; color: #94a3b8; }
    .ki-cost-note {
      font-size: 0.7rem; color: #94a3b8; margin: 0.75rem 0 0 0; font-style: italic;
    }
  `],
})
export class ModelsPerformanceComponent implements OnInit {
  private readonly api = inject(KiModelsApiService);

  @Input() title = 'LLM-Performance — letzte 30 Tage';
  @Input() subtitle = 'Calls + Erfolg + Cost pro Provider/Modell.';

  /**
   * USD pro 1M Output-Tokens pro Provider. Konsument liefert sein Mapping.
   * Wenn leer/unset: Cost-Spalte wird ausgeblendet.
   *
   * Beispiel: `{ gemini: 0.30, anthropic: 5.00, openrouter: 0.40 }`.
   */
  @Input() costMapping: Record<string, number> | null = null;

  /** Token-Schätzung: ~4 chars pro Token. */
  private readonly CHARS_PER_TOKEN = 4;

  /** Währungs-Label hinter dem Cost-Wert. Default USD. */
  @Input() costCurrency: 'USD' | 'EUR' = 'EUR';

  /** USD → EUR Konvertierungs-Faktor (Default Stand 2026). */
  @Input() usdToEur: number = 0.92;

  sortBy: 'calls-desc' | 'success-desc' | 'chars-desc' = 'calls-desc';
  readonly rows = signal<PerformanceRow[]>([]);
  readonly loading = signal(true);

  get hasCost(): boolean {
    return !!this.costMapping && Object.keys(this.costMapping).length > 0;
  }

  get costNote(): string {
    return this.costCurrency === 'EUR'
      ? `Provider-Preis (USD/1M Output-Tokens, *${this.usdToEur} → EUR)`
      : 'Provider-Preis (USD/1M Output-Tokens)';
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.getPerformance(this.sortBy).subscribe({
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

  /**
   * Cost-Schätzung pro Zeile: `(totalChars / CHARS_PER_TOKEN) * (price / 1M)`
   * → USD, dann optional EUR-Konvertierung.
   */
  estCost(r: PerformanceRow): number {
    if (!this.costMapping) return 0;
    const pricePerMillion = this.costMapping[r.provider] ?? 0;
    const tokens = r.totalChars / this.CHARS_PER_TOKEN;
    const usd = (tokens * pricePerMillion) / 1_000_000;
    return this.costCurrency === 'EUR' ? usd * this.usdToEur : usd;
  }

  successClass(rate: number): string {
    if (rate >= 0.95) return 'ki-success-good';
    if (rate >= 0.7) return 'ki-success-ok';
    return 'ki-success-bad';
  }
}
