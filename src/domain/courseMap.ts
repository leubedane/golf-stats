import type { CourseMap, HoleLine, LatLon, MapFeature, MapFeatureKind, OsmReference } from './types';

/** A feature counts for a Hole when it lies this close to its Hole Line. */
export const NEAR_HOLE_LINE_M = 40;

// ---------- Overpass response ----------

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  geometry?: LatLon[];
  tags?: Record<string, string>;
}

const GOLF_KINDS: Record<string, MapFeatureKind> = {
  tee: 'tee',
  green: 'green',
  fairway: 'fairway',
  bunker: 'bunker',
  water_hazard: 'water',
  lateral_water_hazard: 'water',
};

/** Hole number from a Hole Line's tags: `ref`, else a number in `name` ("Loch 3", "Hole 3"). */
export function holeRef(tags: Record<string, string>): number | undefined {
  const fromRef = /^\s*(\d{1,2})\s*$/.exec(tags.ref ?? '');
  if (fromRef) return Number(fromRef[1]);
  const fromName = /^\s*(?:(?:loch|hole|bahn|spielbahn)\s*)?(\d{1,2})\s*$/i.exec(tags.name ?? '');
  return fromName ? Number(fromName[1]) : undefined;
}

function featureKind(el: OverpassElement): MapFeatureKind | undefined {
  const tags = el.tags ?? {};
  if (el.type === 'node') return tags.golf === 'pin' ? 'pin' : undefined;
  if (tags.golf && GOLF_KINDS[tags.golf]) return GOLF_KINDS[tags.golf];
  if (tags.natural === 'water') return 'water';
  return undefined;
}

/** Hole Lines and features from an Overpass `out geom` response; relations and other tags are ignored. */
export function parseOverpass(elements: OverpassElement[]): { holeLines: HoleLine[]; features: MapFeature[] } {
  const holeLines: HoleLine[] = [];
  const features: MapFeature[] = [];
  for (const el of elements) {
    if (el.type === 'relation') continue;
    const tags = el.tags ?? {};
    const points =
      el.type === 'node'
        ? el.lat !== undefined && el.lon !== undefined
          ? [{ lat: el.lat, lon: el.lon }]
          : []
        : (el.geometry ?? []).filter((p): p is LatLon => !!p && typeof p.lat === 'number').map(({ lat, lon }) => ({ lat, lon }));
    if (points.length === 0) continue;
    if (el.type === 'way' && tags.golf === 'hole') {
      if (points.length < 2) continue;
      const ref = holeRef(tags);
      holeLines.push(ref === undefined ? { osmId: el.id, points } : { osmId: el.id, ref, points });
      continue;
    }
    const kind = featureKind(el);
    if (kind) features.push({ osmId: el.id, kind, points });
  }
  return { holeLines, features };
}

export function newCourseMap(
  courseId: string,
  osm: OsmReference,
  osmName: string,
  data: { holeLines: HoleLine[]; features: MapFeature[] },
  previous?: CourseMap,
): CourseMap {
  return {
    courseId,
    osm,
    osmName,
    ...data,
    // A refresh keeps the golfer's assignments; those of vanished lines are simply ignored.
    assignments: previous && previous.osm.id === osm.id && previous.osm.type === osm.type ? previous.assignments : [],
    fetchedAt: Date.now(),
  };
}

// ---------- Hole Line assignment ----------

/** Hole number → Hole Line: manual assignments first, then refs that are unique and not taken. */
export function assignedHoleLines(map: CourseMap): Map<number, HoleLine> {
  const byId = new Map(map.holeLines.map((l) => [l.osmId, l]));
  const result = new Map<number, HoleLine>();
  const manual = new Set<number>();
  for (const a of map.assignments) {
    const line = byId.get(a.osmId);
    if (!line || result.has(a.holeNumber)) continue;
    result.set(a.holeNumber, line);
    manual.add(line.osmId);
  }
  const rest = map.holeLines.filter((l) => !manual.has(l.osmId) && l.ref !== undefined);
  const refCount = new Map<number, number>();
  for (const l of rest) refCount.set(l.ref!, (refCount.get(l.ref!) ?? 0) + 1);
  for (const l of rest) if (refCount.get(l.ref!) === 1 && !result.has(l.ref!)) result.set(l.ref!, l);
  return result;
}

export function unassignedHoleLines(map: CourseMap): HoleLine[] {
  const used = new Set([...assignedHoleLines(map).values()].map((l) => l.osmId));
  return map.holeLines.filter((l) => !used.has(l.osmId));
}

/** Assigns a Hole Line to a hole number, replacing earlier assignments of either; null clears the manual one. */
export function assignHoleLine(map: CourseMap, osmId: number, holeNumber: number | null): CourseMap {
  const kept = map.assignments.filter((a) => a.osmId !== osmId && a.holeNumber !== holeNumber);
  return { ...map, assignments: holeNumber === null ? kept : [...kept, { holeNumber, osmId }] };
}

