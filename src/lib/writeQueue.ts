// ─────────────────────────────────────────────────────────────────────────────
// תור כתיבות — כדי ששמירה שנכשלה לא תיעלם.
//
// ── מה היה כאן קודם ───────────────────────────────────────────────────────
//
// שישה מקומות שמרו כך:
//
//     saveCRMData(data);                                  // מקומי — הצליח
//     apiPost('saveCRM', { data }).catch(console.error);  // לגיליון — אולי
//
// והנקודה החשובה: **ה-`catch` הזה כמעט אף פעם לא רץ.** `apiPost` עוטפת הכול
// ב-try/catch ומחזירה `{ success: false, error }` במקום לזרוק. כלומר הכישלון
// חזר כערך, אף אחד לא בדק אותו, והוא נזרק לפח בשקט מוחלט.
//
// המשתמש ראה שנשמר, כי מקומית באמת נשמר. בגיליון לא היה כלום. הוא יגלה את
// זה כשיפתח במכשיר אחר — או לא יגלה בכלל.
//
// ── מה קורה מעכשיו ────────────────────────────────────────────────────────
//
// כל כתיבה עוברת דרך `trackedPost`. אם היא נכשלת היא נכנסת לתור שנשמר
// ב-localStorage, ולכן **שורדת סגירה של הדפדפן**. התור מנסה שוב כשהחיבור
// חוזר, וכשהאפליקציה נפתחת.
//
// ── ולמה יש מחוון ─────────────────────────────────────────────────────────
//
// הניסיון החוזר יכול להיכשל גם הוא: הגיליון נמחק, ההרשאה נשללה, המכשיר
// לא מחובר יומיים. לכן המחוון אינו קישוט — **הוא הבטחה שהמצב לעולם לא
// חוזר להיות שקט.** תור שנתקע נראה על המסך.
//
// ── איחוד ─────────────────────────────────────────────────────────────────
//
// הפעולות כאן שומרות **בלוק שלם** — כל כרטיסי ה-CRM, כל האירועים. שמירה
// חדשה מחליפה את הקודמת לגמרי, ולכן אין טעם להחזיק שתיים: מספיקה האחרונה.
//
// זה גם הכרחי מעשית. בלי איחוד, עשרים עריכות ברצף בלי קליטה היו עשרים
// עותקים מלאים של הנתונים ב-localStorage — ומכסת האחסון הייתה מתפוצצת
// בדיוק ברגע שהתור נחוץ.
//
// **האיחוד אינו ברירת מחדל.** פעולה שמוסיפה שורה חייבת להישמר במלואה, ולכן
// רק פעולות שנמצאות ב-REPLACING מאוחדות.
// ─────────────────────────────────────────────────────────────────────────────

const QUEUE_KEY = 'write_queue_v1';

/**
 * תקרה קשיחה על פעולות **שאינן מחליפות** — תרומות, מפגשים וכדומה.
 *
 * מעבר לה חדשות נדחות בגלוי; ישנות לעולם אינן נמחקות. הכיוון ההפוך היה
 * נראה נדיב יותר, והוא היה מוחק פעולות שהמשתמש כבר ראה מסומנות כשמורות.
 *
 * שמירות הרקע אינן נספרות כאן: הן מוגבלות לפריט אחד לכל סוג, כלומר שבעה
 * לכל היותר, וסך הפריטים בתור אינו עולה על 57.
 */
const MAX_ENTRIES = 50;

/**
 * פעולות שכל שמירה שלהן מחליפה את הקודמת.
 *
 * הרשימה מפורשת ולא מנוחשת: אם מישהו יוסיף בעתיד פעולה שמוסיפה שורה,
 * היא **לא** תאוחד אלא אם הוסיפו אותה לכאן במודע.
 */
export const REPLACING = new Set([
  'saveCRM', 'saveEvents', 'saveHolidayExtras',
  'saveHistory', 'saveHomeVisits', 'saveProjects', 'updateRebbe',
  // `saveFinance` שולח בלוק כספי מלא, בדיוק כמו השאר. בלי זה שתי שמירות
  // ללא רשת היו נשמרות כשני פריטים, והישנה הייתה נשלחת אחרי החדשה
  // ודורסת אותה — נסיגה שקטה של הנתונים.
  'saveFinance',
]);

