import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { CascadeConfig, CooldownOverride } from '../models/cascade-config';

/**
 * Tri-State Cooldown-Override-Panel.
 *
 * **States:**
 * - `null` (default) → jedes Modell nutzt seine eigene Cooldown-Logik
 * - `true` (force on) → Cooldown global erzwingen
 * - `false` (force off) → Cooldown global deaktivieren
 *
 * **Skeleton** — Phase L.2 portiert die volle UI (3-Button-Toggle, „Effective"-
 * Badge, Tooltip mit Erklärung). Aktuell minimaler Funktional-Test.
 */
@Component({
  selector: 'ki-cascade-cooldown',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ki-cooldown" *ngIf="config() as cfg">
      <strong>Cooldown:</strong>
      <button (click)="set(null)" [class.active]="cfg.cooldownOverride === null">Default</button>
      <button (click)="set(true)" [class.active]="cfg.cooldownOverride === true">Erzwingen</button>
      <button (click)="set(false)" [class.active]="cfg.cooldownOverride === false">Deaktivieren</button>
      <span class="muted">→ effective: {{ cfg.effective }}</span>
    </div>
  `,
  styles: [`
    .ki-cooldown { display: flex; gap: 0.5rem; align-items: center; }
    button { padding: 0.3rem 0.6rem; border: 1px solid #ccc; background: #fff; border-radius: 4px; cursor: pointer; }
    button.active { background: #4f46e5; color: #fff; border-color: #4f46e5; }
    .muted { color: #888; font-size: 0.85rem; }
  `],
})
export class CascadeCooldownComponent {
  private readonly api = inject(KiModelsApiService);

  readonly config = signal<CascadeConfig | null>(null);

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.api.getCascadeConfig().subscribe((cfg) => this.config.set(cfg));
  }

  set(value: CooldownOverride): void {
    this.api.setCascadeConfig({ cooldownOverride: value }).subscribe((cfg) => this.config.set(cfg));
  }
}
