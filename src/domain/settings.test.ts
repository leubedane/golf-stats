import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, addHandicapClass, classHandicap, removeHandicapClass } from './settings';

describe('handicap classes', () => {
  it('own class follows the configured handicap', () => {
    const own = DEFAULT_SETTINGS.handicapClasses.find((c) => c.kind === 'own')!;
    expect(classHandicap(own, { ...DEFAULT_SETTINGS, handicap: 12.4 })).toBe(12.4);
  });

  it('adds a custom class once, sorted by handicap', () => {
    let s = addHandicapClass(DEFAULT_SETTINGS, 5);
    s = addHandicapClass(s, 5);
    const ids = s.handicapClasses.map((c) => c.id);
    expect(ids).toEqual(['own', 'pga', 'hcp-0', 'hcp-5', 'hcp-10', 'hcp-20', 'hcp-30']);
  });

  it('rejects impossible handicaps', () => {
    expect(() => addHandicapClass(DEFAULT_SETTINGS, 60)).toThrow();
  });

  it('removing the primary class falls back to own; own cannot be removed', () => {
    const s = removeHandicapClass({ ...DEFAULT_SETTINGS, primaryHandicapClassId: 'hcp-10' }, 'hcp-10');
    expect(s.primaryHandicapClassId).toBe('own');
    expect(removeHandicapClass(s, 'own').handicapClasses.some((c) => c.id === 'own')).toBe(true);
  });
});