export interface QueuedWrite {
  id: string;
  action: string;
  data: any;
  /**
   * מזהה הבקשה — **זהה לזה של הניסיון הראשון**, וזו כל הנקודה.
   *
   * השרת זוכר מזהים שכבר טיפל בהם. אם הכתיבה בוצעה בגיליון ורק התשובה
   * אבדה בדרך חזרה, הניסיון החוזר יגיע עם אותו מזהה, והשרת יחזיר את
   * התשובה השמורה במקום לבצע שוב.
   *
   * בלי זה התור היה **מחמיר** את הבעיה במקום לפתור אותה: כל ניסיון חוזר
   * היה מקבל מזהה חדש, ותרומה אחת הייתה נרשמת פעמיים. יוסי איתר את זה
   * בסקירה — הגרסה הראשונה שכתבתי הייתה שגויה בדיוק כאן.
   */
  reqId: string;
  queuedAt: number;
  attempts: number;
  lastError: string;
}

export interface QueueState {
  items: QueuedWrite[];
  /**
   * `true` כשהתור מלא ופעולה חדשה נדחתה.
   *
   * דחייה גלויה עדיפה על מחיקה שקטה של פעולה ישנה שכבר הובטח עליה
   * שהיא שמורה.
   */
  queueFull: boolean;
  /**
   * `true` אם לא הצלחנו לכתוב את התור עצמו ל-localStorage.
   *
   * זה המצב הגרוע ביותר — הכתיבה נכשלה **וגם** לא הצלחנו לזכור אותה — ולכן
   * הוא מדווח בנפרד ובמפורש. שתיקה כאן היא בדיוק הבאג שהתור בא לפתור.
   */
  persistFailed: boolean;
}

type PostFn = (action: string, data: any, reqId?: string) => Promise<any>;

let persistFailed = false;
/** התור הגיע לתקרה ופעולה חדשה **לא** נקלטה. דביק עד שמתפנה מקום. */
let queueFull = false;
const listeners = new Set<() => void>();

function notify() { listeners.forEach(f => { try { f(); } catch { /* מאזין שנפל לא יפיל את השאר */ } }); }

/** הרשמה לשינויים בתור. מחזיר פונקציית ביטול. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function loadQueue(): QueuedWrite[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(x => x && typeof x.action === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * כתיבת התור — **הכול או כלום**.
 *
 * הגרסה הראשונה שכתבתי ניסתה „להציל מה שאפשר”: כשהמכסה התמלאה היא שמרה
 * את חמשת הפריטים האחרונים, מחקה את השאר, **וקבעה `persistFailed = false`**.
 * כלומר היא מחקה פעולות שהמשתמש ביצע, והודיעה שהכול תקין.
 *
 * זה בדיוק אותו שקר שקט שהתור כולו בא לתקן, רק במקום אחר. יוסי איתר את
 * זה בסקירה.
 *
 * מעכשיו: אם הכתיבה נכשלה, **הרשימה הקודמת נשארת בשלמותה** (localStorage
 * אינו משתנה כשה-setItem זורק), ו-`persistFailed` נדלק ונשאר דלוק עד
 * לכתיבה מלאה מוצלחת. עדיף להיכשל בקול מאשר למחוק בשקט.
 *
 * מחזיר האם ההצלחה הייתה מלאה.
 */
function writeQueue(items: QueuedWrite[]): boolean {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    persistFailed = false;
    notify();
    return true;
  } catch {
    persistFailed = true;   // דגל דביק
    notify();
    return false;
  }
}

export function queueState(): QueueState {
  const items = loadQueue();
  // המצב **נגזר** ולא רק נזכר.
  //
  // `queueFull` חי בזיכרון המודול בלבד, ולכן רענון של הדף היה מאפס אותו —
  // והאזהרה על הפעולה שנדחתה הייתה נעלמת, בזמן שהתור עצמו נשאר מלא
  // ב-localStorage. גזירה מהתור עצמה עמידה לרענון.
  return { items, persistFailed, queueFull: queueFull || countPending(items) >= MAX_ENTRIES };
}

/** התקרה, לתצוגה ולבדיקות. */
export const QUEUE_LIMIT = MAX_ENTRIES;

export function queueSize(): number {
  return loadQueue().length;
}

export function clearQueue(): void {
  try { localStorage.removeItem(QUEUE_KEY); } catch { /* אין מה לעשות */ }
  persistFailed = false;
  queueFull = false;
  notify();
}

/**
 * האם התשובה מעידה על כישלון.
 *
 * `apiPost` מחזירה `{ success: false, error }` במקום לזרוק, ולכן **לא מספיק
 * לתפוס חריגה** — צריך להסתכל על הערך עצמו. זו בדיוק הנקודה שפוספסה קודם.
 */
