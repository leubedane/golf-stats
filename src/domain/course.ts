import { newId } from './ids';
import type { Course, Hole, Tee, TeeGender } from './types';

export const coursePar = (tee: Tee): number => tee.holes.reduce((sum, h) => sum + h.par, 0);
export const courseLengthM = (tee: Tee): number =>
  tee.holes.reduce((sum, h) => sum + h.lengthM, 0);

export const courseDisplayName = (c: Pick<Course, 'clubName' | 'courseName'>): string =>
  !c.courseName || c.courseName === c.clubName ? c.clubName : `${c.clubName} – ${c.courseName}`;

export function emptyHoles(count: 9 | 18): Hole[] {
  // Default stroke index: odd numbers on the front nine, even on the back (or 1..9 for nine holes).
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    par: 4,
    lengthM: 0,
    strokeIndex: count === 9 ? i + 1 : i < 9 ? i * 2 + 1 : (i - 9) * 2 + 2,
  }));
}

export function emptyTee(gender: TeeGender, holeCount: 9 | 18 = 18): Tee {
  return { id: newId(), name: '', gender, courseRating: 0, slope: 113, holes: emptyHoles(holeCount) };
}

export function emptyCourse(gender: TeeGender): Course {
  return {
    id: newId(),
    clubName: '',
    courseName: '',
    city: '',
    country: '',
    source: 'manual',
    tees: [emptyTee(gender)],
    updatedAt: Date.now(),
  };
}

export type CourseProblem =
  | { code: 'clubNameMissing' }
  | { code: 'noTees' }
  | { code: 'teeNameMissing'; tee: number }
  | { code: 'courseRatingInvalid'; tee: number }
  | { code: 'slopeInvalid'; tee: number }
  | { code: 'parInvalid'; tee: number; hole: number }
  | { code: 'lengthInvalid'; tee: number; hole: number }
  | { code: 'strokeIndexInvalid'; tee: number };

/** Problems that make a Course unusable for a Round. Empty list means valid. */
export function validateCourse(course: Course): CourseProblem[] {
  const problems: CourseProblem[] = [];
  if (!course.clubName.trim()) problems.push({ code: 'clubNameMissing' });
  if (course.tees.length === 0) problems.push({ code: 'noTees' });
  course.tees.forEach((tee, t) => {
    if (!tee.name.trim()) problems.push({ code: 'teeNameMissing', tee: t });
    if (!(tee.courseRating > 20 && tee.courseRating < 90))
      problems.push({ code: 'courseRatingInvalid', tee: t });
    if (!(Number.isInteger(tee.slope) && tee.slope >= 55 && tee.slope <= 155))
      problems.push({ code: 'slopeInvalid', tee: t });
    tee.holes.forEach((h) => {
      if (!(h.par >= 3 && h.par <= 6)) problems.push({ code: 'parInvalid', tee: t, hole: h.number });
      if (!(h.lengthM > 0 && h.lengthM < 800))
        problems.push({ code: 'lengthInvalid', tee: t, hole: h.number });
    });
    // Each Stroke Index used once, 1..18 (nine-hole courses often use odd or even indexes only).
    const indexes = tee.holes.map((h) => h.strokeIndex);
    const unique = new Set(indexes).size === indexes.length;
    const inRange = indexes.every((i) => Number.isInteger(i) && i >= 1 && i <= 18);
    if (!unique || !inRange) problems.push({ code: 'strokeIndexInvalid', tee: t });
  });
  return problems;
}
