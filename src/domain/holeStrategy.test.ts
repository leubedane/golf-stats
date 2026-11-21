import { describe, expect, it } from 'vitest';
import {
  emptyStrategy,
  isEmptyStrategy,
  strategyId,
  strategyTee,
  toggleGreenSide,
  withTeeClub,
} from './holeStrategy';
import { emptyCourse, emptyTee } from './course';

describe('Hole Strategy', () => {
  const base = emptyStrategy('course-1', 7);

  it('is keyed by Course and hole number', () => {
    expect(base.id).toBe(strategyId('course-1', 7));
    expect(strategyId('a', 1)).not.toBe(strategyId('a', 10));
  });

  it('starts empty', () => {
    expect(isEmptyStrategy(base)).toBe(true);
    expect(isEmptyStrategy({ ...base, notes: '  ' })).toBe(true);
    expect(isEmptyStrategy({ ...base, teeTarget: 'left bunker' })).toBe(false);
    expect(isEmptyStrategy({ ...base, dangerSide: ['long'] })).toBe(false);
  });

  it('toggles a side on and off, in a fixed order', () => {
    const s = toggleGreenSide(toggleGreenSide(base, 'goodMiss', 'left'), 'goodMiss', 'short');
    expect(s.goodMiss).toEqual(['short', 'left']);
    expect(toggleGreenSide(s, 'goodMiss', 'left').goodMiss).toEqual(['short']);
  });

  it('never keeps a side as both Good Miss and Danger Side', () => {
    const good = toggleGreenSide(base, 'goodMiss', 'long');
    const danger = toggleGreenSide(good, 'dangerSide', 'long');
    expect(danger.goodMiss).toEqual([]);
    expect(danger.dangerSide).toEqual(['long']);
    expect(toggleGreenSide(danger, 'goodMiss', 'long').dangerSide).toEqual([]);
  });

  it('keeps the Tee Club name so it survives removal from the Bag', () => {
    const s = withTeeClub(base, { id: 'c1', name: '3W', kind: 'wood', order: 2 });
    expect([s.teeClubId, s.teeClubName]).toEqual(['c1', '3W']);
    expect(withTeeClub(s, null)).toMatchObject({ teeClubId: null, teeClubName: '' });
  });

  it('shows hole lengths from a Tee of the preferred gender', () => {
    const course = emptyCourse('male');
    const female = { ...emptyTee('female'), name: 'Rot' };
    course.tees = [{ ...course.tees[0], name: 'Gelb' }, female];
    expect(strategyTee(course, 'female')?.name).toBe('Rot');
    expect(strategyTee(course, 'male')?.name).toBe('Gelb');
    expect(strategyTee({ ...course, tees: [female] }, 'male')?.name).toBe('Rot');
    expect(strategyTee({ ...course, tees: [] }, 'male')).toBeUndefined();
  });
});
