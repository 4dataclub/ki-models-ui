import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CascadeModePanelLabels, CASCADE_MODE_PANEL_LABELS_EN } from '../models/labels';

/**
 * v0.13.0 — Generisches Bereich-Toggle für Cascade-Kategorien.
 *
 * <h3>Was rendert die Component?</h3>
 * <ul>
 *   <li>Ein Toggle (`<button>`-Reihe) mit allen verfügbaren Cascade-Kategorien</li>
 *   <li>Einen kontextuellen Hint-Text (Semantic Routing aktiv vs Override aktiv)</li>
 *   <li>Eine Info-Card im Auto-Mode mit optionalem Scroll-Button zur Cascade-Bereich-
 *       Konfiguration weiter unten auf der Page</li>
 * </ul>
 *
 * <h3>Use-Case (Konsumenten)</h3>
 * <ul>
 *   <li><strong>Switcher</strong>: oben im sw-mode-panel als zweite Toggle-Zeile</li>
 *   <li><strong>EduPro</strong>: über der <code>&lt;ki-cascades-view&gt;</code>
 *       Card im Admin-Tab, damit der Admin das Semantic-Routing-Override toggeln kann</li>
 * </ul>
 *
 * <h3>Architektur-Hinweis</h3>
 * Die Component ist **pure presentational** — kein eigener API-Call. Der
 * Konsument fängt das `(categoryChanged)`-Event und persistiert via
 * {@code KiModelsApiService.setPreferredCategory()}. So bleibt die
 * Component testbar ohne HTTP-Mock und Konsumenten können
 * pre/post-Validierung machen (z.B. Bestätigungs-Dialog).
 *
 * <h3>Auto-Mode-Info-Card</h3>
 * Wenn die Component zusätzlich im Auto-Mode-Kontext gerendert wird (siehe
 * {@link autoMode}-Input), zeigt sie unter dem Toggle eine erklärende
 * Info-Card mit optionalem Scroll-Button zur Cascade-Konfiguration. Wer den
 * Bereich nur als Toggle (ohne Auto-Card) nutzen will, setzt {@link autoMode}
 * auf false (Default) — dann wird nur der Toggle gerendert.
 */
