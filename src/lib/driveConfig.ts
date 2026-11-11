// ─────────────────────────────────────────────────────────────────────────────
// שמירת הגדרות הארגון בחשבון הגוגל של המשתמש.
//
// קובץ JSON יחיד בתיקייה המוסתרת של האפליקציה (appDataFolder). המשתמש לא
// רואה אותו ב-Drive, אף אפליקציה אחרת לא ניגשת אליו, והוא נוסע עם החשבון:
// מתחברים במכשיר חדש — ההגדרות כבר שם.
//
// זה מה שהופך את ההגדרה לחד-פעמית באמת.
// ─────────────────────────────────────────────────────────────────────────────

import { accessToken } from './googleAuth';
import { OrgConfig } from './orgConfig';
import { ClientBackupState, collectClientBackupState, validateClientBackupState } from './clientBackup';

const FILE_NAME = 'kehila-crm-config.json';

export interface DriveAccountState {
  schemaVersion: 2;
  config: Partial<OrgConfig>;
  clientState: ClientBackupState;
  updatedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** מפרש קובץ חשבון בלי תלות ברשת, כדי שניתן לבדוק סכמות ישנות ופגומות. */
export function parseDriveAccountState(data: unknown): DriveAccountState | null {
  if (!isRecord(data)) return null;
  if (data.schemaVersion === 2) {
    if (!isRecord(data.config) || typeof data.updatedAt !== 'string') {
      throw new Error('קובץ החשבון אינו תקין');
    }
    const clientState = validateClientBackupState(data.clientState);
    return {
      schemaVersion: 2,
      config: data.config as Partial<OrgConfig>,
      clientState,
      updatedAt: data.updatedAt,
    };
  }
  // מעטפת מגרסה עתידית אינה "הגדרות ישנות". עצירה עדיפה על פירוש שגוי
  // ועל כתיבה חוזרת שתהרוס פורמט שהגרסה הנוכחית אינה מכירה.
  if (Object.prototype.hasOwnProperty.call(data, 'schemaVersion')) {
    throw new Error('גרסת קובץ החשבון אינה נתמכת');
  }
  return {
    schemaVersion: 2,
    config: data as Partial<OrgConfig>,
    clientState: { schemaVersion: 1, values: {}, excludedSensitive: [] },
    updatedAt: '',
  };
}

async function api(path: string, init: RequestInit = {}): Promise<any> {
  const token = accessToken();
  if (!token) throw new Error('לא מחובר לחשבון גוגל');
  const res = await fetch(`https://www.googleapis.com/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Drive ${res.status}`);
  return res.status === 204 ? null : res.json();
}

/** מזהה קובץ ההגדרות, או null אם עוד לא נוצר. */
async function findFileId(): Promise<string | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}'`);
  const data = await api(`drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)`);
  return data?.files?.[0]?.id || null;
}

/** קורא את ההגדרות מהחשבון. מחזיר null אם אין. */
export async function loadConfigFromDrive(): Promise<Partial<OrgConfig> | null> {
  const state = await loadAccountStateFromDrive();
  return state?.config || null;
}

/**
 * קורא את מצב החשבון המלא. קבצים מהגרסה הישנה (שהכילו רק הגדרות)
 * נתמכים כדי שאף משתמש קיים לא יאבד את החיבור לגיליון.
 */
export async function loadAccountStateFromDrive(): Promise<DriveAccountState | null> {
  const id = await findFileId();
  if (!id) return null;
  const data = await api(`drive/v3/files/${id}?alt=media`);
  return parseDriveAccountState(data);
}

/** כותב את ההגדרות לחשבון — יוצר את הקובץ בפעם הראשונה, ומעדכן אחר כך. */
export async function saveConfigToDrive(config: Partial<OrgConfig>): Promise<void> {
  await saveAccountStateToDrive(config, collectClientBackupState());
}

/** שומר בחשבון גם את החיבור לגיליון וגם את המידע שחי רק במכשיר. */
export async function saveAccountStateToDrive(
  config: Partial<OrgConfig>,
  clientState: ClientBackupState = collectClientBackupState(),
): Promise<DriveAccountState> {
  validateClientBackupState(clientState);
  const accountState: DriveAccountState = {
    schemaVersion: 2,
    config,
    clientState,
    updatedAt: new Date().toISOString(),
  };
  const body = JSON.stringify(accountState);
  const id = await findFileId();

  if (id) {
    await api(`upload/drive/v3/files/${id}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return accountState;
  }

  // יצירה ראשונה: העלאה מרובת-חלקים — מטא-דאטה (שם ומיקום) יחד עם התוכן
  const boundary = 'kehila' + Date.now();
  const metadata = { name: FILE_NAME, parents: ['appDataFolder'] };
  const payload =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${body}\r\n` +
    `--${boundary}--`;

  await api('upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: payload,
  });
  return accountState;
}

/** מוחק את קובץ ההגדרות מהחשבון — לניתוק מלא. */
export async function deleteConfigFromDrive(): Promise<void> {
  const id = await findFileId();
  if (id) await api(`drive/v3/files/${id}`, { method: 'DELETE' });
}
