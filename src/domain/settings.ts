import type { HandicapClass, Settings } from './types';

export const PRESET_HANDICAP_CLASSES: HandicapClass[] = [
  { id: 'own', kind: 'own' },
  { id: 'pga', kind: 'pga' },
  { id: 'hcp-0', kind: 'handicap', handicap: 0 },
  { id: 'hcp-10', kind: 'handicap', handicap: 10 },
  { id: 'hcp-20', kind: 'handicap', handicap: 20 },
  { id: 'hcp-30', kind: 'handicap', handicap: 30 },
];

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  handicap: 6.8,
  teeGender: 'male',
  language: 'en',
  golfCourseApiKey: '',
  handicapClasses: PRESET_HANDICAP_CLASSES,
  primaryHandicapClassId: 'own',
};

/** Handicap the Baseline of a class is modeled for; null means the measured PGA Tour Baseline. */
export function classHandicap(cls: HandicapClass, settings: Settings): number | null {
  switch (cls.kind) {
    case 'pga':
      return null;
    case 'own':
      return settings.handicap;
    case 'handicap':
      return cls.handicap;
  }
}

export function isValidHandicap(value: number): boolean {
  return Number.isFinite(value) && value >= -10 && value <= 54;
}

export function addHandicapClass(settings: Settings, handicap: number): Settings {
  if (!isValidHandicap(handicap)) throw new Error(`Invalid handicap: ${handicap}`);
  const rounded = Math.round(handicap * 10) / 10;
  const exists = settings.handicapClasses.some(
    (c) => c.kind === 'handicap' && c.handicap === rounded,
  );
  if (exists) return settings;
  const cls: HandicapClass = { id: `hcp-${rounded}`, kind: 'handicap', handicap: rounded };
  const classes = [...settings.handicapClasses, cls].sort(sortClasses);
  return { ...settings, handicapClasses: classes };
}

export function removeHandicapClass(settings: Settings, id: string): Settings {
  if (id === 'own') return settings;
  const classes = settings.handicapClasses.filter((c) => c.id !== id);
  const primary = settings.primaryHandicapClassId === id ? 'own' : settings.primaryHandicapClassId;
  return { ...settings, handicapClasses: classes, primaryHandicapClassId: primary };
}

function sortKey(c: HandicapClass): number {
  if (c.kind === 'own') return -1000;
  if (c.kind === 'pga') return -100;
  return c.handicap;
}

function sortClasses(a: HandicapClass, b: HandicapClass): number {
  return sortKey(a) - sortKey(b);
}
