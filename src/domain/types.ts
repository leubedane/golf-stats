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
  /** Ball Position before the Shot, set on the Hole Map (ADR 0005). Off the Green it determines distanceM. */
  position?: LatLon;
}

export type HoleOutcome =
  | { kind: 'holed' }
  /** Ball picked up; the position it was lifted from ends the last Shot. */
  | { kind: 'pickedUp'; lie: Lie; distanceM: number; position?: LatLon };

export interface RoundHole {
  number: number;
  par: number;
  lengthM: number;
  strokeIndex: number;
  shots: Shot[];
  outcome?: HoleOutcome;
  /** Hole Score as entered; absent while the hole's score follows its Shots. */
  score?: HoleScore;
  /** Pin Position in this Round; set once a Ball Position is placed or the pin is moved (ADR 0005). */
  pin?: LatLon;
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

/** Where the first Shot on a par 4 or 5 finished relative to the fairway. */
export type TeeResult = 'fairway' | 'left' | 'right';

/** The result of a Hole entered directly, without its Shots. */
export interface HoleScore {
  /** Strokes including Penalties; null when the ball was Picked Up. */
  strokes: number | null;
  putts?: number;
  /** Par 4 and 5 only. */
  teeResult?: TeeResult;
  penaltyStrokes?: number;
}

/** A position in WGS84 degrees, as stored in OpenStreetMap. */
export interface LatLon {
  lat: number;
  lon: number;
}

export type MapFeatureKind = 'tee' | 'green' | 'fairway' | 'bunker' | 'water' | 'pin';

/** One OpenStreetMap area (or, for a pin, a single point) of a Course Map. */
export interface MapFeature {
  osmId: number;
  kind: MapFeatureKind;
  points: LatLon[];
}

/** The OpenStreetMap line from the tee to the green of one Hole. */
export interface HoleLine {
  osmId: number;
  /** Hole number as tagged in OSM (`ref`, or a number in `name`); absent when untagged. */
  ref?: number;
  points: LatLon[];
}

export interface OsmReference {
  type: 'way' | 'relation';
  id: number;
}

/** The OpenStreetMap features of a Course, stored apart from it (ADR 0004). */
export interface CourseMap {
  courseId: string;
  osm: OsmReference;
  osmName: string;
  holeLines: HoleLine[];
  features: MapFeature[];
  /** Hole Lines assigned by the golfer; they win over OSM refs and survive a refresh. */
  assignments: { holeNumber: number; osmId: number }[];
  fetchedAt: number;
}
