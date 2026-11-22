import { courseDisplayName } from './course';
import { effectiveScore } from './holeScore';
import { newId } from './ids';
import type { Club, Course, HoleOutcome, Lie, Round, RoundHole, Shot, Tee } from './types';

/** Shots from within this distance that are not on the Green are Around-the-Green. */
export const AROUND_THE_GREEN_MAX_M = 27;

export interface StartOptions {
  course: Course;
  tee: Tee;
  startHole: number;
  holeCount: number;
  handicap: number;
  now?: number;
}

export function startRound({ course, tee, startHole, holeCount, handicap, now }: StartOptions): Round {
  const n = tee.holes.length;
  const startIndex = Math.max(0, tee.holes.findIndex((h) => h.number === startHole));
  const count = Math.min(Math.max(1, holeCount), n);
  const holes: RoundHole[] = Array.from({ length: count }, (_, i) => {
    const h = tee.holes[(startIndex + i) % n];
    return { number: h.number, par: h.par, lengthM: h.lengthM, strokeIndex: h.strokeIndex, shots: [] };
  });
  return {
    id: newId(),
    courseId: course.id,
    courseName: courseDisplayName(course),
    teeName: tee.name,
    courseRating: tee.courseRating,
    slope: tee.slope,
    handicap,
    startedAt: now ?? Date.now(),
    holes,
  };
}

export const isPutt = (lie: Lie): boolean => lie === 'green';

/** Around-the-Green Shots need a Short Game Type. */
export const isAroundTheGreen = (lie: Lie, distanceM: number): boolean =>
  lie !== 'green' && lie !== 'tee' && distanceM <= AROUND_THE_GREEN_MAX_M;

export const isFullShot = (lie: Lie, distanceM: number): boolean =>
  !isPutt(lie) && !isAroundTheGreen(lie, distanceM);

export const isHoleComplete = (hole: RoundHole): boolean => hole.outcome !== undefined;

export type ShotEnd = { kind: 'holed' } | { kind: 'position'; lie: Lie; distanceM: number } | { kind: 'unknown' };

/** Where a Shot finished: the next Shot's start, the hole, or the pick-up position. */
export function shotEnd(hole: RoundHole, index: number): ShotEnd {
  const next = hole.shots[index + 1];
  if (next) return { kind: 'position', lie: next.lie, distanceM: next.distanceM };
  if (index !== hole.shots.length - 1 || !hole.outcome) return { kind: 'unknown' };
  if (hole.outcome.kind === 'holed') return { kind: 'holed' };
  return { kind: 'position', lie: hole.outcome.lie, distanceM: hole.outcome.distanceM };
}

/** Distance gained toward the pin; approximates the Shot's length. Null when the end is unknown. */
export function shotProgressM(hole: RoundHole, index: number): number | null {
  const end = shotEnd(hole, index);
  const start = hole.shots[index].distanceM;
  if (end.kind === 'unknown') return null;
  return end.kind === 'holed' ? start : start - end.distanceM;
}

export interface RoundTotals {
  holesCompleted: number;
  strokes: number;
  par: number;
}

/** Totals over holes with Strokes, from the Hole Score or the Shots (Picked Up holes are excluded). */
export function roundTotals(round: Round): RoundTotals {
  return round.holes.reduce<RoundTotals>(
    (acc, h) => {
      const score = effectiveScore(h)?.strokes ?? null;
      if (score === null) return acc;
      return { holesCompleted: acc.holesCompleted + 1, strokes: acc.strokes + score, par: acc.par + h.par };
    },
    { holesCompleted: 0, strokes: 0, par: 0 },
  );
}

/** Index of the first hole with no Hole Score that is not complete, or the last hole when all are done. */
export function currentHoleIndex(round: Round): number {
  const i = round.holes.findIndex((h) => !isHoleComplete(h) && !h.score);
  return i === -1 ? round.holes.length - 1 : i;
}

// ---- Shot validation ----

export type ShotProblem = 'distanceInvalid' | 'puttTooFar' | 'shortGameTypeMissing' | 'clubMissing';

export function validateShot(shot: Shot): ShotProblem[] {
  const problems: ShotProblem[] = [];
  if (!(shot.distanceM > 0 && shot.distanceM < 800)) problems.push('distanceInvalid');
  if (isPutt(shot.lie) && shot.distanceM > 60) problems.push('puttTooFar');
  if (isAroundTheGreen(shot.lie, shot.distanceM) && !shot.shortGameType) problems.push('shortGameTypeMissing');
  if (!shot.clubId && !shot.clubName) problems.push('clubMissing');
  return problems;
}

