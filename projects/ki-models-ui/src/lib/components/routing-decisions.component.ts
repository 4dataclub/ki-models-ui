import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { RoutingCache, RoutingCacheEntry, RoutingTestResult } from '../models/routing';
import { RoutingDecisionsLabels, ROUTING_DECISIONS_LABELS_EN } from '../models/labels';

/**
 * Admin-Component fuer Semantic Routing (Phase v0.11.0).
 *
 * Zeigt:
 *   - Counter-Stats (hits / misses / failures / cacheSize)
 *   - Liste aller Cache-Eintraege (purpose preview, gewaehlte Kategorie,
 *     Alter, Restlebenszeit) mit "X"-Button pro Eintrag
 *   - "Cache komplett leeren"-Button
 *   - Test-Preview-Input: tippe eine Task-Beschreibung, sieh welche Kategorie
 *     der Router waehlen wuerde (cached danach)
 *
 * Konsumenten-Setup: gleicher `KI_MODELS_API_BASE` wie die anderen Components.
 * Wenn das Backend < 0.6.0 ist (kein /routing-Endpoint), faellt es auf eine
 * leere Liste + Hinweistext zurueck statt Crash.
 */
@Component({
  selector: 'ki-routing-decisions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ki-routing">
      <h4 class="ki-title">{{ L.title }}</h4>
      <p class="ki-subtitle">{{ L.subtitle }}</p>

      <!-- v0.12.2: Override-Banner. Erscheint nur wenn preferredCategory
           gesetzt ist (Bereich-Toggle im Konsumenten-UI aktiv). Cache wird
           dann nicht genutzt — der Banner erklärt warum die Tabelle unten
           leer/stale aussieht. -->
      <div *ngIf="overrideCategory() as cat"
           class="ki-override-banner">
        <strong>⚠ Bereich-Override aktiv:</strong>
        Alle Generate-Calls gehen jetzt an <code>{{ cat }}</code>.
        Semantic Routing + dieser Cache werden umgangen — die Einträge
        unten sind Historie.
      </div>

      <!-- Stats-Zeile -->
      <div class="ki-stats" *ngIf="cache() as c">
        <div class="ki-stat">
          <div class="ki-stat-num">{{ c.stats.cacheSize }}</div>
          <div class="ki-stat-label">{{ L.statSize }} / {{ c.stats.cacheCapacity }}</div>
        </div>
        <div class="ki-stat">
          <div class="ki-stat-num ki-ok">{{ c.stats.hits }}</div>
          <div class="ki-stat-label">{{ L.statHits }}</div>
        </div>
        <div class="ki-stat">
          <div class="ki-stat-num">{{ c.stats.misses }}</div>
          <div class="ki-stat-label">{{ L.statMisses }}</div>
        </div>
        <div class="ki-stat">
          <div class="ki-stat-num ki-warn">{{ c.stats.failures }}</div>
          <div class="ki-stat-label">{{ L.statFailures }}</div>
        </div>
      </div>

      <!-- Test-Preview -->
      <div class="ki-test-box">
        <label class="ki-test-label">{{ L.testLabel }}</label>
        <div class="ki-test-row">
          <input [(ngModel)]="testPurpose"
                 [placeholder]="L.testPlaceholder"
                 class="ki-input"
                 (keydown.enter)="runTest()" />
          <button (click)="runTest()"
                  [disabled]="testing() || !testPurpose.trim()"
                  class="ki-btn-primary">
            {{ testing() ? L.testing : L.btnTest }}
          </button>
        </div>
        <p *ngIf="testResult() as r" class="ki-test-result">
          → <strong>{{ r.category }}</strong>
          <span class="ki-muted">({{ r.latencyMs }}ms)</span>
        </p>
      </div>

      <!-- Cache-Liste -->
      <div class="ki-cache-header">
        <span>{{ L.entriesTitle }}</span>
        <button (click)="clearAll()"
                [disabled]="!cache()?.entries?.length"
                class="ki-btn-secondary">
          {{ L.btnClearAll }}
        </button>
      </div>

      <p *ngIf="loading()" class="ki-muted ki-tiny">{{ L.loading }}</p>
      <p *ngIf="!loading() && !(cache()?.entries?.length)" class="ki-empty">{{ L.empty }}</p>

      <table class="ki-table" *ngIf="(cache()?.entries?.length ?? 0) > 0">
        <thead>
          <tr>
            <th>{{ L.colPurpose }}</th>
            <th>{{ L.colCategory }}</th>
            <th>{{ L.colExpires }}</th>
            <th class="ki-right">{{ L.colActions }}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let e of cache()?.entries">
            <td class="ki-truncate" [title]="e.purpose">{{ e.purpose }}</td>
            <td><span class="ki-pill">{{ e.category }}</span></td>
            <td class="ki-tiny ki-muted">{{ formatDuration(e.expiresInSeconds) }}</td>
            <td class="ki-right">
              <button (click)="clearOne(e)" class="ki-btn-icon" [title]="L.btnClearOne">✕</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .ki-routing { font-family: inherit; padding: 1rem 0; }
    .ki-title {
      font-size: 0.75rem; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.1em; color: #475569; margin: 0 0 0.25rem 0;
    }
    .ki-subtitle { font-size: 0.75rem; color: #94a3b8; margin: 0 0 1rem 0; }
    .ki-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1rem; }
    .ki-stat {
      background: #f8fafc; border-radius: 0.75rem; padding: 0.75rem;
      text-align: center;
    }
    .ki-stat-num { font-size: 1.5rem; font-weight: 800; color: #0f172a; }
    .ki-stat-num.ki-ok { color: #059669; }
    .ki-stat-num.ki-warn { color: #d97706; }
    .ki-stat-label {
      font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.05em;
      font-weight: 800; color: #64748b;
    }
    .ki-test-box {
      background: #f1f5f9; border-radius: 0.75rem; padding: 0.75rem;
      margin-bottom: 1rem;
    }
    .ki-test-label {
      display: block; font-size: 0.7rem; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.05em; color: #475569;
      margin-bottom: 0.5rem;
    }
    .ki-test-row { display: flex; gap: 0.5rem; }
    .ki-test-row .ki-input { flex: 1; }
    .ki-test-result { font-size: 0.875rem; margin: 0.5rem 0 0 0; color: #0f172a; }
    .ki-cache-header {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 0.75rem; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.1em; color: #475569; margin-bottom: 0.5rem;
    }
    .ki-input {
      padding: 0.6rem; background: white; border: 2px solid #e2e8f0;
      border-radius: 0.5rem; font-size: 0.875rem;
    }
    .ki-btn-primary {
      padding: 0.6rem 1rem; background: #0f172a; color: white; border: none;
      border-radius: 0.5rem; font-size: 0.7rem; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer;
    }
    .ki-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .ki-btn-secondary {
      padding: 0.3rem 0.7rem; background: #fee2e2; color: #991b1b; border: none;
      border-radius: 0.375rem; font-size: 0.625rem; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer;
    }
    .ki-btn-secondary:disabled { opacity: 0.3; cursor: not-allowed; }
    .ki-btn-icon {
      background: transparent; border: none; color: #94a3b8; cursor: pointer;
      font-size: 1rem; padding: 0.2rem 0.4rem;
    }
    .ki-btn-icon:hover { color: #ef4444; }
    .ki-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .ki-table thead tr { border-bottom: 2px solid #e2e8f0; }
    .ki-table th {
      padding: 0.5rem; text-align: left; text-transform: uppercase;
      font-size: 0.6rem; font-weight: 800; letter-spacing: 0.1em; color: #64748b;
    }
    .ki-table td { padding: 0.5rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .ki-truncate { max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ki-right { text-align: right; }
    .ki-pill {
      display: inline-block; padding: 0.15rem 0.5rem; border-radius: 0.25rem;
      background: #e0e7ff; color: #3730a3; font-size: 0.625rem; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .ki-muted { color: #94a3b8; }
    .ki-tiny { font-size: 0.7rem; }
    .ki-empty { text-align: center; color: #94a3b8; padding: 1rem; font-size: 0.85rem; }
    .ki-override-banner {
      background: #fef3c7; border: 1px solid #fcd34d; color: #92400e;
      padding: 0.7rem 0.9rem; border-radius: 0.5rem;
      margin: 0.75rem 0 1rem 0; font-size: 0.8rem; line-height: 1.4;
    }
    .ki-override-banner code {
      background: #fde68a; padding: 0.1rem 0.4rem; border-radius: 0.25rem;
      font-family: ui-monospace, monospace; font-weight: 700;
    }
  `],
})
export class RoutingDecisionsComponent implements OnInit {
  private readonly api = inject(KiModelsApiService);

  readonly cache = signal<RoutingCache | null>(null);
  readonly loading = signal(true);
  readonly testing = signal(false);
  readonly testResult = signal<RoutingTestResult | null>(null);
  testPurpose = '';

  /** v0.12.2: Wenn nicht-null, ist der Cascade-Override im Backend aktiv —
   *  Banner zeigt das. */
  readonly overrideCategory = signal<string | null>(null);

  /** Konsumenten-i18n-Override. Default = englische Labels. */
  L: RoutingDecisionsLabels = ROUTING_DECISIONS_LABELS_EN;
  set labels(v: Partial<RoutingDecisionsLabels> | undefined) {
    this.L = { ...ROUTING_DECISIONS_LABELS_EN, ...(v ?? {}) };
  }

  ngOnInit(): void {
    this.reload();
    this.loadOverride();
  }

  /**
   * v0.12.2: Override-Status laden (Bereich-Toggle aktiv?). Bei Backend
   * < 0.7.5 wird der Endpoint 404 zurückgeben → wir behandeln das wie
   * „kein Override aktiv" und der Banner bleibt versteckt.
   */
  private loadOverride(): void {
    this.api.getPreferredCategory().subscribe({
      next: (resp) => this.overrideCategory.set(resp?.active && resp?.category ? resp.category : null),
      error: () => this.overrideCategory.set(null),
    });
  }

  reload(): void {
    this.loading.set(true);
    this.api.getRoutingCache().subscribe({
      next: (c) => {
        this.cache.set(c);
        this.loading.set(false);
      },
      error: () => {
        // Backend ohne Routing-Endpoint — leere Liste, kein Crash
        this.cache.set({
          stats: { cacheSize: 0, cacheCapacity: 0, ttlSeconds: 0, hits: 0, misses: 0, failures: 0 },
          entries: [],
        });
        this.loading.set(false);
      },
    });
  }

  runTest(): void {
    const purpose = this.testPurpose.trim();
    if (!purpose) return;
    this.testing.set(true);
    this.testResult.set(null);
    firstValueFrom(this.api.testRouting(purpose))
      .then((r) => {
        this.testResult.set(r);
        this.testing.set(false);
        this.reload();
      })
      .catch(() => this.testing.set(false));
  }

  clearAll(): void {
    if (!confirm(this.L.confirmClearAll)) return;
    this.api.clearRoutingCache().subscribe(() => this.reload());
  }

  clearOne(e: RoutingCacheEntry): void {
    this.api.clearRoutingCacheEntry(e.purposeHash).subscribe(() => this.reload());
  }

  /** Sekunden → "23h 45m" / "12m 30s" / "45s". */
  formatDuration(seconds: number): string {
    if (seconds <= 0) return '–';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }
}
