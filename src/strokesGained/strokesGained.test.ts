import { describe, expect, it } from 'vitest';
import { defaultBag } from '../domain/bag';
import { emptyCourse } from '../domain/course';
import { finishHole, newShot, saveShot, startRound, holeScore } from '../domain/round';
import type { Lie, Round, Shot } from '../domain/types';
import { pgaTourBaseline } from './baseline';
import { modeledBaseline } from './modeledBaseline';
import { roundShotsSg, roundStrokesGained, sgCategory, shotStrokesGained } from './strokesGained';

const bag = defaultBag();
const shot = (lie: Lie, distanceM: number, extra: Partial<Shot> = {}): Shot => ({
  ...newShot({ lie, distanceM }, bag[5]),
  ...extra,
});

function round(): Round {
  const c = emptyCourse('male');
  c.clubName = 'GC';
  c.tees[0].name = 'Y';
  c.tees[0].holes.forEach((h, i) => {
    h.lengthM = 350;
    h.par = i === 1 ? 3 : 4;
    if (i === 1) h.lengthM = 150;
  });
  return startRound({ course: c, tee: c.tees[0], startHole: 1, holeCount: 18, handicap: 6.8 });
}

function play(r: Round, holeIndex: number, shots: Shot[], holed = true): Round {
  for (const s of shots) r = saveShot(r, holeIndex, s);
  return holed ? finishHole(r, holeIndex, { kind: 'holed' }) : r;
}

describe('strokes gained per shot', () => {
  it('is E(start) − E(end) − 1', () => {
    const r = play(round(), 0, [shot('tee', 350), shot('fairway', 120), shot('green', 3)]);
    const E = pgaTourBaseline;
    const h = r.holes[0];
    expect(shotStrokesGained(h, 0, E)).toBeCloseTo(E('tee', 350) - E('fairway', 120) - 1, 10);
    expect(shotStrokesGained(h, 2, E)).toBeCloseTo(E('green', 3) - 1, 10);
  });

  it('charges penalty strokes to the shot that caused them', () => {
    const r = play(round(), 0, [shot('tee', 350, { penaltyStrokes: 1 }), shot('fairway', 120)], false);
    const E = pgaTourBaseline;
    expect(shotStrokesGained(r.holes[0], 0, E)).toBeCloseTo(E('tee', 350) - E('fairway', 120) - 2, 10);
  });

  it('per-shot values on a holed hole sum to E(tee) − score', () => {
    const shots = [shot('tee', 350, { penaltyStrokes: 1 }), shot('rough', 140), shot('bunker', 15), shot('green', 6), shot('green', 1)];
    const r = play(round(), 0, shots);
    for (const E of [pgaTourBaseline, modeledBaseline(6.8), modeledBaseline(20)]) {
      const sum = r.holes[0].shots.reduce((s, _, i) => s + shotStrokesGained(r.holes[0], i, E)!, 0);
      expect(sum).toBeCloseTo(E('tee', 350) - holeScore(r.holes[0])!, 10);
    }
  });

  it('is unknown for the last shot of an unfinished hole and uses the pick-up position', () => {
    let r = play(round(), 0, [shot('tee', 350), shot('fairway', 120)], false);
    expect(shotStrokesGained(r.holes[0], 1, pgaTourBaseline)).toBeNull();
    r = finishHole(r, 0, { kind: 'pickedUp', lie: 'green', distanceM: 8 });
    expect(shotStrokesGained(r.holes[0], 1, pgaTourBaseline)).toBeCloseTo(
      pgaTourBaseline('fairway', 120) - pgaTourBaseline('green', 8) - 1,
      10,
    );
  });
});

describe('categories', () => {
  it('follows the standard definitions', () => {
    expect(sgCategory(shot('tee', 350), 4)).toBe('offTheTee');
    expect(sgCategory(shot('tee', 150), 3)).toBe('approach');
    expect(sgCategory(shot('fairway', 28), 4)).toBe('approach');
    expect(sgCategory(shot('rough', 27), 4)).toBe('aroundTheGreen');
    expect(sgCategory(shot('fringe', 3), 4)).toBe('aroundTheGreen');
    expect(sgCategory(shot('green', 12), 4)).toBe('putting');
  });

  it('round totals add up across categories', () => {
    let r = play(round(), 0, [shot('tee', 350), shot('fairway', 120), shot('rough', 12), shot('green', 2)]);
    r = play(r, 1, [shot('tee', 150), shot('green', 9), shot('green', 1)]);
    const sg = roundStrokesGained(r, pgaTourBaseline);
    expect(sg.offTheTee + sg.approach + sg.aroundTheGreen + sg.putting).toBeCloseTo(sg.total, 10);
    expect(roundShotsSg(r, pgaTourBaseline)).toHaveLength(7);
    const expectedTotal = pgaTourBaseline('tee', 350) - 4 + pgaTourBaseline('tee', 150) - 3;
    expect(sg.total).toBeCloseTo(expectedTotal, 10);
  });
});
