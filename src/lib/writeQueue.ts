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

/** תקרה קשיחה. מעבר לה — הישן ביותר נופל, כדי שלא נאבד את החדש. */
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
   * `true` אם לא הצלחנו לכתוב את התור עצמו ל-localStorage.
   *
   * זה המצב הגרוע ביותר — הכתיבה נכשלה **וגם** לא הצלחנו לזכור אותה — ולכן
   * הוא מדווח בנפרד ובמפורש. שתיקה כאן היא בדיוק הבאג שהתור בא לפתור.
   */
  persistFailed: boolean;
}

type PostFn = (action: string, data: any, reqId?: string) => Promise<any>;

let persistFailed = false;
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

function writeQueue(items: QueuedWrite[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    persistFailed = false;
  } catch {
    // המכסה מלאה. מוותרים על הישנים ומנסים שוב — עדיף לשמור את החדש
    // מאשר לאבד הכול.
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-5)));
      persistFailed = false;
    } catch {
      persistFailed = true;
    }
  }
  notify();
}

export function queueState(): QueueState {
  return { items: loadQueue(), persistFailed };
}

export function queueSize(): number {
  return loadQueue().length;
}

export function clearQueue(): void {
  try { localStorage.removeItem(QUEUE_KEY); } catch { /* אין מה לעשות */ }
  persistFailed = false;
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

/** מוסיף לתור, תוך איחוד פעולות מחליפות. */
export function enqueue(action: string, data: any, error: string, reqId: string): void {
  const items = loadQueue();
  const kept = REPLACING.has(action) ? items.filter(i => i.action !== action) : items;
  kept.push({ id: makeId(), action, data, reqId, queuedAt: Date.now(), attempts: 1, lastError: error });
  writeQueue(kept.slice(-MAX_ENTRIES));
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
  const reqId = makeId();
  let res: any;
  try {
    res = await post(action, data, reqId);
  } catch (e: any) {
    res = { success: false, error: String(e?.message || e) };
  }
  if (isFailure(res)) {
    enqueue(action, data, String(res?.error || 'שגיאה לא ידועה'), reqId);
  }
  return res;
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
    let res: any;
    try {
      // אותו `reqId` מהניסיון הראשון — כך השרת מזהה שזו אותה פעולה
      // ואינו מבצע אותה פעמיים.
      res = await post(item.action, item.data, item.reqId);
    } catch (e: any) {
      res = { success: false, error: String(e?.message || e) };
    }

    // נטען מחדש בכל סיבוב: ייתכן שנוספה כתיבה חדשה תוך כדי, ואיחוד
    // הפעולות עשוי היה להסיר את הפריט הזה בעודנו שולחים אותו.
    const now = loadQueue();
    const at = now.findIndex(i => i.id === item.id);
    if (at === -1) { if (!isFailure(res)) sent++; continue; }

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
    }
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

/** תיאור קריא לאדם, למחוון. */
export function pendingLabel(n: number): string {
  if (n === 0) return '';
  if (n === 1) return 'שינוי אחד ממתין לשמירה';
  return `${n} שינויים ממתינים לשמירה`;
}
