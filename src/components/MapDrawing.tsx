import { useMemo, useState, type ReactNode, type Ref, type SVGProps } from 'react';
import { defaultPinPosition, shotTraces } from '../domain/ballPosition';
import { holeMap, type HoleFrame, type MapPoint, type MapView } from '../domain/courseMap';
import type { CourseMap, LatLon, RoundHole } from '../domain/types';
import type { Translate } from '../i18n/i18n';

const path = (pts: MapPoint[], closed: boolean) =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('') + (closed ? 'Z' : '');

interface DrawingProps {
  view: MapView;
  t: Translate;
  label: string;
  onLineClick?: (osmId: number) => void;
  /** Shows another part of the drawing than the view's own frame (panning and zooming). */
  viewBox?: MapView['viewBox'];
  svgRef?: Ref<SVGSVGElement>;
  svgProps?: SVGProps<SVGSVGElement>;
  className?: string;
  /** Leaves out the Course Map's pins, where the Round's Pin Position is drawn instead. */
  hidePins?: boolean;
  /** Drawn on top of the map, in the same coordinates. */
  children?: ReactNode;
}

/** Draws a Hole Map or Course overview as SVG, with the OpenStreetMap credit below. */
export function MapDrawing({ view, t, label, onLineClick, viewBox, svgRef, svgProps, className, hidePins, children }: DrawingProps) {
  const { x, y, width, height } = viewBox ?? view.viewBox;
  const shapes = hidePins ? view.shapes.filter((s) => s.kind !== 'pin') : view.shapes;
  const labelSize = Math.max(width, height) / 30;
  return (
    <figure className={`map-figure${className ? ` ${className}` : ''}`}>
      <svg
        ref={svgRef}
        viewBox={`${x} ${y} ${width} ${height}`}
        role="img"
        aria-label={label}
        className="map-drawing"
        {...svgProps}
      >
        <rect x={x} y={y} width={width} height={height} className="map-rough" />
        {shapes.map((s) =>
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
        {children}
      </svg>
      <figcaption className="muted">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          {t('map.credit')}
        </a>
      </figcaption>
    </figure>
  );
}

interface OverlayProps {
  frame: HoleFrame;
  /** Size of the visible area in meters, so markers keep their size on screen. */
  size: number;
  hole?: RoundHole;
  pin?: LatLon | null;
  /** The Ball Position being placed. */
  ball?: LatLon | null;
}

/** Recorded Shots as numbered lines, the Pin Position as a flag and the ball being placed. */
export function ShotOverlay({ frame, size, hole, pin, ball }: OverlayProps) {
  const r = size / 55;
  const traces = hole ? shotTraces(hole, pin ?? null) : [];
  const pinAt = pin ? frame.toScreen(pin) : null;
  const ballAt = ball ? frame.toScreen(ball) : null;
  return (
    <g className="shot-overlay">
      {traces.map((tr) => {
        const a = frame.toScreen(tr.from);
        const b = frame.toScreen(tr.to);
        return (
          <g key={tr.n}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="shot-trace" />
            <circle cx={a.x} cy={a.y} r={r * 1.1} className="shot-dot" />
            <text x={a.x} y={a.y} fontSize={r * 1.4} className="shot-number">
              {tr.n}
            </text>
          </g>
        );
      })}
      {pinAt && (
        <g data-marker="pin" className="pin-marker">
          <circle cx={pinAt.x} cy={pinAt.y} r={r * 3} className="marker-hit" />
          <line x1={pinAt.x} y1={pinAt.y} x2={pinAt.x} y2={pinAt.y - r * 3} className="pin-pole" />
          <path d={`M${pinAt.x} ${pinAt.y - r * 3}L${pinAt.x + r * 1.8} ${pinAt.y - r * 2.4}L${pinAt.x} ${pinAt.y - r * 1.8}Z`} className="pin-flag" />
          <circle cx={pinAt.x} cy={pinAt.y} r={r * 0.45} className="pin-hole" />
        </g>
      )}
      {ballAt && (
        <g data-marker="ball" className="ball-marker">
          <circle cx={ballAt.x} cy={ballAt.y} r={r * 3} className="marker-hit" />
          <circle cx={ballAt.x} cy={ballAt.y} r={r} className="ball" />
        </g>
      )}
    </g>
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
  /** The Round's hole, to draw its recorded Shots and Pin Position. */
  hole?: RoundHole;
}

/** A collapsible Hole Map; renders nothing for a Course without a Course Map. */
export function HoleMapCard({ courseMap, holeNumber, t, rememberOpen, hole }: CardProps) {
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
          <MapDrawing view={view} t={t} label={`${t('map.holeMap')} ${holeNumber}`} hidePins={hole !== undefined}>
            {hole && (
              <ShotOverlay
                frame={view.frame}
                size={Math.max(view.viewBox.width, view.viewBox.height)}
                hole={hole}
                pin={hole.pin ?? defaultPinPosition(courseMap, holeNumber)}
              />
            )}
          </MapDrawing>
        ) : (
          <p className="muted">{t('map.noHoleLine')}</p>
        ))}
    </details>
  );
}
