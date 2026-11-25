import { describe, expect, it } from 'vitest';
import { shotsScore } from './holeScore';
import { defaultBag } from './bag';
import { emptyCourse } from './course';
import { roundsToCsv } from './csv';
import {
  currentHoleIndex,
  deleteShot,
  finishHole,
  isAroundTheGreen,
  newShot,
  nextShotDraft,
  normalizeShot,
  roundTotals,
  saveShot,
  shotEnd,
  shotProgressM,
  startRound,
  suggestClub,
  validateShot,
} from './round';
import type { Course, Lie, Round, Shot } from './types';

function course(): Course {
  const c = emptyCourse('male');
  c.clubName = 'GC Test';
  c.tees[0].name = 'Yellow';
  c.tees[0].holes.forEach((h, i) => {
    h.lengthM = 300 + i;
    h.par = i % 4 === 0 ? 3 : 4;
  });
  return c;
}

const bag = defaultBag();
const club = (name: string) => bag.find((c) => c.name === name)!;
const shot = (lie: Lie, distanceM: number, clubName = '7i', extra: Partial<Shot> = {}): Shot => ({
  ...newShot({ lie, distanceM }, club(clubName)),
  ...extra,
});

function playHole(round: Round, index: number, shots: Shot[], outcome: 'holed' | 'none' = 'holed'): Round {
  let r = round;
  for (const s of shots) r = saveShot(r, index, s);
  return outcome === 'holed' ? finishHole(r, index, { kind: 'holed' }) : r;
}

