// ─────────────────────────────────────────────────────────────────────────────
// "איך אני יודע שהכול מעודכן?"
//
// לאפליקציה הזו יש שלוש שכבות שמתעדכנות בנפרד, וכל אחת יכולה להישאר מאחור
// בלי להשמיע קול:
//
//   1. **הקוד ב-GitHub** — מתעדכן ב-git push.
//   2. **מה שהדפדפן שלך מציג** — מתעדכן כשה-Action מסיים לבנות, ורק אם
//      הדפדפן לא מגיש עותק שמור.
//   3. **הסקריפט בגיליון** — מתעדכן רק בהדבקה ובפריסה ידנית.
//
// כשמשהו לא עובד, השאלה הראשונה היא תמיד "איזו שכבה ישנה?" — וקודם לא
// הייתה שום דרך לענות עליה חוץ מניחוש. כאן יושבים המספרים שמאפשרים לענות.
// ─────────────────────────────────────────────────────────────────────────────

declare const __BUILD_TIME__: string;
declare const __BUILD_COMMIT__: string;

/** מתי נבנתה הגרסה שרצה כרגע בדפדפן. מוזרק בזמן הבנייה. */
export const BUILD_TIME: string = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '';

/** ה-commit שממנו נבנתה. ריק בהרצה מקומית. */
export const BUILD_COMMIT: string = typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : '';

/**
 * הגרסה שהאפליקציה מצפה למצוא בגיליון.
 * **מעדכנים אותה יחד עם CODE_VERSION שב-Code.gs, ולא בנפרד.**
 */
export const EXPECTED_CODE_VERSION = '2026-08-24d';

export function formatBuildTime(iso: string): string {
  if (!iso) return 'הרצה מקומית';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export type SyncState = 'ok' | 'sheetOutdated' | 'sheetAhead' | 'unknown';

/** משווה את מה שהגיליון מריץ למה שהאפליקציה מצפה לו. */
export function compareVersions(sheetVersion?: string | null): SyncState {
  const actual = String(sheetVersion || '').trim();
  if (!actual) return 'unknown';
  if (actual === EXPECTED_CODE_VERSION) return 'ok';
  // התאריכים בפורמט ISO, ולכן השוואת מחרוזות היא גם השוואת זמן
  return actual < EXPECTED_CODE_VERSION ? 'sheetOutdated' : 'sheetAhead';
}
