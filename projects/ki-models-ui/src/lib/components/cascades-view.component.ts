import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, forkJoin } from 'rxjs';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { AiModel } from '../models/ai-model';
import { Cascade } from '../models/cascade';
import { Category } from '../models/category';
import { ChainEntry } from '../models/cascade-config';
import { FailoverChainComponent } from './failover-chain.component';
import {
  CascadesViewLabels, CASCADES_VIEW_LABELS_EN,
  FailoverChainLabels, FAILOVER_CHAIN_LABELS_EN,
} from '../models/labels';

/**
 * Phase S' (2026-05-21) — Wrapper-Komponente die N Cascade-Bereiche als
 * eigenständige Karten rendert. Jeder Bereich hat seine eigene
 * Failover-Chain + Cooldown-Anzeige.
 *
 * **Vertrag:** Backend liefert per {@code GET /cascades} eine Liste der
 * Cascade-Namen mit Stats. Pro Name filtert dieser Wrapper die Modelle aus
 * {@code /ai-models} nach {@code category=name} (plus {@code "general"} als
 * Fallback wenn der Name nicht selbst "general" ist) und übergibt die
 * Subset-Liste der "dummen" `<ki-failover-chain>`.
 *
 * **Reorder-Verhalten:** Wenn der Admin Up/Down innerhalb einer Cascade
 * drückt, mappt der Wrapper das in eine globale `reorderModels()`-Anfrage:
 * er nimmt die aktuelle Globale Liste, swappt nur die beiden Modelle der
 * jeweiligen Cascade, übermittelt die neue globale Reihenfolge.
 *
 * **Backward-Compat:** Wenn das Backend `/cascades` nicht kennt oder `[]`
 * liefert, zeigt die Komponente einen leeren Zustand mit Hinweis-Text
 * (Konsument kann dann auf alte 3-Categories-Tabellen fallback).
 */
