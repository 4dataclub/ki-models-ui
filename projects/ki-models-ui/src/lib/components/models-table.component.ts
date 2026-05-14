import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { AiModel } from '../models/ai-model';

/**
 * Tabelle aller AI-Modelle in der Cascade-Reihenfolge.
 *
 * **Skeleton** — Phase L.2 portiert die volle UI aus EduPro hierher (per-
 * Modell-Toggle, Test-Button, Move-Up/Down, Delete, Status-Banner, Cooldown-
 * Anzeige). Aktuell rendert nur eine minimale Liste zur Vertrags-Verifikation.
 *
 * **Events:**
 * - `(activeModelChanged)` emittet wenn der User „aktiv setzen" klickt (in
 *   L.2). Konsument entscheidet was passiert (Switcher: settings.json
 *   schreiben + ccr-Restart-Marker; EduPro: kein-op oder Toast).
 * - `(modelChanged)` emittet bei jeder mutating-Aktion (toggle/reorder/
 *   delete) damit der Konsument seinen lokalen State neu lädt.
 */
@Component({
  selector: 'ki-models-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ki-models-table">
      <!-- TODO L.2: volle Tabelle portieren -->
      <p *ngIf="loading()" class="muted">Lade Modelle…</p>
      <p *ngIf="!loading() && models().length === 0" class="muted">Keine Modelle konfiguriert.</p>
      <ul *ngIf="models().length > 0">
        <li *ngFor="let m of models()">
          <strong>{{ m.provider }}:{{ m.modelId }}</strong>
          — {{ m.enabled ? 'enabled' : 'disabled' }}
          <span *ngIf="m.autoDisabled" class="muted">(auto-disabled: {{ m.autoDisabledReason }})</span>
        </li>
      </ul>
    </div>
  `,
  styles: [`
    .ki-models-table { font-family: inherit; }
    .muted { color: #888; }
    ul { list-style: none; padding: 0; }
    li { padding: 0.5rem 0; border-bottom: 1px solid #eee; }
  `],
})
export class ModelsTableComponent {
  @Output() activeModelChanged = new EventEmitter<AiModel>();
  @Output() modelChanged = new EventEmitter<AiModel>();

  private readonly api = inject(KiModelsApiService);

  readonly loading = signal(true);
  readonly models = signal<AiModel[]>([]);

  ngOnInit(): void {
    this.api.listModels().subscribe({
      next: (list) => {
        this.models.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