@Component({
  selector: 'ki-cascade-mode-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ki-cmp">
      <!-- Bereich-Toggle: nur sichtbar wenn Categories vorhanden -->
      <div *ngIf="categories.length > 0" class="ki-cmp-row">
        <span class="ki-cmp-legend">{{ L.toggleLegend }}</span>
        <div class="ki-cmp-toggle">
          <!-- v0.14.1: „Auto"-Tab ganz links damit User den Override
               wieder abwählen kann ohne sich durch Browser-Devtools zu
               klicken. Aktiv wenn activeCategory leer ist (Semantic
               Routing). Klick setzt activeCategory = '' (kein Override). -->
          <button type="button"
                  (click)="setCategory('')"
                  class="ki-cmp-tab ki-cmp-tab-off"
                  [class.ki-cmp-tab-active]="!activeCategory"
                  [title]="L.hintSemanticRouting">
            {{ L.offButtonLabel }}
          </button>
          <button *ngFor="let c of categories"
                  type="button"
                  (click)="setCategory(c)"
                  class="ki-cmp-tab"
                  [class.ki-cmp-tab-active]="activeCategory === c">
            {{ labelFor(c) }}
          </button>
        </div>
        <span class="ki-cmp-hint">{{ activeHintText() }}</span>
      </div>

      <!-- Auto-Mode Info-Card (nur wenn autoMode=true) -->
      <div *ngIf="autoMode" class="ki-cmp-card">
        <ng-container *ngIf="activeCategory; else autoNoCategory">
          <p class="ki-cmp-card-text">
            {{ autoActiveText() }}
          </p>
          <button *ngIf="scrollTargetId"
                  type="button"
                  (click)="scrollToTarget()"
                  class="ki-cmp-card-btn">
            {{ L.btnScrollToCascade }}
          </button>
        </ng-container>
        <ng-template #autoNoCategory>
          <p class="ki-cmp-card-text-muted">
            {{ L.autoCardSemanticHint }}
          </p>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .ki-cmp { font-family: inherit; }
    .ki-cmp-row {
      display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
      margin: 0.25rem 0;
    }
    .ki-cmp-legend {
      font-size: 0.625rem; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.1em; color: #64748b;
    }
    .ki-cmp-toggle {
      display: inline-flex; padding: 0.25rem; border-radius: 9999px;
      background: #f1f5f9; border: 1px solid #e2e8f0;
    }
    .ki-cmp-tab {
      padding: 0.35rem 1rem; font-size: 0.75rem; font-weight: 700;
      letter-spacing: 0.025em; border-radius: 9999px; border: none;
      background: transparent; color: #64748b; cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .ki-cmp-tab:hover { color: #1e293b; }
    .ki-cmp-tab-active {
      background: #0f172a; color: #f8fafc;
    }
    .ki-cmp-tab-active:hover { color: #f8fafc; }
    /* v0.14.1: „Auto"-Tab visuell etwas subtiler — er ist ein „Off"-
       Zustand, kein gleichwertiger Bereich. Aktive Variante bekommt
       eine etwas hellere Background-Farbe damit der User sieht: das
       ist „kein Override aktiv", nicht „Bereich X aktiv". */
    .ki-cmp-tab-off { font-style: italic; }
    .ki-cmp-tab-off.ki-cmp-tab-active {
      background: #475569; color: #f8fafc;
    }
    .ki-cmp-hint {
      font-size: 0.7rem; color: #64748b; font-style: italic;
    }
    .ki-cmp-card {
      margin-top: 0.75rem; padding: 0.9rem 1rem;
      background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
    }
    .ki-cmp-card-text {
      margin: 0 0 0.5rem 0; font-size: 0.85rem; color: #334155; line-height: 1.5;
    }
    .ki-cmp-card-text-muted {
      margin: 0; font-size: 0.85rem; color: #64748b; line-height: 1.5;
    }
    .ki-cmp-card-btn {
      padding: 0.4rem 0.9rem; background: #0f172a; color: #f8fafc;
      border: none; border-radius: 0.5rem; font-size: 0.75rem;
      font-weight: 700; cursor: pointer; transition: opacity 0.15s;
    }
    .ki-cmp-card-btn:hover { opacity: 0.9; }
  `],
})
export class CascadeModePanelComponent {
  /**
   * Liste der verfügbaren Cascade-Kategorien (z.B. ['cloud', 'free-only']).
   * Leeres Array → die ganze Component rendert nichts.
   */
  @Input() categories: string[] = [];

  /** Aktuell aktiver Bereich. Leer = Semantic Routing (kein Override). */
  @Input() activeCategory: string = '';

  /** Optionale Hint-Strings pro Kategorie (z.B. "Bezahlte Premium-Modelle"). */
  @Input() categoryHintMap: Record<string, string> = {};

  /** Optionale Display-Titel pro Kategorie (Vorrang vor `categoryHintMap`).
   *  Beispiel: {`cloud`: 'Cloud — Premium-Modelle'} */
  @Input() categoryTitles: Record<string, string> = {};

  /**
   * Wenn true: zeigt zusätzlich eine Info-Card mit Auto-Failover-Hinweis +
   * optionalem Scroll-Button. Konsument setzt das wenn der umgebende Kontext
   * im Auto-Mode ist (z.B. Switcher: `mode === 'auto'`).
   */
  @Input() autoMode: boolean = false;

  /** Wenn gesetzt: DOM-ID, zu dem der Scroll-Button springen soll
   *  (z.B. "cascade-bereiche-section"). Wenn leer: kein Button. */
  @Input() scrollTargetId: string = '';

  /** Konsumenten-i18n-Override. Default = englische Labels. */
  L: CascadeModePanelLabels = CASCADE_MODE_PANEL_LABELS_EN;
  @Input() set labels(v: Partial<CascadeModePanelLabels> | undefined) {
    this.L = { ...CASCADE_MODE_PANEL_LABELS_EN, ...(v ?? {}) };
  }

  /** User klickt einen Bereich-Tab → propagiert nach oben. Idempotent. */
  @Output() categoryChanged = new EventEmitter<string>();

  setCategory(c: string): void {
    if (this.activeCategory === c) return;
    this.categoryChanged.emit(c);
  }

  /**
   * Display-Label für eine Kategorie. Priorität:
   * 1. categoryTitles[c]
   * 2. categoryHintMap[c]
   * 3. Capitalized-Slug ("free-only" → "Free Only")
   */
  labelFor(c: string): string {
    return this.categoryTitles?.[c]
        ?? this.categoryHintMap?.[c]
        ?? c.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  /** Hint-Text rechts vom Toggle. */
  activeHintText(): string {
    if (!this.activeCategory) return this.L.hintSemanticRouting;
    return this.L.hintOverrideTemplate.replace('{cat}', this.labelFor(this.activeCategory));
  }

  /** Info-Card-Text wenn Bereich aktiv. */
  autoActiveText(): string {
    return this.L.autoCardActiveTemplate.replace('{cat}', this.labelFor(this.activeCategory));
  }

  /**
   * Scroll zur konfigurierten DOM-ID. Nutzt smooth-scroll und block:'start'
   * damit der User die Card oben am Viewport sieht.
   */
  scrollToTarget(): void {
    if (!this.scrollTargetId || typeof document === 'undefined') return;
    const el = document.getElementById(this.scrollTargetId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