@Component({
  selector: 'ki-cascades-view',
  standalone: true,
  imports: [CommonModule, FormsModule, FailoverChainComponent],
  template: `
    <div class="space-y-6">
      <!-- Sektion-Header: Titel + manueller Refresh (kein periodisches Reload mehr) -->
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          {{ L.sectionTitle }}
        </h3>
        <button type="button"
                (click)="reload()"
                [disabled]="loading()"
                [title]="L.refreshTooltip"
                class="shrink-0 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 text-sm hover:bg-indigo-200 dark:hover:bg-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed transition">
          ↻
        </button>
      </div>

      <!-- Loading -->
      <div *ngIf="loading()" class="text-sm italic text-slate-500">
        {{ L.loading }}
      </div>

      <!-- Empty state — Backend liefert kein /cascades oder leere Liste -->
      <div *ngIf="!loading() && displayedCascades().length === 0"
           class="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        <p class="font-medium">{{ L.empty }}</p>
        <p class="mt-1 text-xs">{{ L.emptyHint }}</p>
      </div>

      <!-- Cascade-Karten — pool-gruppiert (cloud → free → local), eine Card pro Bereich -->
      <div *ngIf="!loading() && displayedCascades().length > 0" class="space-y-8">
        <div *ngFor="let group of cascadesByPool()">
          <h3 *ngIf="group.pool"
              class="mb-3 pb-1 text-base font-black tracking-tight text-slate-900 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700">
            {{ poolTitle(group.pool) }}
          </h3>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <article *ngFor="let c of group.cascades"
                 class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <!-- Header -->
          <header class="mb-4 flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <!-- Inline-Edit für displayName (v0.11.2). Click auf den Title →
                   Input. Enter speichert, Escape bricht ab. -->
              <ng-container *ngIf="editingTitle() !== c.name">
                <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide cursor-pointer hover:text-emerald-700 dark:hover:text-emerald-400 transition"
                    [title]="L.editTitleTooltip"
                    (click)="startEditTitle(c.name)">
                  {{ titleFor(c.name) }}
                </h3>
              </ng-container>
              <ng-container *ngIf="editingTitle() === c.name">
                <input type="text"
                       class="w-full text-lg font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                       [(ngModel)]="editTitleText"
                       [placeholder]="L.editTitlePlaceholder"
                       (keydown.enter)="$event.preventDefault(); saveEditTitle(c.name)"
                       (keydown.escape)="cancelEditTitle()"
                       autofocus />
                <div class="mt-1 flex gap-2 text-[10px]">
                  <button (click)="saveEditTitle(c.name)"
                          [disabled]="savingTitle()"
                          class="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold uppercase tracking-wide">
                    {{ L.editHintSave }}
                  </button>
                  <button (click)="cancelEditTitle()"
                          [disabled]="savingTitle()"
                          class="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wide">
                    {{ L.editHintCancel }}
                  </button>
                </div>
              </ng-container>

              <!-- Inline-Edit für description (v0.10.0). Click auf den Text →
                   Textarea. Enter speichert, Escape bricht ab, Blur speichert.
                   Während Edit ist hint via 'editing()'-Signal blockiert. -->
              <ng-container *ngIf="editing() !== c.name">
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition"
                   [title]="L.editHintTooltip"
                   (click)="startEdit(c.name)">
                  {{ hintFor(c.name) }}
                </p>
              </ng-container>
              <ng-container *ngIf="editing() === c.name">
                <textarea
                  class="mt-1 w-full text-xs px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows="2"
                  [(ngModel)]="editText"
                  [placeholder]="L.editHintPlaceholder"
                  (keydown.enter)="$event.preventDefault(); saveEdit(c.name)"
                  (keydown.escape)="cancelEdit()"
                  #editArea
                  autofocus></textarea>
                <div class="mt-1 flex gap-2 text-[10px]">
                  <button (click)="saveEdit(c.name)"
                          [disabled]="saving()"
                          class="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold uppercase tracking-wide">
                    {{ L.editHintSave }}
                  </button>
                  <button (click)="cancelEdit()"
                          [disabled]="saving()"
                          class="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wide">
                    {{ L.editHintCancel }}
                  </button>
                </div>
              </ng-container>
            </div>
            <div class="shrink-0 flex items-center gap-1.5">
              <span *ngIf="c.currentModel"
                    class="text-[10px] font-mono px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                ● {{ c.currentModel }}
              </span>
              <!-- v0.11.1 — Trash-Icon zum Loeschen der category_meta-Zeile
                   (displayName + description). Sichtbar nur wenn die Cascade
                   ueberhaupt Custom-Texte hat (sonst gibts nichts zu loeschen).
                   Modelle bleiben unangetastet — User muss die ueber die
                   Models-Tabelle einzeln entfernen. -->
              <button *ngIf="hasMeta(c.name)"
                      (click)="deleteMeta(c.name)"
                      [disabled]="deletingMeta() === c.name || editing() === c.name"
                      [title]="L.deleteMetaTooltip"
                      class="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-40 disabled:cursor-not-allowed text-base leading-none p-1 rounded transition">
                ✕
              </button>
            </div>
          </header>

          <!-- Failover-Chain Editor pro Cascade -->
          <ki-failover-chain
            [chain]="chainsByCascade()[c.name] || []"
            [availableModels]="availableModelsAll()"
            [availableProviders]="providerOptions"
            [labels]="chainLabels"
            (chainChanged)="onChainChanged(c.name, $event)">
          </ki-failover-chain>

          <!-- Cooldown-Anzeige pro Modell -->
          <div *ngIf="hasCooldown(c)" class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {{ L.cooldownTitle }}
            </p>
            <div class="space-y-1">
              <div *ngFor="let entry of cooldownEntries(c)"
                   class="flex items-center justify-between text-xs">
                <code class="font-mono text-slate-700 dark:text-slate-300">{{ entry.key }}</code>
                <span [class.text-emerald-600]="entry.sec === 0"
                      [class.text-amber-600]="entry.sec > 0"
                      class="font-bold">
                  {{ entry.sec === 0 ? L.statusFree : (L.statusCooldown + ' ' + entry.sec + 's') }}
                </span>
              </div>
            </div>
          </div>
        </article>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class CascadesViewComponent implements OnInit, OnDestroy {
  @Input() set labels(v: Partial<CascadesViewLabels> | undefined) {
    this.L = { ...CASCADES_VIEW_LABELS_EN, ...(v ?? {}) };
  }
  L: CascadesViewLabels = CASCADES_VIEW_LABELS_EN;

  @Input() chainLabels?: Partial<FailoverChainLabels>;

  /**
   * Optional: Pro Cascade-Name eine Sub-Hint (z.B. „Lehrinhalte, Prüfungen, Chat").
   * Wenn nicht gesetzt, wird der Default-Hint aus `L.defaultHint` genommen.
   */
  @Input() hintByCascade: Record<string, string> = {};

  /** Provider-Optionen für das Dropdown im Failover-Editor. */
  @Input() providerOptions: { value: string; label: string }[] = [
    { value: 'gemini',        label: 'Gemini (Google)' },
    { value: 'openai',        label: 'OpenAI' },
    { value: 'anthropic',     label: 'Anthropic' },
    { value: 'openrouter',    label: 'OpenRouter' },
    { value: 'deepseek',      label: 'DeepSeek' },
    { value: 'ollama',        label: 'Ollama (local)' },
    { value: 'openai_compat', label: 'Custom OpenAI-compatible' },
  ];

  /** Wird emittet wenn der Admin in einer der Cascades reordert oder Modelle tauscht. */
  @Output() cascadeChanged = new EventEmitter<{ cascadeName: string; chain: ChainEntry[] }>();

  private readonly api = inject(KiModelsApiService);

  readonly loading = signal(true);
  readonly cascades = signal<Cascade[]>([]);
  readonly allModels = signal<AiModel[]>([]);

  /**
   * Optionale Whitelist sichtbarer Cascade-Namen. `null`/`undefined` (Default) →
   * alle vom Backend gelieferten (bereits pool-gefilterten) Cascaden werden
   * gezeigt. Wird eine Liste gesetzt, werden NUR diese gerendert — der Switcher
   * blendet so je nach Supermodell-Zustand entweder nur die Pool-Cascade oder
   * nur die Rollen-Cascaden ein.
   */
  private readonly _visibleCascades = signal<string[] | null>(null);
  @Input() set visibleCascades(v: string[] | null | undefined) {
    this._visibleCascades.set(v ?? null);
  }

  /**
   * Pool-Anzeigenamen für die Pool-gruppierte Matrix. Nur genutzt, wenn eine
   * `visibleCascades`-Whitelist gesetzt ist (Switcher-Fall) — dann werden die
   * Cascade-Cards zusätzlich nach Pool (cloud → free → local) gruppiert.
   */
  @Input() poolTitles: Record<string, string> = {
    cloud: 'Cloud — Premium (bezahlt)',
    free: 'Free — OpenRouter :free',
    local: 'Lokal — Ollama (privat)',
  };

  /** Cascaden nach optionaler Whitelist gefiltert (Template iteriert darüber). */
  readonly displayedCascades = computed<Cascade[]>(() => {
    const allow = this._visibleCascades();
    const list = this.cascades();
    if (allow == null) return list;
    const set = new Set(allow);
    return list.filter((c) => set.has(c.name));
  });

  /** Bekannte Pools in Anzeige-Reihenfolge. */
  private readonly POOL_ORDER = ['cloud', 'free', 'local'];

  /**
   * Leitet den Pool eines Cascade-Namens ab (analog models-table):
   *   bare Pool → Pool; 'free-only' → 'free'; Compound '{x}-{pool}' → Suffix;
   *   sonst → null.
   */
  poolOf(name: string): string | null {
    if (name === 'free-only') return 'free';
    if (this.POOL_ORDER.includes(name)) return name;
    const idx = name.lastIndexOf('-');
    if (idx >= 0) {
      const suffix = name.slice(idx + 1);
      if (this.POOL_ORDER.includes(suffix)) return suffix;
    }
    return null;
  }

  /**
   * Pool-gruppierte Cascade-Cards — nur aktiv, wenn eine `visibleCascades`-
   * Whitelist gesetzt ist. Reihenfolge cloud → free → local, innerhalb eines
   * Pools die bestehende `displayedCascades`-Ordnung. Nicht-poolbare Cascaden
   * (z.B. 'general') landen ohne Header in einer letzten Gruppe (key null).
   */
  readonly cascadesByPool = computed<{ pool: string | null; cascades: Cascade[] }[]>(() => {
    const list = this.displayedCascades();
    if (this._visibleCascades() == null) return [{ pool: null, cascades: list }];
    const byPool = new Map<string | null, Cascade[]>();
    for (const c of list) {
      const p = this.poolOf(c.name);
      if (!byPool.has(p)) byPool.set(p, []);
      byPool.get(p)!.push(c);
    }
    const groups: { pool: string | null; cascades: Cascade[] }[] = [];
    for (const pool of this.POOL_ORDER) {
      const g = byPool.get(pool);
      if (g?.length) groups.push({ pool, cascades: g });
    }
    const rest = byPool.get(null);
    if (rest?.length) groups.push({ pool: null, cascades: rest });
    return groups;
  });

  /** Header-Label für eine Pool-Gruppe. */
  poolTitle(pool: string): string {
    return this.poolTitles[pool]
      || pool.replace(/[-_]+/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
  }

  /**
   * Display-Metadaten pro Kategorie (v0.10.0). Wird beim init aus
   * `GET {base}/categories` geladen. Wenn der Endpoint nicht existiert
   * (Backward-Compat zu llm-cascade < 0.5), bleibt das Array leer und das
   * UI fällt auf den `[hintByCascade]`-Input bzw. `L.defaultHint` zurück.
   */
  readonly categoriesMeta = signal<Category[]>([]);

  /**
   * Inline-Edit-State: Name der Kategorie die gerade editiert wird (oder
   * `null` wenn kein Edit aktiv). `editText` ist der aktuelle Textarea-Wert.
   * `saving` blockiert die Buttons während des PUT-Roundtrips.
   */
  readonly editing = signal<string | null>(null);
  editText = '';
  readonly saving = signal(false);

  /**
   * v0.11.2 — separates Edit-State für displayName. Title + Description
   * können nicht gleichzeitig editiert werden — das Edit-Modell ist
   * exclusive pro Cascade-Card.
   */
  readonly editingTitle = signal<string | null>(null);
  editTitleText = '';
  readonly savingTitle = signal(false);

  /**
   * v0.11.1 — beim Klick auf das Trash-Icon wird der Cascade-Name hier
   * gespeichert bis der DELETE-Roundtrip durch ist. So koennen wir nur den
   * gerade in Bearbeitung befindlichen Button disablen, nicht alle.
   */
  readonly deletingMeta = signal<string | null>(null);

  /**
   * Pro Cascade-Name die Chain (Array<{provider, model}>) als computed-Signal.
   * Stabile Referenz solange sich allModels nicht ändert — verhindert CD-Storms
   * im Failover-Chain-Child und stellt sicher dass die Berechnung erst läuft
   * wenn allModels wirklich befüllt ist.
   */
  readonly chainsByCascade = computed<Record<string, ChainEntry[]>>(() => {
    const result: Record<string, ChainEntry[]> = {};
    const models = this.allModels();
    const enabledOnly = models.filter(m => m.enabled && !m.autoDisabled);
    for (const c of this.cascades()) {
      const name = c.name.toLowerCase();
      const subset = enabledOnly.filter(m => {
        const cat = (m.category ?? 'general').toLowerCase();
        return cat === name || (name !== 'general' && cat === 'general');
      });
      result[c.name] = subset.map(m => ({ provider: m.provider, model: m.modelId }));
    }
    return result;
  });

  /**
   * Provider-Modell-Dropdown-Optionen (stable ref). Zeigt ALLE konfigurierten
   * Modelle an — auch deaktivierte (AUS) — damit die Cascade-Bereiche die eine
   * Verwaltungsfläche sind: genau die Modelle aus der Tabelle sind hier wählbar.
   * Nur autoDisabled (tot/wiederholt fehlgeschlagen) bleibt raus. Ein im Chain
   * gewähltes Modell wird in {@link #onChainChanged} automatisch aktiviert.
   */
  readonly availableModelsAll = computed<{ provider: string; modelId: string; displayName: string }[]>(() => {
    return this.allModels()
      .filter(m => !m.autoDisabled)
      .map(m => ({
        provider: m.provider,
        modelId: m.modelId,
        displayName: m.displayName ?? m.modelId,
      }));
  });

  /** Auto-Refresh (Sekunden). Default 0 = AUS: die View lädt nur beim Init und
   *  danach ausschließlich über den manuellen Refresh-Button. Periodisches
   *  Reload ließ den ganzen Bereich im Sekundentakt flackern. Opt-in bleibt
   *  möglich, indem ein Konsument einen Wert > 0 setzt. */
  @Input() autoRefreshSec = 0;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.reload();
    if (this.autoRefreshSec > 0) {
      this.refreshTimer = setInterval(() => this.reload(), this.autoRefreshSec * 1000);
    }
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  }

  reload(): void {
    this.loading.set(true);
    // Parallel laden — Cascades-Stats + Modelle (für Filter pro Cascade) +
    // Categories-Display-Metadaten (v0.10.0). `firstValueFrom` statt
    // `.toPromise()`. Categories ist optional (404 → leer fallback).
    Promise.all([
      firstValueFrom(this.api.listCascades()).catch(() => [] as any),
      firstValueFrom(this.api.listModels()).catch(() => [] as any),
      firstValueFrom(this.api.listCategories()).catch(() => [] as any),
    ]).then(([cs, ms, cats]) => {
      this.cascades.set(Array.isArray(cs) ? cs : []);
      this.allModels.set(Array.isArray(ms) ? ms : []);
      this.categoriesMeta.set(Array.isArray(cats) ? cats : []);
      this.loading.set(false);
    });
  }

  /**
   * Title-Lookup-Reihenfolge:
   *   1. `displayName` aus den Categories-Metadaten (User hat's gesetzt)
   *   2. Roher Cascade-Name (rückwärtskompatibel, bisheriges Verhalten)
   *
   * Der Cascade-Name selbst kommt vom Backend `/cascades` und ist bereits
   * der Kategorie-Identifier — wir capitalisieren ihn NICHT zusätzlich, weil
   * die alten UIs ihn bereits via `uppercase`-CSS rendern.
   */
  titleFor(cascadeName: string): string {
    const meta = this.categoriesMeta().find(c => c.name === cascadeName.toLowerCase());
    return meta?.displayName?.trim() || cascadeName;
  }

  /**
   * Hint-Lookup-Reihenfolge:
   *   1. `description` aus den Categories-Metadaten (User-edit per Inline-Edit)
   *   2. `[hintByCascade]`-Input vom Konsumenten (sein hardcoded Default)
   *   3. `L.defaultHint` (Library-Englisch-Fallback)
   */
  hintFor(cascadeName: string): string {
    const key = cascadeName.toLowerCase();
    const meta = this.categoriesMeta().find(c => c.name === key);
    return meta?.description?.trim()
      || this.hintByCascade[key]
      || this.L.defaultHint;
  }

  /** Klick auf den Hint → Edit-Mode aktivieren mit aktuellem Wert vorbefüllt. */
  startEdit(cascadeName: string): void {
    const key = cascadeName.toLowerCase();
    const meta = this.categoriesMeta().find(c => c.name === key);
    // Vorgeladener Text: NUR die persistierte description, NICHT der Konsumenten-
    // Default — User soll nicht versehentlich den Hardcode festschreiben.
    this.editText = meta?.description ?? '';
    this.editing.set(cascadeName);
  }

  /** Escape oder Cancel-Button → Edit-Mode verlassen ohne Save. */
  cancelEdit(): void {
    this.editing.set(null);
    this.editText = '';
  }

  /**
   * Save-Button (oder Enter): PUT der neuen description an
   * `/categories/{name}`. Leerer String → wird als `null` gesendet
   * (Backend löscht das Feld), damit der Konsument-Default wieder greift.
   */
  saveEdit(cascadeName: string): void {
    const key = cascadeName.toLowerCase();
    const trimmed = (this.editText ?? '').trim();
    this.saving.set(true);
    this.api.updateCategory(key, {
      description: trimmed.length === 0 ? null : trimmed,
    }).subscribe({
      next: () => {
        // Lokale Metadaten-Liste sofort patchen damit die UI ohne Reload
        // den neuen Wert zeigt — der nächste reload() würde es zwar auch
        // holen, aber der UX-Lag wäre sichtbar.
        const list = [...this.categoriesMeta()];
        const idx = list.findIndex(c => c.name === key);
        if (idx >= 0) {
          list[idx] = { ...list[idx], description: trimmed || null };
        } else {
          list.push({ name: key, description: trimmed || null });
        }
        this.categoriesMeta.set(list);
        this.editing.set(null);
        this.editText = '';
        this.saving.set(false);
      },
      error: (e) => {
        console.error('[ki-cascades-view] saveEdit failed', e);
        this.saving.set(false);
      },
    });
  }

  hasCooldown(c: Cascade): boolean {
    return c.cooldownSec && Object.keys(c.cooldownSec).length > 0;
  }

  /**
   * v0.11.2 — Inline-Edit für displayName. Click auf den Title öffnet ein
   * Input-Feld. Persistiert via PUT /api/categories/{name} mit nur dem
   * displayName-Feld (description bleibt unangetastet).
   */
  startEditTitle(cascadeName: string): void {
    const key = cascadeName.toLowerCase();
    const meta = this.categoriesMeta().find(c => c.name === key);
    // Vorgeladener Text: NUR der persistierte displayName, NICHT der
    // capitalized Fallback — User soll nicht versehentlich den Fallback
    // als seinen eigenen Wert festschreiben.
    this.editTitleText = meta?.displayName ?? '';
    this.editingTitle.set(cascadeName);
  }

  cancelEditTitle(): void {
    this.editingTitle.set(null);
    this.editTitleText = '';
  }

  saveEditTitle(cascadeName: string): void {
    const key = cascadeName.toLowerCase();
    const trimmed = (this.editTitleText ?? '').trim();
    this.savingTitle.set(true);
    this.api.updateCategory(key, {
      displayName: trimmed.length === 0 ? null : trimmed,
    }).subscribe({
      next: () => {
        const list = [...this.categoriesMeta()];
        const idx = list.findIndex(c => c.name === key);
        if (idx >= 0) {
          list[idx] = { ...list[idx], displayName: trimmed || null };
        } else {
          list.push({ name: key, displayName: trimmed || null });
        }
        this.categoriesMeta.set(list);
        this.editingTitle.set(null);
        this.editTitleText = '';
        this.savingTitle.set(false);
      },
      error: (e) => {
        console.error('[ki-cascades-view] saveEditTitle failed', e);
        this.savingTitle.set(false);
      },
    });
  }

  /**
   * v0.11.1 — true wenn fuer diese Kategorie eine `category_meta`-Zeile
   * im Backend existiert (User hat displayName oder description gesetzt).
   * Trash-Icon wird nur dann angezeigt — sonst gaebe es nichts zu loeschen.
   */
  hasMeta(cascadeName: string): boolean {
    const key = cascadeName.toLowerCase();
    const meta = this.categoriesMeta().find(c => c.name === key);
    if (!meta) return false;
    const hasTitle = !!meta.displayName && meta.displayName.trim().length > 0;
    const hasDesc  = !!meta.description && meta.description.trim().length > 0;
    return hasTitle || hasDesc;
  }

  /**
   * v0.11.1 — DELETE der `category_meta`-Zeile. Modelle bleiben unangetastet,
   * der Cascade-Bereich verschwindet erst wenn auch die Modelle weg sind
   * (oder umkategoriiert wurden). Nach Erfolg lokales Patchen + Reload.
   */
  deleteMeta(cascadeName: string): void {
    const key = cascadeName.toLowerCase();
    if (!confirm(this.L.deleteMetaConfirm(this.titleFor(cascadeName)))) return;
    this.deletingMeta.set(key);
    this.api.deleteCategoryMeta(key).subscribe({
      next: () => {
        // Lokal patchen damit Title + Description sofort auf Fallback gehen
        const list = this.categoriesMeta().map(c =>
          c.name === key ? { ...c, displayName: null, description: null } : c);
        this.categoriesMeta.set(list);
        this.deletingMeta.set(null);
      },
      error: (e) => {
        console.error('[ki-cascades-view] deleteMeta failed', e);
        this.deletingMeta.set(null);
      },
    });
  }

  cooldownEntries(c: Cascade): { key: string; sec: number }[] {
    return Object.entries(c.cooldownSec || {})
      .map(([key, sec]) => ({ key, sec: sec as number }));
  }

  /**
   * Cascade-scoped Reorder: nimmt die neue Cascade-spezifische Chain vom
   * Failover-Editor und übersetzt das in eine globale `reorderModels()`-
   * Anfrage. Die globale Liste wird so umsortiert, dass die Position der
   * cascade-eigenen Modelle der neuen Reihenfolge entspricht; alle anderen
   * Modelle bleiben in ihrer relativen Position.
   */
  onChainChanged(cascadeName: string, newChain: ChainEntry[]): void {
    const global = this.allModels();
    const idsInChain = new Set<number>();
    const orderedCascadeIds: number[] = [];

    // Map ChainEntry → DB-id
    for (const entry of newChain) {
      const found = global.find(m => m.provider === entry.provider && m.modelId === entry.model);
      if (found) {
        idsInChain.add(found.id);
        orderedCascadeIds.push(found.id);
      }
    }

    // Cascade = Verwaltungsfläche: ins Chain gewählte Modelle werden AKTIVIERT,
    // kategorie-eigene Modelle die aus dem Chain entfernt wurden DEAKTIVIERT.
    // general-Modelle sind geteilt (in jeder Kategorie angehängt) → beim Editieren
    // einer anderen Kategorie NICHT anfassen: nur Modelle deren category == cascadeName.
    const cat = cascadeName.toLowerCase();
    const toEnable  = global.filter(m => idsInChain.has(m.id) && !m.enabled);
    const toDisable = global.filter(m =>
      !idsInChain.has(m.id) && m.enabled
      && ((m.category ?? 'general').toLowerCase() === cat));

    // Globale Liste neu komponieren: bei den cascade-Slots in der globalen
    // Reihenfolge die neue cascade-Order einsetzen, fremde Modelle behalten
    // ihre Position.
    const newGlobalOrder: number[] = [];
    let cascadeIdx = 0;
    for (const m of global) {
      if (idsInChain.has(m.id)) {
        newGlobalOrder.push(orderedCascadeIds[cascadeIdx++]);
      } else {
        newGlobalOrder.push(m.id);
      }
    }

    const applyReorder = () => this.api.reorderModels(newGlobalOrder).subscribe({
      next: () => {
        this.cascadeChanged.emit({ cascadeName, chain: newChain });
        this.reload();
      },
      error: (e) => console.error('[ki-cascades-view] reorder failed', e),
    });

    // Erst Enable/Disable (falls nötig), dann Reorder + Reload. Ohne Änderungen
    // direkt reordern.
    const ops = [
      ...toEnable.map(m => this.api.toggleModel(m.id, true)),
      ...toDisable.map(m => this.api.toggleModel(m.id, false)),
    ];
    if (ops.length === 0) {
      applyReorder();
    } else {
      forkJoin(ops).subscribe({
        next:  () => applyReorder(),
        error: (e) => { console.error('[ki-cascades-view] enable/disable failed', e); applyReorder(); },
      });
    }
  }
}
