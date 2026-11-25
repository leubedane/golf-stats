import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { lieAt, mapDistanceM } from '../domain/ballPosition';
import { holeMap, type MapPoint, type MapView } from '../domain/courseMap';
import type { CourseMap, LatLon, RoundHole } from '../domain/types';
import type { Translate } from '../i18n/i18n';
import { MapDrawing, ShotOverlay } from './MapDrawing';

interface Props {
  courseMap: CourseMap;
  hole: RoundHole;
  ball: LatLon | undefined;
  pin: LatLon;
  /** The first Shot's Lie is always Tee, whatever lies under the ball. */
  teeShot: boolean;
  t: Translate;
  onDone: (ball: LatLon, pin: LatLon) => void;
  onCancel: () => void;
}

type ViewBox = MapView['viewBox'];
type Gesture =
  | { kind: 'tap' | 'pan'; start: MapPoint; startClient: MapPoint; box: ViewBox; inverse: DOMMatrix }
  | { kind: 'ball' | 'pin' }
  | { kind: 'pinch'; start: MapPoint; distance: number; box: ViewBox; inverse: DOMMatrix };

/** Moves further than this (in screen pixels) turn a tap into a pan. */
const TAP_SLOP_PX = 8;
const MIN_WIDTH_M = 25;
const MAX_WIDTH_M = 2500;

const apply = (m: DOMMatrix, c: MapPoint): MapPoint => {
  const p = new DOMPoint(c.x, c.y).matrixTransform(m);
  return { x: p.x, y: p.y };
};

/** Zooms a view box by `factor` so that drawing point `from` ends up under the screen point that maps to `to` before zooming. */
function zoomed(box: ViewBox, factor: number, from: MapPoint, to: MapPoint): ViewBox {
  const f = Math.min(MAX_WIDTH_M / box.width, Math.max(MIN_WIDTH_M / box.width, factor));
  return {
    x: from.x + f * (box.x - to.x),
    y: from.y + f * (box.y - to.y),
    width: box.width * f,
    height: box.height * f,
  };
}

/** Full-screen Hole Map for placing a Ball Position by touch and dragging the Pin Position. */
export function BallPositionPicker({ courseMap, hole, ball: initialBall, pin: initialPin, teeShot, t, onDone, onCancel }: Props) {
  const view = useMemo(() => holeMap(courseMap, hole.number, { allFeatures: true })!, [courseMap, hole.number]);
  const [box, setBox] = useState<ViewBox>(view.viewBox);
  const [ball, setBall] = useState<LatLon | null>(initialBall ?? null);
  const [pin, setPin] = useState<LatLon>(initialPin);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, MapPoint>());
  const gesture = useRef<Gesture | null>(null);

  // Start with the whole Hole in view, widened or heightened to the screen's shape.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || svg.clientWidth === 0 || svg.clientHeight === 0) return;
    const screen = svg.clientWidth / svg.clientHeight;
    const v = view.viewBox;
    const width = Math.max(v.width, v.height * screen);
    const height = width / screen;
    setBox({ x: v.x - (width - v.width) / 2, y: v.y - (height - v.height) / 2, width, height });
  }, [view]);

  // A full-screen view: keep the page behind it from scrolling.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const inverse = () => svgRef.current!.getScreenCTM()!.inverse();
  const toDrawing = (c: MapPoint) => apply(inverse(), c);

  function startGesture(target: EventTarget) {
    const ids = [...pointers.current.values()];
    if (ids.length >= 2) {
      const [a, b] = ids;
      const inv = inverse();
      gesture.current = {
        kind: 'pinch',
        start: apply(inv, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }),
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        box,
        inverse: inv,
      };
      return;
    }
    const marker = (target as Element).closest?.('[data-marker]')?.getAttribute('data-marker');
    if (marker === 'ball' || marker === 'pin') {
      gesture.current = { kind: marker };
      return;
    }
    const inv = inverse();
    gesture.current = { kind: 'tap', start: apply(inv, ids[0]), startClient: ids[0], box, inverse: inv };
  }

  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startGesture(e.target);
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const now = { x: e.clientX, y: e.clientY };
    if (g.kind === 'ball') setBall(view.frame.toLatLon(toDrawing(now)));
    else if (g.kind === 'pin') setPin(view.frame.toLatLon(toDrawing(now)));
    else if (g.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      const mid = apply(g.inverse, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      setBox(zoomed(g.box, g.distance / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), g.start, mid));
    } else {
      if (g.kind === 'tap' && Math.hypot(now.x - g.startClient.x, now.y - g.startClient.y) > TAP_SLOP_PX) g.kind = 'pan';
      if (g.kind === 'pan') setBox(zoomed(g.box, 1, g.start, apply(g.inverse, now)));
    }
  }

  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (g?.kind === 'tap' && wasSingle) setBall(view.frame.toLatLon(g.start));
    // Lifting one finger of a pinch ends it; the other finger does nothing until lifted.
    gesture.current = null;
  }

  function onWheel(e: ReactWheelEvent<SVGSVGElement>) {
    const at = toDrawing({ x: e.clientX, y: e.clientY });
    setBox((b) => zoomed(b, Math.exp(e.deltaY * 0.0015), at, at));
  }

  const lie = ball ? (teeShot ? 'tee' : lieAt(courseMap, ball)) : null;
  return (
    <div className="ball-picker" role="dialog" aria-modal="true" aria-label={t('map.placeTitle')}>
      <header className="ball-picker-header">
        <strong>{t('map.placeTitle')}</strong>
        <span className="muted">
          {ball && lie
            ? t('map.placeReadout', { lie: t(`lie.${lie}`), m: mapDistanceM(ball, pin) })
            : t('map.placeHint')}
        </span>
      </header>
      <MapDrawing
        view={view}
        viewBox={box}
        t={t}
        label={`${t('map.holeMap')} ${hole.number}`}
        className="ball-picker-map"
        hidePins
        svgRef={svgRef}
        svgProps={{
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerCancel: onPointerUp,
          onWheel,
          preserveAspectRatio: 'xMidYMid slice',
        }}
      >
        <ShotOverlay frame={view.frame} size={Math.max(box.width, box.height)} hole={hole} pin={pin} ball={ball} />
      </MapDrawing>
      <footer className="row ball-picker-footer">
        <button className="grow" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button className="grow primary" disabled={!ball} onClick={() => ball && onDone(ball, pin)}>
          {t('map.done')}
        </button>
      </footer>
    </div>
  );
}
