import { InjectionToken } from '@angular/core';

/**
 * Base-URL für die KI-Modell-Admin-API.
 *
 * Konsumenten konfigurieren das per `providers`:
 * ```ts
 * { provide: KI_MODELS_API_BASE, useValue: '/api/admin' }   // EduPro
 * { provide: KI_MODELS_API_BASE, useValue: '/api' }         // Switcher
 * ```
 *
 * Die Library hängt an die Base relative Pfade: `/ai-models`, `/api-keys`,
 * `/cascade-config`. Konsumenten müssen sicherstellen dass die Endpoints
 * dem in [`api-contract.md`](../../examples/api-contract.md) dokumentierten
 * Vertrag entsprechen.
 */
export const KI_MODELS_API_BASE = new InjectionToken<string>('KI_MODELS_API_BASE');
