import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { ApiKeySetting } from '../models/api-key-setting';

/**
 * Section zur Verwaltung aller API-Keys (settingKey-basiert).
 *
 * Backend liefert Liste mit `{ settingKey, valueMasked, configured, keySource,
 * envVar, isDefault }`. UI rendert pro Eintrag eine Card mit:
 * - Status-Badge (configured/empty)
 * - Quelle (db/env)
 * - Inline-Edit-Button → setKey()
 * - Clear-Button → setKey('') (Empty-Wert löscht Override)
 *
 * **Skeleton** — Phase L.2 portiert volle UI (Add-Key-Form für neue settingKeys
 * die nicht in den Defaults sind, autocomplete aus AiModelConfig).
 */
@Component({
  selector: 'ki-api-keys-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ki-keys-section">
      <h3>API-Keys</h3>
      <p *ngIf="loading()" class="muted">Lade Keys…</p>
      <ul *ngIf="keys().length > 0">
        <li *ngFor="let k of keys()">
          <code>{{ k.settingKey }}</code>
          —
          <span [class.ok]="k.configured" [class.empty]="!k.configured">
            {{ k.configured ? k.valueMasked : '(leer)' }}
          </span>
          <span class="muted" *ngIf="k.keySource">[{{ k.keySource }}]</span>
        </li>
      </ul>
    </div>
  `,
  styles: [`
    .ki-keys-section { font-family: inherit; }
    .muted { color: #888; }
    .ok { color: #047857; }
    .empty { color: #b91c1c; }
    ul { list-style: none; padding: 0; }
    li { padding: 0.4rem 0; border-bottom: 1px solid #eee; }
    code { background: #f3f4f6; padding: 0.1rem 0.3rem; border-radius: 3px; }
  `],
})
export class ApiKeysSectionComponent {
  private readonly api = inject(KiModelsApiService);

  readonly loading = signal(true);
  readonly keys = signal<ApiKeySetting[]>([]);

  ngOnInit(): void {
    this.api.listKeys().subscribe({
      next: (list) => {
        this.keys.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
