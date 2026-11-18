import type { GolfstatDb } from './db';
import type { Club, Course, Settings } from '../domain/types';

export const BACKUP_FORMAT = 'golfstat-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  settings: Settings[];
  clubs: Club[];
  courses: Course[];
}

export async function exportBackup(database: GolfstatDb): Promise<Backup> {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: await database.settings.toArray(),
    clubs: await database.clubs.toArray(),
    courses: await database.courses.toArray(),
  };
}

export function parseBackup(text: string): Backup {
  const data = JSON.parse(text) as Partial<Backup>;
  if (data.format !== BACKUP_FORMAT) throw new Error('Not a Golfstat backup file');
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION)
    throw new Error(`Unsupported backup version: ${data.version}`);
  if (!Array.isArray(data.settings) || !Array.isArray(data.clubs) || !Array.isArray(data.courses))
    throw new Error('Backup file is incomplete');
  return data as Backup;
}

/** Replaces all local data with the backup's contents. */
export async function importBackup(database: GolfstatDb, backup: Backup): Promise<void> {
  await database.transaction('rw', database.settings, database.clubs, database.courses, async () => {
    await Promise.all([database.settings.clear(), database.clubs.clear(), database.courses.clear()]);
    await database.settings.bulkPut(backup.settings);
    await database.clubs.bulkPut(backup.clubs);
    await database.courses.bulkPut(backup.courses);
  });
}
