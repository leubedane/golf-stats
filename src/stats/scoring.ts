import { effectiveScore } from '../domain/holeScore';
import type { Round } from '../domain/types';

/** A count out of the holes where it could be measured. */
export interface Count {
  hit: number;
  of: number;
}

export interface ScoringStats {
  /** Fairway Tee Results out of par 4 and 5 holes with a Tee Result. */
  fairways: Count;
  /** Greens in Regulation out of holes with Strokes and Putts. */
  gir: Count;
  /** Putts (hit) over holes with Putts entered (of). */
  putts: Count;
}

export const ratio = (c: Count): number | null => (c.of > 0 ? c.hit / c.of : null);

const empty = (): ScoringStats => ({ fairways: { hit: 0, of: 0 }, gir: { hit: 0, of: 0 }, putts: { hit: 0, of: 0 } });

/** Classic scorecard stats from each hole's Hole Score, or the Shots of a Detailed hole. */
export function roundScoring(round: Round): ScoringStats {
  const s = empty();
  for (const h of round.holes) {
    const score = effectiveScore(h);
    if (!score) continue;
    if (h.par >= 4 && score.teeResult) {
      s.fairways.of++;
      if (score.teeResult === 'fairway') s.fairways.hit++;
    }
    if (score.putts !== undefined) {
      s.putts.of++;
      s.putts.hit += score.putts;
      if (score.strokes !== null) {
        s.gir.of++;
        if (score.strokes - score.putts <= h.par - 2) s.gir.hit++;
      }
    }
  }
  return s;
}

export function combineScoring(list: ScoringStats[]): ScoringStats {
  return list.reduce((acc, s) => {
    for (const k of Object.keys(acc) as (keyof ScoringStats)[]) {
      acc[k].hit += s[k].hit;
      acc[k].of += s[k].of;
    }
    return acc;
  }, empty());
}

export interface ScoringPoint {
  roundId: string;
  startedAt: number;
  courseName: string;
  stats: ScoringStats;
}

/** Scoring stats per Round, oldest first. */
export function scoringTrend(rounds: Round[]): ScoringPoint[] {
  return [...rounds]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((r) => ({ roundId: r.id, startedAt: r.startedAt, courseName: r.courseName, stats: roundScoring(r) }));
}
