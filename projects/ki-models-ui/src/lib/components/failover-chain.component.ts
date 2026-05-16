import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChainEntry } from '../models/cascade-config';
import { FailoverChainLabels, FAILOVER_CHAIN_LABELS_EN } from '../models/labels';

/**
 * Generischer Failover-Chain-Editor — von beiden Konsumenten (Switcher +
 * EduPro) genutzt. Komponente ist „dumm": sie hält keinen Zustand, sondern
 * emittet `(chainChanged)` bei jeder Edit-Aktion. Der Konsument entscheidet
 * was mit der neuen Chain passiert:
 *
 * - **Switcher** persistiert sie in `_switcher.fallback_chain` (Wrapper liest
 *   das + restartet Claude Code bei Quota-Fehler entlang der Chain).
 * - **EduPro** mapped die Chain auf cascade-models-CRUD (`orderIdx`-Reorder
 *   bei Reorder, POST bei Add, DELETE bei Remove). Damit ist die Chain in
 *   EduPro effektiv die enabled-Modell-Liste in `orderIdx`-Reihenfolge.
 *
 * Switcher-spezifische Features (Aktuelle-Stufe-Indikator, Promote-Button)
 * sind hinter `[showChainPosition]="true"` gegated und in EduPro standardmäßig
 * ausgeblendet.
 *
 * **Inputs:**
 * - `chain` — aktuelle Chain (`{provider, model}[]`)
 * - `availableModels` — Optionen für Modell-Dropdown pro Provider
 * - `availableProviders` — Optionen für Provider-Dropdown
 * - `chainPosition` — aktive Stufe (0-basiert, null = keine)
 * - `showChainPosition` — gated Aktuelle-Stufe-Zeile + Promote-Button
 * - `labels` — i18n-Override
 *
 * **Outputs:**
 * - `chainChanged` — neue Chain nach jeder Edit-Aktion
 * - `promoteRequested` — User klickt „Zurück zu Stufe 1" (nur bei
 *   `showChainPosition && chainPosition > 0` sichtbar)
 */
