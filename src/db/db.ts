import Dexie, { type EntityTable } from 'dexie';
import { seedCourses } from '../courses/seedCourses';
import { defaultBag } from '../domain/bag';
import { DEFAULT_SETTINGS } from '../domain/settings';
import type { Club, Course, Round, Settings } from '../domain/types';

export class GolfstatDb extends Dexie {
  settings!: EntityTable<Settings, 'id'>;
  clubs!: EntityTable<Club, 'id'>;
  courses!: EntityTable<Course, 'id'>;
  rounds!: EntityTable<Round, 'id'>;

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
