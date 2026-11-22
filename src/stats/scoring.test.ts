import { describe, expect, it } from 'vitest';
import type { Round, RoundHole } from '../domain/types';
import { combineScoring, ratio, roundScoring, scoringTrend } from './scoring';

const hole = (par: number, score?: RoundHole['score']): RoundHole => ({
  number: 1,
  par,
  lengthM: 300,
  strokeIndex: 1,
  shots: [],
  ...(score && { score }),
});

const round = (startedAt: number, holes: RoundHole[]): Round => ({
  id: `r${startedAt}`,
  courseId: 'c',
  courseName: 'GC',
  teeName: 'Y',
  courseRating: 72,
  slope: 125,
  handicap: 10,
  startedAt,
  holes,
});

describe('classic scoring stats', () => {
  const r = round(1, [
    hole(4, { strokes: 4, putts: 2, teeResult: 'fairway' }), // GIR, fairway
    hole(4, { strokes: 5, putts: 1, teeResult: 'left' }), // no GIR
    hole(3, { strokes: 3, putts: 2, teeResult: 'right' }), // GIR; par 3 has no fairway
    hole(5, { strokes: 6 }), // no putts: no GIR count, no fairway
    hole(4, { strokes: null, putts: 3 }), // picked up: no GIR, putts counted
    hole(4),
  ]);

  it('count Fairways on par 4 and 5 with a Tee Result', () => {
    expect(roundScoring(r).fairways).toEqual({ hit: 1, of: 2 });
  });

  it('count Greens in Regulation where Strokes minus Putts is at most par minus 2', () => {
    expect(roundScoring(r).gir).toEqual({ hit: 2, of: 3 });
  });

  it('count Putts on holes where they were entered', () => {
    expect(roundScoring(r).putts).toEqual({ hit: 8, of: 4 });
  });

  it('combine over Rounds and give a trend, oldest first', () => {
    const r2 = round(0, [hole(4, { strokes: 4, putts: 2, teeResult: 'fairway' })]);
    expect(combineScoring([roundScoring(r), roundScoring(r2)]).fairways).toEqual({ hit: 2, of: 3 });
    expect(scoringTrend([r, r2]).map((p) => p.roundId)).toEqual(['r0', 'r1']);
    expect(ratio({ hit: 1, of: 4 })).toBe(0.25);
    expect(ratio({ hit: 0, of: 0 })).toBeNull();
  });
});
