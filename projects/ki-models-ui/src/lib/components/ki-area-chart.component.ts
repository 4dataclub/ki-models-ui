import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * v0.18.0 — Dependency-freier Area-Chart (reines SVG, portiert aus EduPro).
 * Smooth-Bézier-Linie, Gradient-Fill, Drop-Shadow, Hover-Punkte. Keine
 * npm-Dependency, keine Tailwind-Klassen (inline Styles).
 *
 * Eingabe: `series` als `{date,value}[]` (chronologisch). X-Labels zeigen
 * `MM-DD` (ISO-Datum ab Position 5). Speist den Erfolgs-Trend in
 * `<ki-call-overview>`.
 */
@Component({
  selector: 'ki-area-chart',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; }
    .ki-ac-wrap { width: 100%; color: #6366f1; }
    .area-line { transition: filter .2s; }
    .area-line:hover { filter: drop-shadow(0 2px 6px rgba(99,102,241,.4)); }
    .area-pt { transition: r .15s, opacity .15s; cursor: crosshair; }
    .area-pt:hover { r: 6; }
    .area-area { animation: kiAreaIn .8s ease-out both; }
    @keyframes kiAreaIn { from { opacity: 0; } to { opacity: 1; } }
    svg { width: 100%; height: auto; display: block; }
  `],
  template: `
    <div class="ki-ac-wrap">
      <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="none">
        <defs>
          <linearGradient [attr.id]="gradId" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" [attr.stop-color]="color" stop-opacity="0.55"></stop>
            <stop offset="55%" [attr.stop-color]="color" stop-opacity="0.18"></stop>
            <stop offset="100%" [attr.stop-color]="color" stop-opacity="0.01"></stop>
          </linearGradient>
          <filter [attr.id]="shadowId" x="-20%" y="-20%" width="140%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
            <feOffset dy="2"/>
            <feComponentTransfer><feFuncA type="linear" slope="0.25"/></feComponentTransfer>
            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <g *ngFor="let g of yTicks">
          <line [attr.x1]="padX" [attr.x2]="width - padX"
                [attr.y1]="g.y" [attr.y2]="g.y"
                stroke="currentColor" stroke-opacity="0.06" stroke-dasharray="3 5" />
          <text [attr.x]="padX - 2" [attr.y]="g.y + 3" text-anchor="end"
                fill="currentColor" fill-opacity="0.4"
                font-size="8" font-weight="700" style="font-family: monospace;">{{ g.value }}</text>
        </g>

        <path *ngIf="points.length > 0" class="area-area"
              [attr.d]="areaPath" [attr.fill]="'url(#' + gradId + ')'" />
        <path *ngIf="points.length > 0" class="area-line"
              [attr.d]="linePath" fill="none" [attr.stroke]="color"
              stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />

        <g *ngFor="let pt of points; let i = index">
          <circle class="area-pt" [attr.cx]="pt.x" [attr.cy]="pt.y" r="3.5"
                  [attr.fill]="color" stroke="white" stroke-width="1.5"
                  [attr.filter]="'url(#' + shadowId + ')'">
            <title>{{ pt.label }}: {{ pt.value }}</title>
          </circle>
          <text *ngIf="i % labelStep === 0 || pt.value === maxValue"
                [attr.x]="pt.x" [attr.y]="pt.y - 8"
                text-anchor="middle"
                [attr.fill]="color" font-size="10.5" font-weight="900"
                style="font-family: inherit; pointer-events: none;">{{ pt.value }}</text>
        </g>

        <text *ngFor="let pt of points; let i = index"
              [attr.x]="pt.x" [attr.y]="height - 4"
              text-anchor="middle"
              [attr.opacity]="i % labelStep === 0 ? 0.55 : 0"
              fill="currentColor"
              font-size="9" font-weight="700"
              style="font-family: monospace;">{{ pt.shortLabel }}</text>
      </svg>
    </div>
  `,
})
export class KiAreaChartComponent {
  @Input() series: { date: string; value: number }[] = [];
  @Input() color = '#6366f1';
  @Input() width = 600;
  @Input() height = 180;
  padX = 32;
  padY = 14;
  readonly gradId = 'kig_' + Math.random().toString(36).slice(2, 9);
  readonly shadowId = 'kis_' + Math.random().toString(36).slice(2, 9);

  get maxValue(): number {
    if (!this.series?.length) return 0;
    return Math.max(0, ...this.series.map(d => d.value || 0));
  }

  get yTicks(): { y: number; value: number }[] {
    const max = Math.max(1, this.maxValue);
    const innerH = this.height - 2 * this.padY - 14;
    return [0.25, 0.5, 0.75, 1].map(frac => ({
      y: this.padY + innerH - innerH * frac,
      value: Math.round(max * frac),
    }));
  }

  get points(): { x: number; y: number; value: number; label: string; shortLabel: string }[] {
    if (!this.series?.length) return [];
    const max = Math.max(1, ...this.series.map(d => d.value || 0));
    const innerW = this.width - 2 * this.padX;
    const innerH = this.height - 2 * this.padY - 14;
    return this.series.map((d, i) => {
      const x = this.padX + (this.series.length === 1 ? innerW / 2 : (i / (this.series.length - 1)) * innerW);
      const y = this.padY + innerH - (d.value / max) * innerH;
      const short = (d.date || '').slice(5);
      return { x, y, value: d.value, label: d.date, shortLabel: short };
    });
  }

  get labelStep(): number {
    const n = this.series.length;
    if (n <= 7) return 1;
    if (n <= 14) return 2;
    if (n <= 21) return 3;
    return Math.ceil(n / 8);
  }

  get linePath(): string {
    const pts = this.points;
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const cx = (prev.x + cur.x) / 2;
      d += ` C ${cx} ${prev.y}, ${cx} ${cur.y}, ${cur.x} ${cur.y}`;
    }
    return d;
  }

  get areaPath(): string {
    const line = this.linePath;
    if (!line) return '';
    const pts = this.points;
    const baseY = this.height - this.padY - 14;
    return `${line} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`;
  }
}