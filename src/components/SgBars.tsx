import { useState } from 'react';

export interface SgBar {
  key: string;
  label: string;
  value: number;
  /** Extra detail shown when the bar is tapped or hovered. */
  detail?: string;
  emphasis?: boolean;
}

export const formatSg = (sg: number): string => {
  const r = Math.round(sg * 100) / 100;
  return r > 0 ? `+${r.toFixed(2)}` : r === 0 ? '0.00' : `−${Math.abs(r).toFixed(2)}`;
};

/** Horizontal diverging bars around zero: gained to the right, lost to the left. */
export function SgBars({ bars, ariaLabel, total }: { bars: SgBar[]; ariaLabel: string; total?: SgBar }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(0.5, ...bars.map((b) => Math.abs(b.value)));
  const activeBar = bars.find((b) => b.key === active);

  return (
    <figure className="sg-bars" aria-label={ariaLabel}>
      {bars.map((b) => {
        const pct = (Math.abs(b.value) / max) * 50;
        return (
          <button
            key={b.key}
            type="button"
            className={`sg-bar-row ${b.emphasis ? 'emphasis' : ''} ${active === b.key ? 'active' : ''}`}
            onClick={() => setActive(active === b.key ? null : b.key)}
            onMouseEnter={() => setActive(b.key)}
            onMouseLeave={() => setActive(null)}
            aria-label={`${b.label}: ${formatSg(b.value)}${b.detail ? `, ${b.detail}` : ''}`}
          >
            <span className="sg-bar-label">{b.label}</span>
            <span className="sg-bar-track">
              <span className="sg-bar-zero" />
              <span
                className={`sg-bar-fill ${b.value >= 0 ? 'gained' : 'lost'}`}
                style={b.value >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
              />
            </span>
            <span className="sg-bar-value">{formatSg(b.value)}</span>
          </button>
        );
      })}
      {total && (
        <div className="sg-bar-row emphasis" aria-label={`${total.label}: ${formatSg(total.value)}`}>
          <span className="sg-bar-label">{total.label}</span>
          <span />
          <span className="sg-bar-value">{formatSg(total.value)}</span>
        </div>
      )}
      <figcaption className="sg-bar-detail muted">{activeBar?.detail ?? ' '}</figcaption>
    </figure>
  );
}
