// חותמת הגיבוי האחרון במכשיר הזה.
//
// המידע מקומי בלבד: הוא אינו עולה לגיליון ואינו מוכיח מה קיים במחשב אחר.
// לכן הטקסט בממשק אומר במפורש "במכשיר זה". החותמת נכתבת רק לאחר
// ש-collectBackup החזיר קובץ שלם וההורדה הופעלה.

export interface BackupStamp {
  completedAt: string;
  fileName: string;
  rows: number;
  sheets: number;
  sync: number;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const BACKUP_STAMP_KEY = 'kehila_last_backup_v1';

function localStorageOrNull(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

export function isBackupStamp(value: unknown): value is BackupStamp {
  const v = value as Partial<BackupStamp> | null;
  if (!v || typeof v !== 'object') return false;
  if (typeof v.completedAt !== 'string' || !Number.isFinite(Date.parse(v.completedAt))) return false;
  if (typeof v.fileName !== 'string' || !v.fileName.trim()) return false;
  return nonNegativeInteger(v.rows) !== null &&
    nonNegativeInteger(v.sheets) !== null &&
    nonNegativeInteger(v.sync) !== null;
}

export function makeBackupStamp(
  summary: { rows: number; sheets: number; sync: number },
  fileName: string,
  completedAt = new Date()
): BackupStamp {
  return {
    completedAt: completedAt.toISOString(),
    fileName,
    rows: Math.max(0, Math.trunc(Number(summary.rows) || 0)),
    sheets: Math.max(0, Math.trunc(Number(summary.sheets) || 0)),
    sync: Math.max(0, Math.trunc(Number(summary.sync) || 0)),
  };
}

export function readBackupStamp(storage: StorageLike | null = localStorageOrNull()): BackupStamp | null {
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(BACKUP_STAMP_KEY) || 'null');
    return isBackupStamp(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeBackupStamp(
  stamp: BackupStamp,
  storage: StorageLike | null = localStorageOrNull()
): boolean {
  if (!storage || !isBackupStamp(stamp)) return false;
  try {
    storage.setItem(BACKUP_STAMP_KEY, JSON.stringify(stamp));
    return true;
  } catch {
    // אחסון מקומי חסום או מלא — הגיבוי עצמו עדיין הצליח.
    return false;
  }
}
