import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { CascadeConfig, CooldownOverride } from '../models/cascade-config';

/**
 * Tri-State Cooldown-Override-Panel.
 *
 * **States:**
 * - `null` (Default) — jedes Modell nutzt seine eigene Cooldown-Logik (Standard)
 * - `true` (Force ON) — Cooldown global erzwingen (auch wenn Modelle individuell deaktiviert haben)
 * - `false` (Force OFF) — Cooldown global deaktivieren (Tests / Debug)
 *
 * **Effective-Badge** zeigt den vom Backend resolved Endzustand (`effective`,
 * `effectiveCooldown`).
 */
@Component({
  selector: 'ki-cascade-cooldown',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ki-cooldown" *ngIf="config() as cfg">
      <h4 class="ki-section-title">Cascade Cooldown</h4>
      <p class="ki-subtitle">Override the per-model cooldown behaviour globally.</p>

      <div class="ki-controls">
        <button (click)="set(null)"
                class="ki-state-btn"
                [class.ki-state-active]="cfg.cooldownOverride === null"
                [class.ki-state-default]="cfg.cooldownOverride === null">
          Default
        </button>
        <button (click)="set(true)"
                class="ki-state-btn"
                [class.ki-state-active]="cfg.cooldownOverride === true"
                [class.ki-state-on]="cfg.cooldownOverride === true">
          Force ON
        </button>
        <button (click)="set(false)"
                class="ki-state-btn"
                [class.ki-state-active]="cfg.cooldownOverride === false"
                [class.ki-state-off]="cfg.cooldownOverride === false">
          Force OFF
        </button>

        <span class="ki-effective-badge"
              [class.ki-effective-on]="cfg.effectiveCooldown"
              [class.ki-effective-off]="!cfg.effectiveCooldown">
          {{ cfg.effectiveCooldown ? 'Effective: ON' : 'Effective: OFF' }}
        </span>
      </div>

      <p class="ki-hint">
        Default = each model decides for itself. Force ON keeps cooldowns even when
        a model would skip them. Force OFF removes all cooldowns globally — use with
        care, useful for testing.
      </p>
    </div>

    <div *ngIf="!config() && loading()" class="ki-muted">Loading cascade config…</div>
    <div *ngIf="!config() && !loading()" class="ki-error">Failed to load cascade config.</div>
  `,
  styles: [`
    .ki-cooldown { font-family: inherit; padding: 1.5rem 0; }
    .ki-section-title {
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #475569;
      margin-bottom: 0.5rem;
    }
    .ki-subtitle { color: #64748b; font-size: 0.75rem; font-weight: 700; margin-bottom: 1.25rem; }
    .ki-controls { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    .ki-state-btn {
      padding: 0.6rem 1rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      border: none;
      cursor: pointer;
      background: #f1f5f9;
      color: #475569;
      transition: background 0.15s;
    }
    .ki-state-btn:hover { background: #e2e8f0; }
    .ki-state-active.ki-state-default { background: #0f172a; color: white; }
    .ki-state-active.ki-state-on { background: #10b981; color: white; }
    .ki-state-active.ki-state-off { background: #f59e0b; color: white; }
    .ki-effective-badge {
      margin-left: auto;
      padding: 0.3rem 0.75rem;
      border-radius: 999px;
      font-size: 0.625rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .ki-effective-on { background: #d1fae5; color: #065f46; }
    .ki-effective-off { background: #fef3c7; color: #92400e; }
    .ki-hint { color: #94a3b8; font-size: 0.7rem; font-weight: 700; margin-top: 1rem; }
    .ki-muted { color: #888; }
    .ki-error { color: #b91c1c; font-weight: 700; }
  `],
})
export class CascadeCooldownComponent {
  private readonly api = inject(KiModelsApiService);

  readonly loading = signal(true);
  readonly config = signal<CascadeConfig | null>(null);

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.api.getCascadeConfig().subscribe({
      next: (cfg) => {
        this.config.set(cfg);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  set(value: CooldownOverride): void {
    if (this.config()?.cooldownOverride === value) return;
    this.api.setCascadeConfig({ cooldownOverride: value }).subscribe((cfg) => this.config.set(cfg));
  }
}