describe('starting a round', () => {
  it('orders holes from the start hole and wraps around', () => {
    const c = course();
    const r = startRound({ course: c, tee: c.tees[0], startHole: 10, holeCount: 18, handicap: 6.8 });
    expect(r.holes.map((h) => h.number)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(r.courseName).toBe('GC Test');
    expect(r.handicap).toBe(6.8);
  });

  it('supports nine holes', () => {
    const c = course();
    const r = startRound({ course: c, tee: c.tees[0], startHole: 10, holeCount: 9, handicap: 6.8 });
    expect(r.holes.map((h) => h.number)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  it('first shot defaults to the tee at hole length', () => {
    const c = course();
    const r = startRound({ course: c, tee: c.tees[0], startHole: 1, holeCount: 18, handicap: 6.8 });
    expect(nextShotDraft(r.holes[1])).toEqual({ lie: 'tee', distanceM: 301 });
  });

  it('first shot on a Hole Map starts at the tee, measured straight to the pin', () => {
    const c = course();
    const r = startRound({ course: c, tee: c.tees[0], startHole: 1, holeCount: 18, handicap: 6.8 });
    const tee = { lat: 48, lon: 7.9 };
    const pin = { lat: 48 + 250 / 111_195, lon: 7.9 };
    expect(nextShotDraft(r.holes[1], { tee, pin })).toEqual({ lie: 'tee', distanceM: 250, position: tee });
  });

  it('the first Shot of a Hole is always from the Tee, later Shots may be too', () => {
    const c = course();
    let r = startRound({ course: c, tee: c.tees[0], startHole: 1, holeCount: 18, handicap: 6.8 });
    r = saveShot(r, 0, shot('fairway', 300, 'Driver'));
    r = saveShot(r, 0, shot('tee', 300, 'Driver')); // re-tee after out of bounds
    expect(r.holes[0].shots.map((s) => s.lie)).toEqual(['tee', 'tee']);
    r = saveShot(r, 0, { ...r.holes[0].shots[0], lie: 'rough' });
    expect(r.holes[0].shots[0].lie).toBe('tee');
  });
});

describe('playing a hole', () => {
  const c = course();
  const base = startRound({ course: c, tee: c.tees[0], startHole: 1, holeCount: 18, handicap: 6.8 });

  it('derives shot ends, progress and score including penalties', () => {
    const r = playHole(base, 1, [
      shot('tee', 360, 'Driver', { penaltyStrokes: 1 }),
      shot('rough', 140),
      shot('green', 6, 'Putter'),
      shot('green', 0.8, 'Putter'),
    ]);
    const h = r.holes[1];
    expect(shotEnd(h, 0)).toEqual({ kind: 'position', lie: 'rough', distanceM: 140 });
    expect(shotEnd(h, 3)).toEqual({ kind: 'holed' });
    expect(shotProgressM(h, 0)).toBe(220);
    expect(shotProgressM(h, 3)).toBe(0.8);
    expect(shotsScore(h)).toBe(5);
    expect(currentHoleIndex(r)).toBe(0);
  });

  it('picked-up hole ends the last shot at the pick-up position and has no score', () => {
    let r = playHole(base, 0, [shot('tee', 150, '7i'), shot('bunker', 12, '56°')], 'none');
    r = finishHole(r, 0, { kind: 'pickedUp', lie: 'bunker', distanceM: 10 });
    expect(shotEnd(r.holes[0], 1)).toEqual({ kind: 'position', lie: 'bunker', distanceM: 10 });
    expect(shotsScore(r.holes[0])).toBeNull();
    expect(roundTotals(r)).toEqual({ holesCompleted: 0, strokes: 0, par: 0 });
  });

  it('last shot of an unfinished hole has an unknown end', () => {
    const r = playHole(base, 0, [shot('tee', 150)], 'none');
    expect(shotEnd(r.holes[0], 0)).toEqual({ kind: 'unknown' });
    expect(shotProgressM(r.holes[0], 0)).toBeNull();
  });

  it('editing a shot replaces it; deleting one reopens the hole', () => {
    let r = playHole(base, 0, [shot('tee', 150), shot('green', 3, 'Putter')]);
    const first = r.holes[0].shots[0];
    r = saveShot(r, 0, { ...first, distanceM: 155 });
    expect(r.holes[0].shots).toHaveLength(2);
    expect(r.holes[0].shots[0].distanceM).toBe(155);
    r = deleteShot(r, 0, r.holes[0].shots[1].id);
    expect(r.holes[0].outcome).toBeUndefined();
  });

  it('totals only count holed-out holes', () => {
    let r = playHole(base, 0, [shot('tee', 150), shot('green', 3, 'Putter')]);
    r = playHole(r, 1, [shot('tee', 300, 'Driver'), shot('fairway', 100, 'PW'), shot('green', 2, 'Putter')]);
    expect(roundTotals(r)).toEqual({ holesCompleted: 2, strokes: 5, par: 7 });
    expect(currentHoleIndex(r)).toBe(2);
  });
});

describe('shot rules', () => {
  it('around the green is within 27 m and not on the green or tee', () => {
    expect(isAroundTheGreen('rough', 27)).toBe(true);
    expect(isAroundTheGreen('rough', 28)).toBe(false);
    expect(isAroundTheGreen('green', 10)).toBe(false);
    expect(isAroundTheGreen('fringe', 4)).toBe(true);
  });

  it('requires a short game type around the green, defaulting from bunker and fringe lies', () => {
    expect(validateShot(shot('rough', 15, '56°'))).toContain('shortGameTypeMissing');
    expect(newShot({ lie: 'bunker', distanceM: 15 }).shortGameType).toBe('bunkerShot');
    expect(newShot({ lie: 'fringe', distanceM: 5 }).shortGameType).toBe('fringePutt');
    expect(newShot({ lie: 'bunker', distanceM: 120 }).shortGameType).toBe('bunkerShot');
    expect(normalizeShot(newShot({ lie: 'bunker', distanceM: 120 })).shortGameType).toBeUndefined();
  });

  it('drops fields that do not apply', () => {
    const putt = normalizeShot(shot('green', 4, 'Putter', { shape: 'draw', break: 'straight' }));
    expect(putt.shape).toBeUndefined();
    expect(putt.break).toBe('straight');
    const drive = normalizeShot(shot('tee', 350, 'Driver', { missLength: 'long', break: 'straight' }));
    expect(drive.missLength).toBeUndefined();
    expect(drive.break).toBeUndefined();
  });

  it('rejects implausible distances', () => {
    expect(validateShot(shot('fairway', 0))).toContain('distanceInvalid');
    expect(validateShot(shot('green', 80, 'Putter'))).toContain('puttTooFar');
  });
});

describe('club suggestion', () => {
  it('uses putter on the green and driver off par-4 tees', () => {
    expect(suggestClub(bag, [], 'green', 5, 4)?.name).toBe('Putter');
    expect(suggestClub(bag, [], 'tee', 350, 4)?.name).toBe('Driver');
    expect(suggestClub(bag, [], 'tee', 150, 3)).toBeUndefined();
  });

  it('learns from earlier shots at a similar distance and lie', () => {
    const history = [shot('fairway', 148, '7i'), shot('fairway', 152, '7i'), shot('fairway', 150, '6i'), shot('rough', 150, '8i')];
    expect(suggestClub(bag, history, 'fairway', 150, 4)?.name).toBe('7i');
    expect(suggestClub(bag, history, 'tee', 150, 3)?.name).toBe('7i');
    expect(suggestClub(bag, history, 'rough', 150, 4)?.name).toBe('8i');
  });

  it('falls back to the highest-lofted wedge around the green', () => {
    expect(suggestClub(bag, [], 'rough', 12, 4)?.name).toBe('60°');
  });
});

describe('CSV export', () => {
  it('writes one row per shot with derived end', () => {
    const c = course();
    let r = startRound({ course: c, tee: c.tees[0], startHole: 1, holeCount: 18, handicap: 6.8, now: Date.UTC(2026, 10, 18) });
    r = playHole(r, 0, [shot('tee', 150), shot('green', 3, 'Putter')]);
    const lines = roundsToCsv([r]).trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('2026-11-18,GC Test,Yellow,1,3,1,2,1,tee,150,7i,0');
    expect(lines[1].endsWith('green,3,147')).toBe(true);
    expect(lines[2].endsWith('holed,0,3')).toBe(true);
  });
});
