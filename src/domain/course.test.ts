import { describe, expect, it } from 'vitest';
import { courseDisplayName, coursePar, emptyCourse, emptyHoles, validateCourse } from './course';
import type { Course } from './types';

function validCourse(): Course {
  const c = emptyCourse('male');
  c.clubName = 'GC Test';
  c.tees[0].name = 'Yellow';
  c.tees[0].courseRating = 71.5;
  c.tees[0].slope = 130;
  c.tees[0].holes.forEach((h) => (h.lengthM = 350));
  return c;
}

describe('course', () => {
  it('default 18 holes use every stroke index once', () => {
    const si = emptyHoles(18).map((h) => h.strokeIndex).sort((a, b) => a - b);
    expect(si).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it('accepts a complete course', () => {
    const c = validCourse();
    expect(validateCourse(c)).toEqual([]);
    expect(coursePar(c.tees[0])).toBe(72);
  });

  it('reports missing data', () => {
    const c = emptyCourse('male');
    const codes = validateCourse(c).map((p) => p.code);
    expect(codes).toContain('clubNameMissing');
    expect(codes).toContain('teeNameMissing');
    expect(codes).toContain('courseRatingInvalid');
    expect(codes).toContain('lengthInvalid');
  });

  it('rejects duplicate stroke indexes but allows odd-only on nine holes', () => {
    const c = validCourse();
    c.tees[0].holes[1].strokeIndex = c.tees[0].holes[0].strokeIndex;
    expect(validateCourse(c).map((p) => p.code)).toContain('strokeIndexInvalid');

    const nine = validCourse();
    nine.tees[0].holes = emptyHoles(9).map((h, i) => ({ ...h, lengthM: 300, strokeIndex: i * 2 + 1 }));
    expect(validateCourse(nine)).toEqual([]);
  });

  it('display name avoids repeating the club name', () => {
    expect(courseDisplayName({ clubName: 'GC A', courseName: 'GC A' })).toBe('GC A');
    expect(courseDisplayName({ clubName: 'GC A', courseName: 'West' })).toBe('GC A – West');
  });
});
