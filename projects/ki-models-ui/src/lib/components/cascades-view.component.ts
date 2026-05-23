import { Component, EventEmitter, Input, Output, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { AiModel } from '../models/ai-model';
import { Cascade } from '../models/cascade';
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
  imports: [CommonModule, FailoverChainComponent],
  template: `
    <div class="space-y-6">
      <!-- Loading -->
      <div *ngIf="loading()" class="text-sm italic text-slate-500">
        {{ L.loading }}
      </div>

      <!-- Empty state — Backend liefert kein /cascades oder leere Liste -->
      <div *ngIf="!loading() && cascades().length === 0"
           class="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        <p class="font-medium">{{ L.empty }}</p>
        <p class="mt-1 text-xs">{{ L.emptyHint }}</p>
      </div>

      <!-- Cascade-Karten — eine pro Bereich -->
      <div *ngIf="!loading() && cascades().length > 0"
           class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <article *ngFor="let c of cascades()"
                 class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <!-- Header -->
          <header class="mb-4 flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                {{ c.name }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {{ hintFor(c.name) }}
              </p>
            </div>
            <span *ngIf="c.currentModel"
                  class="shrink-0 text-[10px] font-mono px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
              ● {{ c.currentModel }}
            </span>
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
  `,
  styles: [],
})
export class CascadesViewComponent implements OnInit {
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

  /** Provider-Modell-Dropdown-Optionen, ebenfalls als computed (stable ref). */
  readonly availableModelsAll = computed<{ provider: string; modelId: string; displayName: string }[]>(() => {
    return this.allModels()
      .filter(m => m.enabled && !m.autoDisabled)
      .map(m => ({
        provider: m.provider,
        modelId: m.modelId,
        displayName: m.displayName ?? m.modelId,
      }));
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    // Parallel laden — Cascades-Stats + Modelle (für Filter pro Cascade).
    // `firstValueFrom` statt `.toPromise()` (deprecated, kann undefined liefern
    // wenn die Observable ohne Wert completes — was bei HttpClient bei leerer
    // Response geschehen kann und allModels=[] hinterlässt, womit chainFor()
    // jeder Cascade auch leer wäre und die Failover-Chain die EmptyState
    // zeigt obwohl die Cascade-Karten selbst da sind).
    Promise.all([
      firstValueFrom(this.api.listCascades()).catch(() => [] as any),
      firstValueFrom(this.api.listModels()).catch(() => [] as any),
    ]).then(([cs, ms]) => {
      this.cascades.set(Array.isArray(cs) ? cs : []);
      this.allModels.set(Array.isArray(ms) ? ms : []);
      this.loading.set(false);
    });
  }

  hintFor(cascadeName: string): string {
    return this.hintByCascade[cascadeName.toLowerCase()] ?? this.L.defaultHint;
  }

  hasCooldown(c: Cascade): boolean {
    return c.cooldownSec && Object.keys(c.cooldownSec).length > 0;
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

    this.api.reorderModels(newGlobalOrder).subscribe({
      next: () => {
        this.cascadeChanged.emit({ cascadeName, chain: newChain });
        this.reload();
      },
      error: (e) => console.error('[ki-cascades-view] reorder failed', e),
    });
  }
}
