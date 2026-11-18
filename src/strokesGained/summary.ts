import { holeScore } from '../domain/round';
import type { Round } from '../domain/types';
import type { Baseline } from './baseline';
import { roundShotsSg, SG_CATEGORIES, sumByCategory, type SgByCategory, type SgCategory } from './strokesGained';

export interface HoleSummary {
  number: number;
  par: number;
  /** Null unless holed. */
  score: number | null;
  /** SG for the whole hole; null unless holed (a picked-up hole has no complete total). */
  sg: number | null;
  pickedUp: boolean;
}

export interface RoundSummary {
  sg: SgByCategory;
  shotCount: Record<SgCategory, number>;
  holes: HoleSummary[];
  putts: number;
  penaltyStrokes: number;
}

/**
 * Strokes Gained summary of a Round against one Baseline. Category sums include every Shot whose
 * end is known, so Shots before a Pick-Up count; only holed holes get a hole total.
 */
export function summarizeRound(round: Round, baseline: Baseline): RoundSummary {
  const entries = roundShotsSg(round, baseline);
  const shotCount = Object.fromEntries(SG_CATEGORIES.map((c) => [c, 0])) as Record<SgCategory, number>;
  entries.forEach((e) => shotCount[e.category]++);

  const holes = round.holes
    .filter((h) => h.shots.length > 0)
    .map((h): HoleSummary => {
      const score = holeScore(h);
      const sg = score === null ? null : entries.filter((e) => e.holeNumber === h.number).reduce((s, e) => s + e.sg, 0);
      return { number: h.number, par: h.par, score, sg, pickedUp: h.outcome?.kind === 'pickedUp' };
    });

  const allShots = round.holes.flatMap((h) => h.shots);
  return {
    sg: sumByCategory(entries),
    shotCount,
    holes,
    putts: allShots.filter((s) => s.lie === 'green').length,
    penaltyStrokes: allShots.reduce((s, x) => s + x.penaltyStrokes, 0),
  };
}
