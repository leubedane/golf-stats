import Dexie, { type EntityTable } from 'dexie';
import { SEED_TUNIBERG_ID, TUNIBERG_PCCADDIE_ID, seedCourses } from '../courses/seedCourses';
import { defaultBag } from '../domain/bag';
import { isEmptyStrategy } from '../domain/holeStrategy';
import { DEFAULT_SETTINGS } from '../domain/settings';
import type { Club, Course, HoleStrategy, Round, Settings } from '../domain/types';

export class GolfstatDb extends Dexie {
  settings!: EntityTable<Settings, 'id'>;
  clubs!: EntityTable<Club, 'id'>;
  courses!: EntityTable<Course, 'id'>;
  rounds!: EntityTable<Round, 'id'>;
  holeStrategies!: EntityTable<HoleStrategy, 'id'>;

  constructor(name = 'golfstat') {
    super(name);
    this.version(1).stores({
      settings: 'id',
      clubs: 'id, order',
      courses: 'id, externalId, clubName',
    });
    this.version(2).stores({
      rounds: 'id, startedAt, courseId',
    });
    // Seed courses: `populate` covers new databases, the version 3 upgrade existing ones.
    this.version(3)
      .stores({})
      .upgrade((tx) => tx.table('courses').bulkPut(seedCourses()));
    // Link the seeded course to its PC CADDIE course, so a PC CADDIE import updates it.
    this.version(4)
      .stores({})
      .upgrade((tx) =>
        tx
          .table('courses')
          .where('id')
          .equals(SEED_TUNIBERG_ID)
          .modify({ source: 'pccaddie', externalId: TUNIBERG_PCCADDIE_ID }),
      );
    // Hole Strategies live apart from Courses, so a course import (which replaces the Course) keeps them.
    this.version(5).stores({
      holeStrategies: 'id, courseId',
    });
    this.on('populate', (tx) => tx.table('courses').bulkAdd(seedCourses()));
  }
}

export const db = new GolfstatDb();

/** Creates default settings and bag on first start. */
export async function ensureSeeded(database: GolfstatDb = db): Promise<void> {
  await database.transaction('rw', database.settings, database.clubs, async () => {
    if (!(await database.settings.get('settings'))) await database.settings.put(DEFAULT_SETTINGS);
    if ((await database.clubs.count()) === 0) await database.clubs.bulkPut(defaultBag());
  });
}

export async function getSettings(database: GolfstatDb = db): Promise<Settings> {
  return (await database.settings.get('settings')) ?? DEFAULT_SETTINGS;
}

/** Stores a Hole Strategy, or deletes it when nothing is planned any more. */
export async function saveStrategy(strategy: HoleStrategy, database: GolfstatDb = db): Promise<void> {
  if (isEmptyStrategy(strategy)) await database.holeStrategies.delete(strategy.id);
  else await database.holeStrategies.put({ ...strategy, updatedAt: Date.now() });
}

/** Deletes a Course together with its Course Strategy. Rounds keep their own snapshot. */
export async function deleteCourse(courseId: string, database: GolfstatDb = db): Promise<void> {
  await database.transaction('rw', database.courses, database.holeStrategies, async () => {
    await database.courses.delete(courseId);
    await database.holeStrategies.where('courseId').equals(courseId).delete();
  });
}
