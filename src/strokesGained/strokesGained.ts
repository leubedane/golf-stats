import { isAroundTheGreen, shotEnd } from '../domain/round';
import { isDetailed } from '../domain/holeScore';
import type { Round, RoundHole, Shot } from '../domain/types';
import type { Baseline } from './baseline';

export type SgCategory = 'offTheTee' | 'approach' | 'aroundTheGreen' | 'putting';
export const SG_CATEGORIES: SgCategory[] = ['offTheTee', 'approach', 'aroundTheGreen', 'putting'];

export function sgCategory(shot: Shot, par: number): SgCategory {
  if (shot.lie === 'green') return 'putting';
  if (shot.lie === 'tee' && par >= 4) return 'offTheTee';
  if (isAroundTheGreen(shot.lie, shot.distanceM)) return 'aroundTheGreen';
  return 'approach';
}

/**
 * Strokes Gained for one Shot:
 *   SG = E(start) − E(end) − 1 − penalty strokes   (E(end) = 0 when holed)
 * Null when the Shot's end is not yet known.
 */
export function shotStrokesGained(hole: RoundHole, index: number, baseline: Baseline): number | null {
  const shot = hole.shots[index];
  const end = shotEnd(hole, index);
  if (end.kind === 'unknown') return null;
  const endValue = end.kind === 'holed' ? 0 : baseline(end.lie, end.distanceM);
  return baseline(shot.lie, shot.distanceM) - endValue - 1 - shot.penaltyStrokes;
}

export interface SgEntry {
  holeNumber: number;
  shotIndex: number;
  shot: Shot;
  category: SgCategory;
  sg: number;
}

/** Every Shot of the Round whose end is known, with its category and Strokes Gained. */
export function roundShotsSg(round: Round, baseline: Baseline): SgEntry[] {
  const entries: SgEntry[] = [];
  for (const hole of round.holes) {
    // A hole in progress counts once its Shots end in a Hole Outcome.
    if (!isDetailed(hole)) continue;
    hole.shots.forEach((shot, shotIndex) => {
      const sg = shotStrokesGained(hole, shotIndex, baseline);
      if (sg === null) return;
      entries.push({ holeNumber: hole.number, shotIndex, shot, category: sgCategory(shot, hole.par), sg });
    });
  }
  return entries;
}

export type SgByCategory = Record<SgCategory | 'total', number>;

export function sumByCategory(entries: SgEntry[]): SgByCategory {
  const sums: SgByCategory = { offTheTee: 0, approach: 0, aroundTheGreen: 0, putting: 0, total: 0 };
  for (const e of entries) {
    sums[e.category] += e.sg;
    sums.total += e.sg;
  }
  return sums;
}

export const roundStrokesGained = (round: Round, baseline: Baseline): SgByCategory =>
  sumByCategory(roundShotsSg(round, baseline));