/** Drops fields that don't apply to the Shot's Lie and distance. */
export function normalizeShot(shot: Shot): Shot {
  const s: Shot = { ...shot };
  if (!isAroundTheGreen(s.lie, s.distanceM)) delete s.shortGameType;
  if (!isPutt(s.lie)) delete s.break;
  if (!isFullShot(s.lie, s.distanceM)) delete s.shape;
  if (s.lie === 'tee') delete s.missLength;
  return s;
}

// ---- Editing a hole (pure; return a new Round) ----

function withHole(round: Round, holeIndex: number, update: (h: RoundHole) => RoundHole): Round {
  return { ...round, holes: round.holes.map((h, i) => (i === holeIndex ? update(h) : h)) };
}

export function saveShot(round: Round, holeIndex: number, shot: Shot): Round {
  const s = normalizeShot(shot);
  return withHole(round, holeIndex, (h) => {
    const exists = h.shots.some((x) => x.id === s.id);
    return { ...h, shots: exists ? h.shots.map((x) => (x.id === s.id ? s : x)) : [...h.shots, s] };
  });
}

export function deleteShot(round: Round, holeIndex: number, shotId: string): Round {
  return withHole(round, holeIndex, (h) => {
    const shots = h.shots.filter((s) => s.id !== shotId);
    // Removing a shot invalidates how the hole ended.
    return { ...h, shots, outcome: undefined };
  });
}

export function finishHole(round: Round, holeIndex: number, outcome: HoleOutcome): Round {
  return withHole(round, holeIndex, (h) => {
    if (h.shots.length === 0 && outcome.kind === 'holed') throw new Error('Cannot hole out without a shot');
    return { ...h, outcome };
  });
}

export function reopenHole(round: Round, holeIndex: number): Round {
  return withHole(round, holeIndex, (h) => ({ ...h, outcome: undefined }));
}

export function finishRound(round: Round, now = Date.now()): Round {
  return { ...round, finishedAt: now };
}

// ---- Defaults for the next Shot ----

export interface ShotDraft {
  lie: Lie | null;
  distanceM: number;
}

export function nextShotDraft(hole: RoundHole): ShotDraft {
  if (hole.shots.length === 0) return { lie: 'tee', distanceM: hole.lengthM };
  return { lie: null, distanceM: 0 };
}

/**
 * Suggests a Club: the putter on the Green, the driver from the Tee of a par 4/5,
 * otherwise the Club used most often from a similar Lie and distance in earlier Shots.
 */
export function suggestClub(
  bag: Club[],
  history: Shot[],
  lie: Lie,
  distanceM: number,
  par: number,
): Club | undefined {
  const byKind = (kind: Club['kind']) => bag.find((c) => c.kind === kind);
  if (lie === 'green') return byKind('putter');
  if (lie === 'tee' && par >= 4) return byKind('driver') ?? bag[0];
  if (distanceM <= 0) return undefined;

  const window = Math.max(8, distanceM * 0.07);
  const similarLie = (l: Lie) => (l === 'tee' || l === 'fairway' || l === 'fringe' ? 'short' : l);
  const counts = new Map<string, number>();
  for (const s of history) {
    if (!s.clubId || Math.abs(s.distanceM - distanceM) > window) continue;
    if (similarLie(s.lie) !== similarLie(lie)) continue;
    counts.set(s.clubId, (counts.get(s.clubId) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const fromHistory = best && bag.find((c) => c.id === best[0]);
  if (fromHistory) return fromHistory;

  if (isAroundTheGreen(lie, distanceM)) {
    const wedges = bag.filter((c) => c.kind === 'wedge');
    return wedges[wedges.length - 1];
  }
  return undefined;
}

export function newShot(draft: { lie: Lie; distanceM: number }, club?: Club): Shot {
  return {
    id: newId(),
    lie: draft.lie,
    distanceM: draft.distanceM,
    clubId: club?.id ?? null,
    clubName: club?.name ?? '',
    penaltyStrokes: 0,
    shortGameType: defaultShortGameType(draft.lie),
  };
}

/** Default Short Game Type for a Lie, when the Lie implies one. */
export function defaultShortGameType(lie: Lie): Shot['shortGameType'] {
  return lie === 'bunker' ? 'bunkerShot' : lie === 'fringe' ? 'fringePutt' : undefined;
}