@Component({
  selector: 'ki-failover-chain',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <p class="text-sm text-slate-600 dark:text-slate-300 mb-3">
        <strong class="font-semibold text-slate-900 dark:text-slate-100">{{ L.title }}</strong>
        — {{ L.description }}
      </p>

      <div *ngIf="chain.length === 0" class="text-sm italic text-slate-500 dark:text-slate-400 mb-3">
        {{ L.emptyState }}
      </div>

      <div class="space-y-2">
        <div *ngFor="let row of chain; let i = index" class="flex items-center gap-2">
          <span class="w-6 text-xs font-bold text-slate-500 dark:text-slate-400">{{ i + 1 }}.</span>
          <select
            [(ngModel)]="row.provider"
            (change)="onProviderChange(i)"
            class="flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100"
          >
            <option *ngFor="let p of validProviders()" [value]="p.value">{{ p.label }}</option>
          </select>
          <select
            [(ngModel)]="row.model"
            (change)="emit()"
            class="flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100"
          >
            <option *ngFor="let m of modelsForRow(row.provider, i)" [value]="m.modelId">{{ m.displayName }}</option>
          </select>
          <button
            type="button"
            (click)="moveUp(i)"
            [disabled]="i === 0"
            [title]="L.moveUpTitle"
            class="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >↑</button>
          <button
            type="button"
            (click)="moveDown(i)"
            [disabled]="i === chain.length - 1"
            [title]="L.moveDownTitle"
            class="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >↓</button>
          <button
            type="button"
            (click)="removeRow(i)"
            *ngIf="chain.length > 1"
            [title]="L.removeRowTitle"
            class="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 hover:bg-red-500 hover:text-white transition"
          >×</button>
        </div>
      </div>

      <button
        type="button"
        (click)="addRow()"
        [disabled]="!canAdd()"
        class="mt-3 px-3 py-1.5 text-xs font-bold rounded-lg border border-dashed border-slate-400 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-950 dark:hover:border-slate-50 hover:text-slate-950 dark:hover:text-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-400 disabled:hover:text-slate-600 transition"
      >+ {{ L.addRow }}</button>

      <div *ngIf="showChainPosition" class="flex items-center gap-3 mt-4 pt-3 border-t border-dashed border-slate-300 dark:border-slate-700">
        <span class="text-xs text-slate-500 dark:text-slate-400">{{ L.currentStep }}</span>
        <span class="flex-1 text-sm text-slate-700 dark:text-slate-200">{{ positionLabel() }}</span>
        <button
          type="button"
          *ngIf="(chainPosition ?? 0) > 0"
          (click)="promoteRequested.emit()"
          class="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-950 dark:bg-slate-50 text-slate-50 dark:text-slate-950 hover:opacity-90 transition"
        >{{ L.promote }}</button>
      </div>

      <p class="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        {{ L.hint }}
      </p>
    </div>
  `,
})
export class FailoverChainComponent {
  /** Aktuelle Chain. Die Komponente mutiert sie in-place beim Editieren und emittet `chainChanged`. */
  @Input() chain: ChainEntry[] = [];

  /** Optionen für die Modell-Dropdowns. Pro Provider eine Liste an Modellen. */
  @Input() availableModels: { provider: string; modelId: string; displayName: string }[] = [];

  /** Optionen für die Provider-Dropdowns. Default: anthropic/google/openrouter. */
  @Input() availableProviders: { value: string; label: string }[] = [
    { value: 'anthropic',  label: 'Anthropic' },
    { value: 'google',     label: 'Google AI Studio' },
    { value: 'openrouter', label: 'OpenRouter' },
  ];

  /** Aktive Stufe (0-basiert). Nur relevant bei `showChainPosition=true`. */
  @Input() chainPosition: number | null = null;

  /** Gated die Aktuelle-Stufe-Zeile + Promote-Button (Switcher-only-Feature). */
  @Input() showChainPosition = false;

  /** Optionale i18n-Override-Strings. */
  @Input() set labels(v: Partial<FailoverChainLabels> | undefined) {
    this.L = { ...FAILOVER_CHAIN_LABELS_EN, ...(v ?? {}) };
  }
  L: FailoverChainLabels = FAILOVER_CHAIN_LABELS_EN;

  @Output() chainChanged = new EventEmitter<ChainEntry[]>();
  @Output() promoteRequested = new EventEmitter<void>();

  modelsFor(provider: string) {
    return this.availableModels.filter((m) => m.provider === provider);
  }

  /**
   * Wie {@link modelsFor}, aber zusätzlich gefiltert auf Modelle, die NICHT
   * bereits in einer ANDEREN Chain-Zeile ausgewählt sind. Verhindert, dass
   * der User das gleiche `{provider, model}`-Paar mehrfach in die Chain
   * packt — würde im Konsumenten-Diff (z.B. EduPros `onFailoverChainChanged`)
   * zu Mehrdeutigkeit führen (welche Zeile gehört zu welchem cascade-Modell)
   * und den vorherigen Inhaber implizit löschen.
   */
  modelsForRow(provider: string, rowIdx: number): { modelId: string; displayName: string }[] {
    const blocked = new Set<string>();
    for (let j = 0; j < this.chain.length; j++) {
      if (j === rowIdx) continue;
      blocked.add(`${this.chain[j].provider}|${this.chain[j].model}`);
    }
    return this.availableModels
      .filter((m) => m.provider === provider)
      .filter((m) => !blocked.has(`${m.provider}|${m.modelId}`));
  }

  /**
   * Filtere `availableProviders` auf Provider, die mind. EIN `availableModels`-
   * Eintrag haben. Verhindert dass User Provider-Werte aus dem Dropdown picken,
   * für die kein Modell konfiguriert ist (würde sonst beim Aktivieren in einen
   * „kein Provider-Bean"-Backend-Fehler laufen).
   *
   * Beispiel EduPro (cascade-Namensraum): hat nur Modelle mit `provider:'gemini'`
   * → Dropdown zeigt nur „Google AI Studio". Selbst wenn der Konsument
   * `availableProviders` mit `[anthropic, google, openrouter]` overridet,
   * werden Optionen ohne Modelle ausgeblendet.
   */
  validProviders(): { value: string; label: string }[] {
    const have = new Set(this.availableModels.map((m) => m.provider));
    return this.availableProviders.filter((p) => have.has(p.value));
  }

  onProviderChange(idx: number): void {
    // Beim Provider-Wechsel: Modell auf erstes verfügbares des neuen Providers
    // setzen, das nicht bereits in einer anderen Zeile steht.
    const first = this.modelsForRow(this.chain[idx].provider, idx)[0];
    if (first) this.chain[idx].model = first.modelId;
    this.emit();
  }

  /**
   * True wenn es noch ein verfügbares Modell gibt, das NICHT bereits in der
   * Chain steht. Steuert das Disabled-State des „+ Stufe"-Buttons — verhindert
   * Klick-Versuche die sonst ein Duplikat (oder keinen Row) erzeugen würden.
   */
  canAdd(): boolean {
    if (this.availableModels.length === 0) return false;
    const inChain = new Set(this.chain.map((r) => `${r.provider}|${r.model}`));
    return this.availableModels.some((m) => !inChain.has(`${m.provider}|${m.modelId}`));
  }

  /**
   * Neue Chain-Stufe = erstes `availableModels`-Eintrag, der noch NICHT in der
   * Chain ist. Verhindert Duplikate beim Klick auf „+ Stufe".
   */
  addRow(): void {
    const inChain = new Set(this.chain.map((r) => `${r.provider}|${r.model}`));
    const first = this.availableModels.find((m) => !inChain.has(`${m.provider}|${m.modelId}`));
    if (!first) return; // Alles schon in Chain — Button sollte disabled sein
    this.chain = [...this.chain, { provider: first.provider, model: first.modelId }];
    this.emit();
  }

  removeRow(idx: number): void {
    this.chain = this.chain.filter((_, i) => i !== idx);
    this.emit();
  }

  moveUp(idx: number): void {
    if (idx === 0) return;
    const next = [...this.chain];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    this.chain = next;
    this.emit();
  }

  moveDown(idx: number): void {
    if (idx >= this.chain.length - 1) return;
    const next = [...this.chain];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    this.chain = next;
    this.emit();
  }

  positionLabel(): string {
    const pos = this.chainPosition ?? 0;
    const entry = this.chain[pos];
    if (!entry) return this.L.positionLabel(pos, '–', '–');
    return this.L.positionLabel(pos, entry.provider, entry.model);
  }

  emit(): void {
    this.chainChanged.emit([...this.chain]);
  }
}