export function isFailure(res: any): boolean {
  if (!res) return true;
  if (res.error) return true;
  if (res.success === false) return true;
  return false;
}

/**
 * כישלון שאסור לזרוק — צריך לנסות שוב.
 *
 * `REQUEST_IN_PROGRESS` הוא המקרה שיוסי הוסיף בשרת: עותק שני של אותה בקשה
 * הגיע בזמן שהראשון עוד רץ. **אין כאן תקלה** — יש בקשה שכבר בטיפול, ואם
 * נסיר אותה מהתור עכשיו נאבד את היכולת לדעת אם היא הצליחה.
 *
 * לכן היא נשארת, אבל **לא** נספרת ככישלון תקוע שמדליק אזהרה אדומה.
 */
export function isRetryable(res: any): boolean {
  return !!res && (res.retryable === true || res.code === 'REQUEST_IN_PROGRESS');
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * כמה פריטים נספרים מול התקרה.
 *
 * **רק פעולות שאינן מחליפות.** פעולה מחליפה מוגבלת ממילא לפריט אחד לכל
 * סוג — שבעה בסך הכול — ולכן היא אינה יכולה להציף את התור. לספור אותה מול
 * אותה תקרה היה גורם לעריכת הכרטיס האחרונה להידחות בגלל חמישים תרומות
 * שממתינות, וזו תוצאה גרועה: היא מאבדת את מצב העריכה העדכני ביותר בלי
 * להגן על שום דבר.
 */
function countPending(items: QueuedWrite[]): number {
  return items.filter(i => !REPLACING.has(i.action)).length;
}

/** מכבה את האזהרה רק כשבאמת התפנה מקום. */
function refreshFull(items: QueuedWrite[]): void {
  if (queueFull && countPending(items) < MAX_ENTRIES) queueFull = false;
}

/**
 * מסיר מהתור גרסאות ישנות של אותו בלוק, אחרי ששליחה חדשה יותר הצליחה.
 *
 * התרחיש שיוסי תיאור, והוא מסוג הבאגים ש**נראים למשתמש כמו „הנתונים חזרו
 * אחורה לבד”**:
 *
 *   1. מצב A נכשל ונשאר בתור.
 *   2. מצב B, חדש יותר, מצליח מיד בשרת.
 *   3. בסבב הבא התור שולח את A — ודורס את B.
 *
 * שמירת בלוק היא החלפה מלאה, ולכן ברגע שגרסה חדשה יותר אושרה, כל גרסה
 * ישנה שממתינה הופכת לא רק למיותרת אלא **למזיקה**.
 */
function dropSuperseded(action: string, notNewerThan: number): void {
  if (!REPLACING.has(action)) return;
  const items = loadQueue();
  const kept = items.filter(i => !(i.action === action && i.queuedAt <= notNewerThan));
  if (kept.length !== items.length) {
    writeQueue(kept);
    refreshFull(kept);
  }
}

// ── סדרוּת לכל בלוק ─────────────────────────────────────────────────────────
//
// שתי שמירות של אותו בלוק לא יוצאות במקביל. בלי זה יש מרוץ אמיתי: A יוצא,
// B יוצא, B מגיע ראשון, A מגיע אחריו ודורס אותו — והמשתמש רואה את העריכה
// שלו נעלמת בלי שום שגיאה.
//
// שרשרת לכל `action` ולא נעילה גלובלית: אין שום סיבה ששמירת פרויקטים
// תמתין לשמירת אנשי קשר.
const chains = new Map<string, Promise<unknown>>();

function serialize<T>(action: string, fn: () => Promise<T>): Promise<T> {
  if (!REPLACING.has(action)) return fn();
  const prev = chains.get(action) || Promise.resolve();
  const next = prev.then(fn, fn);   // גם כישלון קודם אינו עוצר את הבא
  chains.set(action, next.catch(() => undefined));
  return next;
}

/**
 * מוסיף לתור.
 *
 * **פריט שאינו ב-REPLACING לעולם אינו נמחק כדי לפנות מקום.** הגרסה הראשונה
 * חתכה ב-`slice(-MAX_ENTRIES)`, כלומר הפעולה החמישים־ואחת מחקה את הראשונה
 * בשקט. לשמירות בלוק מאוחדות זה לא היה מורגש; ל-51 תרומות שנרשמו בלי
 * קליטה זה אובדן נתונים גמור — וללא כל סימן.
 *
 * כשמגיעים לתקרה **עוצרים לקבל חדשות ומתריעים**, במקום למחוק ישנות. פעולה
 * שלא נכנסה היא הפסד; פעולה שנמחקה אחרי שהובטח למשתמש שהיא שמורה היא
 * הפסד **ושקר**.
 */
export function enqueue(action: string, data: any, error: string, reqId: string): boolean {
  const items = loadQueue();
  const replacing = REPLACING.has(action);
  const kept = replacing ? items.filter(i => i.action !== action) : items;

  if (!replacing && countPending(kept) >= MAX_ENTRIES) {
    queueFull = true;
    notify();
    return false;
  }

  kept.push({ id: makeId(), action, data, reqId, queuedAt: Date.now(), attempts: 1, lastError: error });
  const okSaved = writeQueue(kept);

  // **לא** מכבים כאן על סמך הצלחת השמירה.
  //
  // הגרסה הקודמת עשתה `if (okSaved) queueFull = false`, וכך שמירת רקע אחת
  // שנכנסה אחרי דחייה כיבתה את האזהרה — בזמן שהפעולה שנדחתה עדיין חסרה
  // ולא התפנה שום מקום. אזהרה שנכבית לבד היא אזהרה שלא ראו.
  //
  // היא נכבית רק ב-`flushQueue`, אחרי ששליחה מוצלחת באמת פינתה מקום.
  refreshFull(kept);
  return okSaved;
}

/**
 * שולח, ואם נכשל — שומר לניסיון חוזר.
 *
 * **המזהה נוצר כאן, לפני השליחה הראשונה**, ולא אחרי הכישלון. זה ההבדל בין
 * ניסיון חוזר בטוח לבין רישום כפול: השרת חייב לראות את אותו מזהה בשני
 * הניסיונות כדי לזהות שזו אותה פעולה.
 *
 * מחזיר את תשובת השרת כפי שהיא, כדי שקוראים שכן בודקים ימשיכו לעבוד.
 */
export async function trackedPost(action: string, data: any, post: PostFn): Promise<any> {
  return serialize(action, async () => {
    const startedAt = Date.now();
    const reqId = makeId();
    let res: any;
    try {
      res = await post(action, data, reqId);
    } catch (e: any) {
      res = { success: false, error: String(e?.message || e) };
    }
    if (isFailure(res)) {
      enqueue(action, data, String(res?.error || 'שגיאה לא ידועה'), reqId);
    } else {
      // גרסה חדשה יותר אושרה — כל גרסה ישנה שממתינה בתור תדרוס אותה.
      dropSuperseded(action, startedAt);
    }
    return res;
  });
}

/**
 * מנסה לשלוח שוב את כל מה שממתין.
 *
 * פריט שהצליח יוצא מהתור מיד ולא מחכה לסוף — כך שניתוק באמצע לא מבטל את
 * מה שכבר עבר. פריט שנכשל נשאר, ומונה הניסיונות שלו עולה.
 */
export async function flushQueue(post: PostFn): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0;

  // עותק של הרשימה בתחילת הריצה. פריטים שנוספים תוך כדי יטופלו בסבב הבא.
  for (const item of loadQueue()) {
    await serialize(item.action, async () => {
      // כתיבה חדשה יותר שהצליחה בזמן שהמתנו בשרשרת כבר הסירה את הפריט.
      // במקרה כזה אסור לשלוח כעת את הגרסה הישנה ולדרוס אותה.
      const before = loadQueue();
      if (!before.some(i => i.id === item.id)) return;

      let res: any;
      try {
        // אותו `reqId` מהניסיון הראשון — כך השרת מזהה שזו אותה פעולה
        // ואינו מבצע אותה פעמיים.
        res = await post(item.action, item.data, item.reqId);
      } catch (e: any) {
        res = { success: false, error: String(e?.message || e) };
      }

      // נטען מחדש: ייתכן שפעולה שאינה מחליפה נוספה תוך כדי השליחה.
      const now = loadQueue();
      const at = now.findIndex(i => i.id === item.id);
      if (at === -1) { if (!isFailure(res)) sent++; return; }

      if (isFailure(res)) {
        failed++;
        // בקשה שכבר בטיפול בשרת אינה תקלה. משאירים אותה בתור לסבב הבא, אבל
        // בלי להעלות את מונה הניסיונות — אחרת המחוון היה צובע אדום ומודיע
        // על „ניסיונות שנכשלים” בזמן שהכול בסדר.
        const inFlight = isRetryable(res);
        now[at] = {
          ...now[at],
          attempts: inFlight ? now[at].attempts : now[at].attempts + 1,
          lastError: inFlight ? 'הבקשה כבר בטיפול בשרת' : String(res?.error || 'שגיאה לא ידועה'),
        };
        writeQueue(now);
      } else {
        sent++;
        now.splice(at, 1);
        writeQueue(now);
        refreshFull(now);   // כאן, ורק כאן, באמת התפנה מקום
      }
    });
  }

  return { sent, failed };
}

