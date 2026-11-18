import { describe, expect, it } from 'vitest';
import { defaultBag } from '../domain/bag';
import { emptyCourse } from '../domain/course';
import { finishHole, newShot, saveShot, startRound } from '../domain/round';
import type { Lie, Round, Shot } from '../domain/types';
import { pgaTourBaseline } from './baseline';
import { summarizeRound } from './summary';

const bag = defaultBag();
const shot = (lie: Lie, d: number, extra: Partial<Shot> = {}): Shot => ({ ...newShot({ lie, distanceM: d }, bag[5]), ...extra });

function round(): Round {
  const c = emptyCourse('male');
  c.clubName = 'GC';
  c.tees[0].name = 'Y';
  c.tees[0].holes.forEach((h) => (h.lengthM = 350));
  return startRound({ course: c, tee: c.tees[0], startHole: 1, holeCount: 18, handicap: 6.8 });
}

describe('round summary', () => {
  it('summarizes holed and picked-up holes', () => {
    let r = round();
    for (const s of [shot('tee', 350, { penaltyStrokes: 1 }), shot('fairway', 120), shot('green', 5), shot('green', 1)]) r = saveShot(r, 0, s);
    r = finishHole(r, 0, { kind: 'holed' });
    for (const s of [shot('tee', 350), shot('rough', 20)]) r = saveShot(r, 1, s);
    r = finishHole(r, 1, { kind: 'pickedUp', lie: 'rough', distanceM: 15 });
    r = saveShot(r, 2, shot('tee', 350)); // in progress, end unknown

    const s = summarizeRound(r, pgaTourBaseline);
    expect(s.holes.map((h) => [h.number, h.score, h.pickedUp])).toEqual([[1, 5, false], [2, null, true], [3, null, false]]);
    expect(s.holes[0].sg).toBeCloseTo(pgaTourBaseline('tee', 350) - 5, 10);
    expect(s.holes[1].sg).toBeNull();
    expect(s.shotCount).toEqual({ offTheTee: 2, approach: 1, aroundTheGreen: 1, putting: 2 });
    expect(s.putts).toBe(2);
    expect(s.penaltyStrokes).toBe(1);
  });
});
