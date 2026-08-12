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

const FILE_NAME = 'kehila-crm-config.json';

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
  const id = await findFileId();
  if (!id) return null;
  const data = await api(`drive/v3/files/${id}?alt=media`);
  return data && typeof data === 'object' ? data : null;
}

/** כותב את ההגדרות לחשבון — יוצר את הקובץ בפעם הראשונה, ומעדכן אחר כך. */
export async function saveConfigToDrive(config: Partial<OrgConfig>): Promise<void> {
  const body = JSON.stringify(config);
  const id = await findFileId();

  if (id) {
    await api(`upload/drive/v3/files/${id}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return;
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
}

/** מוחק את קובץ ההגדרות מהחשבון — לניתוק מלא. */
export async function deleteConfigFromDrive(): Promise<void> {
  const id = await findFileId();
  if (id) await api(`drive/v3/files/${id}`, { method: 'DELETE' });
}
