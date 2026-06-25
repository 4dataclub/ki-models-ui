import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { QualityStatRow } from '../models/quality';
import { KiPagerComponent, paginate } from './ki-pager.component';

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
  imports: [CommonModule, FormsModule, KiPagerComponent],
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
          <button (click)="reload()" class="ki-btn-refresh" title="Tabelle neu laden">↻</button>
          <!--
            v0.12.1: Manueller Auto-Disable-Trigger. Sichtbar nur wenn das
            Backend-Feature aktiv ist (autoDisableEnabled signal). Sonst
            wäre's verwirrend einen Button zu zeigen der nichts macht.
            Tipp: Default-disabled solange noch geladen wird → kein
            Doppel-Klick beim Spam-Klicker.
          -->
          <button *ngIf="autoDisableEnabled()"
                  (click)="runAutoDisable()"
                  [disabled]="running()"
                  class="ki-btn-autodisable"
                  title="Killt jetzt sofort alle Modelle mit Tier=kill und genügend Calls — der Hintergrund-Job läuft sonst alle 6h">
            {{ running() ? 'Läuft…' : '✗ Auto-Disable jetzt' }}
          </button>
        </div>
      </div>

      <!-- v0.12.1: Result-Banner nach manuellem Run. Wird nach 8s
           ausgeblendet, kann via X-Klick weg-geklickt werden. Grün wenn
           was gekillt wurde, neutral wenn nichts zu tun war. -->
      <div *ngIf="lastResult() as r"
           class="ki-result-banner"
           [class.ki-result-killed]="r.disabled.length > 0"
           [class.ki-result-noop]="r.disabled.length === 0">
        <strong *ngIf="r.disabled.length > 0">
          ✗ {{ r.disabled.length }} Modell{{ r.disabled.length === 1 ? '' : 'e' }} auto-disabled
        </strong>
        <strong *ngIf="r.disabled.length === 0">
          ✓ Nichts zu tun — keine kill-Tier-Modelle mit ≥{{ autoDisableMinCalls() }} Calls
        </strong>
        <span class="ki-tiny ki-muted ki-result-detail" *ngIf="r.disabled.length > 0">
          {{ r.disabled.join(', ') }}
        </span>
        <button class="ki-result-dismiss" (click)="lastResult.set(null)" title="schließen">✕</button>
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
          <tr *ngFor="let r of pageRows()"
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

      <ki-pager
        [total]="rows().length"
        [page]="page()"
        [pageSize]="pageSize"
        (pageChange)="page.set($event)">
      </ki-pager>
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
    .ki-btn-autodisable {
      padding: 0.35rem 0.7rem; background: #fee2e2; color: #991b1b;
      border: 1px solid #fecaca; border-radius: 0.375rem;
      font-size: 0.7rem; font-weight: 700; cursor: pointer;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .ki-btn-autodisable:hover { background: #fecaca; }
    .ki-btn-autodisable:disabled { opacity: 0.5; cursor: not-allowed; }
    .ki-result-banner {
      display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
      padding: 0.7rem 0.9rem; border-radius: 0.5rem; margin-bottom: 0.75rem;
      font-size: 0.8rem;
    }
    .ki-result-killed { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
    .ki-result-noop   { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
    .ki-result-detail { flex: 1; min-width: 0; word-break: break-all; }
    .ki-result-dismiss {
      background: transparent; border: none; color: inherit; cursor: pointer;
      font-weight: 700; padding: 0 0.25rem; opacity: 0.6;
    }
    .ki-result-dismiss:hover { opacity: 1; }
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

  /** Seitengröße der Tabelle. Pager nur sichtbar wenn mehr Zeilen. */
  @Input() pageSize = 25;

  readonly rows = signal<QualityStatRow[]>([]);
  readonly loading = signal(true);
  readonly page = signal(0);
  readonly pageRows = computed(() => paginate(this.rows(), this.page(), this.pageSize));

  // v0.12.1: Auto-Disable-Trigger
  readonly running = signal(false);
  readonly autoDisableEnabled = signal(false);
  readonly autoDisableMinCalls = signal(50);
  readonly lastResult = signal<{ disabled: string[] } | null>(null);
  /** Hide result-banner nach 8s. Timer-Ref damit reload nicht zwei Timer parallel laufen lässt. */
  private resultTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.reload();
    this.loadAutoDisableConfig();
  }

  /**
   * Holt einmal beim Mount die Auto-Disable-Config. Bei Backend &lt; 0.7.3
   * (kein Endpoint) bleibt {@link autoDisableEnabled} false → der Button
   * wird gar nicht erst sichtbar. Saubere Backward-Compat.
   */
  private loadAutoDisableConfig(): void {
    this.api.getQualityAutoDisableConfig().subscribe({
      next: (cfg) => {
        this.autoDisableEnabled.set(!!cfg?.enabled);
        if (cfg?.minCalls) this.autoDisableMinCalls.set(cfg.minCalls);
      },
      error: () => {
        // Endpoint nicht da → Feature einfach nicht zeigen.
        this.autoDisableEnabled.set(false);
      },
    });
  }

  reload(): void {
    this.loading.set(true);
    this.page.set(0);
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

  /**
   * v0.12.1: triggert den Auto-Disable-Job im Backend, zeigt das Ergebnis
   * im Banner und lädt die Stats-Tabelle neu (damit die jetzt-disabled-
   * Modelle ihre neue {@code autoDisabled=true}-Markierung kriegen — die
   * Tabelle zeigt zwar nicht direkt das autoDisabled-Feld, aber das
   * UI-„DISABLE"-Badge basiert auf der frischen Server-Antwort).
   *
   * Bei Backend-Fehler (z.B. Endpoint nicht da): kurze rote Fallback-
   * Meldung „nicht verfügbar". Der Button bleibt nutzbar.
   */
  runAutoDisable(): void {
    if (this.running()) return;
    this.running.set(true);
    if (this.resultTimer) { clearTimeout(this.resultTimer); this.resultTimer = null; }

    this.api.runQualityAutoDisable().subscribe({
      next: (report) => {
        this.lastResult.set({ disabled: report?.disabled ?? [] });
        this.running.set(false);
        this.reload();
        // Banner nach 8s automatisch zumachen — User muss nicht klicken.
        this.resultTimer = setTimeout(() => this.lastResult.set(null), 8000);
      },
      error: () => {
        this.lastResult.set({ disabled: [] });
        this.running.set(false);
        this.resultTimer = setTimeout(() => this.lastResult.set(null), 5000);
      },
    });
  }
}
