/*
 * Public API Surface of @dataclub/ki-models-ui
 *
 * Konsumenten importieren Components + Service + InjectionToken hier von:
 *   import { ModelsTableComponent, KI_MODELS_API_BASE } from '@dataclub/ki-models-ui';
 *
 * Module-Wrapper (für nicht-standalone-Apps) wird in Phase L.2 hinzugefügt.
 */

// ─── Models / Interfaces ─────────────────────────────────────────────────
export * from './lib/models/ai-model';
export * from './lib/models/api-key-setting';
export * from './lib/models/cascade-config';
export * from './lib/models/cascade';
export * from './lib/models/category';
export * from './lib/models/routing';
export * from './lib/models/quality';
export * from './lib/models/performance';
export * from './lib/models/cooldown';
export * from './lib/models/provider-server';
export * from './lib/models/labels';
export * from './lib/models/app-setting';
export * from './lib/models/delegation-call';
export * from './lib/models/stats-trend';
export * from './lib/models/stats-totals';
export * from './lib/models/stats-failover';
export * from './lib/models/log-snippet';

// ─── Service + InjectionToken ────────────────────────────────────────────
export * from './lib/services/ki-models-api.service';
export * from './lib/services/ki-models-api.token';

// ─── Components (standalone) ─────────────────────────────────────────────
export * from './lib/components/models-table.component';
export * from './lib/components/add-model-form.component';
export * from './lib/components/cascade-cooldown.component';
export * from './lib/components/api-keys-section.component';
export * from './lib/components/failover-chain.component';
export * from './lib/components/cascades-view.component';
export * from './lib/components/routing-decisions.component';
export * from './lib/components/models-quality-stats.component';
export * from './lib/components/cascade-mode-panel.component';
export * from './lib/components/models-performance.component';
export * from './lib/components/models-cooldown-state.component';
export * from './lib/components/provider-servers.component';
export * from './lib/components/privacy-settings.component';
export * from './lib/components/supermodel-matrix.component';
export * from './lib/components/delegation-live.component';
export * from './lib/components/ki-pager.component';
export * from './lib/components/ki-area-chart.component';
export * from './lib/components/ki-donut-chart.component';
export * from './lib/components/call-overview.component';
export * from './lib/components/failover-analytics.component';
export * from './lib/components/log-snippets.component';
export * from './lib/components/mode-events.component';
export * from './lib/components/models-page.component';