/**
 * ניסיונות חוזרים אוטומטיים.
 *
 * שלושה טריגרים: חזרת החיבור, חזרה ללשונית, וכל דקה. השלישי קיים כי
 * `navigator.onLine` משקר לא מעט — הוא מדווח "מחובר" גם כשיש רשת אלחוטית
 * בלי אינטרנט בפועל, וזה מצב נפוץ.
 *
 * מחזיר פונקציית עצירה.
 */
export function startAutoFlush(post: PostFn, intervalMs = 60_000): () => void {
  let busy = false;
  const run = async () => {
    if (busy || queueSize() === 0) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    busy = true;
    try { await flushQueue(post); } finally { busy = false; }
  };

  const onVisible = () => { if (document.visibilityState === 'visible') run(); };
  const timer = setInterval(run, intervalMs);
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', onVisible);
  run();

  return () => {
    clearInterval(timer);
    window.removeEventListener('online', run);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// שלב ב׳ — פעולות שינוי ישירות
//
// שמירות הרקע (`trackedPost`) נכשלו בשקט, ולכן די היה להן בתור. פעולה
// שהמשתמש מבצע ורואה — הוספת תרומה, שמירה במרכז הכספי — היא מקרה אחר:
// **המסך אומר לו משהו**, והשאלה היא מה.
//
// עד היום היא אמרה „נכשל”. וזו הודעה שמזמינה לחיצה נוספת — שיוצרת רישום
// שני של אותה תרומה. כלומר הניסוח עצמו היה מקור לבאג.
//
// מכאן יש שלושה מצבים מפורשים, לפי החוזה שיוסי הגדיר. שלושה, ולא שני
// בוליאנים, כי שני בוליאנים מאפשרים צירוף חסר משמעות („נכשל אבל בתור”)
// שמחזיר בדיוק את הניסוח הבעייתי.
// ─────────────────────────────────────────────────────────────────────────────

export type WriteOutcome =
  /** השרת אישר. */
  | { status: 'saved'; res: any }
  /**
   * התקבל ונשמר בתור — **לא כישלון.**
   *
   * המסך צריך לומר „ממתין לשליחה”, להשאיר את מה שהמשתמש הזין, ולא להציע
   * לנסות שוב. הפס העליון כבר מדווח על ההמתנה.
   */
  | { status: 'queued' }
  /** גם השרת לא אישר וגם התור לא הצליח לשמור. **רק כאן מציגים שגיאה.** */
  | { status: 'failed'; error: string };

/**
 * שולח פעולת שינוי ישירה, ומחזיר מצב מפורש.
 *
 * שים לב ש„התור הגיע לתקרה” מחזיר `failed` ולא `queued` — כי הפעולה באמת
 * לא נשמרה בשום מקום, ובמצב כזה המשתמש חייב לדעת.
 */
export async function submitWrite(action: string, data: any, post: PostFn): Promise<WriteOutcome> {
  return serialize(action, async (): Promise<WriteOutcome> => {
    const startedAt = Date.now();
    const reqId = makeId();
    let res: any;
    try {
      res = await post(action, data, reqId);
    } catch (e: any) {
      res = { success: false, error: String(e?.message || e) };
    }

    if (!isFailure(res)) {
      dropSuperseded(action, startedAt);
      return { status: 'saved', res };
    }

    const error = String(res?.error || 'שגיאה לא ידועה');
    return enqueue(action, data, error, reqId)
      ? { status: 'queued' }
      : { status: 'failed', error };
  });
}

/** מה להציג למשתמש עבור כל מצב. */
export function outcomeMessage(o: WriteOutcome): string {
  if (o.status === 'saved') return '';
  if (o.status === 'queued') return 'נשמר במכשיר וממתין לשליחה';
  return `לא נשמר: ${o.error}`;
}

/** תיאור קריא לאדם, למחוון. */
export function pendingLabel(n: number): string {
  if (n === 0) return '';
  if (n === 1) return 'שינוי אחד ממתין לשמירה';
  return `${n} שינויים ממתינים לשמירה`;
}
