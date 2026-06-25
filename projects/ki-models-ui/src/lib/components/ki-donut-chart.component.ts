import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

const KI_PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9',
  '#a855f7', '#14b8a6', '#f97316', '#ec4899', '#84cc16',
];

/**
 * v0.18.0 — Dependency-freier Donut-Chart (reines SVG, portiert aus EduPro).
 * Animiertes Grow-in, Hover-Segmente, Center-Total, klickbare Legende mit
 * Anzahl + Prozent. Keine npm-Dependency, keine Tailwind-Klassen.
 *
 * Eingabe: `data` als `{key,label?,count,color?}[]`. Zeigt max. 8 Segmente.
 * Speist das Failover-out/Provider-Donut in `<ki-failover-analytics>`.
 */
@Component({
  selector: 'ki-donut-chart',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; }
    .ki-donut { display: flex; align-items: center; gap: 1.5rem; color: #334155; }
    .ki-donut-svg-wrap { width: 11rem; height: 11rem; flex-shrink: 0; }
    .donut-seg { transition: stroke-width .2s, opacity .2s; cursor: pointer; }
    .donut-seg:hover { stroke-width: 17; }
    .donut-grp { animation: kiDonutIn .9s cubic-bezier(.4, 0, .2, 1) both; }
    @keyframes kiDonutIn { from { opacity: 0; } to { opacity: 1; } }
    .ki-donut-legend { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.25rem; }
    .legend-row {
      display: flex; align-items: center; gap: 0.6rem; font-size: 0.75rem;
      padding: 0.2rem 0.4rem; border-radius: 0.25rem; transition: background .15s;
    }
    .legend-row:hover { background: rgba(148,163,184,.12); }
    .legend-swatch { width: 0.75rem; height: 0.75rem; border-radius: 0.2rem; flex-shrink: 0; }
    .legend-key {
      font-weight: 700; text-transform: uppercase; letter-spacing: -0.01em;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .legend-count { margin-left: auto; font-weight: 900; font-variant-numeric: tabular-nums; }
    .legend-pct {
      color: #94a3b8; font-variant-numeric: tabular-nums; width: 2.6rem;
      text-align: right; font-size: 0.65rem;
    }
    .ki-donut-empty { color: #94a3b8; font-size: 0.8rem; padding: 1.5rem 0; }
    svg { width: 100%; height: 100%; }
  `],
  template: `
    <div *ngIf="segments.length === 0" class="ki-donut-empty">Keine Daten.</div>

    <div *ngIf="segments.length > 0" class="ki-donut">
      <div class="ki-donut-svg-wrap">
        <svg viewBox="0 0 100 100">
          <defs>
            <filter [attr.id]="glowId" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.2"/>
              <feOffset dy="1.5"/>
              <feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
              <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-opacity="0.06" stroke-width="14" />

          <g class="donut-grp" transform="rotate(-90 50 50)" [attr.filter]="'url(#' + glowId + ')'">
            <circle *ngFor="let s of segments" class="donut-seg"
                    cx="50" cy="50" r="38" fill="none"
                    [attr.stroke]="s.color"
                    stroke-width="14"
                    [attr.stroke-dasharray]="s.dash"
                    [attr.stroke-dashoffset]="s.offset"
                    stroke-linecap="butt">
              <title>{{ s.label }}: {{ s.count }} ({{ s.pct }}%)</title>
            </circle>
          </g>

          <text x="50" y="47" text-anchor="middle" font-size="13" font-weight="900"
                fill="currentColor" style="font-family: inherit;">{{ total }}</text>
          <text x="50" y="60" text-anchor="middle" font-size="5.5" font-weight="700"
                fill="currentColor" fill-opacity="0.45" letter-spacing="1.5"
                style="font-family: monospace;">{{ centerLabel }}</text>
        </svg>
      </div>

      <div class="ki-donut-legend">
        <div *ngFor="let s of segments" class="legend-row">
          <span class="legend-swatch" [style.background]="s.color"></span>
          <span class="legend-key">{{ s.label }}</span>
          <span class="legend-count">{{ s.count }}</span>
          <span class="legend-pct">{{ s.pct }}%</span>
        </div>
      </div>
    </div>
  `,
})
export class KiDonutChartComponent {
  @Input() data: { key: string; label?: string; count: number; color?: string }[] = [];
  @Input() centerLabel = 'TOTAL';
  private readonly C = 2 * Math.PI * 38;
  readonly glowId = 'kidg_' + Math.random().toString(36).slice(2, 9);

  get total(): number {
    return (this.data || []).reduce((s, d) => s + (d.count || 0), 0);
  }

  get segments(): { key: string; label: string; count: number; pct: number; color: string; dash: string; offset: number }[] {
    const total = this.total;
    if (total === 0) return [];
    let acc = 0;
    return (this.data || []).slice(0, 8).map((d, i) => {
      const frac = d.count / total;
      const len = frac * this.C;
      const seg = {
        key: d.key,
        label: d.label || d.key,
        count: d.count,
        pct: Math.round(frac * 100),
        color: d.color || KI_PALETTE[i % KI_PALETTE.length],
        dash: `${len} ${this.C - len}`,
        offset: -acc,
      };
      acc += len;
      return seg;
    });
  }
}
