import { BackupFile, buildBackupCoverage } from './backup';
import { validateClientBackupState } from './clientBackup';

export const RESTORE_CHUNK_SIZE = 500;
export const RESTORE_CONFIRM_WORD = 'שחזר';

export interface RestorePlan {
  backup: BackupFile;
  totalRows: number;
  sheetCount: number;
  syncCount: number;
  sourceName: string;
  generatedAt: string;
}

export interface RestoreReportRow {
  label: string;
  expected: number;
  restored: number;
}

export interface RestoreCompletionReport {
  completedAt: string;
  snapshotName: string;
  rows: RestoreReportRow[];
  sheetCount: number;
  syncCount: number;
  clientItems: number;
}

export class RestoreValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RestoreValidationError';
  }
}

export function validateBackupForRestore(value: any): RestorePlan {
  if (!value || value.kind !== 'kehila-crm-backup' || value.success !== true) {
    throw new RestoreValidationError('זה אינו קובץ גיבוי מלא של האפליקציה');
  }
  const schemaVersion = Number(value.schemaVersion);
  if (schemaVersion !== 1 && schemaVersion !== 2) {
    throw new RestoreValidationError(`גרסת גיבוי אינה נתמכת: ${value.schemaVersion ?? 'לא ידועה'}`);
  }
  if (!value.sheets || typeof value.sheets !== 'object' || Array.isArray(value.sheets)) {
    throw new RestoreValidationError('חסרה מפת הלשוניות בגיבוי');
  }
  if (!value.syncResolved || typeof value.syncResolved !== 'object' || Array.isArray(value.syncResolved)) {
    throw new RestoreValidationError('חסרים נתוני הסנכרון בגיבוי');
  }

  let totalRows = 0;
  let sheetCount = 0;
  Object.keys(value.sheets).forEach(name => {
    const sheet = value.sheets[name];
    if (!sheet || typeof sheet !== 'object') throw new RestoreValidationError(`לשונית פגומה: ${name}`);
    if (typeof sheet.present !== 'boolean') throw new RestoreValidationError(`חסר סימון present בלשונית ${name}`);
    if (!Array.isArray(sheet.headers) || !sheet.headers.every((h: any) => typeof h === 'string')) {
      throw new RestoreValidationError(`כותרות לא תקינות בלשונית ${name}`);
    }
    if (!Array.isArray(sheet.rows)) throw new RestoreValidationError(`חסרות שורות בלשונית ${name}`);
    if (!Number.isInteger(sheet.rowCount) || sheet.rowCount < 0 || sheet.rowCount !== sheet.rows.length) {
      throw new RestoreValidationError(`מספר השורות אינו תואם בלשונית ${name}`);
    }
    if (!sheet.present && (sheet.rows.length || sheet.headers.length)) {
      throw new RestoreValidationError(`לשונית ${name} מסומנת כחסרה אך מכילה נתונים`);
    }
    if (sheet.present && !sheet.headers.length) throw new RestoreValidationError(`אין כותרות בלשונית ${name}`);
    if (sheet.rows.some((row: any) => !Array.isArray(row) || row.length !== sheet.headers.length)) {
      throw new RestoreValidationError(`רוחב שורה אינו תואם לכותרות בלשונית ${name}`);
    }
    if (sheet.present) { sheetCount++; totalRows += sheet.rows.length; }
  });

  if (schemaVersion >= 2 || value.clientState !== undefined) {
    try { validateClientBackupState(value.clientState); }
    catch (e: any) { throw new RestoreValidationError(e?.message || String(e)); }
  }
  if (schemaVersion >= 2 || value.coverage !== undefined) {
    if (!value.coverage || typeof value.coverage !== 'object') {
      throw new RestoreValidationError('חסרה מפת כיסוי בגיבוי');
    }
    const recalculated = buildBackupCoverage(value as BackupFile);
    if (JSON.stringify(recalculated) !== JSON.stringify(value.coverage)) {
      throw new RestoreValidationError('מפת הכיסוי אינה תואמת לתוכן הקובץ');
    }
  }

  return {
    backup: value as BackupFile,
    totalRows,
    sheetCount,
    syncCount: Object.keys(value.syncResolved).length,
    sourceName: String(value.spreadsheet?.name || ''),
    generatedAt: String(value.generatedAt || ''),
  };
}

