import type { Club, Course, GreenSide, HoleStrategy, Tee, TeeGender } from './types';

export const GREEN_SIDES: readonly GreenSide[] = ['short', 'long', 'left', 'right'];

export const strategyId = (courseId: string, holeNumber: number): string => `${courseId}:${holeNumber}`;

export function emptyStrategy(courseId: string, holeNumber: number): HoleStrategy {
  return {
    id: strategyId(courseId, holeNumber),
    courseId,
    holeNumber,
    teeClubId: null,
    teeClubName: '',
    teeTarget: '',
    goodMiss: [],
    dangerSide: [],
    notes: '',
    updatedAt: 0,
  };
}

/** True when nothing is planned; an empty Hole Strategy is deleted instead of stored. */
export function isEmptyStrategy(s: HoleStrategy): boolean {
  return (
    !s.teeClubId &&
    !s.teeClubName.trim() &&
    !s.teeTarget.trim() &&
    !s.notes.trim() &&
    s.goodMiss.length === 0 &&
    s.dangerSide.length === 0
  );
}

/** Toggles a side in one field; a side added to one field leaves the other, so it is never both. */
export function toggleGreenSide(s: HoleStrategy, field: 'goodMiss' | 'dangerSide', side: GreenSide): HoleStrategy {
  const other = field === 'goodMiss' ? 'dangerSide' : 'goodMiss';
  const adding = !s[field].includes(side);
  const inField = adding ? [...s[field], side] : s[field].filter((x) => x !== side);
  return {
    ...s,
    [field]: GREEN_SIDES.filter((x) => inField.includes(x)),
    [other]: adding ? s[other].filter((x) => x !== side) : s[other],
  };
}

export function withTeeClub(s: HoleStrategy, club: Club | null): HoleStrategy {
  return { ...s, teeClubId: club?.id ?? null, teeClubName: club?.name ?? '' };
}

/** The Tee whose hole lengths are shown next to a Course Strategy: the first of the golfer's gender. */
export function strategyTee(course: Course, gender: TeeGender): Tee | undefined {
  return course.tees.find((t) => t.gender === gender) ?? course.tees[0];
}
