import { describe, expect, it } from 'vitest';
import type { Lie } from '../domain/types';
import { interpolate, pgaTourBaseline } from './baseline';
import { REFERENCE_PAR, modeledBaseline, referenceScore, typicalOverPar } from './modeledBaseline';

const yd = (y: number) => y * 0.9144;
const ft = (f: number) => f * 0.3048;

describe('PGA Tour baseline', () => {
  it('matches published table values', () => {
    expect(pgaTourBaseline('tee', yd(400))).toBeCloseTo(3.99, 2);
    expect(pgaTourBaseline('fairway', yd(100))).toBeCloseTo(2.8, 2);
    expect(pgaTourBaseline('green', ft(10))).toBeCloseTo(1.61, 2);
  });

  it('interpolates between rows and extrapolates beyond them', () => {
    expect(pgaTourBaseline('fairway', yd(110))).toBeCloseTo((2.8 + 2.85) / 2, 3);
    expect(interpolate([[0, 1], [10, 2]], 20)).toBe(3);
  });

  it('values fringe like fairway, bunker like sand, short tee shots like fairway', () => {
    expect(pgaTourBaseline('fringe', 10)).toBe(pgaTourBaseline('fairway', 10));
    expect(pgaTourBaseline('bunker', yd(30))).toBeCloseTo(2.66, 2);
    expect(pgaTourBaseline('tee', yd(80))).toBe(pgaTourBaseline('fairway', yd(80)));
  });

  it('never values a ball off the hole below one stroke', () => {
    expect(pgaTourBaseline('green', 0.1)).toBeGreaterThanOrEqual(1);
  });
});

describe('modeled baselines', () => {
  it.each([0, 6.8, 10, 20, 30])('handicap %s is calibrated to its typical score on the Reference Course', (h) => {
    expect(referenceScore(modeledBaseline(h))).toBeCloseTo(REFERENCE_PAR + typicalOverPar(h), 6);
  });

  it('gets harder with handicap everywhere', () => {
    const situations: [Lie, number][] = [['tee', yd(400)], ['fairway', yd(150)], ['rough', yd(15)], ['bunker', yd(10)], ['green', ft(6)]];
    for (const [lie, d] of situations) {
      const values = [0, 10, 20, 30].map((h) => modeledBaseline(h)(lie, d));
      expect(pgaTourBaseline(lie, d)).toBeLessThan(values[0]);
      values.slice(1).forEach((v, i) => expect(v).toBeGreaterThan(values[i]));
    }
  });

  it('is close to published amateur data points', () => {
    // Lou Stagner / Arccos: 10-handicap from 100 yd fairway ≈ 3.38, rough ≈ 3.5.
    expect(Math.abs(modeledBaseline(10)('fairway', yd(100)) - 3.38)).toBeLessThan(0.15);
    expect(Math.abs(modeledBaseline(10)('rough', yd(100)) - 3.5)).toBeLessThan(0.2);
    // Pinpoint: 15-handicap from 160 yd fairway ≈ 3.92.
    expect(Math.abs(modeledBaseline(15)('fairway', yd(160)) - 3.92)).toBeLessThan(0.2);
  });
});
