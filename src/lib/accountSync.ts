import { ClientBackupState } from './clientBackup';

const META_KEY = 'google_account_sync_meta_v2';

// מפתחות מהגרסה הראשונה. שם נשמר בטעות JSON מלא כמזהה שינוי, ולכן הוא
// יכול להיות בגודל כמה מגה־בייט. קוראים אותם רק לצורך הגירה ומוחקים אותם.
const LEGACY_ENABLED_KEY = 'google_account_sync_enabled_v1';
const LEGACY_BASELINE_KEY = 'google_account_sync_baseline_v1';
const LEGACY_HASH_KEY = 'google_account_sync_hash_v1';
const LEGACY_CONFLICT_KEY = 'google_account_sync_conflict_v1';

// מטמונים שניתנים לבנייה מחדש ואינם חלק מהגיבוי. אם האחסון מלא אפילו
// לרשומת הסנכרון הזעירה, פינוי שלהם בטוח יותר מהשארת סנכרון חצי־מופעל.
const REBUILDABLE_CACHE_KEYS = ['bundle_snapshot_v1', 'geocode_cache_v1'];

interface SyncMeta {
  e: 0 | 1;
  b: string;
  h: string;
  c: 0 | 1;
}

function legacyMeta(storage: Storage): SyncMeta {
  return {
    e: storage.getItem(LEGACY_ENABLED_KEY) === '1' ? 1 : 0,
    b: storage.getItem(LEGACY_BASELINE_KEY) || '',
    // לעולם לא טוענים את הערך הענק לזיכרון: די לדעת שהוא מהפורמט הישן,
    // והוא לא יכול להשתוות לטביעת האצבע הקצרה של הגרסה החדשה.
    h: '',
    c: storage.getItem(LEGACY_CONFLICT_KEY) === '1' ? 1 : 0,
  };
}

function readMeta(storage: Storage): SyncMeta {
  try {
    const parsed = JSON.parse(storage.getItem(META_KEY) || 'null');
    if (parsed && (parsed.e === 0 || parsed.e === 1) && typeof parsed.b === 'string'
      && typeof parsed.h === 'string' && (parsed.c === 0 || parsed.c === 1)) {
      return parsed;
    }
  } catch { /* נופלים להגירה מהמפתחות הישנים */ }
  return legacyMeta(storage);
}

function removeLegacyLargeValues(storage: Storage): void {
  // מוחקים קודם את ההאש הישן: הוא נגזר בלבד, ובמכשיר שבתמונה הוא בדיוק
  // הערך שחרג מהמכסה. enabled/baseline נשארים עד שהרשומה החדשה נכתבה.
  try { storage.removeItem(LEGACY_HASH_KEY); } catch { /* ניסיון מיטבי */ }
  try { storage.removeItem(LEGACY_CONFLICT_KEY); } catch { /* ניסיון מיטבי */ }
}

function writeMeta(meta: SyncMeta, storage: Storage): void {
  removeLegacyLargeValues(storage);
  const raw = JSON.stringify(meta);
  try {
    storage.setItem(META_KEY, raw);
  } catch {
    // מכסת localStorage משותפת לכל נתוני האפליקציה. המטמונים האלה אינם
    // מקור אמת; מחיקתם מאפשרת לשמור את הרשומה האטומית בלי לגעת בתור כתיבה.
    REBUILDABLE_CACHE_KEYS.forEach(key => {
      try { storage.removeItem(key); } catch { /* ניסיון מיטבי */ }
    });
    storage.setItem(META_KEY, raw);
  }
  // רק אחרי כתיבה אטומית מוצלחת מסירים את שער ההפעלה והבסיס הישנים.
  try { storage.removeItem(LEGACY_ENABLED_KEY); } catch { /* ניסיון מיטבי */ }
  try { storage.removeItem(LEGACY_BASELINE_KEY); } catch { /* ניסיון מיטבי */ }
}

/**
 * טביעת אצבע קצרה וקבועה של מצב המכשיר.
 *
 * הגרסה הקודמת החזירה JSON מלא ושמרה אותו שוב ב-localStorage. תמונת פוסטר
 * אחת הספיקה להכפיל את צריכת המקום ולחרוג מהמכסה. כאן מעבדים את המפתחות
 * והערכים בהדרגה ומחזירים פחות מ־40 תווים, בלי עותק נוסף של כל הגיבוי.
 */
export function clientStateHash(state: ClientBackupState): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  let length = 0;

  const feed = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      first = Math.imul(first ^ code, 0x01000193);
      second = Math.imul(second ^ code, 0x85ebca6b);
      length++;
    }
  };

  feed(String(state.schemaVersion));
  Object.keys(state.values).sort().forEach(key => {
    feed(`\u0000${key}\u0001`);
    const value = state.values[key];
    feed(value === null ? '\u0002' : `\u0003${value}`);
  });
  [...state.excludedSensitive].sort().forEach(value => feed(`\u0004${value}`));
  return `${length.toString(36)}-${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`;
}

export function isAccountSyncEnabled(storage: Storage = localStorage): boolean {
  return readMeta(storage).e === 1;
}

export function accountSyncBaseline(storage: Storage = localStorage): string {
  return readMeta(storage).b;
}

export function accountSyncLastHash(storage: Storage = localStorage): string {
  return readMeta(storage).h;
}

export function remoteChangedSinceBaseline(remoteUpdatedAt: string, storage: Storage = localStorage): boolean {
  return remoteUpdatedAt !== accountSyncBaseline(storage);
}

export function enableAccountSync(updatedAt: string, hash: string, storage: Storage = localStorage): void {
  writeMeta({ e: 1, b: updatedAt, h: hash, c: 0 }, storage);
}

export function recordAccountSync(updatedAt: string, hash: string, storage: Storage = localStorage): void {
  const current = readMeta(storage);
  writeMeta({ ...current, b: updatedAt, h: hash, c: 0 }, storage);
}

export function markAccountSyncConflict(storage: Storage = localStorage): void {
  const current = readMeta(storage);
  writeMeta({ ...current, c: 1 }, storage);
}

export function hasAccountSyncConflict(storage: Storage = localStorage): boolean {
  return readMeta(storage).c === 1;
}

export function disableAccountSync(storage: Storage = localStorage): void {
  try { storage.removeItem(META_KEY); } catch { /* ניסיון מיטבי */ }
  [LEGACY_ENABLED_KEY, LEGACY_BASELINE_KEY, LEGACY_HASH_KEY, LEGACY_CONFLICT_KEY].forEach(key => {
    try { storage.removeItem(key); } catch { /* ניסיון מיטבי */ }
  });
}
