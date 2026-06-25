import { Component, EventEmitter, Input, Output, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KiModelsApiService } from '../services/ki-models-api.service';
import { ProviderServer } from '../models/provider-server';
import { ProviderServersLabels, PROVIDER_SERVERS_LABELS_EN } from '../models/labels';
import { KiPagerComponent, paginate } from './ki-pager.component';
import { SortState, nextSort, sortGlyph, sortRows, filterRows } from './table-tools';

/**
 * v0.15.0 — Verwaltung benannter Inferenz-Server (llm-cascade ≥ 0.8.0).
 *
 * Lokale Modelle (Ollama) laufen normalerweise auf „localhost"; über benannte
 * Server kann ein Modell seine Inferenz an einen externen Rechner auslagern.
 * Diese Komponente listet die Server + erlaubt Add/Edit/Delete/Set-Default.
 * Das pro-Modell-Dropdown lebt in `<ki-models-table>` / `<ki-add-model-form>`.
 *
 * **Event:** `(serversChanged)` nach jeder Mutation — Konsument kann z.B. die
 * Models-Table neu laden lassen damit das Server-Dropdown aktuell ist.
 *
 * **Graceful degrade:** Backend < 0.8.0 liefert 404 auf `/provider-servers` →
 * leere Liste + dezenter Hinweis, kein Fehler.
 */
@Component({
  selector: 'ki-provider-servers',
  standalone: true,
  imports: [CommonModule, FormsModule, KiPagerComponent],
  template: `
    <section class="ki-provider-servers">
      <header class="ki-ps-header">
        <h4 class="ki-ps-title">{{ L.title }}</h4>
        <p class="ki-ps-subtitle">{{ L.subtitle }}</p>
      </header>

      <p *ngIf="loading()" class="ki-ps-muted">{{ L.loading }}</p>

      <div *ngIf="!loading()" class="ki-ps-table-wrap">
        <input *ngIf="servers().length > 0"
          class="ki-ps-filter" type="text" placeholder="Filtern…"
          [value]="filter()" (input)="setFilter($any($event.target).value)" />
        <table class="ki-ps-table">
          <thead>
            <tr>
              <th class="ki-ps-sortable" (click)="sortCol('name')">{{ L.colName }} <span class="ki-ps-glyph">{{ glyph('name') }}</span></th>
              <th class="ki-ps-sortable" (click)="sortCol('baseUrl')">{{ L.colBaseUrl }} <span class="ki-ps-glyph">{{ glyph('baseUrl') }}</span></th>
              <th>{{ L.colDefault }}</th>
              <th class="ki-ps-right">{{ L.colActions }}</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of pageServers()">
              <td class="ki-ps-mono"><strong>{{ s.name }}</strong>
                <div *ngIf="s.description" class="ki-ps-tiny ki-ps-muted">{{ s.description }}</div>
              </td>
              <td class="ki-ps-mono ki-ps-tiny">{{ s.baseUrl }}</td>
              <td>
                <span *ngIf="s.isDefault" class="ki-ps-badge">{{ L.badgeDefault }}</span>
              </td>
              <td class="ki-ps-right">
                <button class="ki-ps-btn" (click)="startEdit(s)">{{ L.btnEdit }}</button>
                <button *ngIf="!s.isDefault" class="ki-ps-btn" (click)="setDefault(s)">{{ L.btnSetDefault }}</button>
                <button *ngIf="!s.isDefault" class="ki-ps-btn ki-ps-danger" (click)="remove(s)">{{ L.btnDelete }}</button>
              </td>
            </tr>
            <tr *ngIf="!servers().length">
              <td colspan="4" class="ki-ps-muted ki-ps-tiny">{{ L.empty }}</td>
            </tr>
          </tbody>
        </table>

        <ki-pager
          [total]="viewServers().length"
          [page]="page()"
          [pageSize]="pageSize"
          (pageChange)="page.set($event)">
        </ki-pager>
      </div>

      <!-- Add / Edit form -->
      <form class="ki-ps-form" (ngSubmit)="save()">
        <input [(ngModel)]="formName" name="psName" [placeholder]="L.fieldName"
               [readonly]="!!editingName()" class="ki-ps-input ki-ps-mono" />
        <input [(ngModel)]="formBaseUrl" name="psBaseUrl" [placeholder]="L.fieldBaseUrl"
               class="ki-ps-input ki-ps-mono" />
        <input [(ngModel)]="formDescription" name="psDesc" [placeholder]="L.fieldDescription"
               class="ki-ps-input" />
        <div class="ki-ps-form-actions">
          <button type="submit" class="ki-ps-btn ki-ps-primary"
                  [disabled]="saving() || !formBaseUrl.trim() || (!editingName() && !formName.trim())">
            {{ editingName() ? L.btnSave : L.btnAdd }}
          </button>
          <button type="button" *ngIf="editingName()" class="ki-ps-btn" (click)="cancelEdit()">{{ L.btnCancel }}</button>
        </div>
      </form>

      <p *ngIf="error()" class="ki-ps-error">{{ error() }}</p>
      <p class="ki-ps-hint">{{ L.hint }}</p>
    </section>
  `,
  styles: [`
    .ki-provider-servers { font-family: inherit; padding: 1rem 0; }
    .ki-ps-title { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #475569; margin: 0 0 0.25rem; }
    .ki-ps-subtitle { font-size: 0.75rem; color: #64748b; margin: 0 0 0.75rem; }
    .ki-ps-table-wrap { overflow-x: auto; }
    .ki-ps-filter {
      width: 100%; box-sizing: border-box; padding: 0.4rem 0.6rem;
      margin-bottom: 0.5rem; border: 1px solid #e2e8f0; border-radius: 0.375rem;
      font-size: 0.8rem;
    }
    .ki-ps-sortable { cursor: pointer; user-select: none; white-space: nowrap; }
    .ki-ps-sortable:hover { color: #4f46e5; }
    .ki-ps-glyph { font-size: 0.6rem; opacity: 0.6; }
    .ki-ps-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    .ki-ps-table th { text-align: left; padding: 0.35rem 0.5rem; color: #64748b; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; }
    .ki-ps-table td { padding: 0.4rem 0.5rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .ki-ps-right { text-align: right; }
    .ki-ps-mono { font-family: ui-monospace, monospace; }
    .ki-ps-tiny { font-size: 0.7rem; }
    .ki-ps-muted { color: #94a3b8; }
    .ki-ps-badge { display: inline-block; padding: 0.1rem 0.35rem; border-radius: 0.25rem; background: #d1fae5; color: #065f46; font-size: 0.6rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
    .ki-ps-btn { padding: 0.25rem 0.5rem; margin-left: 0.25rem; border: 1px solid #cbd5e1; background: #fff; border-radius: 0.4rem; font-size: 0.7rem; font-weight: 700; cursor: pointer; }
    .ki-ps-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .ki-ps-primary { background: #0f172a; color: #fff; border-color: #0f172a; }
    .ki-ps-danger { color: #b91c1c; border-color: #fecaca; }
    .ki-ps-form { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; align-items: center; }
    .ki-ps-input { padding: 0.5rem; background: #f8fafc; border: 2px solid #f1f5f9; border-radius: 0.5rem; font-size: 0.8rem; flex: 1 1 12rem; }
    .ki-ps-input[readonly] { opacity: 0.6; }
    .ki-ps-form-actions { display: flex; gap: 0.25rem; }
    .ki-ps-error { color: #b91c1c; font-weight: 700; font-size: 0.75rem; margin-top: 0.5rem; }
    .ki-ps-hint { color: #94a3b8; font-size: 0.7rem; font-weight: 600; margin-top: 0.5rem; }
  `],
})
export class ProviderServersComponent {
  @Output() serversChanged = new EventEmitter<void>();

