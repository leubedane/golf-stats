import { describe, expect, it } from 'vitest';
import {
  effectiveScore,
  holeStatus,
  isDetailed,
  scoreMismatches,
  setHoleScore,
  shotPlan,
} from './holeScore';
import { currentHoleIndex, roundTotals } from './round';
import type { Lie, Round, RoundHole, Shot } from './types';

const shot = (lie: Lie, distanceM: number, extra: Partial<Shot> = {}): Shot => ({
  id: `${lie}-${distanceM}`,
  lie,
  distanceM,
  clubId: null,
  clubName: 'X',
  penaltyStrokes: 0,
  ...extra,
});

const hole = (extra: Partial<RoundHole> = {}): RoundHole => ({
  number: 1,
  par: 4,
  lengthM: 350,
  strokeIndex: 1,
  shots: [],
  ...extra,
});

/** Tee, approach, two putts, holed: 4 strokes. */
const detailedFour = (extra: Partial<RoundHole> = {}) =>
  hole({
    shots: [shot('tee', 350, { missSide: 'left' }), shot('rough', 140), shot('green', 8), shot('green', 1)],
    outcome: { kind: 'holed' },
    ...extra,
  });

const round = (holes: RoundHole[]): Round => ({
  id: 'r',
  courseId: 'c',
  courseName: 'GC',
  teeName: 'Gelb',
  courseRating: 72,
  slope: 125,
  handicap: 10,
  startedAt: 0,
  holes: holes.map((h, i) => ({ ...h, number: i + 1 })),
});

describe('Hole Score', () => {
  it('is empty for a hole with nothing entered', () => {
    expect(effectiveScore(hole())).toBeNull();
    expect(holeStatus(hole())).toBe('empty');
  });

  it('uses the entered Hole Score', () => {
    const h = hole({ score: { strokes: 5, putts: 2, teeResult: 'fairway' } });
    expect(effectiveScore(h)).toEqual({ strokes: 5, putts: 2, teeResult: 'fairway' });
    expect(holeStatus(h)).toBe('scored');
  });

  it('follows the Shots of a Detailed hole while none is entered', () => {
    expect(effectiveScore(detailedFour())).toEqual({ strokes: 4, putts: 2, teeResult: 'left', penaltyStrokes: 0 });
    expect(holeStatus(detailedFour())).toBe('detailed');
  });

  it('follows the Shots of a picked-up hole as Picked Up', () => {
    const h = hole({ shots: [shot('tee', 350)], outcome: { kind: 'pickedUp', lie: 'rough', distanceM: 100 } });
    expect(effectiveScore(h)?.strokes).toBeNull();
  });

  it('has no Tee Result on a par 3', () => {
    expect(effectiveScore(detailedFour({ par: 3 }))?.teeResult).toBeUndefined();
  });

  it('is a hole in progress while its Shots have no Hole Outcome', () => {
    const h = hole({ shots: [shot('tee', 350)], score: { strokes: 5 } });
    expect(isDetailed(h)).toBe(false);
    expect(holeStatus(h)).toBe('inProgress');
    expect(effectiveScore(h)?.strokes).toBe(5);
  });

  it('flags Strokes, Putts and Penalties that disagree with the Shots', () => {
    expect(scoreMismatches(detailedFour({ score: { strokes: 4, putts: 2, penaltyStrokes: 0 } }))).toEqual([]);
    expect(scoreMismatches(detailedFour({ score: { strokes: 5, putts: 3, penaltyStrokes: 1 } }))).toEqual([
      'strokes',
      'putts',
      'penalties',
    ]);
    expect(holeStatus(detailedFour({ score: { strokes: 5 } }))).toBe('mismatch');
  });

  it('skips fields that were not entered, and holes that are not Detailed', () => {
    expect(scoreMismatches(detailedFour({ score: { strokes: 4 } }))).toEqual([]);
    expect(scoreMismatches(hole({ score: { strokes: 5 } }))).toEqual([]);
  });

  it('flags a Picked Up Hole Score against holed Shots', () => {
    expect(scoreMismatches(detailedFour({ score: { strokes: null } }))).toEqual(['strokes']);
  });

  it('is set and cleared on one hole of a Round', () => {
    const r = setHoleScore(round([hole(), hole()]), 1, { strokes: 3 });
    expect(r.holes.map((h) => h.score)).toEqual([undefined, { strokes: 3 }]);
    expect(setHoleScore(r, 1, undefined).holes[1]).not.toHaveProperty('score');
  });
});

describe('Round totals with Hole Scores', () => {
  it('count entered Hole Scores and Detailed holes, not Picked Up ones', () => {
    const r = round([hole({ score: { strokes: 5 } }), detailedFour(), hole({ score: { strokes: null } }), hole()]);
    expect(roundTotals(r)).toEqual({ holesCompleted: 2, strokes: 9, par: 8 });
  });

  it('continue on the first hole without a Hole Score that is not Detailed', () => {
    expect(currentHoleIndex(round([hole({ score: { strokes: 5 } }), detailedFour(), hole(), hole()]))).toBe(2);
    expect(currentHoleIndex(round([hole({ score: { strokes: 5 } })]))).toBe(0);
  });
});

describe('Shot plan from the Hole Score', () => {
  it('counts the expected Shots, leaving out Penalty strokes', () => {
    expect(shotPlan(hole({ score: { strokes: 6, putts: 2, penaltyStrokes: 1 } }))).toMatchObject({ expectedShots: 5 });
    expect(shotPlan(hole())).toMatchObject({ expectedShots: null });
    expect(shotPlan(hole({ score: { strokes: null } }))).toMatchObject({ expectedShots: null });
  });

  it('uses recorded Penalties when none were entered', () => {
    const h = hole({ shots: [shot('tee', 350, { penaltyStrokes: 1 })], score: { strokes: 6 } });
    expect(shotPlan(h).expectedShots).toBe(5);
  });

  it('starts on the Green once only putts remain', () => {
    const score = { strokes: 5, putts: 2 };
    expect(shotPlan(hole({ score, shots: [shot('tee', 350), shot('rough', 150)] })).lie).toBeUndefined();
    expect(shotPlan(hole({ score, shots: [shot('tee', 350), shot('rough', 150), shot('fringe', 15)] })).lie).toBe('green');
  });

  it('takes the second Lie from the Tee Result', () => {
    const one = [shot('tee', 350)];
    expect(shotPlan(hole({ shots: one, score: { strokes: 4, teeResult: 'fairway' } })).lie).toBe('fairway');
    expect(shotPlan(hole({ shots: one, score: { strokes: 4, teeResult: 'right' } })).lie).toBe('rough');
  });

  it('takes the first Miss Direction from the Tee Result', () => {
    expect(shotPlan(hole({ score: { strokes: 4, teeResult: 'fairway' } })).missSide).toBe('onTarget');
    expect(shotPlan(hole({ score: { strokes: 4, teeResult: 'left' } })).missSide).toBe('left');
    expect(shotPlan(hole({ score: { strokes: 4 } })).missSide).toBeUndefined();
  });
});
