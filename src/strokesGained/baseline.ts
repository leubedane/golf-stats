import type { Lie } from '../domain/types';
import { GREEN_FEET, OFF_GREEN_YARDS } from './pgaTourTable';

const METERS_PER_YARD = 0.9144;
const METERS_PER_FOOT = 0.3048;

/** Expected strokes to hole out from a Lie and Distance to Pin in meters. */
export type Baseline = (lie: Lie, distanceM: number) => number;

type TableLie = 'tee' | 'fairway' | 'rough' | 'sand' | 'recovery';
const COLUMN: Record<TableLie, 1 | 2 | 3 | 4 | 5> = { tee: 1, fairway: 2, rough: 3, sand: 4, recovery: 5 };

/** Fringe is valued like Fairway (Broadie's convention), Bunker like sand. */
function tableLie(lie: Exclude<Lie, 'green'>): TableLie {
  switch (lie) {
    case 'fringe':
      return 'fairway';
    case 'bunker':
      return 'sand';
    default:
      return lie;
  }
}

/** Linear interpolation; extrapolates with the slope of the last segment beyond the table. */
export function interpolate(points: readonly (readonly [number, number])[], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  const [xa, ya] = points[points.length - 2];
  const [xb, yb] = points[points.length - 1];
  return yb + ((x - xb) / (xb - xa)) * (yb - ya);
}

function column(lie: TableLie): [number, number][] {
  const c = COLUMN[lie];
  return OFF_GREEN_YARDS.filter((row) => row[c] !== null).map((row) => [row[0], row[c] as number]);
}

const COLUMNS: Record<TableLie, [number, number][]> = {
  tee: column('tee'),
  fairway: column('fairway'),
  rough: column('rough'),
  sand: column('sand'),
  recovery: column('recovery'),
};

/** The measured PGA Tour Baseline. */
export const pgaTourBaseline: Baseline = (lie, distanceM) => {
  if (lie === 'green') return interpolate(GREEN_FEET, distanceM / METERS_PER_FOOT);
  const yards = distanceM / METERS_PER_YARD;
  let l = tableLie(lie);
  // Tee shots shorter than the table's tee column start are valued like fairway shots.
  if (l === 'tee' && yards < COLUMNS.tee[0][0]) l = 'fairway';
  return interpolate(COLUMNS[l], yards);
};

export const toYards = (m: number) => m / METERS_PER_YARD;
export const toFeet = (m: number) => m / METERS_PER_FOOT;