export function restoreManifest(plan: RestorePlan) {
  return {
    schemaVersion: Number(plan.backup.schemaVersion),
    sheets: Object.keys(plan.backup.sheets).map(name => {
      const s = plan.backup.sheets[name];
      return { name, present: s.present, headerCount: s.headers.length, rowCount: s.rowCount };
    }),
    syncKeys: Object.keys(plan.backup.syncResolved),
    source: plan.backup.spreadsheet || null,
    generatedAt: plan.backup.generatedAt,
  };
}

export function sheetChunks(plan: RestorePlan, sheetName: string, limit = RESTORE_CHUNK_SIZE) {
  const sheet = plan.backup.sheets[sheetName];
  if (!sheet?.present) return [];
  const size = Math.max(1, Math.min(Math.trunc(limit) || RESTORE_CHUNK_SIZE, RESTORE_CHUNK_SIZE));
  if (!sheet.rows.length) return [{ offset: 0, total: 0, headers: sheet.headers, rows: [] }];
  const chunks = [];
  for (let offset = 0; offset < sheet.rows.length; offset += size) {
    chunks.push({
      offset,
      total: sheet.rows.length,
      headers: offset === 0 ? sheet.headers : undefined,
      rows: sheet.rows.slice(offset, offset + size),
    });
  }
  return chunks;
}

const RECORD_LABELS: { key: keyof NonNullable<BackupFile['coverage']>['records']; label: string }[] = [
  { key: 'contacts', label: 'אנשי קשר' },
  { key: 'logRows', label: 'תרומות ומפגשים' },
  { key: 'standingOrders', label: 'הוראות קבע' },
  { key: 'nameAliases', label: 'מיזוגים וקישורי שמות' },
  { key: 'activities', label: 'פעילויות' },
  { key: 'campaigns', label: 'קמפיינים' },
  { key: 'tasks', label: 'משימות' },
  { key: 'homeVisitRounds', label: 'מערכי ביקורי בית' },
  { key: 'financeTransactions', label: 'תנועות כספיות' },
  { key: 'customHolidays', label: 'חגים מותאמים' },
];

/**
 * בונה דוח רק אחרי שהשרת החזיר ספירות שנבדקו בפועל. נתוני הסנכרון
 * נחשבים משוחזרים רק אם כל המפתחות שהיו בגיבוי אושרו על ידי השרת.
 */
export function buildRestoreCompletionReport(
  plan: RestorePlan,
  finish: any,
  clientItems: number,
): RestoreCompletionReport {
  const serverReport = finish?.restoreReport;
  if (!serverReport || !Array.isArray(serverReport.sheets) || !Array.isArray(serverReport.syncKeys)) {
    throw new Error('השחזור הסתיים ללא דוח שלמות; יש לעדכן את הסקריפט ולבדוק שוב');
  }

  const byName = new Map(serverReport.sheets.map((item: any) => [String(item?.name || ''), item]));
  const presentSheets = Object.entries(plan.backup.sheets).filter(([, sheet]) => sheet.present);
  presentSheets.forEach(([name, sheet]) => {
    const actual: any = byName.get(name);
    if (!actual || actual.verified !== true || Number(actual.expectedRows) !== sheet.rowCount ||
        Number(actual.restoredRows) !== sheet.rowCount) {
      throw new Error(`דוח השלמות אינו תואם ללשונית ${name}`);
    }
  });

  const expectedSync = Object.keys(plan.backup.syncResolved).sort();
  const restoredSync = serverReport.syncKeys.map(String).sort();
  if (JSON.stringify(expectedSync) !== JSON.stringify(restoredSync)) {
    throw new Error('דוח השלמות אינו תואם לנתוני המערכת');
  }

  const coverage = plan.backup.coverage;
  const rows: RestoreReportRow[] = coverage
    ? RECORD_LABELS.map(({ key, label }) => ({
        label,
        expected: Number(coverage.records[key] || 0),
        restored: Number(coverage.records[key] || 0),
      }))
    : presentSheets.map(([name, sheet]) => ({ label: name, expected: sheet.rowCount, restored: sheet.rowCount }));

  return {
    completedAt: String(serverReport.verifiedAt || new Date().toISOString()),
    snapshotName: String(finish?.snapshotName || ''),
    rows,
    sheetCount: presentSheets.length,
    syncCount: expectedSync.length,
    clientItems,
  };
}
