import type { HoleScore, Lie, MissSide, Round, RoundHole, TeeResult } from './types';

/** Strokes counted from the Shots, including Penalties; null unless the hole was holed. */
export function shotsScore(hole: RoundHole): number | null {
  if (hole.outcome?.kind !== 'holed') return null;
  return hole.shots.reduce((sum, s) => sum + 1 + s.penaltyStrokes, 0);
}

/** A hole is Detailed once its Shots end in a Hole Outcome. */
export const isDetailed = (hole: RoundHole): boolean => hole.shots.length > 0 && hole.outcome !== undefined;

const shotsPutts = (hole: RoundHole) => hole.shots.filter((s) => s.lie === 'green').length;
const shotsPenalties = (hole: RoundHole) => hole.shots.reduce((sum, s) => sum + s.penaltyStrokes, 0);

const TEE_RESULT_OF: Partial<Record<MissSide, TeeResult>> = { onTarget: 'fairway', left: 'left', right: 'right' };
const MISS_SIDE_OF: Record<TeeResult, MissSide> = { fairway: 'onTarget', left: 'left', right: 'right' };

/** The Hole Score the Shots of a Detailed hole add up to. */
function scoreFromShots(hole: RoundHole): HoleScore {
  const first = hole.shots[0];
  const teeResult = hole.par >= 4 && first?.lie === 'tee' && first.missSide ? TEE_RESULT_OF[first.missSide] : undefined;
  return {
    strokes: shotsScore(hole),
    putts: shotsPutts(hole),
    penaltyStrokes: shotsPenalties(hole),
    ...(teeResult && { teeResult }),
  };
}

/** The entered Hole Score, else the one a Detailed hole's Shots add up to, else null. */
export function effectiveScore(hole: RoundHole): HoleScore | null {
  if (hole.score) return hole.score;
  return isDetailed(hole) ? scoreFromShots(hole) : null;
}

export type ScoreMismatch = 'strokes' | 'putts' | 'penalties';

/** Fields of an entered Hole Score that disagree with the Shots of a Detailed hole. */
export function scoreMismatches(hole: RoundHole): ScoreMismatch[] {
  if (!hole.score || !isDetailed(hole)) return [];
  const fromShots = scoreFromShots(hole);
  const found: ScoreMismatch[] = [];
  if (hole.score.strokes !== fromShots.strokes) found.push('strokes');
  if (hole.score.putts !== undefined && hole.score.putts !== fromShots.putts) found.push('putts');
  if (hole.score.penaltyStrokes !== undefined && hole.score.penaltyStrokes !== fromShots.penaltyStrokes)
    found.push('penalties');
  return found;
}

export type HoleStatus = 'empty' | 'scored' | 'inProgress' | 'detailed' | 'mismatch';

export function holeStatus(hole: RoundHole): HoleStatus {
  if (isDetailed(hole)) return scoreMismatches(hole).length > 0 ? 'mismatch' : 'detailed';
  if (hole.shots.length > 0) return 'inProgress';
  return hole.score ? 'scored' : 'empty';
}

/** Enters a Hole Score, or with undefined lets the hole's score follow its Shots again. */
export function setHoleScore(round: Round, holeIndex: number, score: HoleScore | undefined): Round {
  return {
    ...round,
    holes: round.holes.map((h, i) => {
      if (i !== holeIndex) return h;
      if (score) return { ...h, score };
      const { score: _removed, ...rest } = h;
      return rest;
    }),
  };
}

export interface ShotPlan {
  /** Shots the entered Hole Score implies (Strokes minus Penalty strokes); null when unknown. */
  expectedShots: number | null;
  /** Suggested Lie for the next Shot, when the Hole Score implies one. */
  lie?: Lie;
  /** Suggested Miss Direction for the first Shot, from the Tee Result. */
  missSide?: MissSide;
}

/** What the entered Hole Score says about the next Shot to record. */
export function shotPlan(hole: RoundHole): ShotPlan {
  const score = hole.score;
  if (!score) return { expectedShots: null };
  const penalties = score.penaltyStrokes ?? shotsPenalties(hole);
  const expectedShots = score.strokes === null ? null : score.strokes - penalties;
  const n = hole.shots.length;
  const teeResult = hole.par >= 4 ? score.teeResult : undefined;

  if (n === 0) return { expectedShots, ...(teeResult && { missSide: MISS_SIDE_OF[teeResult] }) };

  // Strokes before the putts: once they are used up, the next Shot is a putt.
  const strokesSoFar = n + shotsPenalties(hole);
  if (score.strokes !== null && score.putts !== undefined && strokesSoFar >= score.strokes - score.putts)
    return { expectedShots, lie: 'green' };
  if (n === 1 && teeResult && hole.shots[0].lie === 'tee')
    return { expectedShots, lie: teeResult === 'fairway' ? 'fairway' : 'rough' };
  return { expectedShots };
}
