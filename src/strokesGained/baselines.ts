import { classHandicap } from '../domain/settings';
import type { HandicapClass, Settings } from '../domain/types';
import { pgaTourBaseline, type Baseline } from './baseline';
import { modeledBaseline } from './modeledBaseline';

/** The Baseline for a Handicap Class: measured for the PGA Tour, modeled otherwise. */
export function baselineFor(cls: HandicapClass, settings: Settings): Baseline {
  const handicap = classHandicap(cls, settings);
  return handicap === null ? pgaTourBaseline : modeledBaseline(handicap);
}
