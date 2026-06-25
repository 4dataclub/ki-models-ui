import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { AiModel } from '../models/ai-model';
import {
  CascadeCooldownLabels,
  CascadesViewLabels,
  FailoverChainLabels,
  ModelsTableLabels,
  AddModelFormLabels,
  ApiKeysSectionLabels,
  ProviderServersLabels,
} from '../models/labels';

import { CascadeCooldownComponent } from './cascade-cooldown.component';
import { CascadesViewComponent } from './cascades-view.component';
import { ModelsTableComponent } from './models-table.component';
import { AddModelFormComponent } from './add-model-form.component';
import { ApiKeysSectionComponent } from './api-keys-section.component';
import { PrivacySettingsComponent } from './privacy-settings.component';
import { SupermodelMatrixComponent } from './supermodel-matrix.component';
import { ProviderServersComponent } from './provider-servers.component';
import { ModelsQualityStatsComponent } from './models-quality-stats.component';
import { ModelsPerformanceComponent } from './models-performance.component';
import { ModelsCooldownStateComponent } from './models-cooldown-state.component';
import { RoutingDecisionsComponent } from './routing-decisions.component';
import { DelegationLiveComponent } from './delegation-live.component';

/** Optional config bundle — every field is optional; bare mount renders with defaults. */
export interface KiModelsPageConfig {
  cascadeCooldownLabels?: Partial<CascadeCooldownLabels>;
  cascadesViewLabels?: Partial<CascadesViewLabels>;
  cascadeChainLabels?: Partial<FailoverChainLabels>;
  cascadeHints?: Record<string, string>;
  cascadeProviderOptions?: { value: string; label: string }[];
  modelsTableLabels?: Partial<ModelsTableLabels>;
  showActiveAction?: boolean;
  activeModelId?: string | null;
  categoryTitles?: Record<string, string>;
  categoryHints?: Record<string, string>;
  categoryOrder?: string[];
  keylessProviders?: string[];
  addModelFormLabels?: Partial<AddModelFormLabels>;
  defaultCategoryByProvider?: Record<string, string>;
  apiKeysSectionLabels?: Partial<ApiKeysSectionLabels>;
  providerServersLabels?: Partial<ProviderServersLabels>;
  qualityTitle?: string;
  qualitySubtitle?: string;
  performanceTitle?: string;
  performanceSubtitle?: string;
  costMapping?: Record<string, number> | null;
  costCurrency?: 'USD' | 'EUR';
  usdToEur?: number;
  cooldownTitle?: string;
  cooldownSubtitle?: string;
  cooldownAutoRefreshSec?: number;
  privacyTitle?: string;
  privacySubtitle?: string;
  delegationTitle?: string;
  delegationSubtitle?: string;
  delegationAutoRefreshSec?: number;
  delegationMaxRows?: number;
}

/**
 * ki-models-page — Single-Source Composer
 *
 * Renders every section in canonical order. A bare
 * `<ki-models-page></ki-models-page>` works with EduPro defaults.
 *
 * Canonical order:
 * Verwaltung: cascade-cooldown → cascades-view → models-table →
 *             add-model-form → api-keys-section → privacy-settings
 * Supermodell: supermodel-matrix
 * Statistiken: provider-servers → models-quality-stats →
 *              models-performance → models-cooldown-state →
 *              routing-decisions → delegation-live
 */
