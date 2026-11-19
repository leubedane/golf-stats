import type { Course, TeeGender } from '../domain/types';

/**
 * Courses every new installation starts with. Fixed ids, so seeding twice keeps one copy.
 *
 * Golfclub Tuniberg: taken from the club's PC CADDIE online scorecard
 * (pccaddie.net/clubs/0497743, scorecard data dated 2022-02-14). Par and Stroke Index differ
 * between Tees, so each Tee carries its own.
 */
interface SeedTee {
  id: string;
  name: string;
  gender: TeeGender;
  courseRating: number;
  slope: number;
  par: number[];
  strokeIndex: number[];
  lengthM: number[];
}

const TUNIBERG_TEES: SeedTee[] = [
  {
    id: 'tuniberg-schwarz-male',
    name: 'Schwarz',
    gender: 'male',
    courseRating: 74.8,
    slope: 129,
    par: [4, 4, 5, 3, 4, 4, 4, 3, 5, 4, 5, 4, 4, 3, 5, 4, 3, 4],
    strokeIndex: [16, 4, 8, 10, 2, 18, 12, 14, 6, 17, 13, 3, 7, 9, 15, 1, 5, 11],
    lengthM: [284, 397, 516, 199, 422, 333, 354, 170, 510, 310, 492, 398, 369, 176, 475, 442, 184, 370],
  },
  {
    id: 'tuniberg-weiss-male',
    name: 'Weiß',
    gender: 'male',
    courseRating: 72.7,
    slope: 128,
    par: [4, 4, 5, 3, 5, 4, 4, 3, 4, 4, 5, 4, 4, 3, 5, 4, 3, 4],
    strokeIndex: [14, 4, 6, 8, 12, 16, 10, 18, 2, 15, 11, 3, 7, 9, 13, 1, 17, 5],
    lengthM: [284, 357, 483, 188, 450, 323, 354, 146, 410, 310, 492, 352, 346, 176, 469, 384, 136, 359],
  },
  {
    id: 'tuniberg-gelb-male',
    name: 'Gelb',
    gender: 'male',
    courseRating: 71.0,
    slope: 126,
    par: [4, 4, 5, 3, 5, 4, 4, 3, 4, 4, 5, 4, 4, 3, 5, 4, 3, 4],
    strokeIndex: [14, 4, 6, 10, 8, 16, 12, 18, 2, 15, 9, 3, 5, 13, 11, 1, 17, 7],
    lengthM: [274, 347, 435, 167, 450, 323, 313, 146, 350, 310, 461, 352, 346, 155, 447, 374, 128, 329],
  },
  {
    id: 'tuniberg-gelb-female',
    name: 'Gelb',
    gender: 'female',
    courseRating: 77.1,
    slope: 132,
    par: [4, 4, 5, 3, 5, 4, 4, 3, 4, 4, 5, 4, 4, 3, 5, 4, 3, 4],
    strokeIndex: [14, 4, 6, 10, 8, 16, 12, 18, 2, 15, 9, 3, 5, 13, 11, 1, 17, 7],
    lengthM: [274, 347, 435, 167, 450, 323, 313, 146, 350, 310, 461, 352, 346, 155, 447, 374, 128, 329],
  },
  {
    id: 'tuniberg-blau-male',
    name: 'Blau',
    gender: 'male',
    courseRating: 68.7,
    slope: 120,
    par: [4, 4, 5, 3, 4, 4, 4, 3, 4, 4, 5, 4, 4, 3, 4, 4, 3, 4],
    strokeIndex: [14, 4, 6, 10, 2, 16, 12, 18, 8, 15, 11, 5, 7, 13, 3, 1, 17, 9],
    lengthM: [266, 305, 435, 167, 396, 287, 313, 127, 350, 274, 434, 324, 298, 155, 402, 327, 107, 329],
  },
  {
    id: 'tuniberg-blau-female',
    name: 'Blau',
    gender: 'female',
    courseRating: 74.8,
    slope: 125,
    par: [4, 4, 5, 3, 5, 4, 4, 3, 4, 4, 5, 4, 4, 3, 5, 4, 3, 4],
    strokeIndex: [4, 6, 8, 14, 12, 16, 10, 18, 2, 11, 9, 1, 7, 15, 13, 3, 17, 5],
    lengthM: [266, 305, 435, 167, 396, 287, 313, 127, 350, 274, 434, 324, 298, 155, 402, 327, 107, 329],
  },
  {
    id: 'tuniberg-rot-male',
    name: 'Rot',
    gender: 'male',
    courseRating: 67.7,
    slope: 117,
    par: [4, 4, 5, 3, 4, 4, 4, 3, 4, 4, 5, 4, 4, 3, 4, 4, 3, 4],
    strokeIndex: [14, 4, 6, 10, 2, 16, 12, 18, 8, 15, 11, 5, 7, 13, 3, 1, 17, 9],
    lengthM: [250, 305, 425, 141, 396, 287, 291, 127, 318, 274, 434, 324, 298, 125, 402, 327, 99, 301],
  },
  {
    id: 'tuniberg-rot-female',
    name: 'Rot',
    gender: 'female',
    courseRating: 73.6,
    slope: 124,
    par: [4, 4, 5, 3, 5, 4, 4, 3, 4, 4, 5, 4, 4, 3, 5, 4, 3, 4],
    strokeIndex: [4, 6, 8, 14, 12, 16, 10, 18, 2, 11, 9, 1, 7, 15, 13, 3, 17, 5],
    lengthM: [250, 305, 425, 141, 396, 287, 291, 127, 318, 274, 434, 324, 298, 125, 402, 327, 99, 301],
  },
  {
    id: 'tuniberg-orange-male',
    name: 'Orange',
    gender: 'male',
    courseRating: 58.8,
    slope: 95,
    par: [3, 4, 4, 3, 3, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 3, 4],
    strokeIndex: [18, 8, 6, 14, 10, 16, 4, 12, 2, 11, 3, 13, 1, 15, 5, 17, 9, 7],
    lengthM: [66, 226, 241, 141, 117, 85, 246, 127, 268, 84, 268, 139, 289, 125, 268, 88, 99, 221],
  },
  {
    id: 'tuniberg-orange-female',
    name: 'Orange',
    gender: 'female',
    courseRating: 59.8,
    slope: 97,
    par: [3, 4, 4, 3, 3, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 3, 4],
    strokeIndex: [18, 8, 6, 14, 10, 16, 4, 12, 2, 11, 3, 13, 1, 15, 5, 17, 9, 7],
    lengthM: [66, 226, 241, 141, 117, 85, 246, 127, 268, 84, 268, 139, 289, 125, 268, 88, 99, 221],
  },
];

export function seedCourses(now = Date.now()): Course[] {
  return [
    {
      id: 'seed-gc-tuniberg',
      clubName: 'Golfclub Tuniberg',
      courseName: '',
      city: 'Freiburg-Munzingen',
      country: 'Germany',
      source: 'manual',
      tees: TUNIBERG_TEES.map(({ par, strokeIndex, lengthM, ...tee }) => ({
        ...tee,
        holes: par.map((p, i) => ({
          number: i + 1,
          par: p,
          strokeIndex: strokeIndex[i],
          lengthM: lengthM[i],
        })),
      })),
      updatedAt: now,
    },
  ];
}
