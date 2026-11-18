import type { Lie } from '../domain/types';
import { interpolate, pgaTourBaseline, toFeet, toYards, type Baseline } from './baseline';

/**
 * Modeled Baselines for amateur Handicap Classes (ADR 0001).
 *
 *   E_h(lie, d) = E_pga(lie, d) + k_h · w(lie, d)
 *
 * w is a fixed shape describing where amateurs lose strokes to tour players: a little on short
 * putts, more on long putts, and on off-green shots a lie-dependent amount growing slowly with
 * distance. k_h is solved so that the expected score on the Reference Course matches the
 * typical score of a golfer with handicap h.
 */

/** The Reference Course: par 72, 5,900 m (4 par 3s, 10 par 4s, 4 par 5s). */
export const REFERENCE_COURSE: readonly { par: number; lengthM: number }[] = [
  ...[150, 165, 135, 175].map((lengthM) => ({ par: 3, lengthM })),
  ...[310, 330, 345, 360, 325, 350, 370, 335, 355, 355].map((lengthM) => ({ par: 4, lengthM })),
  ...[450, 470, 440, 480].map((lengthM) => ({ par: 5, lengthM })),
];
export const REFERENCE_PAR = REFERENCE_COURSE.reduce((s, h) => s + h.par, 0);

/** Typical strokes over par on the Reference Course by handicap (anchored on Shot Scope averages). */
const OVER_PAR_BY_HANDICAP: readonly (readonly [number, number])[] = [
  [0, 1],
  [10, 11],
  [20, 22],
  [30, 33],
];

export const typicalOverPar = (handicap: number): number => interpolate(OVER_PAR_BY_HANDICAP, handicap);

/** Extrapolation below handicap 0 uses the 0–10 slope. */
function overPar(handicap: number): number {
  if (handicap >= 0) return typicalOverPar(handicap);
  const [[x0, y0], [x1, y1]] = OVER_PAR_BY_HANDICAP;
  return y0 + ((handicap - x0) / (x1 - x0)) * (y1 - y0);
}

const LIE_BASE: Record<Exclude<Lie, 'green'>, number> = {
  tee: 0.6,
  fairway: 0.5,
  fringe: 0.5,
  rough: 0.62,
  bunker: 0.8,
  recovery: 0.75,
};

/** Shape of the amateur penalty (strokes per unit of k). */
export function shape(lie: Lie, distanceM: number): number {
  if (lie === 'green') return 0.25 * (1 - Math.exp(-toFeet(distanceM) / 12));
  const yards = Math.min(toYards(distanceM), 600);
  const closeIn = Math.min(1, 0.5 + yards / 100);
  return LIE_BASE[lie] * closeIn + 0.0006 * yards;
}

const PGA_REFERENCE_SCORE = REFERENCE_COURSE.reduce((s, h) => s + pgaTourBaseline('tee', h.lengthM), 0);
const SHAPE_REFERENCE = REFERENCE_COURSE.reduce((s, h) => s + shape('tee', h.lengthM), 0);

/** Scale factor k_h that calibrates the model for a handicap. */
export function scaleFor(handicap: number): number {
  return (REFERENCE_PAR + overPar(handicap) - PGA_REFERENCE_SCORE) / SHAPE_REFERENCE;
}

export function modeledBaseline(handicap: number): Baseline {
  const k = scaleFor(handicap);
  return (lie, distanceM) => {
    const value = pgaTourBaseline(lie, distanceM) + k * shape(lie, distanceM);
    // Never fewer than one stroke to hole out from off the hole.
    return Math.max(1, value);
  };
}

/** Expected score on the Reference Course for a Baseline (the Course's tee shots summed). */
export const referenceScore = (baseline: Baseline): number =>
  REFERENCE_COURSE.reduce((s, h) => s + baseline('tee', h.lengthM), 0);
