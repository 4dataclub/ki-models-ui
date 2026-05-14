import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { KI_MODELS_API_BASE } from './ki-models-api.token';
import { AiModel, AiModelCreate, AiModelUpdate } from '../models/ai-model';
import { ApiKeySetting, ApiKeySettingUpdate } from '../models/api-key-setting';
import { CascadeConfig, CascadeConfigUpdate } from '../models/cascade-config';

/**
 * Library-API-Service. Spricht alle KI-Modell-/API-Key-/Cascade-Endpoints
 * gegen die vom Konsumenten konfigurierte Base-URL (siehe `KI_MODELS_API_BASE`).
 *
 * **Vertrag:** Konsumentenseitige Endpoints müssen folgenden Pfaden entsprechen:
 *
 * ```
 * GET    {base}/ai-models                   → AiModel[]
 * POST   {base}/ai-models                   → AiModel
 * PUT    {base}/ai-models/{id}              → AiModel
 * DELETE {base}/ai-models/{id}              → { ok: true }
 * POST   {base}/ai-models/{id}/test         → { ok, latencyMs, error? }
 * POST   {base}/ai-models/reorder           → { ok: true }                body: { orderedIds }
 * POST   {base}/ai-models/{id}/toggle       → { id, ok, enabled }         body: { enabled }
 * GET    {base}/api-keys                    → ApiKeySetting[]
 * POST   {base}/api-keys/setting/{key}      → { ok: true }                body: { value }
 * GET    {base}/cascade-config              → CascadeConfig
 * PUT    {base}/cascade-config              → CascadeConfig
 * ```
 *
 * Backend-API-Drift zwischen EduPro und Switcher: jeder Konsument kann diesen
 * Service per Inheritance/Wrapper überschreiben oder via Subclass-Provider
 * austauschen, falls nötig.
 */
@Injectable({ providedIn: 'root' })
export class KiModelsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(KI_MODELS_API_BASE);

  // ─── Models ──────────────────────────────────────────────────────────────

  listModels(): Observable<AiModel[]> {
    return this.http.get<AiModel[]>(`${this.base}/ai-models`);
  }

  createModel(body: AiModelCreate): Observable<AiModel> {
    return this.http.post<AiModel>(`${this.base}/ai-models`, body);
  }

  updateModel(id: number, body: AiModelUpdate): Observable<AiModel> {
    return this.http.put<AiModel>(`${this.base}/ai-models/${id}`, body);
  }

  deleteModel(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/ai-models/${id}`);
  }

  testModel(id: number): Observable<{ ok: boolean; latencyMs?: number; error?: string }> {
    return this.http.post<{ ok: boolean; latencyMs?: number; error?: string }>(
      `${this.base}/ai-models/${id}/test`,
      {},
    );
  }

  reorderModels(orderedIds: number[]): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/ai-models/reorder`, { orderedIds });
  }

  toggleModel(id: number, enabled: boolean): Observable<{ id: number; ok: boolean; enabled: boolean }> {
    return this.http.post<{ id: number; ok: boolean; enabled: boolean }>(
      `${this.base}/ai-models/${id}/toggle`,
      { enabled },
    );
  }

  // ─── API-Keys ────────────────────────────────────────────────────────────

  listKeys(): Observable<ApiKeySetting[]> {
    return this.http.get<ApiKeySetting[]>(`${this.base}/api-keys`);
  }

  setKey(settingKey: string, body: ApiKeySettingUpdate): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      `${this.base}/api-keys/setting/${encodeURIComponent(settingKey)}`,
      body,
    );
  }

  // ─── Cascade-Config ──────────────────────────────────────────────────────

  getCascadeConfig(): Observable<CascadeConfig> {
    return this.http.get<CascadeConfig>(`${this.base}/cascade-config`);
  }

  setCascadeConfig(body: CascadeConfigUpdate): Observable<CascadeConfig> {
    return this.http.put<CascadeConfig>(`${this.base}/cascade-config`, body);
  }
}
