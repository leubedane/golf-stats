import { describe, expect, it } from 'vitest';
import { defaultBag } from '../domain/bag';
import { emptyCourse } from '../domain/course';
import { finishHole, newShot, saveShot, startRound } from '../domain/round';
import type { Lie, Round, Shot } from '../domain/types';
import { pgaTourBaseline } from '../strokesGained/baseline';
import { averagePerRound, orderByBag, puttingByBand, roundTrend, sgByClub, sgByShortGameType, tendenciesByClub } from './stats';

const bag = defaultBag();
const club = (n: string) => bag.find((c) => c.name === n)!;
const shot = (lie: Lie, d: number, c: string, extra: Partial<Shot> = {}): Shot => ({ ...newShot({ lie, distanceM: d }, club(c)), ...extra });

function playedRound(startedAt: number, holes: Shot[][]): Round {
  const c = emptyCourse('male');
  c.clubName = 'GC';
  c.tees[0].name = 'Y';
  c.tees[0].holes.forEach((h) => (h.lengthM = 350));
  let r = startRound({ course: c, tee: c.tees[0], startHole: 1, holeCount: 18, handicap: 6.8, now: startedAt });
  holes.forEach((shots, i) => {
    for (const s of shots) r = saveShot(r, i, s);
    r = finishHole(r, i, { kind: 'holed' });
  });
  return r;
}

const r1 = playedRound(2000, [
  [shot('tee', 350, 'Driver', { missSide: 'right', shape: 'fade' }), shot('fairway', 120, '9i'), shot('rough', 15, '56°', { shortGameType: 'chipHigh' }), shot('green', 1.5, 'Putter')],
  [shot('tee', 350, 'Driver', { missSide: 'left', shape: 'hook' }), shot('rough', 130, '8i'), shot('green', 7, 'Putter'), shot('green', 0.5, 'Putter')],
]);
const r2 = playedRound(1000, [[shot('tee', 350, 'Driver', { missSide: 'right', shape: 'fade' }), shot('fairway', 100, 'PW'), shot('green', 3, 'Putter')]]);

describe('stats', () => {
  it('trend is ordered by date and averages per round', () => {
    const trend = roundTrend([r1, r2], pgaTourBaseline);
    expect(trend.map((p) => p.roundId)).toEqual([r2.id, r1.id]);
    const avg = averagePerRound(trend)!;
    expect(avg.total).toBeCloseTo((trend[0].sg.total + trend[1].sg.total) / 2, 10);
    expect(averagePerRound([])).toBeNull();
  });

  it('groups SG by club with per-shot average', () => {
    const driver = sgByClub([r1, r2], pgaTourBaseline).find((g) => g.key === 'Driver')!;
    expect(driver.shots).toBe(3);
    expect(driver.sgPerShot).toBeCloseTo(driver.sg / 3, 10);
  });

  it('groups around-the-green shots by short game type', () => {
    const groups = sgByShortGameType([r1, r2], pgaTourBaseline);
    expect(groups.map((g) => [g.key, g.shots])).toEqual([['chipHigh', 1]]);
  });

  it('puts putts into distance bands and counts holed putts', () => {
    const bands = puttingByBand([r1, r2], pgaTourBaseline);
    expect(bands.map((b) => [b.key, b.shots, b.holed])).toEqual([['0-1', 1, 1], ['1-2', 1, 1], ['2-5', 1, 1], ['5-10', 1, 0], ['10+', 0, 0]]);
  });

  it('counts miss direction and shape per club', () => {
    const driver = tendenciesByClub([r1, r2]).find((t) => t.clubName === 'Driver')!;
    expect(driver.side).toEqual({ left: 1, onTarget: 0, right: 2 });
    expect(driver.shapes).toEqual({ fade: 2, hook: 1 });
  });

  it('orders by bag position', () => {
    expect(orderByBag(['Putter', 'Old 3i', 'Driver'], (x) => x, ['Driver', 'Putter'])).toEqual(['Driver', 'Putter', 'Old 3i']);
  });
});
