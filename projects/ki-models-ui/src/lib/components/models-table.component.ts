import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { AiModel } from '../models/ai-model';

/**
 * Tabelle aller AI-Modelle in der Cascade-Reihenfolge.
 *
 * **Spalten:** #, Provider, Model-ID (+displayName), Key-Status, Enabled-Toggle,
 * Status (autoDisabled-Reason / Cooldown / Free), Actions (Up/Down, Test, Re-Enable,
 * Delete).
 *
 * **Events:**
 * - `(activeModelChanged)` — User klickt „Als aktiv setzen" (Switcher-Feature,
 *   wird in L.2/L.4 ergänzt wenn dem Component ein `[showActiveAction]="true"`
 *   Input mitgegeben wird). Aktuell nicht im Template (folgt L.2.1).
 * - `(modelChanged)` — emittet bei jeder mutating-Aktion (toggle/move/delete/
 *   test) damit der Konsument seine Modell-Liste neu laden kann.
 *
 * Labels sind englisch hardcoded — Konsument-spezifische Übersetzung folgt in
 * Phase L.3 via `@Input()`-Override-Pattern oder eigenem Translation-Service.
 */
@Component({
  selector: 'ki-models-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ki-models-table">
      <div class="ki-models-table-header">
        <button (click)="reload()" class="ki-btn-secondary">↻ Refresh</button>
      </div>

      <div *ngIf="loading()" class="ki-muted">Loading models…</div>

      <div *ngIf="!loading() && models().length === 0" class="ki-empty">
        No models configured. Use the form below to add one.
      </div>

      <div *ngIf="models().length > 0" class="ki-table-wrap">
        <table class="ki-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Provider</th>
              <th>Model ID</th>
              <th>Key</th>
              <th>Enabled</th>
              <th>Status</th>
              <th class="ki-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let m of models(); let i = index"
                [class.ki-row-auto-disabled]="m.autoDisabled">
              <td class="ki-mono ki-muted">{{ i + 1 }}</td>
              <td class="ki-mono ki-provider">{{ m.provider }}</td>
              <td class="ki-mono">
                <strong>{{ m.modelId }}</strong>
                <div *ngIf="m.displayName" class="ki-muted ki-tiny">{{ m.displayName }}</div>
              </td>
              <td>
                <span *ngIf="m.keyConfigured" class="ki-badge ki-badge-ok">Key set</span>
                <span *ngIf="!m.keyConfigured" class="ki-badge ki-badge-warn">Key missing</span>
                <div class="ki-tiny ki-mono ki-muted">{{ m.apiKeySettingKey }}</div>
              </td>
              <td>
                <button *ngIf="!m.autoDisabled"
                        (click)="toggle(m)"
                        [disabled]="!m.enabled && !m.keyConfigured"
                        [title]="(!m.enabled && !m.keyConfigured) ? 'Key required before enabling' : ''"
                        class="ki-toggle"
                        [class.ki-toggle-on]="m.enabled"
                        [class.ki-toggle-off]="!m.enabled">
                  {{ m.enabled ? 'ON' : 'OFF' }}
                </button>
                <span *ngIf="m.autoDisabled" class="ki-badge ki-badge-error">🚫 Auto-disabled</span>
              </td>
              <td>
                <span *ngIf="m.autoDisabled" class="ki-tiny ki-error" [title]="m.autoDisabledReason || ''">
                  {{ truncate(m.autoDisabledReason || '', 60) }}
                </span>
                <span *ngIf="!m.autoDisabled && (m.cooldownRemainingSec ?? 0) > 0" class="ki-tiny ki-cooldown">
                  cd {{ m.cooldownRemainingSec }}s
                </span>
                <span *ngIf="!m.autoDisabled && !(m.cooldownRemainingSec ?? 0)" class="ki-tiny ki-ok">
                  Free
                </span>
                <div *ngIf="testResult()[m.id] as r" class="ki-tiny ki-mono"
                     [class.ki-ok]="r.ok"
                     [class.ki-error]="!r.ok && !r.pending">
                  <span *ngIf="r.pending">…</span>
                  <span *ngIf="r.ok">✓ {{ r.latencyMs }}ms</span>
                  <span *ngIf="!r.ok && !r.pending">✗ {{ truncate(r.error || '', 80) }}</span>
                </div>
              </td>
              <td class="ki-right ki-actions">
                <button (click)="move(i, -1)" [disabled]="i === 0" class="ki-btn-icon">↑</button>
                <button (click)="move(i, 1)" [disabled]="i === models().length - 1" class="ki-btn-icon">↓</button>
                <button (click)="test(m)" class="ki-btn-secondary">Test</button>
                <button *ngIf="m.autoDisabled" (click)="reEnable(m)" class="ki-btn-warn">Re-enable</button>
                <button (click)="remove(m)" class="ki-btn-danger">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .ki-models-table { font-family: inherit; }
    .ki-models-table-header { display: flex; justify-content: flex-end; margin-bottom: 0.75rem; }
    .ki-muted { color: #888; }
    .ki-tiny { font-size: 0.7rem; }
    .ki-mono { font-family: ui-monospace, monospace; }
    .ki-provider { color: #4f46e5; font-weight: 700; }
    .ki-empty { text-align: center; padding: 2rem; color: #94a3b8; font-weight: 600; }
    .ki-table-wrap { overflow-x: auto; }
    .ki-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .ki-table thead tr { border-bottom: 2px solid #e2e8f0; }
    .ki-table th {
      padding: 0.75rem 0.5rem;
      text-align: left;
      text-transform: uppercase;
      font-size: 0.625rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: #64748b;
    }
    .ki-table td { padding: 0.75rem 0.5rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .ki-right { text-align: right; }
    .ki-row-auto-disabled { background: #fef2f2; }
    .ki-badge {
      display: inline-block;
      padding: 0.15rem 0.4rem;
      border-radius: 0.25rem;
      font-size: 0.625rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .ki-badge-ok { background: #d1fae5; color: #065f46; }
    .ki-badge-warn { background: #fee2e2; color: #991b1b; }
    .ki-badge-error { background: #ef4444; color: white; }
    .ki-toggle {
      padding: 0.25rem 0.6rem;
      border-radius: 0.375rem;
      font-size: 0.625rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: none;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .ki-toggle:disabled { opacity: 0.4; cursor: not-allowed; }
    .ki-toggle-on { background: #10b981; color: white; }
    .ki-toggle-off { background: #e2e8f0; color: #475569; }
    .ki-actions { white-space: nowrap; }
    .ki-actions > * { margin-left: 0.25rem; }
    .ki-btn-icon, .ki-btn-secondary, .ki-btn-warn, .ki-btn-danger {
      padding: 0.25rem 0.6rem;
      border-radius: 0.375rem;
      font-size: 0.625rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: none;
      cursor: pointer;
    }
    .ki-btn-icon { background: #f1f5f9; color: #1e293b; }
    .ki-btn-icon:disabled { opacity: 0.3; cursor: not-allowed; }
    .ki-btn-secondary { background: #e0e7ff; color: #3730a3; }
    .ki-btn-warn { background: #fef3c7; color: #92400e; }
    .ki-btn-danger { background: #fee2e2; color: #991b1b; }
    .ki-ok { color: #059669; font-weight: 700; }
    .ki-cooldown { color: #d97706; font-weight: 700; }
    .ki-error { color: #dc2626; font-weight: 700; }
  `],
})
export class ModelsTableComponent {
  @Output() activeModelChanged = new EventEmitter<AiModel>();
  @Output() modelChanged = new EventEmitter<AiModel | null>();

  private readonly api = inject(KiModelsApiService);

  readonly loading = signal(true);
  readonly models = signal<AiModel[]>([]);
  readonly testResult = signal<Record<number, { ok?: boolean; latencyMs?: number; error?: string; pending?: boolean }>>({});

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.listModels().subscribe({
      next: (list) => {
        this.models.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggle(m: AiModel): void {
    if (!m.enabled && !m.keyConfigured) return;
    this.api.toggleModel(m.id, !m.enabled).subscribe(() => {
      this.modelChanged.emit(m);
      this.reload();
    });
  }

  reEnable(m: AiModel): void {
    this.api.updateModel(m.id, { autoDisabled: false, enabled: true } as any).subscribe(() => {
      this.modelChanged.emit(m);
      this.reload();
    });
  }

  remove(m: AiModel): void {
    if (!confirm(`Delete model "${m.modelId}"?`)) return;
    this.api.deleteModel(m.id).subscribe(() => {
      this.modelChanged.emit(null);
      this.reload();
    });
  }

  move(idx: number, dir: -1 | 1): void {
    const target = idx + dir;
    if (target < 0 || target >= this.models().length) return;
    const ordered = [...this.models()];
    const [moved] = ordered.splice(idx, 1);
    ordered.splice(target, 0, moved);
    this.api.reorderModels(ordered.map((m) => m.id)).subscribe(() => {
      this.modelChanged.emit(moved);
      this.reload();
    });
  }

  test(m: AiModel): void {
    this.setTest(m.id, { pending: true });
    this.api.testModel(m.id).subscribe({
      next: (r) => {
        this.setTest(m.id, r);
        if (m.enabled && r.ok === false) {
          // Auto-disable bei Test-Fail (analog EduPro)
          this.api.toggleModel(m.id, false).subscribe(() => this.reload());
        }
      },
      error: (e) => {
        this.setTest(m.id, { ok: false, error: e?.message ?? 'Error' });
        if (m.enabled) this.api.toggleModel(m.id, false).subscribe(() => this.reload());
      },
    });
  }

  truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  private setTest(id: number, r: any): void {
    this.testResult.update((tr) => ({ ...tr, [id]: r }));
  }
}
