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
  source: 'api' | 'pccaddie' | 'manual';
  /** Id at the source: GolfCourseAPI course id, or PC CADDIE course id (e.g. 7743.1.1). */
  externalId?: string;
  tees: Tee[];
  updatedAt: number;
}

export type Lie = 'tee' | 'fairway' | 'fringe' | 'rough' | 'bunker' | 'recovery' | 'green';
export type MissSide = 'left' | 'onTarget' | 'right';
export type MissLength = 'short' | 'good' | 'long';
export type ShotShape = 'hook' | 'draw' | 'straight' | 'fade' | 'slice';
export type ShortGameType = 'chipFlat' | 'chipHighSpin' | 'chipHigh' | 'pitch' | 'bunkerShot' | 'fringePutt';
export type Break = 'leftToRight' | 'straight' | 'rightToLeft';

export interface Shot {
  id: string;
  /** Lie and Distance to Pin before the Shot. */
  lie: Lie;
  distanceM: number;
  clubId: string | null;
  /** Club name at the time of the Shot, kept if the Club is later removed from the Bag. */
  clubName: string;
  penaltyStrokes: 0 | 1 | 2;
  missSide?: MissSide;
  missLength?: MissLength;
  shape?: ShotShape;
  shortGameType?: ShortGameType;
  break?: Break;
}

export type HoleOutcome =
  | { kind: 'holed' }
  /** Ball picked up; the position it was lifted from ends the last Shot. */
  | { kind: 'pickedUp'; lie: Lie; distanceM: number };

export interface RoundHole {
  number: number;
  par: number;
  lengthM: number;
  strokeIndex: number;
  shots: Shot[];
  outcome?: HoleOutcome;
}

export interface Round {
  id: string;
  courseId: string;
  /** Snapshot of course and tee at the start of the Round, so later course edits don't change it. */
  courseName: string;
  teeName: string;
  courseRating: number;
  slope: number;
  handicap: number;
  startedAt: number;
  finishedAt?: number;
  /** Holes in playing order (e.g. 10..18 then 1..9 when starting on the back nine). */
  holes: RoundHole[];
}

/** A side of the Green, for a Hole Strategy's Good Miss and Danger Side. */
export type GreenSide = 'short' | 'long' | 'left' | 'right';

/** The preferred way to play one Hole of a Course, the same from every Tee. */
export interface HoleStrategy {
  /** `${courseId}:${holeNumber}`, see `strategyId`. */
  id: string;
  courseId: string;
  holeNumber: number;
  teeClubId: string | null;
  /** Club name at the time it was chosen, kept if the Club is later removed from the Bag. */
  teeClubName: string;
  teeTarget: string;
  goodMiss: GreenSide[];
  dangerSide: GreenSide[];
  notes: string;
  updatedAt: number;
}
