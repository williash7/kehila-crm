// לוגיקה סביב הוראות קבע (הוק): חישוב סטטוס (פעילה / מסתיימת בקרוב / הסתיימה),
// סידור הרשימה כך שמה שדורש התייחסות עולה למעלה, וניהול תזכורת חודשית שמופיעה
// בדשבורד כדי לוודא שעוברים על הרשימה מדי חודש (חשוב במיוחד סביב קמפיין שבו
// המון הוראות קבע חדשות נפתחות, לצד ישנות שעומדות להסתיים).

export interface HkEntry {
  id?: string;
  name: string;
  active: boolean;
  amount: number;
  remaining: number;
  lastBilled: string;
  cancelDate?: string;
  [key: string]: any;
}

export type HkStatus = 'cancelled' | 'expired' | 'expiring' | 'active';

// "בוטלה" קודם ל"הסתיימה": הוראה שבוטלה באמצע הדרך היא לא הוראה שמיצתה
// את עצמה. ההבחנה חשובה — "הסתיימה" זה סיפור מוצלח, "בוטלה" זה תורם שירד.
export function getHkStatus(hk: HkEntry, threshold: number): HkStatus {
  if (hk.cancelDate) return 'cancelled';
  const remaining = Number(hk.remaining);
  if (!hk.active || !Number.isFinite(remaining) || remaining <= 0) return 'expired';
  if (remaining <= threshold) return 'expiring';
  return 'active';
}

export const HK_STATUS_LABEL: Record<HkStatus, string> = {
  cancelled: 'בוטלה',
  expired: 'הסתיימה',
  expiring: 'מסתיימת בקרוב',
  active: 'פעילה',
};

export const HK_STATUS_COLOR: Record<HkStatus, string> = {
  cancelled: 'bg-orange-50 text-orange-700 border-orange-200',
  expired: 'bg-gray-100 text-gray-500 border-gray-200',
  expiring: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// ── כשל חיוב "פתוח" ─────────────────────────────────────────────────────────
//
// לשונית כשלי החיוב היא **יומן היסטורי**: כל מייל סירוב שהתקבל אי פעם יושב
// בה לנצח. אם מסמנים באדום כל מי שמופיע בה, כמעט כל הרשימה נצבעת — כולל
// תורם שהכרטיס שלו נדחה פעם אחת לפני שנה, תוקן, ומאז משלם כסדרו. אזהרה
// שמופיעה תמיד היא אזהרה שמפסיקים לראות.
//
// לכן כשל נחשב פתוח רק אם **לא נכנס כסף אחריו**. חיוב מוצלח שמאוחר מהכשל
// הוא ההוכחה הטובה ביותר שהבעיה נפתרה — אין מייל "הכרטיס תוקן" שיגיד לנו.
// והוראה שבוטלה לא מוצגת כתקלה בכלל: היא לא אמורה להיגבות.

// ולמי בדיוק שייך הכשל? מייל הסירוב נושא **מספר הוראה**, ולכן זו ההצמדה
// הנכונה. הצמדה לפי שם גוררת את הסימון האדום לכל ההוראות של אותו אדם —
// תורם שנכשל לו כרטיס בהוראה אחת נראה כאילו כל ההוראות שלו תקועות.
// נפילה לשם נשמרת רק לרשומות ישנות שאין בהן מספר הוראה.

export interface FailureIndex {
  byOrder: Record<string, any>;
  byName: Record<string, any>;
}

export function indexFailures(failures: any[]): FailureIndex {
  const byOrder: Record<string, any> = {};
  const byName: Record<string, any> = {};
  (failures || []).forEach(f => {
    const order = String(f?.order || '').trim();
    if (order) byOrder[order] = f;
    if (f?.name) byName[f.name] = f;
  });
  return { byOrder, byName };
}

export function openFailureFor(hk: HkEntry, idx: FailureIndex): any | null {
  if (hk.cancelDate) return null;

  const id = String(hk.id || '').trim();
  // אם להוראה יש מזהה, מסתמכים **רק** על התאמה לפיו. היעדר כשל למזהה הזה
  // הוא מידע, לא חוסר מידע — ואסור להשלים אותו מכשל של הוראה אחרת.
  const fail = id ? idx.byOrder[id] : idx.byName[hk.name];
  if (!fail) return null;

  const failDate = parseDate(fail.date);
  const billed = parseDate(hk.lastBilled);
  if (failDate && billed && billed >= failDate) return null;

  return fail;
}

function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const m = String(v).trim().match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (!m) return null;
  const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
  const d = new Date(Number(yyyy), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

// מסדר: קודם מי שיש לו כשל חיוב פתוח, אחר כך לפי דחיפות סטטוס
// (מסתיימת בקרוב > הסתיימה > פעילה), ולבסוף לפי כמה חיובים נותרו.
export function sortHkList(hk: HkEntry[], failNames: Set<string>, threshold: number): HkEntry[] {
  const statusOrder: Record<HkStatus, number> = { expiring: 0, expired: 1, active: 2, cancelled: 3 };
  return [...hk].sort((a, b) => {
    const aFail = failNames.has(a.name) ? 0 : 1;
    const bFail = failNames.has(b.name) ? 0 : 1;
    if (aFail !== bFail) return aFail - bFail;
    const sa = getHkStatus(a, threshold);
    const sb = getHkStatus(b, threshold);
    if (statusOrder[sa] !== statusOrder[sb]) return statusOrder[sa] - statusOrder[sb];
    return (Number(a.remaining) || 0) - (Number(b.remaining) || 0);
  });
}

export function countHkByStatus(hk: HkEntry[], threshold: number): Record<HkStatus, number> {
  const counts: Record<HkStatus, number> = { active: 0, expiring: 0, expired: 0, cancelled: 0 };
  hk.forEach(h => { counts[getHkStatus(h, threshold)]++; });
  return counts;
}

// ── תזכורת חודשית ────────────────────────────────────────────────────────────
// נשמר מקומית מתי בפעם האחרונה "סומן כנבדק" חודש נתון, כדי שהבאנר בדשבורד
// יופיע פעם אחת בכל חודש קלנדרי ולא בכל טעינה.

const REMINDER_KEY = 'hk_monthly_reminder_reviewed';

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}`;
}

export function isMonthlyReminderReviewed(): boolean {
  try {
    return localStorage.getItem(REMINDER_KEY) === currentMonthKey();
  } catch {
    return false;
  }
}

export function markMonthlyReminderReviewed(): void {
  try {
    localStorage.setItem(REMINDER_KEY, currentMonthKey());
  } catch {
    // localStorage לא זמין — לא קריטי
  }
}
