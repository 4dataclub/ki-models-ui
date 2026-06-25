import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { AiModel } from '../models/ai-model';

/**
 * v0.17.0 — Supermodell-Rollen-Matrix (Compound-Kategorie-Übersicht).
 *
 * <h3>Was zeigt das?</h3>
 * Eine Tabelle/Grid der Compound-Kategorien {role}-{pool}, jeweils mit den
 * zugeordneten Modellen in Failover-Reihenfolge. Portiert aus dem Switcher
 * (Rollen-im-Pool-Panel, app.component.ts) als wiederverwendbare Library-
 * Komponente.
 *
 * <h3>Sichtbarkeit:</h3>
 * Die Matrix ist nur sichtbar wenn `supermodelOn = true` (Host setzt
 * explizit). Default ist `false` — nacktes Mount zeigt nichts. Wenn
 * `disabled = true`: Panel ist sichtbar aber gedimmt + gesperrt.
 *
 * <h3>Konsument-Use-Case:</h3>
 * - Switcher: `[supermodelOn]="supermodel()"` — zeigt Matrix wenn Supermodell aktiv
 * - EduPro: `[disabled]="true"` — Panel sichtbar aber Feature noch nicht freigeschaltet
 */
@Component({
  selector: 'ki-supermodel-matrix',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section *ngIf="supermodelOn" class="ki-supermodel-matrix" [class.ki-disabled]="disabled">

      <!-- Disabled-Hint-Banner -->
      <div *ngIf="disabled" class="ki-disabled-hint">
        {{ disabledHint }}
      </div>

      <div [class.ki-dimmed]="disabled">
        <h2 class="ki-heading">Rollen im Pool „{{ effectivePoolTitles()[effectivePool()] || effectivePool() }}"</h2>
        <p class="ki-intro">
          Opus plant, delegiert pro Schritt an die günstigste Rolle (über <code class="ki-code">&#64;supermodel</code>) und prüft am Ende. ① ② = Failover-Kette mit Cooldown.
        </p>

        <p *ngIf="localOrchestratorPending && effectivePool() === 'local'" class="ki-warn">
          ⚠ Lokaler Orchestrator gewählt, aber kein lokales Modell aktiv — fail-closed (kein automatischer Cloud-Ausweich). Ollama-Modell ziehen + aktivieren.
        </p>

        <!-- Empty state when no compound categories match -->
        <p *ngIf="noMatrixData()" class="ki-empty-state">
          Keine Supermodell-Kategorien gefunden
        </p>

        <div *ngIf="!noMatrixData()" class="ki-grid">
          <div *ngFor="let role of roles" class="ki-role-card">
            <div class="ki-role-header">
              <strong class="ki-role-label">{{ effectiveRoleMeta()[role]?.label || role }}</strong>
              <code class="ki-role-code">{{ role }}-{{ effectivePool() }}</code>
            </div>
            <p class="ki-role-desc">{{ effectiveRoleMeta()[role]?.desc || '' }}</p>

            <!-- Models in failover order -->
            <ng-container *ngIf="cellModels(role).length > 0; else emptyCell">
              <div *ngFor="let m of cellModels(role); let i = index" class="ki-model-entry" [class.ki-model-disabled]="!m.enabled">
                {{ i + 1 }}. {{ m.displayName }} · {{ m.provider }}<span *ngIf="!m.enabled" class="ki-aus"> · aus</span>
              </div>
            </ng-container>

            <!-- Empty cell template -->
            <ng-template #emptyCell>
              <span class="ki-empty-cell">
                <ng-container *ngIf="role === 'research' && effectivePool() === 'local'">
                  Lokal/intern erlaubt (Intranet/VPN, offline) — nur öffentliches Web verweigert (fail-closed).
                </ng-container>
                <ng-container *ngIf="role === 'research' && effectivePool() !== 'local'">
                  Über Gemini-MCP (Grounding) — kein Cascade-Modell nötig.
                </ng-container>
                <ng-container *ngIf="role !== 'research'">
                  Kein Modell — Kategorie {{ role }}-{{ effectivePool() }} anlegen.
                </ng-container>
              </span>
            </ng-template>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .ki-supermodel-matrix {
      font-family: inherit;
      padding: 1rem 0;
    }

    .ki-disabled-hint {
      background: #fef9c3;
      border: 1px solid #fde68a;
      color: #92400e;
      padding: 0.5rem 0.9rem;
      border-radius: 0.5rem;
      font-size: 0.8rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }

    .ki-dimmed {
      opacity: 0.55;
      pointer-events: none;
      user-select: none;
    }

    .ki-heading {
      font-size: 1rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 0.5rem 0;
    }

    .ki-intro {
      font-size: 0.8rem;
      color: #64748b;
      margin: 0 0 0.75rem 0;
    }

    .ki-code {
      font-family: ui-monospace, monospace;
      background: #f1f5f9;
      padding: 0.1rem 0.3rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
    }

    .ki-warn {
      font-size: 0.8rem;
      color: #92400e;
      background: #fef3c7;
      border: 1px solid #fde68a;
      border-radius: 0.375rem;
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.75rem;
    }

    .ki-empty-state {
      font-size: 0.85rem;
      color: #94a3b8;
      text-align: center;
      padding: 1.5rem;
    }

    .ki-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    @media (min-width: 640px) {
      .ki-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    .ki-role-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 0.9rem 1rem;
    }

    .ki-role-header {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
      flex-wrap: wrap;
    }

    .ki-role-label {
      font-size: 0.85rem;
      font-weight: 700;
      color: #1e293b;
    }

    .ki-role-code {
      font-family: ui-monospace, monospace;
      font-size: 0.65rem;
      color: #94a3b8;
    }

    .ki-role-desc {
      font-size: 0.75rem;
      color: #64748b;
      margin: 0 0 0.5rem 0;
    }

    .ki-model-entry {
      font-family: ui-monospace, monospace;
      font-size: 0.75rem;
      color: #334155;
      padding: 0.1rem 0;
    }

    .ki-model-disabled {
      color: #94a3b8;
    }

    .ki-aus {
      color: #ef4444;
      font-size: 0.7rem;
    }

    .ki-empty-cell {
      font-size: 0.72rem;
      color: #94a3b8;
      font-style: italic;
    }
  `],
})
export class SupermodelMatrixComponent implements OnInit {
  private readonly api = inject(KiModelsApiService);

  // ─── Axis configuration ──────────────────────────────────────────────────

  @Input() pools: string[] = ['cloud', 'free', 'local'];
  @Input() roles: string[] = ['orchestrator', 'implement', 'review', 'research', 'dispatch'];

  // ─── State inputs ────────────────────────────────────────────────────────

  /** If not provided, derived via getPreferredCategory(). */
  @Input() activePool?: string;

  /**
   * CRITICAL DEFAULT: false — panel renders NOTHING when false.
   * Host must explicitly pass supermodelOn=true to show the matrix.
   */
  @Input() supermodelOn = false;

  @Input() localOrchestratorPending = false;

  // ─── Disabled state ──────────────────────────────────────────────────────

  /**
   * When true: panel is visible but dimmed/locked (display-only).
   * EduPro mounts with disabled=true to preview the feature.
   */
  @Input() disabled = false;

  @Input() disabledHint = 'Supermodell — demnächst verfügbar';

  // ─── Label overrides (merge over German defaults) ────────────────────────

  @Input() labels?: {
    roleMeta?: Record<string, { label: string; desc: string }>;
    poolTitles?: Record<string, string>;
  };

  // ─── Default German metadata ─────────────────────────────────────────────

  private readonly DEFAULT_POOL_TITLES: Record<string, string> = {
    cloud: 'Cloud — Premium (bezahlt)',
    free:  'Free — OpenRouter :free',
    local: 'Lokal — Ollama (privat)',
  };

  private readonly DEFAULT_ROLE_META: Record<string, { label: string; desc: string }> = {
    orchestrator: { label: 'Orchestrator', desc: 'Plant + synthetisiert (Claude Code selbst)' },
    implement:    { label: 'Implement',    desc: 'Bulk-Code, Backend, Boilerplate, CRUD' },
    review:       { label: 'Review',       desc: 'Korrektheit, Sicherheit, Tests' },
    research:     { label: 'Research',     desc: 'Web/Google, große Docs' },
    dispatch:     { label: 'Dispatch',     desc: 'Triviales: Commit-Msgs, Summaries' },
  };

  // ─── Reactive state ──────────────────────────────────────────────────────

  /** All models grouped by compound category key (role-pool). */
  readonly matrixModels = signal<Record<string, { provider: string; modelId: string; displayName: string; enabled: boolean }[]>>({});

  /** Derived pool when activePool input is absent. */
  private readonly derivedPool = signal<string>('');

  /** Resolved pool: input takes priority, then derived, then first pool. */
  readonly effectivePool = computed<string>(() => {
    if (this.activePool) return this.activePool;
    const d = this.derivedPool();
    return d || this.pools[0] || 'cloud';
  });

  /** Merged roleMeta: defaults + optional label overrides. */
  readonly effectiveRoleMeta = computed<Record<string, { label: string; desc: string }>>(() => {
    return { ...this.DEFAULT_ROLE_META, ...(this.labels?.roleMeta ?? {}) };
  });

  /** Merged poolTitles: defaults + optional label overrides. */
  readonly effectivePoolTitles = computed<Record<string, string>>(() => {
    return { ...this.DEFAULT_POOL_TITLES, ...(this.labels?.poolTitles ?? {}) };
  });

  /**
   * True when supermodelOn=true but NO model matches any role-pool compound
   * key (e.g. EduPro backend with only utility/content/general categories).
   * Renders a calm empty state instead of crashing.
   */
  readonly noMatrixData = computed<boolean>(() => {
    const matrix = this.matrixModels();
    const pool = this.effectivePool();
    return this.roles.every(role => !(matrix[`${role}-${pool}`]?.length));
  });

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadModels();
    if (!this.activePool) {
      this.loadDerivedPool();
    }
  }

  /**
   * Load all models and group them by compound category (role-pool).
   * Includes disabled models — they appear greyed out in the matrix.
   * On error: graceful empty ({}).
   */
  private loadModels(): void {
    this.api.listModels().subscribe({
      next: (models: AiModel[]) => {
        const matrix: Record<string, { provider: string; modelId: string; displayName: string; enabled: boolean }[]> = {};
        for (const m of models) {
          const cat = m.category || 'general';
          (matrix[cat] ??= []).push({
            provider: m.provider,
            modelId: m.modelId,
            displayName: m.displayName || m.modelId,
            enabled: !!m.enabled,
          });
        }
        this.matrixModels.set(matrix);
      },
      error: () => {
        // Backend unavailable or empty — graceful degradation.
        this.matrixModels.set({});
      },
    });
  }

  /**
   * Derive active pool from getPreferredCategory() when activePool input is absent.
   * Parses compound key format "<role>-<pool>"; falls back to pools[0] on error
   * or if the category does not match the compound pattern.
   */
  private loadDerivedPool(): void {
    this.api.getPreferredCategory().subscribe({
      next: (resp) => {
        const cat = resp?.category || '';
        const parts = cat.split('-');
        if (parts.length >= 2) {
          const possiblePool = parts[parts.length - 1];
          const possibleRole = parts.slice(0, -1).join('-');
          if (this.roles.includes(possibleRole) && this.pools.includes(possiblePool)) {
            this.derivedPool.set(possiblePool);
            return;
          }
        }
        this.derivedPool.set(this.pools[0] || 'cloud');
      },
      error: () => {
        this.derivedPool.set(this.pools[0] || 'cloud');
      },
    });
  }

  // ─── Template helpers ────────────────────────────────────────────────────

  /**
   * Returns models for the compound cell {role}-{effectivePool}.
   * Order preserved from API (orderIdx = failover chain order).
   */
  cellModels(role: string): { provider: string; modelId: string; displayName: string; enabled: boolean }[] {
    return this.matrixModels()[`${role}-${this.effectivePool()}`] ?? [];
  }
}