// ---------- Geometry ----------

/** A point in meters on the drawing; y grows downward, as in SVG. */
export interface MapPoint {
  x: number;
  y: number;
}

export interface MapShape {
  osmId: number;
  kind: MapFeatureKind;
  points: MapPoint[];
  /** Drawn faded: in view, but not part of this Hole. */
  faded: boolean;
}

export interface MapLine {
  osmId: number;
  points: MapPoint[];
  highlighted: boolean;
  /** An outline of the hole rather than a tee→green line. */
  area: boolean;
  label?: string;
}

export interface MapView {
  shapes: MapShape[];
  lines: MapLine[];
  viewBox: { x: number; y: number; width: number; height: number };
}

const EARTH_RADIUS_M = 6_371_008.8;
const RAD = Math.PI / 180;

/** Equirectangular projection around an origin: x east, y north, in meters. Accurate to well under 1% over a course. */
function projector(origin: LatLon) {
  const cosLat = Math.cos(origin.lat * RAD);
  return (p: LatLon): MapPoint => ({
    x: (p.lon - origin.lon) * RAD * EARTH_RADIUS_M * cosLat,
    y: (p.lat - origin.lat) * RAD * EARTH_RADIUS_M,
  });
}

function segmentDistance(p: MapPoint, a: MapPoint, b: MapPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function pointToPath(p: MapPoint, path: MapPoint[]): number {
  if (path.length === 1) return Math.hypot(p.x - path[0].x, p.y - path[0].y);
  let min = Infinity;
  for (let i = 1; i < path.length; i++) min = Math.min(min, segmentDistance(p, path[i - 1], path[i]));
  return min;
}

function insidePolygon(p: MapPoint, poly: MapPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** True for a Hole Line mapped as a closed outline of the hole (first point = last point), not as a tee→green line. */
export const isHoleArea = (line: HoleLine): boolean => {
  const a = line.points[0];
  const b = line.points[line.points.length - 1];
  return line.points.length >= 4 && a.lat === b.lat && a.lon === b.lon;
};

/** Shortest distance in meters between two shapes (areas, lines or points); 0 when one lies partly inside the other area. */
export function featureDistance(feature: MapPoint[], line: MapPoint[], lineIsArea = false): number {
  if (feature.length >= 3 && line.some((p) => insidePolygon(p, feature))) return 0;
  if (lineIsArea && feature.some((p) => insidePolygon(p, line))) return 0;
  let min = Infinity;
  for (const p of feature) min = Math.min(min, pointToPath(p, line));
  if (feature.length > 1) for (const p of line) min = Math.min(min, pointToPath(p, feature));
  return min;
}

/** Mean of the vertices; a closed ring's repeated last point is counted once. */
function centroid(all: MapPoint[]): MapPoint {
  const last = all[all.length - 1];
  const pts = all.length > 1 && last.x === all[0].x && last.y === all[0].y ? all.slice(0, -1) : all;
  return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
}
const dist = (a: MapPoint, b: MapPoint) => Math.hypot(a.x - b.x, a.y - b.y);

/** Features within this distance of a hole outline belong to it. Tighter than for a line, as the outline already spans the hole. */
const NEAR_HOLE_AREA_M = 10;
/** Narrowest Hole Map, as width / height. */
const MIN_ASPECT = 0.45;

/**
 * Where a hole starts (tee) and ends (green), in projected meters. A line runs from its first to its last point.
 * For a hole outline: from the tee to the green inside it that lie farthest apart; without either, along the outline's longest extent.
 */
function holeAxis(linePts: MapPoint[], isArea: boolean, features: { kind: MapFeatureKind; pts: MapPoint[] }[]): [MapPoint, MapPoint] {
  if (!isArea) return [linePts[0], linePts[linePts.length - 1]];
  const inside = (kind: MapFeatureKind) =>
    features.filter((f) => f.kind === kind && featureDistance(f.pts, linePts, true) <= NEAR_HOLE_AREA_M).map((f) => centroid(f.pts));
  const greens = inside('green');
  const tees = inside('tee');
  const starts = tees.length > 0 ? tees : linePts;
  const ends = greens.length > 0 ? greens : linePts;
  let best: [MapPoint, MapPoint] = [linePts[0], linePts[0]];
  for (const a of starts) for (const b of ends) if (dist(a, b) > dist(...best)) best = [a, b];
  return best;
}

/** Length of a Hole Line in meters from tee to green (along a line, or across an outline). */
export function holeLineLengthM(map: CourseMap, line: HoleLine): number {
  const project = projector(line.points[0]);
  const pts = line.points.map(project);
  if (isHoleArea(line)) return dist(...holeAxis(pts, true, map.features.map((f) => ({ kind: f.kind, pts: f.points.map(project) }))));
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  return total;
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function boxOf(points: MapPoint[], box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }): Box {
  for (const p of points) {
    box.minX = Math.min(box.minX, p.x);
    box.minY = Math.min(box.minY, p.y);
    box.maxX = Math.max(box.maxX, p.x);
    box.maxY = Math.max(box.maxY, p.y);
  }
  return box;
}

const overlaps = (a: Box, b: Box) => a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;

/** Fairways and water first, so greens, tees and bunkers are drawn on top of them. */
const DRAW_ORDER: MapFeatureKind[] = ['fairway', 'water', 'tee', 'green', 'bunker', 'pin'];
const byDrawOrder = (a: MapShape, b: MapShape) => DRAW_ORDER.indexOf(a.kind) - DRAW_ORDER.indexOf(b.kind);

/**
 * The Hole Map of one Hole: its Hole Line and every feature within 40 m of it (10 m of a hole outline),
 * rotated so the tee is at the bottom and the green at the top. Other features in view are faded.
 * Null without a Hole Line.
 */
export function holeMap(map: CourseMap, holeNumber: number): MapView | null {
  const line = assignedHoleLines(map).get(holeNumber);
  if (!line) return null;
  const isArea = isHoleArea(line);
  const project = projector(line.points[0]);
  const linePts = line.points.map(project);
  const projected = map.features.map((f) => ({ osmId: f.osmId, kind: f.kind, pts: f.points.map(project) }));
  const [start, end] = holeAxis(linePts, isArea, projected);
  // Rotate the tee→green direction onto north, then flip y for the screen.
  const angle = Math.atan2(end.x - start.x, end.y - start.y);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const toScreen = (p: MapPoint): MapPoint => ({ x: p.x * cos - p.y * sin, y: -(p.x * sin + p.y * cos) });

  const near = isArea ? NEAR_HOLE_AREA_M : NEAR_HOLE_LINE_M;
  const screenLine = linePts.map(toScreen);
  const shapes = projected.map((f) => ({
    osmId: f.osmId,
    kind: f.kind,
    points: f.pts.map(toScreen),
    faded: featureDistance(f.pts, linePts, isArea) > near,
  }));

  // The view: the Hole Line with room on both sides (an outline needs less), grown to fit this Hole's greens and tees.
  const box = boxOf(screenLine);
  for (const s of shapes) if (!s.faded && (s.kind === 'green' || s.kind === 'tee')) boxOf(s.points, box);
  const pad = isArea ? { x: 15, y: 15 } : { x: 45, y: 20 };
  const view: Box = { minX: box.minX - pad.x, minY: box.minY - pad.y, maxX: box.maxX + pad.x, maxY: box.maxY + pad.y };
  // Keep a long, straight hole from becoming a sliver: at least 45% as wide as it is tall.
  const grow = Math.max(0, MIN_ASPECT * (view.maxY - view.minY) - (view.maxX - view.minX)) / 2;
  view.minX -= grow;
  view.maxX += grow;

  return {
    shapes: shapes.filter((s) => overlaps(boxOf(s.points), view)).sort(byDrawOrder),
    lines: [{ osmId: line.osmId, points: screenLine, highlighted: true, area: isArea }],
    viewBox: { x: view.minX, y: view.minY, width: view.maxX - view.minX, height: view.maxY - view.minY },
  };
}

/** The whole Course Map, north up, with assigned Hole Lines labelled and one line highlighted. */
export function courseOverview(map: CourseMap, highlightOsmId?: number): MapView | null {
  if (map.holeLines.length === 0 && map.features.length === 0) return null;
  const all = [...map.holeLines.flatMap((l) => l.points), ...map.features.flatMap((f) => f.points)];
  const lat = all.reduce((s, p) => s + p.lat, 0) / all.length;
  const lon = all.reduce((s, p) => s + p.lon, 0) / all.length;
  const project = projector({ lat, lon });
  const toScreen = (p: LatLon): MapPoint => {
    const m = project(p);
    return { x: m.x, y: -m.y };
  };
  const numbers = new Map([...assignedHoleLines(map)].map(([n, l]) => [l.osmId, n]));
  const lines = map.holeLines.map((l) => ({
    osmId: l.osmId,
    points: l.points.map(toScreen),
    highlighted: l.osmId === highlightOsmId,
    area: isHoleArea(l),
    label: numbers.has(l.osmId) ? String(numbers.get(l.osmId)) : undefined,
  }));
  const shapes = map.features
    .map((f) => ({ osmId: f.osmId, kind: f.kind, points: f.points.map(toScreen), faded: false }))
    .sort(byDrawOrder);
  // Frame the Hole Lines when there are any, so far-off water does not shrink the course.
  const box = lines.length > 0 ? boxOf(lines.flatMap((l) => l.points)) : boxOf(shapes.flatMap((s) => s.points));
  const pad = 30;
  return {
    shapes,
    lines,
    viewBox: { x: box.minX - pad, y: box.minY - pad, width: box.maxX - box.minX + 2 * pad, height: box.maxY - box.minY + 2 * pad },
  };
}
