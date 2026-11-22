import { useMemo, useState } from 'react';
import { holeMap, type MapPoint, type MapView } from '../domain/courseMap';
import type { CourseMap } from '../domain/types';
import type { Translate } from '../i18n/i18n';

const path = (pts: MapPoint[], closed: boolean) =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('') + (closed ? 'Z' : '');

interface DrawingProps {
  view: MapView;
  t: Translate;
  label: string;
  onLineClick?: (osmId: number) => void;
}

/** Draws a Hole Map or Course overview as SVG, with the OpenStreetMap credit below. */
export function MapDrawing({ view, t, label, onLineClick }: DrawingProps) {
  const { x, y, width, height } = view.viewBox;
  const labelSize = Math.max(width, height) / 30;
  return (
    <figure className="map-figure">
      <svg viewBox={`${x} ${y} ${width} ${height}`} role="img" aria-label={label} className="map-drawing">
        <rect x={x} y={y} width={width} height={height} className="map-rough" />
        {view.shapes.map((s) =>
          s.kind === 'pin' ? (
            <circle key={s.osmId} cx={s.points[0].x} cy={s.points[0].y} r={1.5} className={`map-pin${s.faded ? ' faded' : ''}`} />
          ) : (
            <path key={s.osmId} d={path(s.points, true)} className={`map-${s.kind}${s.faded ? ' faded' : ''}`} />
          ),
        )}
        {view.lines.map((l) => (
          <g key={l.osmId} onClick={onLineClick && (() => onLineClick(l.osmId))} className={onLineClick ? 'clickable' : undefined}>
            {onLineClick && <path d={path(l.points, false)} className="map-line-hit" />}
            <path d={path(l.points, l.area)} className={`map-line${l.area ? ' area' : ''}${l.highlighted ? ' highlighted' : ''}`} />
            {l.label && (
              <text x={l.points[0].x} y={l.points[0].y} fontSize={labelSize} className="map-label">
                {l.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      <figcaption className="muted">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          {t('map.credit')}
        </a>
      </figcaption>
    </figure>
  );
}

const OPEN_KEY = 'golfstat.holeMapOpen';

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

interface CardProps {
  /** Undefined while loading, null when the Course has no Course Map. */
  courseMap: CourseMap | null | undefined;
  holeNumber: number;
  t: Translate;
  /** Remember open/closed across holes and visits (Round page). */
  rememberOpen?: boolean;
}

/** A collapsible Hole Map; renders nothing for a Course without a Course Map. */
export function HoleMapCard({ courseMap, holeNumber, t, rememberOpen }: CardProps) {
  const [open, setOpen] = useState(() => (rememberOpen ? readOpen() : false));
  const view = useMemo(() => (courseMap ? holeMap(courseMap, holeNumber) : null), [courseMap, holeNumber]);
  if (!courseMap) return null;
  return (
    <details
      className="card hole-map"
      open={open}
      onToggle={(e) => {
        const next = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(next);
        if (rememberOpen)
          try {
            localStorage.setItem(OPEN_KEY, next ? '1' : '0');
          } catch {
            // Storage unavailable (private mode): the card just forgets.
          }
      }}
    >
      <summary>{t('map.holeMap')}</summary>
      {open &&
        (view ? (
          <MapDrawing view={view} t={t} label={`${t('map.holeMap')} ${holeNumber}`} />
        ) : (
          <p className="muted">{t('map.noHoleLine')}</p>
        ))}
    </details>
  );
}
