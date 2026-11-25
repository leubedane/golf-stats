import { exportBackup } from '../db/backup';
import { db } from '../db/db';

/** Hands the golfer a file to save. */
export function downloadFile(content: string, type: string, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Saves a full backup of this device's data as JSON. */
export async function downloadBackup() {
  const backup = await exportBackup(db);
  downloadFile(JSON.stringify(backup, null, 2), 'application/json', `golfstat-backup-${backup.exportedAt.slice(0, 10)}.json`);
}