  @Input() set labels(v: Partial<ProviderServersLabels> | undefined) {
    this.L = { ...PROVIDER_SERVERS_LABELS_EN, ...(v ?? {}) };
  }
  L: ProviderServersLabels = PROVIDER_SERVERS_LABELS_EN;

  private readonly api = inject(KiModelsApiService);

  /** Seitengröße der Server-Tabelle. Pager nur sichtbar wenn mehr Zeilen. */
  @Input() pageSize = 10;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly servers = signal<ProviderServer[]>([]);
  readonly error = signal<string | null>(null);
  readonly page = signal(0);
  readonly filter = signal('');
  readonly sort = signal<SortState>({ key: null, dir: null });
  readonly viewServers = computed(() =>
    sortRows(filterRows(this.servers(), this.filter(), ['name', 'baseUrl', 'description']), this.sort()),
  );
  readonly pageServers = computed(() => paginate(this.viewServers(), this.page(), this.pageSize));
  /** Name des aktuell editierten Servers; null = Add-Modus. */
  readonly editingName = signal<string | null>(null);

  glyph(key: string): string { return sortGlyph(this.sort(), key); }
  sortCol(key: string): void { this.sort.set(nextSort(this.sort(), key)); this.page.set(0); }
  setFilter(v: string): void { this.filter.set(v); this.page.set(0); }

  formName = '';
  formBaseUrl = '';
  formDescription = '';

  private static readonly NAME_RE = /^[a-z0-9_-]{1,50}$/;

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.page.set(0);
    this.api.listProviderServers().subscribe({
      next: (list) => { this.servers.set(list ?? []); this.loading.set(false); },
      error: () => { this.servers.set([]); this.loading.set(false); },
    });
  }

  startEdit(s: ProviderServer): void {
    this.editingName.set(s.name);
    this.formName = s.name;
    this.formBaseUrl = s.baseUrl;
    this.formDescription = s.description ?? '';
    this.error.set(null);
  }

  cancelEdit(): void {
    this.editingName.set(null);
    this.formName = '';
    this.formBaseUrl = '';
    this.formDescription = '';
    this.error.set(null);
  }

  save(): void {
    const name = (this.editingName() ?? this.formName).trim().toLowerCase();
    const baseUrl = this.formBaseUrl.trim();
    if (!baseUrl) { this.error.set(this.L.errorBaseUrlRequired); return; }
    if (!ProviderServersComponent.NAME_RE.test(name)) { this.error.set(this.L.errorNameFormat); return; }
    this.saving.set(true);
    this.error.set(null);
    this.api.upsertProviderServer(name, {
      baseUrl,
      description: this.formDescription.trim() || null,
    }).subscribe({
      next: () => { this.saving.set(false); this.cancelEdit(); this.reload(); this.serversChanged.emit(); },
      error: (err) => { this.saving.set(false); this.error.set(err?.error?.error ?? 'Error'); },
    });
  }

  setDefault(s: ProviderServer): void {
    this.api.upsertProviderServer(s.name, { baseUrl: s.baseUrl, isDefault: true }).subscribe({
      next: () => { this.reload(); this.serversChanged.emit(); },
      error: (err) => this.error.set(err?.error?.error ?? 'Error'),
    });
  }

  remove(s: ProviderServer): void {
    if (s.isDefault) { this.error.set(this.L.errorDeleteDefault); return; }
    if (!confirm(this.L.confirmDelete(s.name))) return;
    this.api.deleteProviderServer(s.name).subscribe({
      next: () => { this.reload(); this.serversChanged.emit(); },
      error: (err) => this.error.set(err?.error?.error ?? this.L.errorDeleteDefault),
    });
  }
}
