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
