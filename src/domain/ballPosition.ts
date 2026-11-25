import { distanceBetweenM, holeMap, isInside } from './courseMap';
import type { CourseMap, LatLon, Lie, MapFeature, Round, RoundHole, Shot } from './types';

// Ball Positions and Pin Positions on the Hole Map (ADR 0005). Positions are latitude/longitude, like the Course Map.

/** A pin node counts for a green when it lies inside it or this close to it. */
const PIN_NEAR_GREEN_M = 10;

function centre(points: LatLon[]): LatLon {
  const last = points[points.length - 1];
  const pts = points.length > 1 && last.lat === points[0].lat && last.lon === points[0].lon ? points.slice(0, -1) : points;
  return { lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length, lon: pts.reduce((s, p) => s + p.lon, 0) / pts.length };
}

const nearest = <T>(items: T[], to: LatLon, at: (item: T) => LatLon): T | undefined =>
  items.reduce<T | undefined>((best, item) => (best === undefined || distanceBetweenM(at(item), to) < distanceBetweenM(at(best), to) ? item : best), undefined);

/**
 * The Pin Position a Hole starts with: the Course Map's pin on the Hole's green, else the middle of that green,
 * else the end of the Hole Line. The Hole's green is the one nearest the end of the Hole Line. Null without a Hole Line.
 */
export function defaultPinPosition(map: CourseMap, holeNumber: number): LatLon | null {
  const view = holeMap(map, holeNumber);
  if (!view) return null;
  const end = view.frame.end;
  const green = nearest(
    map.features.filter((f) => f.kind === 'green'),
    end,
    (f) => centre(f.points),
  );
  if (!green || distanceBetweenM(centre(green.points), end) > 60) return end;
  const pins = map.features
    .filter((f) => f.kind === 'pin')
    .map((f) => f.points[0])
    .filter((p) => isInside(p, green.points) || distanceBetweenM(p, centre(green.points)) <= PIN_NEAR_GREEN_M + greenRadiusM(green));
  return nearest(pins, centre(green.points), (p) => p) ?? centre(green.points);
}

function greenRadiusM(green: MapFeature): number {
  const c = centre(green.points);
  return Math.max(...green.points.map((p) => distanceBetweenM(p, c)));
}

/** Where the first Shot of a Hole starts: the start of its Hole Line. Null without a Hole Line. */
export function teePosition(map: CourseMap, holeNumber: number): LatLon | null {
  return holeMap(map, holeNumber)?.frame.start ?? null;
}

/** The Lie the Course Map suggests for a Ball Position. Fringe and Recovery cannot be told from the map. */
export function lieAt(map: CourseMap, position: LatLon): Lie {
  const under = (kind: MapFeature['kind']) => map.features.some((f) => f.kind === kind && isInside(position, f.points));
  if (under('green')) return 'green';
  if (under('bunker')) return 'bunker';
  if (under('fairway')) return 'fairway';
  return 'rough';
}

/** Distance to Pin from a Ball Position, in whole meters as entered elsewhere. */
export function mapDistanceM(position: LatLon, pin: LatLon): number {
  return Math.max(1, Math.round(distanceBetweenM(position, pin)));
}

/** Off the Green the Ball Position sets the Distance to Pin; on the Green it is only drawn and the distance is typed. */
export const distanceFromMap = (lie: Lie, position: LatLon | undefined): position is LatLon => position !== undefined && lie !== 'green';

/** A Shot's Distance to Pin as the map says, when it comes from the map. */
function withMapDistance<T extends { lie: Lie; distanceM: number; position?: LatLon }>(item: T, pin: LatLon): T {
  return distanceFromMap(item.lie, item.position) ? { ...item, distanceM: mapDistanceM(item.position, pin) } : item;
}

/** Sets a Hole's Pin Position and recomputes the Distance to Pin of its Ball Positions off the Green. */
export function setPinPosition(round: Round, holeIndex: number, pin: LatLon): Round {
  return {
    ...round,
    holes: round.holes.map((h, i) => (i === holeIndex ? holeWithPin(h, pin) : h)),
  };
}

function holeWithPin(hole: RoundHole, pin: LatLon): RoundHole {
  const outcome = hole.outcome?.kind === 'pickedUp' ? withMapDistance(hole.outcome, pin) : hole.outcome;
  return { ...hole, pin, shots: hole.shots.map((s) => withMapDistance(s, pin)), ...(outcome ? { outcome } : {}) };
}

/** One recorded Shot drawn on the Hole Map: from its Ball Position to where it finished. */
export interface ShotTrace {
  /** Shot number on the Hole, from 1. */
  n: number;
  from: LatLon;
  to: LatLon;
}

/** Recorded Shots with a known start and end position: the next Ball Position, the pick-up position, or the pin when holed. */
export function shotTraces(hole: RoundHole, pin: LatLon | null): ShotTrace[] {
  const traces: ShotTrace[] = [];
  hole.shots.forEach((shot: Shot, i) => {
    if (!shot.position) return;
    const next = hole.shots[i + 1];
    const last = i === hole.shots.length - 1;
    const to = next
      ? next.position
      : last && hole.outcome?.kind === 'pickedUp'
        ? hole.outcome.position
        : last && hole.outcome?.kind === 'holed'
          ? (pin ?? undefined)
          : undefined;
    if (to) traces.push({ n: i + 1, from: shot.position, to });
  });
  return traces;
}
