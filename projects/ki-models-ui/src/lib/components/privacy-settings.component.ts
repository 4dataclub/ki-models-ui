import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { AppSetting } from '../models/app-setting';

/**
 * v0.16.0 — Datenschutz-Toggle für das „logPromptSnippet"-Setting.
 *
 * <h3>Was macht das?</h3>
 * Liest beim Mount `GET {base}/settings`, findet den Eintrag mit
 * `key === 'logPromptSnippet'` und zeigt einen Toggle. Ist das Setting
 * nicht vorhanden oder liefert das Backend einen Fehler (inkl. 404),
 * steht der Toggle auf AUS — Datenschutz als sicherer Default.
 *
 * <h3>Toggle-Aktion:</h3>
 * Beim Flippen ruft die Komponente `POST {base}/settings/logPromptSnippet`
 * mit `{ value: 'true' | 'false' }` auf. Bei Erfolg wird `enabled` auf
 * den neuen Wert gesetzt; bei Fehler bleibt der alte Wert erhalten und
 * ein kurzes Fehler-Feedback erscheint.
 *
 * <h3>Konsument-Use-Case:</h3>
 * - Switcher: in einem Datenschutz-Tab
 * - EduPro: in den Admin-Settings neben anderen App-Settings
 */
@Component({
  selector: 'ki-privacy-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ki-privacy-settings">
      <div class="ki-header">
        <div>
          <h4 class="ki-title">{{ title }}</h4>
          <p class="ki-subtitle">{{ subtitle }}</p>
        </div>
      </div>

      <p *ngIf="loading()" class="ki-muted">Lade Einstellungen…</p>

      <div *ngIf="!loading()" class="ki-toggle-row">
        <label class="ki-toggle-label" [for]="toggleId">
          <span class="ki-toggle-text">
            Prompt-Logging
            <span class="ki-badge" [class.ki-badge-on]="enabled()" [class.ki-badge-off]="!enabled()">
              {{ enabled() ? 'AN' : 'AUS' }}
            </span>
          </span>
          <span class="ki-toggle-hint ki-muted">logPromptSnippet</span>
        </label>
        <div class="ki-toggle-control">
          <input
            type="checkbox"
            [id]="toggleId"
            [checked]="enabled()"
            [disabled]="saving()"
            (change)="onToggle($event)"
            class="ki-checkbox"
          />
          <label [for]="toggleId" class="ki-switch" [class.ki-switch-saving]="saving()"></label>
        </div>
      </div>

      <!-- Feedback-Banner: Erfolg / Fehler nach dem Speichern -->
      <div *ngIf="savedMsg()" class="ki-feedback ki-feedback-ok">{{ savedMsg() }}</div>
      <div *ngIf="errorMsg()" class="ki-feedback ki-feedback-err">{{ errorMsg() }}</div>
    </div>
  `,
  styles: [`
    .ki-privacy-settings { font-family: inherit; padding: 1rem 0; }
    .ki-header { margin-bottom: 1rem; }
    .ki-title {
      font-size: 0.85rem; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.1em; color: #1e293b; margin: 0 0 0.25rem 0;
    }
    .ki-subtitle { font-size: 0.7rem; color: #64748b; margin: 0; }
    .ki-muted { color: #94a3b8; }

    .ki-toggle-row {
      display: flex; justify-content: space-between; align-items: center;
      gap: 1rem; padding: 0.75rem 1rem;
      border: 1px solid #e2e8f0; border-radius: 0.5rem;
      background: #f8fafc;
    }
    .ki-toggle-label {
      display: flex; flex-direction: column; gap: 0.15rem; cursor: pointer; flex: 1;
    }
    .ki-toggle-text {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.85rem; font-weight: 600; color: #1e293b;
    }
    .ki-toggle-hint { font-size: 0.7rem; }

    .ki-badge {
      display: inline-block; padding: 0.1rem 0.35rem;
      border-radius: 0.25rem; font-size: 0.65rem; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .ki-badge-on  { background: #dcfce7; color: #166534; }
    .ki-badge-off { background: #f1f5f9; color: #64748b; }

    /* Toggle-Switch (CSS-only, kein extra Framework nötig) */
    .ki-toggle-control { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
    .ki-checkbox { display: none; }
    .ki-switch {
      position: relative; display: inline-block;
      width: 2.5rem; height: 1.4rem;
      background: #cbd5e1; border-radius: 9999px;
      cursor: pointer; transition: background 0.2s;
    }
    .ki-switch::after {
      content: ''; position: absolute;
      top: 0.15rem; left: 0.15rem;
      width: 1.1rem; height: 1.1rem;
      background: white; border-radius: 50%;
      transition: transform 0.2s;
    }
    .ki-checkbox:checked + .ki-switch { background: #4f46e5; }
    .ki-checkbox:checked + .ki-switch::after { transform: translateX(1.1rem); }
    .ki-switch-saving { opacity: 0.5; cursor: not-allowed; }

    .ki-feedback {
      margin-top: 0.6rem; padding: 0.5rem 0.75rem;
      border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600;
    }
    .ki-feedback-ok  { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .ki-feedback-err { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  `],
})
export class PrivacySettingsComponent implements OnInit {
  private readonly api = inject(KiModelsApiService);

  /** Titel oben — überschreibbar pro Konsument. */
  @Input() title = 'Datenschutz';
  @Input() subtitle =
    'Speichert pro Delegations-Call einen gekürzten Prompt-Ausschnitt (max. 160 Zeichen) — nur für Debug/Live-Watch. Standard: AUS (Datenschutz).';

  /** Eindeutige ID damit label[for] korrekt funktioniert, auch wenn die Component mehrfach gemountet wird. */
  readonly toggleId = `ki-privacy-toggle-${Math.random().toString(36).slice(2)}`;

  readonly enabled = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly savedMsg = signal<string | null>(null);
  readonly errorMsg = signal<string | null>(null);

  private savedTimer: ReturnType<typeof setTimeout> | null = null;
  private errorTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.api.getSettings().subscribe({
      next: (settings: AppSetting[]) => {
        const entry = settings.find(s => s.key === 'logPromptSnippet');
        this.enabled.set(entry?.value === 'true');
        this.loading.set(false);
      },
      error: () => {
        // 404 oder Netzwerkfehler → sicherer Default: AUS
        this.enabled.set(false);
        this.loading.set(false);
      },
    });
  }

  onToggle(event: Event): void {
    const next = (event.target as HTMLInputElement).checked;
    if (this.saving()) return;

    this.saving.set(true);
    this.clearMessages();

    this.api.setSetting('logPromptSnippet', next ? 'true' : 'false').subscribe({
      next: () => {
        this.enabled.set(next);
        this.saving.set(false);
        this.savedMsg.set('Gespeichert.');
        this.savedTimer = setTimeout(() => this.savedMsg.set(null), 3000);
      },
      error: () => {
        // Fehler: Signal bleibt beim alten Wert — Checkbox springt zurück
        this.saving.set(false);
        this.errorMsg.set('Fehler beim Speichern — Einstellung nicht geändert.');
        this.errorTimer = setTimeout(() => this.errorMsg.set(null), 5000);
      },
    });
  }

  private clearMessages(): void {
    if (this.savedTimer) { clearTimeout(this.savedTimer); this.savedTimer = null; }
    if (this.errorTimer) { clearTimeout(this.errorTimer); this.errorTimer = null; }
    this.savedMsg.set(null);
    this.errorMsg.set(null);
  }
}