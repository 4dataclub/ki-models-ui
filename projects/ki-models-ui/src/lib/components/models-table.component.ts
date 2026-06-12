import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { AiModel } from '../models/ai-model';
import { ProviderServer } from '../models/provider-server';
import { ModelsTableLabels, MODELS_TABLE_LABELS_EN } from '../models/labels';

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
        <button (click)="reload()" class="ki-btn-secondary">↻ {{ L.refresh }}</button>
      </div>

      <div *ngIf="loading()" class="ki-muted">{{ L.loading }}</div>

      <div *ngIf="!loading() && models().length === 0" class="ki-empty">
        {{ L.empty }}
      </div>

      <!-- Phase R: Gruppierte Ansicht nach Routing-Kategorie. Jede Section
           rendert ihre eigene Tabelle. Reorder (Pfeile) ist innerhalb einer
           Kategorie scoped — globaler orderIdx wird im Hintergrund neu
           vergeben, aber Cross-Kategorie-Swap ist nicht erlaubt. -->
      <div *ngIf="models().length > 0">
        <section *ngFor="let cat of categoriesWithModels()" class="ki-category-section">
          <header class="ki-category-header">
            <h4 class="ki-category-title">{{ categoryTitle(cat) }}</h4>
            <p class="ki-category-hint">{{ categoryHint(cat) }}</p>
          </header>

          <div class="ki-table-wrap">
            <table class="ki-table">
              <thead>
                <tr>
                  <th>{{ L.colNum }}</th>
                  <th>{{ L.colProvider }}</th>
                  <th>{{ L.colModelId }}</th>
                  <th>{{ L.colKey }}</th>
                  <th>{{ L.colEnabled }}</th>
                  <th>{{ L.colStatus }}</th>
                  <th>{{ L.colServer }}</th>
                  <th class="ki-right">{{ L.colActions }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let m of modelsByCategory()[cat]; let i = index"
                    [class.ki-row-auto-disabled]="m.autoDisabled">
                  <td class="ki-mono ki-muted">{{ i + 1 }}</td>
                  <td class="ki-mono ki-provider">{{ m.provider }}</td>
                  <td class="ki-mono">
                    <strong>{{ m.modelId }}</strong>
                    <div *ngIf="m.displayName" class="ki-muted ki-tiny">{{ m.displayName }}</div>
                  </td>
                  <td>
                    <span *ngIf="isKeylessModel(m)" class="ki-badge ki-badge-local">{{ L.keyless }}</span>
                    <span *ngIf="!isKeylessModel(m) && m.keyConfigured" class="ki-badge ki-badge-ok">{{ L.keySet }}</span>
                    <span *ngIf="!isKeylessModel(m) && !m.keyConfigured" class="ki-badge ki-badge-warn">{{ L.keyMissing }}</span>
                    <div class="ki-tiny ki-mono ki-muted">{{ m.apiKeySettingKey }}</div>
                  </td>
                  <td>
                    <button *ngIf="!m.autoDisabled"
                            (click)="toggle(m)"
                            [disabled]="(!m.enabled && !m.keyConfigured && !isKeylessModel(m)) || (!m.enabled && m.hardwareCompatible === false)"
                            [title]="toggleDisabledReason(m)"
                            class="ki-toggle"
                            [class.ki-toggle-on]="m.enabled"
                            [class.ki-toggle-off]="!m.enabled">
                      {{ m.enabled ? L.on : L.off }}
                    </button>
                    <span *ngIf="m.autoDisabled" class="ki-badge ki-badge-error">🚫 {{ L.autoDisabled }}</span>
                  </td>
                  <td>
                    <span *ngIf="m.hardwareCompatible === false" class="ki-badge ki-badge-warn">⚠ {{ L.hardwareBlocked }}</span>
                    <span *ngIf="m.hardwareCompatible === false" class="ki-tiny ki-error" [title]="m.hardwareReason || ''">
                      {{ truncate(m.hardwareReason || '', 60) }}
                    </span>
                    <span *ngIf="m.autoDisabled" class="ki-tiny ki-error" [title]="m.autoDisabledReason || ''">
                      {{ truncate(m.autoDisabledReason || '', 60) }}
                    </span>
                    <span *ngIf="!m.autoDisabled && (m.cooldownRemainingSec ?? 0) > 0" class="ki-tiny ki-cooldown">
                      cd {{ m.cooldownRemainingSec }}s
                    </span>
                    <span *ngIf="!m.autoDisabled && !(m.cooldownRemainingSec ?? 0) && m.hardwareCompatible !== false" class="ki-tiny ki-ok">
                      {{ L.free }}
                    </span>
                    <div *ngIf="testResult()[m.id] as r" class="ki-tiny ki-mono"
                         [class.ki-ok]="r.ok"
                         [class.ki-error]="!r.ok && !r.pending">
                      <span *ngIf="r.pending">…</span>
                      <span *ngIf="r.ok">✓ {{ r.latencyMs }}ms</span>
                      <span *ngIf="!r.ok && !r.pending">✗ {{ truncate(r.error || '', 80) }}</span>
                    </div>
                  </td>
                  <td>
                    <select *ngIf="supportsCustomServer(m); else noServer"
                            class="ki-server-select"
                            (change)="setServer(m, $any($event.target).value)">
                      <option value="" [selected]="!m.providerServerName">{{ L.serverDefault }}</option>
                      <option *ngFor="let s of providerServers()" [value]="s.name"
                              [selected]="m.providerServerName === s.name">{{ s.name }}</option>
                    </select>
                    <ng-template #noServer><span class="ki-muted ki-tiny">—</span></ng-template>
                  </td>
                  <td class="ki-right ki-actions">
                    <button (click)="moveInCategory(cat, i, -1)"
                            [disabled]="i === 0"
                            class="ki-btn-icon">↑</button>
                    <button (click)="moveInCategory(cat, i, 1)"
                            [disabled]="i === modelsByCategory()[cat].length - 1"
                            class="ki-btn-icon">↓</button>
                    <button (click)="test(m)" class="ki-btn-secondary">{{ L.btnTest }}</button>
                    <span *ngIf="showActiveAction && isActiveModel(m)" class="ki-badge ki-badge-active">{{ L.activeBadge }}</span>
                    <button
                      *ngIf="showActiveAction && !isActiveModel(m) && (m.keyConfigured || isKeylessModel(m)) && !m.autoDisabled"
                      (click)="setActive(m)"
                      class="ki-btn-primary"
                    >{{ L.btnSetActive }}</button>
                    <button *ngIf="m.autoDisabled" (click)="reEnable(m)" class="ki-btn-warn">{{ L.btnReenable }}</button>
                    <button (click)="remove(m)" class="ki-btn-danger">{{ L.btnDelete }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .ki-models-table { font-family: inherit; }
    .ki-models-table-header { display: flex; justify-content: flex-end; margin-bottom: 0.75rem; }
    .ki-category-section { margin-bottom: 2rem; }
    .ki-category-section:last-child { margin-bottom: 0; }
    .ki-category-header { margin-bottom: 0.5rem; }
    .ki-category-title {
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #1e293b;
      margin: 0 0 0.15rem 0;
    }
    .ki-category-hint { font-size: 0.7rem; color: #64748b; margin: 0; }
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
    .ki-badge-local { background: #dbeafe; color: #1e40af; }
    .ki-server-select { font-size: 0.75rem; padding: 0.1rem 0.25rem; border-radius: 0.25rem; border: 1px solid #cbd5e1; background: #fff; max-width: 9rem; }
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
    .ki-btn-primary  { background: #10b981; color: white; }
    .ki-btn-warn { background: #fef3c7; color: #92400e; }
    .ki-btn-danger { background: #fee2e2; color: #991b1b; }
    .ki-btn-icon, .ki-btn-secondary, .ki-btn-primary, .ki-btn-warn, .ki-btn-danger {
      padding: 0.25rem 0.6rem;
      border-radius: 0.375rem;
      font-size: 0.625rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: none;
      cursor: pointer;
    }
    .ki-badge-active { background: #d1fae5; color: #065f46; border: 1px solid #10b981; }
    .ki-ok { color: #059669; font-weight: 700; }
    .ki-cooldown { color: #d97706; font-weight: 700; }
    .ki-error { color: #dc2626; font-weight: 700; }
  `],
})
export class ModelsTableComponent {
  @Output() activeModelChanged = new EventEmitter<AiModel>();
  @Output() modelChanged = new EventEmitter<AiModel | null>();

  /** Optionale Labels — Konsument gibt seine i18n-Strings rein. Default = englisch. */
  @Input() set labels(v: Partial<ModelsTableLabels> | undefined) {
    this.L = { ...MODELS_TABLE_LABELS_EN, ...(v ?? {}) };
  }
  L: ModelsTableLabels = MODELS_TABLE_LABELS_EN;

  /**
   * Aktiviert pro Modell-Zeile den „Als aktiv setzen"-Button (`btnSetActive`).
   * Default `false` — EduPro nutzt das nicht, Switcher schaltet's auf `true`.
   * Wenn das Modell bereits aktiv ist (siehe `activeModelId`), zeigt sich
   * stattdessen das AKTIV-Badge.
   */
  @Input() showActiveAction = false;

  /**
   * Aktive Modell-ID (`modelId`-Feld, nicht die DB-id). Wird mit jeder Zeile
   * verglichen um die AKTIV-Badge zu setzen. `null` = kein Modell aktiv.
   */
  @Input() activeModelId: string | null = null;

  /**
   * Anzeige-Titel pro Kategorie. Generisch seit v0.10.0 — Konsumenten reichen
   * eine Map aller Kategorien rein, die ihre Modelle nutzen. Fehlende
   * Einträge fallen auf `categoryUtility`/`categoryContent`/`categoryGeneral`
   * aus den Labels zurück (Backward-Compat zu v0.9.x), und für alles andere
   * auf den capitalized Kategorie-String selbst.
   *
   * Beispiele:
   *  - EduPro übergibt nichts → Defaults aus `MODELS_TABLE_LABELS_*` greifen.
   *  - Switcher übergibt `{ cloud: 'Cloud — Premium', 'free-only': 'Free Tier' }`.
   */
  @Input() categoryTitles: Record<string, string> = {};

  /** Sub-Beschreibung pro Kategorie. Selbe Fallback-Kette wie `categoryTitles`. */
  @Input() categoryHints: Record<string, string> = {};

  /**
   * Explizite Reihenfolge der Kategorie-Sektionen. Wenn leer (Default),
   * werden Kategorien in der Reihenfolge gezeigt, in der sie erstmals in
   * `models()` auftauchen — was wiederum der globalen `orderIdx`-Reihenfolge
   * folgt. Für deterministische UI: Konsument liefert seine Wunsch-Reihenfolge.
   */
  @Input() categoryOrder: string[] = [];

  /**
   * v0.11.3 — Konsumenten-spezifische Liste von Provider-Namen die keinen
   * API-Key brauchen. Zusätzlich zu dem `keyless`-Flag aus dem Backend.
   *
   * Beispiele:
   *  - Switcher: `['anthropic']` — Claude via Max-OAuth (Cookie), kein
   *    sk-ant-Key nötig. Cascade-Backend ruft anthropic nicht direkt;
   *    Wrapper handled das.
   *  - EduPro: `[]` — alle Cloud-Provider brauchen ihren Key, weil EduPro-
   *    Backend selbst HTTP-Calls an api.anthropic.com etc. macht.
   *
   * Default `[]`. Ollama ist immer keyless (vom Backend markiert), egal
   * was hier steht.
   */
  @Input() keylessProviders: string[] = [];

  private readonly api = inject(KiModelsApiService);

  readonly loading = signal(true);
  readonly models = signal<AiModel[]>([]);
  readonly testResult = signal<Record<number, { ok?: boolean; latencyMs?: number; error?: string; pending?: boolean; skipped?: boolean }>>({});
  /** v0.15.0 — benannte Inferenz-Server für das pro-Modell-Dropdown. Leer wenn
   *  Backend < 0.8.0 (Endpoint 404) → Dropdown zeigt nur „Default". */
  readonly providerServers = signal<ProviderServer[]>([]);

  /**
   * Modelle gruppiert nach Kategorie. null/undefined/leer → `'general'`
   * (bleibt Default — passt zum llm-cascade-Backend, das ebenfalls auf
   * `general` fällt). Beliebige String-Kategorien werden akzeptiert.
   */
  readonly modelsByCategory = computed<Record<string, AiModel[]>>(() => {
    const buckets: Record<string, AiModel[]> = {};
    for (const m of this.models()) {
      const cat = m.category && m.category.trim() ? m.category : 'general';
      (buckets[cat] ??= []).push(m);
    }
    return buckets;
  });

  /**
   * Kategorien die mindestens 1 Modell enthalten. Reihenfolge:
   *   1. Explizit via `[categoryOrder]` — diese kommen zuerst (in der
   *      gegebenen Reihenfolge, sofern sie überhaupt Modelle enthalten).
   *   2. Alle restlichen Kategorien danach in der Reihenfolge ihres
   *      ersten Auftretens in `models()` (= globaler `orderIdx`).
   */
  readonly categoriesWithModels = computed<string[]>(() => {
    const by = this.modelsByCategory();
    const present = Object.keys(by);
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const c of this.categoryOrder) {
      if (by[c]?.length && !seen.has(c)) { ordered.push(c); seen.add(c); }
    }
    for (const m of this.models()) {
      const c = m.category && m.category.trim() ? m.category : 'general';
      if (by[c]?.length && !seen.has(c)) { ordered.push(c); seen.add(c); }
    }
    for (const c of present) {
      if (!seen.has(c)) { ordered.push(c); seen.add(c); }
    }
    return ordered;
  });

  /**
   * Capitalize + Bindestrich/Underscore zu Leerzeichen — als letztes Fallback
   * für unbekannte Kategorien (z.B. `free-only` → `Free Only`, `cloud` → `Cloud`).
   * Damit sieht die UI auch ohne explizite `categoryTitles`-Map nicht roh aus.
   */
  private prettifyCategory(c: string): string {
    return c.replace(/[-_]+/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
  }

  /**
   * Title-Lookup-Reihenfolge:
   *   1. Explizit via `[categoryTitles]`-Map (Konsumenten-Override)
   *   2. Backward-Compat zu v0.9.x: hardcoded utility/content/general aus Labels
   *   3. Capitalized Kategorie-String als Fallback
   */
  categoryTitle(c: string): string {
    if (this.categoryTitles[c]) return this.categoryTitles[c];
    if (c === 'utility') return this.L.categoryUtility;
    if (c === 'content') return this.L.categoryContent;
    if (c === 'general') return this.L.categoryGeneral;
    return this.prettifyCategory(c);
  }

  /**
   * Hint-Lookup-Reihenfolge analog `categoryTitle`. Wenn kein Hint gefunden:
   * leerer String (UI zeigt dann nur den Title).
   */
  categoryHint(c: string): string {
    if (this.categoryHints[c]) return this.categoryHints[c];
    if (c === 'utility') return this.L.categoryUtilityHint;
    if (c === 'content') return this.L.categoryContentHint;
    if (c === 'general') return this.L.categoryGeneralHint;
    return '';
  }

  ngOnInit(): void {
    this.reload();
    this.loadProviderServers();
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

  /** v0.15.0 — lädt die benannten Server fürs Server-Dropdown. Backend < 0.8.0
   *  liefert 404 → leere Liste, Dropdown zeigt nur „Default". */
  private loadProviderServers(): void {
    this.api.listProviderServers().subscribe({
      next: (list) => this.providerServers.set(list ?? []),
      error: () => this.providerServers.set([]),
    });
  }

  /** v0.15.0 — Server-Auswahl nur für lokale/self-hosted Provider sinnvoll.
   *  Cloud-Provider haben feste Endpoints und ignorieren den Server. */
  supportsCustomServer(m: AiModel): boolean {
    return m.provider === 'ollama' || m.provider === 'openai_compat';
  }

  /** v0.15.0 — weist einem Modell einen Inferenz-Server zu (leer = Default). */
  setServer(m: AiModel, name: string): void {
    this.api.updateModel(m.id, { providerServerName: name || null } as any).subscribe(() => {
      this.modelChanged.emit(m);
      this.reload();
    });
  }

  /** Tooltip für den (ggf. deaktivierten) Enable-Toggle: Key-Grund vs. Hardware-Grund. */
  toggleDisabledReason(m: AiModel): string {
    if (!m.enabled && m.hardwareCompatible === false) return this.L.toggleHardwareBlocked;
    if (!m.enabled && !m.keyConfigured && !this.isKeylessModel(m)) return this.L.toggleNeedsKey;
    return '';
  }

  toggle(m: AiModel): void {
    // v0.11.3 — keyless Modelle (Ollama, oder Konsument-Override für anthropic
    // via Max-OAuth) duerfen auch ohne keyConfigured aktiviert werden.
    if (!m.enabled && !m.keyConfigured && !this.isKeylessModel(m)) return;
    // v0.15.0 — hardware-geblockte Modelle nicht aktivierbar (nur OFF→ON sperren;
    // ein bereits aktives Modell bleibt abschaltbar). Geht von selbst wieder auf
    // sobald das Backend hardwareCompatible=true liefert (mehr RAM / ext. Server).
    if (!m.enabled && m.hardwareCompatible === false) return;
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
    if (!confirm(this.L.confirmDelete(m.modelId))) return;
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

  /**
   * Move innerhalb einer Kategorie: tauscht zwei kategoriegleiche Modelle in der
   * globalen `orderIdx`-Liste. Cross-Kategorie-Swap nicht möglich (Buttons
   * sind am Ende der Kategorie disabled). Globale Reihenfolge bleibt stabil,
   * nur die zwei Positionen werden gewechselt.
   */
  moveInCategory(cat: string, idxInCat: number, dir: -1 | 1): void {
    const subset = this.modelsByCategory()[cat];
    const target = idxInCat + dir;
    if (target < 0 || target >= subset.length) return;
    const movedModel = subset[idxInCat];
    const swapModel  = subset[target];

    const ordered = [...this.models()];
    const movedGlobalIdx = ordered.findIndex(m => m.id === movedModel.id);
    const swapGlobalIdx  = ordered.findIndex(m => m.id === swapModel.id);
    if (movedGlobalIdx < 0 || swapGlobalIdx < 0) return;
    [ordered[movedGlobalIdx], ordered[swapGlobalIdx]] = [ordered[swapGlobalIdx], ordered[movedGlobalIdx]];

    this.api.reorderModels(ordered.map(m => m.id)).subscribe(() => {
      this.modelChanged.emit(movedModel);
      this.reload();
    });
  }

  test(m: AiModel): void {
    this.setTest(m.id, { pending: true });
    this.api.testModel(m.id).subscribe({
      next: (r) => {
        this.setTest(m.id, r);
        // Auto-disable nur bei *echten* Failed-Tests (Modell antwortet falsch
        // oder gar nicht). Wenn der Konsument-Backend den Test bewusst
        // übersprungen hat (`skipped: true`), ist das KEIN Grund das Modell
        // auto-zu-deaktivieren — z.B. Switcher kurzschließt den Anthropic-Test
        // wenn kein API-Key da ist, weil Max-OAuth den Live-Switch trotzdem
        // erlaubt. Das Modell ist nutzbar, nur nicht testbar.
        if (m.enabled && r.ok === false && r.skipped !== true) {
          this.api.toggleModel(m.id, false).subscribe(() => this.reload());
        }
      },
      error: (e) => {
        this.setTest(m.id, { ok: false, error: e?.message ?? 'Error' });
        if (m.enabled) this.api.toggleModel(m.id, false).subscribe(() => this.reload());
      },
    });
  }

  /**
   * „Als aktiv setzen"-Klick — emittet `activeModelChanged`. Der Konsument
   * (z.B. Switcher) entscheidet was passiert: typisch ist ein `/api/switch`
   * mit `{provider, modelId}` damit der Wrapper Claude Code mit dem neuen
   * Provider neu startet.
   */
  setActive(m: AiModel): void {
    this.activeModelChanged.emit(m);
  }

  /** True wenn die Zeile zum `activeModelId`-Input passt. */
  isActiveModel(m: AiModel): boolean {
    return !!this.activeModelId && m.modelId === this.activeModelId;
  }

  /**
   * v0.11.4 — true wenn das Modell als „keyless" zu rendern ist (blaues
   * "Lokal"-Badge statt "Key fehlt"/"Key set").
   *
   * Logik:
   *  1. Backend-keyless (`m.keyless===true`, z.B. Ollama lokal) → IMMER true
   *  2. Konsument-Override (`keylessProviders.includes(provider)`) + KEIN
   *     Key konfiguriert → true (Beispiel: Switcher-anthropic ohne sk-ant-Key,
   *     Wechsel läuft via Max-OAuth ohne API-Call)
   *  3. Konsument-Override + Key konfiguriert → FALSE — User hat einen Key
   *     gesetzt, also „Key set" anzeigen + Test geht (Switcher-anthropic mit
   *     sk-ant-Key → echter api.anthropic.com-Call funktioniert)
   *  4. Sonst → false (normaler Cloud-Provider mit/ohne Key)
   */
  isKeylessModel(m: AiModel): boolean {
    if (m.keyless === true) return true;
    return this.keylessProviders.includes(m.provider) && !m.keyConfigured;
  }

  truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  private setTest(id: number, r: any): void {
    this.testResult.update((tr) => ({ ...tr, [id]: r }));
  }
}
