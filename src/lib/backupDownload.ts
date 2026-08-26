import { exportManifest, exportChunk, exportSync } from './api';
import {
  BackupIncomplete,
  BackupFile,
  Progress,
  backupFileName,
  backupSummary,
  collectBackup,
} from './backup';
import { collectClientBackupState } from './clientBackup';
import { BackupStamp, makeBackupStamp, writeBackupStamp } from './backupHistory';

export interface DownloadedBackup {
  file: BackupFile;
  fileName: string;
  stamp: BackupStamp;
}

/**
 * יוצר ומוריד גיבוי מלא. משותף לכפתור הגיבוי ולמרכז הניקוי, כדי שפעולה
 * רגישה לעולם לא תשתמש בגרסה מקוצרת או חלקית של הגיבוי.
 */
export async function createAndDownloadFullBackup(
  onProgress?: (progress: Progress) => void,
): Promise<DownloadedBackup> {
  const manifest = await exportManifest();
  const file = await collectBackup(
    manifest,
    async (sheet, offset, limit) => await exportChunk(sheet, offset, limit),
    async key => await exportSync(key),
    onProgress,
    undefined,
    collectClientBackupState(),
  );

  if (file?.success !== true) {
    throw new BackupIncomplete([{ what: 'הקובץ', error: 'הגיבוי לא סומן כשלם' }]);
  }

  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const fileName = backupFileName();
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  const stamp = makeBackupStamp(backupSummary(file), fileName);
  writeBackupStamp(stamp);
  return { file, fileName, stamp };
}
