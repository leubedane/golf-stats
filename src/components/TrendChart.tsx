import { useEffect, useRef, useState } from 'react';

export interface TrendPoint {
  key: string;
  value: number;
  /** Shown in the tooltip line, e.g. date and course. */
  label: string;
}

interface Props {
  points: TrendPoint[];
  format: (v: number) => string;
  ariaLabel: string;
  height?: number;
}

/** Single-series line chart around a zero baseline, with tap/hover detail. */
export function TrendChart({ points, format, ariaLabel, height = 170 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pad = { top: 14, right: 52, bottom: 14, left: 20 };
  const values = points.map((p) => p.value);
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = Math.max(hi - lo, 1);
  const yMin = lo - span * 0.1;
  const yMax = hi + span * 0.1;
  const innerW = Math.max(width - pad.left - pad.right, 10);
  const innerH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.top + ((yMax - v) / (yMax - yMin)) * innerH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points.length - 1;
  const shown = active ?? last;
  const step = points.length > 1 ? innerW / (points.length - 1) : innerW;

  return (
    <figure className="trend" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        <line className="trend-zero" x1={pad.left} x2={pad.left + innerW} y1={y(0)} y2={y(0)} />
        <text className="trend-axis" x={pad.left - 6} y={y(0) + 4} textAnchor="end">0</text>
        {active !== null && <line className="trend-cross" x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + innerH} />}
        {points.length > 1 && <path className="trend-line" d={path} />}
        {points.map((p, i) => (
          <circle key={p.key} className={`trend-dot ${i === shown ? 'active' : ''}`} cx={x(i)} cy={y(p.value)} r={i === shown ? 5 : 4} />
        ))}
        {points.length > 0 && (
          <text className="trend-label" x={x(last) + 8} y={y(points[last].value) + 4}>
            {format(points[last].value)}
          </text>
        )}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.key}`}
            x={x(i) - step / 2}
            y={0}
            width={step}
            height={height}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onClick={() => setActive(active === i ? null : i)}
          >
            <title>{`${p.label}: ${format(p.value)}`}</title>
          </rect>
        ))}
      </svg>
      <figcaption className="muted trend-caption">
        {points[shown] ? `${points[shown].label}: ${format(points[shown].value)}` : ' '}
      </figcaption>
    </figure>
  );
}