@Component({
  selector: 'ki-models-page',
  standalone: true,
  imports: [
    CommonModule,
    CascadeCooldownComponent,
    CascadesViewComponent,
    ModelsTableComponent,
    AddModelFormComponent,
    ApiKeysSectionComponent,
    PrivacySettingsComponent,
    SupermodelMatrixComponent,
    ProviderServersComponent,
    ModelsQualityStatsComponent,
    ModelsPerformanceComponent,
    ModelsCooldownStateComponent,
    RoutingDecisionsComponent,
    DelegationLiveComponent,
  ],
  template: `
    <!-- ── Verwaltung ─────────────────────────────────────────────────── -->

    <section class="ki-card">
      <ki-cascade-cooldown
        [labels]="config.cascadeCooldownLabels">
      </ki-cascade-cooldown>
    </section>

    <section class="ki-card">
      <ki-cascades-view
        [labels]="config.cascadesViewLabels"
        [chainLabels]="config.cascadeChainLabels"
        [hintByCascade]="config.cascadeHints ?? {}"
        [providerOptions]="config.cascadeProviderOptions ?? []"
        (cascadeChanged)="onCascadeChanged()">
      </ki-cascades-view>
    </section>

    <section class="ki-card">
      <ki-models-table
        [labels]="config.modelsTableLabels"
        [showActiveAction]="config.showActiveAction ?? false"
        [activeModelId]="config.activeModelId ?? null"
        [categoryTitles]="config.categoryTitles ?? {}"
        [categoryHints]="config.categoryHints ?? {}"
        [categoryOrder]="config.categoryOrder ?? []"
        [keylessProviders]="config.keylessProviders ?? []"
        (modelChanged)="onModelChanged($event)"
        (activeModelChanged)="onActiveModelChanged($event)">
      </ki-models-table>
    </section>

    <section class="ki-card">
      <ki-add-model-form
        [labels]="config.addModelFormLabels"
        [defaultCategoryByProvider]="config.defaultCategoryByProvider ?? {}"
        (modelCreated)="onModelCreated($event)">
      </ki-add-model-form>
    </section>

    <section class="ki-card">
      <ki-api-keys-section
        [labels]="config.apiKeysSectionLabels"
        (keyChanged)="onKeyChanged($event)">
      </ki-api-keys-section>
    </section>

    <section class="ki-card">
      <ki-privacy-settings
        [title]="config.privacyTitle ?? 'Datenschutz'"
        [subtitle]="config.privacySubtitle ?? 'Speichert pro Delegations-Call einen gekürzten Prompt-Ausschnitt (max. 160 Zeichen) — nur für Debug/Live-Watch. Standard: AUS (Datenschutz).'">
      </ki-privacy-settings>
    </section>

    <!-- ── Supermodell ────────────────────────────────────────────────── -->

    <section class="ki-card">
      <ki-supermodel-matrix
        [pools]="supermodelPools ?? ['cloud', 'free', 'local']"
        [roles]="supermodelRoles ?? ['orchestrator', 'implement', 'review', 'research', 'dispatch']"
        [activePool]="activePool"
        [supermodelOn]="supermodelOn"
        [localOrchestratorPending]="localOrchestratorPending"
        [disabled]="supermodelDisabled"
        [disabledHint]="supermodelDisabledHint ?? 'Supermodell — demnächst verfügbar'"
        [labels]="supermodelLabels">
      </ki-supermodel-matrix>
    </section>

    <!-- ── Statistiken ────────────────────────────────────────────────── -->

    <section class="ki-card">
      <ki-provider-servers
        [labels]="config.providerServersLabels"
        (serversChanged)="onServersChanged()">
      </ki-provider-servers>
    </section>

    <section class="ki-card">
      <ki-models-quality-stats
        [title]="config.qualityTitle ?? 'KI-Qualität — Stats der letzten 30 Tage'"
        [subtitle]="config.qualitySubtitle ?? 'Schlechte Modelle stehen oben. KILL-Kandidaten sollten deaktiviert werden.'">
      </ki-models-quality-stats>
    </section>

    <section class="ki-card">
      <ki-models-performance
        [title]="config.performanceTitle ?? 'LLM-Performance — letzte 30 Tage'"
        [subtitle]="config.performanceSubtitle ?? 'Calls + Erfolg + Cost pro Provider/Modell.'"
        [costMapping]="config.costMapping ?? null"
        [costCurrency]="config.costCurrency ?? 'EUR'"
        [usdToEur]="config.usdToEur ?? 0.92">
      </ki-models-performance>
    </section>

    <section class="ki-card">
      <ki-models-cooldown-state
        [title]="config.cooldownTitle ?? 'Cooldown-State — pro Modell'"
        [subtitle]="config.cooldownSubtitle ?? 'Live-Status: KILLED (rot) → Cooldown (gelb) → ready (grün).'"
        [autoRefreshSec]="config.cooldownAutoRefreshSec ?? 30">
      </ki-models-cooldown-state>
    </section>

    <section class="ki-card">
      <ki-routing-decisions></ki-routing-decisions>
    </section>

    <section class="ki-card">
      <ki-delegation-live
        [title]="config.delegationTitle ?? 'Delegationen — Live'"
        [subtitle]="config.delegationSubtitle ?? 'Letzte Aufrufe der Kaskade. Auto-Refresh.'"
        [autoRefreshSec]="config.delegationAutoRefreshSec ?? 5"
        [maxRows]="config.delegationMaxRows ?? 50">
      </ki-delegation-live>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      padding: 1.5rem;
    }

    .ki-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-bottom: 1.25rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.06);
    }

    .ki-card:last-child {
      margin-bottom: 0;
    }
  `],
})
export class ModelsPageComponent {
  /** Optional config bundle — all fields optional, defaults apply. */
  @Input() config: KiModelsPageConfig = {};

  // ── Supermodel-Matrix pass-throughs ────────────────────────────────
  @Input() activePool?: string;
  @Input() supermodelOn = false;
  @Input() localOrchestratorPending = false;
  @Input() supermodelDisabled = false;
  @Input() supermodelDisabledHint?: string;
  @Input() supermodelPools?: string[];
  @Input() supermodelRoles?: string[];
  @Input() supermodelLabels?: any;

  // ── Re-emitted outputs ─────────────────────────────────────────────
  @Output() modelChanged = new EventEmitter<AiModel | null>();
  @Output() activeModelChanged = new EventEmitter<AiModel>();
  @Output() modelCreated = new EventEmitter<AiModel>();
  @Output() keyChanged = new EventEmitter<string>();

  // ── ViewChild references for internal wiring ───────────────────────
  @ViewChild(ModelsTableComponent) modelsTable?: ModelsTableComponent;
  @ViewChild(CascadesViewComponent) cascadesView?: CascadesViewComponent;

  // ── Internal event handlers ────────────────────────────────────────

  onModelChanged(model: AiModel | null): void {
    this.modelChanged.emit(model);
  }

  onActiveModelChanged(model: AiModel): void {
    this.activeModelChanged.emit(model);
  }

  onModelCreated(model: AiModel): void {
    this.modelsTable?.reload();
    this.modelCreated.emit(model);
  }

  onKeyChanged(key: string): void {
    this.modelsTable?.reload();
    this.keyChanged.emit(key);
  }

  onCascadeChanged(): void {
    // no-op at page level; cascade changes are handled internally
  }

  onServersChanged(): void {
    // servers changed — table may need refresh
    this.modelsTable?.reload();
  }

  /** Public reload — host can call after pool/config changes. */
  reload(): void {
    this.modelsTable?.reload();
    this.cascadesView?.reload();
  }
}