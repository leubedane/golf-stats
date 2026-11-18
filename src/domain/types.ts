export type Language = 'en' | 'de';
export type TeeGender = 'male' | 'female';

/** A reference group whose Baseline is used for comparison. */
export type HandicapClass =
  | { id: string; kind: 'pga' }
  | { id: string; kind: 'own' }
  | { id: string; kind: 'handicap'; handicap: number };

export interface Settings {
  id: 'settings';
  handicap: number;
  teeGender: TeeGender;
  language: Language;
  golfCourseApiKey: string;
  handicapClasses: HandicapClass[];
  primaryHandicapClassId: string;
}

export type ClubKind = 'driver' | 'wood' | 'hybrid' | 'iron' | 'wedge' | 'putter';

export interface Club {
  id: string;
  name: string;
  kind: ClubKind;
  order: number;
}

export interface Hole {
  number: number;
  par: number;
  lengthM: number;
  strokeIndex: number;
}

export interface Tee {
  id: string;
  name: string;
  gender: TeeGender;
  courseRating: number;
  slope: number;
  holes: Hole[];
}

export interface Course {
  id: string;
  clubName: string;
  courseName: string;
  city: string;
  country: string;
  source: 'api' | 'manual';
  /** Id at GolfCourseAPI when fetched from there. */
  externalId?: string;
  tees: Tee[];
  updatedAt: number;
}
