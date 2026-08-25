/** מידע חשוב שחי בדפדפן ולא בגיליון. */
export interface ClientBackupState {
  schemaVersion: 1;
  values: Record<string, string | null>;
  /** סודות אינם נכתבים לקובץ JSON גלוי. */
  excludedSensitive: string[];
}

export const CLIENT_BACKUP_KEYS = [
  'app_settings_v1',
  'org_config_v1',
  'custom_hols',
  'manual_donations',
  'write_queue_v1',
  'poster_bgImage',
  'poster_bgOverlay',
  'reverseHeaderMap',
  'data_onboarding_v1_completed',
  'rebbe_date',
  'thankyou_backfill_v1_done',
  'event_task_date_backfill_v1_done',
  'hk_monthly_reminder_reviewed',
  'score_total',
  'score_streak',
  'score_last_action_date',
  'score_weekly_log',
  'score_best_week',
  'score_activity_log',
  'score_backfill_v1_done',
  'kehila:list-sort:contacts',
  'kehila:list-sort:donations',
  'kehila:list-sort:standing-orders',
  'kehila:list-sort:charge-failures',
  'kehila:list-sort:payment-ledger',
  'kehila:list-sort:finance-transactions',
  'kehila:list-sort:finance-cashflow',
] as const;

const ALLOWED = new Set<string>(CLIENT_BACKUP_KEYS);

function safeJson(raw: string | null): any {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/** אוסף את מצב המכשיר, אך משמיט במפורש אסימוני גישה. */
export function collectClientBackupState(storage: Storage = localStorage): ClientBackupState {
  const values: Record<string, string | null> = {};
  CLIENT_BACKUP_KEYS.forEach(key => { values[key] = storage.getItem(key); });

  const settings = safeJson(values.app_settings_v1);
  if (settings && typeof settings === 'object') {
    delete settings.fbAccessToken;
    values.app_settings_v1 = JSON.stringify(settings);
  }

  return {
    schemaVersion: 1,
    values,
    excludedSensitive: ['app_settings_v1.fbAccessToken', 'google_token_v1'],
  };
}

export function validateClientBackupState(value: any): ClientBackupState {
  if (!value || value.schemaVersion !== 1 || !value.values || typeof value.values !== 'object' || Array.isArray(value.values)) {
    throw new Error('מידע המכשיר בגיבוי אינו תקין');
  }
  Object.entries(value.values).forEach(([key, raw]) => {
    if (!ALLOWED.has(key)) throw new Error(`מפתח מכשיר אינו מוכר: ${key}`);
    if (raw !== null && typeof raw !== 'string') throw new Error(`ערך מכשיר אינו תקין: ${key}`);
  });
  const missing = CLIENT_BACKUP_KEYS.filter(key => !Object.prototype.hasOwnProperty.call(value.values, key));
  if (missing.length) throw new Error(`חסרים פריטי מכשיר בגיבוי: ${missing.join(', ')}`);
  return value as ClientBackupState;
}

/**
 * מחזיר את מצב המכשיר לאחר שהשרת סיים בהצלחה.
 * כתובת החיבור והסודות הקיימים נשמרים כדי ששחזור לא יעביר את האפליקציה
 * בטעות לגיליון אחר ולא ימחק אסימון שלא נכתב בקובץ מטעמי אבטחה.
 */
export function restoreClientBackupState(value: ClientBackupState | undefined, storage: Storage = localStorage): number {
  if (!value) return 0; // גיבוי ישן: אין מצב מכשיר, ואסור למחוק את הקיים.
  const state = validateClientBackupState(value);
  const currentSettings = safeJson(storage.getItem('app_settings_v1')) || {};
  const currentOrg = safeJson(storage.getItem('org_config_v1')) || {};
  const before = Object.fromEntries(CLIENT_BACKUP_KEYS.map(key => [key, storage.getItem(key)]));
  let restored = 0;

  try {
    CLIENT_BACKUP_KEYS.forEach(key => {
      const raw = state.values[key];
      if (raw === null) storage.removeItem(key);
      else if (key === 'app_settings_v1') {
        const next = safeJson(raw) || {};
        if (currentSettings.fbAccessToken) next.fbAccessToken = currentSettings.fbAccessToken;
        storage.setItem(key, JSON.stringify(next));
      } else if (key === 'org_config_v1') {
        const next = safeJson(raw) || {};
        if (currentOrg.gsUrl) next.gsUrl = currentOrg.gsUrl;
        storage.setItem(key, JSON.stringify(next));
      } else storage.setItem(key, raw);
      restored++;
    });
  } catch (error: any) {
    // מצב המכשיר חוזר כיחידה אחת: אם הדפדפן מלא או חסום, לא משאירים
    // חצי הגדרות מהגיבוי וחצי מהמצב הקודם.
    CLIENT_BACKUP_KEYS.forEach(key => {
      try {
        const raw = before[key];
        if (raw === null) storage.removeItem(key); else storage.setItem(key, raw);
      } catch { /* ניסיון מיטבי להחזיר את המצב הקודם */ }
    });
    throw new Error(`שחזור הגדרות המכשיר לא הושלם: ${error?.message || error}`);
  }
  return restored;
}
