import { newId } from './ids';
import type { Club, ClubKind } from './types';

export const MAX_CLUBS = 14;

const DEFAULT_CLUBS: [string, ClubKind][] = [
  ['Driver', 'driver'],
  ['3W', 'wood'],
  ['4H', 'hybrid'],
  ['5i', 'iron'],
  ['6i', 'iron'],
  ['7i', 'iron'],
  ['8i', 'iron'],
  ['9i', 'iron'],
  ['PW', 'wedge'],
  ['52°', 'wedge'],
  ['56°', 'wedge'],
  ['60°', 'wedge'],
  ['Putter', 'putter'],
];

export function defaultBag(): Club[] {
  return DEFAULT_CLUBS.map(([name, kind], order) => ({ id: newId(), name, kind, order }));
}

export const CLUB_KINDS: ClubKind[] = ['driver', 'wood', 'hybrid', 'iron', 'wedge', 'putter'];
