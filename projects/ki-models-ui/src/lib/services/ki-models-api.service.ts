import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { KI_MODELS_API_BASE } from './ki-models-api.token';
import { AiModel, AiModelCreate, AiModelUpdate } from '../models/ai-model';
import { ApiKeySetting, ApiKeySettingUpdate } from '../models/api-key-setting';
import { CascadeConfig, CascadeConfigUpdate } from '../models/cascade-config';
import { Cascade } from '../models/cascade';
import { Category, CategoryUpdate } from '../models/category';
import { RoutingCache, RoutingTestResult } from '../models/routing';
import { QualityStatRow } from '../models/quality';

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

  /**
   * `skipped: true` zeigt an, dass das Konsument-Backend den Test bewusst
   * übersprungen hat (z.B. Switcher beim Anthropic-Modell ohne API-Key, weil
   * Max-OAuth den Live-Switch erlaubt aber kein API-Test möglich ist). Die
   * Tabelle deaktiviert das Modell in dem Fall NICHT auto.
   */
  testModel(id: number): Observable<{ ok: boolean; latencyMs?: number; error?: string; skipped?: boolean }> {
    return this.http.post<{ ok: boolean; latencyMs?: number; error?: string; skipped?: boolean }>(
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

  /**
   * Listet alle API-Key-Settings.
   *
   * Akzeptiert zwei Backend-Response-Shapes:
   * - **Array** (`ApiKeySetting[]`) — was die Library als Vertrag definiert
   *   (Switcher liefert das direkt unter `/cascade-settings`).
   * - **Object mit `settings`-Map** — was EduPros bestehender Endpoint
   *   `/admin/api-keys` liefert (`{settings: {key: {keyMasked, keySource, …}}}`).
   *
   * Bei Object-Form werden die Entries in das Array-Format gemapped, damit
   * die Components homogen mit `ApiKeySetting`-Items arbeiten. Pro Konsument
   * brauchen wir so keinen eigenen Adapter — die Library normalisiert selbst.
   */
  listKeys(): Observable<ApiKeySetting[]> {
    return this.http.get<any>(`${this.base}/api-keys`).pipe(
      map((resp): ApiKeySetting[] => {
        if (Array.isArray(resp)) return resp;
        // EduPro-Shape: { settings: { <key>: { keyMasked, keySource, keyConfigured, envVar, isDefault } } }
        if (resp && typeof resp === 'object' && resp.settings && typeof resp.settings === 'object') {
          return Object.entries(resp.settings).map(([settingKey, v]: [string, any]) => ({
            settingKey,
            valueMasked: v?.keyMasked ?? '',
            configured: !!v?.keyConfigured,
            keySource: v?.keySource ?? null,
            envVar: v?.envVar ?? null,
            isDefault: !!v?.isDefault,
          }));
        }
        return [];
      }),
    );
  }

  setKey(settingKey: string, body: ApiKeySettingUpdate): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      `${this.base}/api-keys/setting/${encodeURIComponent(settingKey)}`,
      body,
    );
  }

  // ─── Cascades (Phase S' — Bereiche mit eigener Failover-Chain + Cooldown) ──

  /**
   * Liefert alle Cascade-Bereiche der Konsumenten-DB.
   *
   * **Vertrag**: Backend exponiert `GET {base}/cascades` → `Cascade[]`.
   * Frontend (z.B. `<ki-cascades-view>`) rendert eine Karte pro Eintrag.
   *
   * Fallback: liefert das Backend `[]` zurueck oder ist Endpoint nicht
   * verfuegbar, gibt der Wrapper-Component einen leeren Zustand — der
   * Konsument kann optional die alten 3 Default-Categories als Fallback
   * rendern.
   */
  listCascades(): Observable<Cascade[]> {
    return this.http.get<Cascade[]>(`${this.base}/cascades`);
  }

  /** Detail einer einzelnen Cascade. Selten direkt gebraucht; meistens reicht {@link #listCascades}. */
  getCascade(name: string): Observable<Cascade> {
    return this.http.get<Cascade>(`${this.base}/cascades/${encodeURIComponent(name)}`);
  }

  // ─── Categories (Display-Metadaten pro Kategorie — v0.10.0) ─────────────

  /**
   * Liste aller Kategorien (Display-Metadaten). Backend vereint implizite
   * Kategorien aus `ai_model_config.category` mit persistierten
   * `category_meta`-Einträgen — Felder ohne gesetzte Metadaten kommen mit
   * `null` zurück. Wenn der Endpoint nicht existiert (Backward-Compat zu
   * llm-cascade < 0.5), liefert der Konsument `404`; das Frontend muss
   * dann selbst auf leeren Default zurückfallen.
   */
  listCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.base}/categories`);
  }

  /**
   * Upsert für die Display-Metadaten einer Kategorie. Wird vom Inline-Edit
   * der Cascades-View aufgerufen. Partial-Update: Felder die nicht im Body
   * stehen werden NICHT angefasst; `null` löscht das Feld explizit.
   */
  updateCategory(name: string, body: CategoryUpdate): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(
      `${this.base}/categories/${encodeURIComponent(name)}`,
      body,
    );
  }

  /**
   * Löscht NUR die Metadaten-Zeile — die Kategorie selbst lebt weiter,
   * solange ein Modell sie nutzt. Nach Delete bekommt sie wieder die
   * UI-Fallbacks (capitalized name, leerer Hint).
   */
  deleteCategoryMeta(name: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(
      `${this.base}/categories/${encodeURIComponent(name)}`,
    );
  }

  // ─── Cascade-Config ──────────────────────────────────────────────────────

  getCascadeConfig(): Observable<CascadeConfig> {
    return this.http.get<CascadeConfig>(`${this.base}/cascade-config`);
  }

  setCascadeConfig(body: CascadeConfigUpdate): Observable<CascadeConfig> {
    return this.http.put<CascadeConfig>(`${this.base}/cascade-config`, body);
  }

  // ─── Semantic Routing (Phase v0.11.0 — llm-cascade ≥ 0.6.0) ──────────────

  /**
   * Snapshot des Routing-Caches mit Counter-Stats. Wird vom
   * `<ki-routing-decisions>`-Component periodisch geladen damit der User
   * sieht welche purpose-Strings auf welche Kategorie geroutet wurden.
   */
  getRoutingCache(): Observable<RoutingCache> {
    return this.http.get<RoutingCache>(`${this.base}/routing/cache`);
  }

  /** Kompletter Cache leeren — User-Aktion im UI. */
  clearRoutingCache(): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/routing/cache`);
  }

  /** Einzelnen Cache-Eintrag (per purposeHash) entfernen. */
  clearRoutingCacheEntry(purposeHash: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(
      `${this.base}/routing/cache/${encodeURIComponent(purposeHash)}`,
    );
  }

  /**
   * Test-Modus: einen purpose probe-routen ohne den eigentlichen Generate-
   * Call durchzufuehren. Cached das Ergebnis trotzdem (sodass der naechste
   * echte Call den gleichen Pfad nimmt). Praktisch um zu sehen welche
   * Kategorie der Router fuer eine bestimmte Task-Beschreibung waehlen
   * wuerde, bevor man's live ausrollt.
   */
  testRouting(purpose: string): Observable<RoutingTestResult> {
    return this.http.post<RoutingTestResult>(
      `${this.base}/routing/test`,
      { purpose },
    );
  }

  // ─── Quality-Stats (v0.7.1 — llm-cascade ≥ 0.7.2) ────────────────────────

  /**
   * Liefert Quality-Bewertung pro Modell aus den letzten 30 Tagen.
   * Default-Sortierung „worst-first": KILL-Kandidaten und schlechte Modelle
   * stehen oben, damit Admin Probleme sofort sieht.
   *
   * @param sortBy 'worst-first' (Default) | 'best-first' | 'calls-desc'
   */
  getQualityStats(sortBy: 'worst-first' | 'best-first' | 'calls-desc' = 'worst-first'): Observable<QualityStatRow[]> {
    return this.http.get<QualityStatRow[]>(`${this.base}/stats/quality?sortBy=${sortBy}`);
  }
}
