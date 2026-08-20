// לוגיקה סביב הוראות קבע (הוק): חישוב סטטוס (פעילה / מסתיימת בקרוב / הסתיימה),
// סידור הרשימה כך שמה שדורש התייחסות עולה למעלה, וניהול תזכורת חודשית שמופיעה
// בדשבורד כדי לוודא שעוברים על הרשימה מדי חודש (חשוב במיוחד סביב קמפיין שבו
// המון הוראות קבע חדשות נפתחות, לצד ישנות שעומדות להסתיים).

export interface HkEntry {
  id?: string;
  name: string;
  active: boolean;
  amount: number;
  /** כמה מועדי חיוב עוד לפנינו בלוח השנה — לא כמה כסף חסר. ראה getHK_ בשרת. */
  remaining: number;
  /** סך התשלומים שההוראה נפתחה עליהם */
  payments?: number;
  /** הוראה ללא הגבלת זמן — נגבית עד שעוצרים אותה, ואין לה "נותרו" */
  unlimited?: boolean;
  /** כמה חיובים נגבו בפועל */
  paid?: number;
  lastBilled: string;
  /** מתי ייגבה החיוב הבא — ריק להוראה שהסתיימה או בוטלה */
  nextCharge?: string;
  cancelDate?: string;
  startDate?: string;
  /** מספר ההוראה הקודמת בשרשרת — קיים רק בהוראה שנוצרה כחידוש */
  renewalOf?: string;
  /** מספר ההוראה שחידשה את זו. מחושב באפליקציה, לא מגיע מהגיליון. */
  renewedBy?: string;
  [key: string]: any;
}

export type HkStatus = 'renewed' | 'cancelled' | 'expired' | 'expiring' | 'active';

// "בוטלה" קודם ל"הסתיימה": הוראה שבוטלה באמצע הדרך היא לא הוראה שמיצתה
// את עצמה. ההבחנה חשובה — "הסתיימה" זה סיפור מוצלח, "בוטלה" זה תורם שירד.
export function getHkStatus(hk: HkEntry, threshold: number): HkStatus {
  // הוראה שחודשה אינה "בוטלה" ואינה "הסתיימה" — היא נמשכת תחת מספר אחר.
  // בלי ההבחנה הזו כל חידוש היה מוסיף לרשימה שורה כתומה מדאיגה, ומי שסורק
  // את המסך היה רואה תורם שירד בדיוק כשהוא חידש.
  if (hk.renewedBy) return 'renewed';
  if (hk.cancelDate) return 'cancelled';
  // הוראה ללא הגבלה לא מסתיימת ולא "מסתיימת בקרוב" — היא פשוט פעילה.
  if (hk.unlimited) return 'active';
  const remaining = Number(hk.remaining);
  if (!hk.active || !Number.isFinite(remaining) || remaining <= 0) return 'expired';
  if (remaining <= threshold) return 'expiring';
  return 'active';
}

export const HK_STATUS_LABEL: Record<HkStatus, string> = {
  renewed: 'חודשה',
  cancelled: 'בוטלה',
  expired: 'הסתיימה',
  expiring: 'מסתיימת בקרוב',
  active: 'פעילה',
};

export const HK_STATUS_COLOR: Record<HkStatus, string> = {
  renewed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
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
  // ── הוראה שחודשה: הסירובים שלה הם היסטוריה ──────────────────────────────
  //
  // תורם שנכשל לו כרטיס, ובעקבות זה פתחתם הוראה חדשה — הבעיה **טופלה**,
  // וזה בדיוק מה שהחידוש אומר. השארת הסימון האדום עליו אחריו הופכת אותו
  // לאזהרה שמופיעה תמיד, ואזהרה כזו מפסיקים לראות.
  if (hk.renewedBy) return null;

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
  const statusOrder: Record<HkStatus, number> = { expiring: 0, expired: 1, active: 2, cancelled: 3, renewed: 4 };
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
  const counts: Record<HkStatus, number> = { active: 0, expiring: 0, expired: 0, cancelled: 0, renewed: 0 };
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

// ── שרשרות חידוש ────────────────────────────────────────────────────────────
//
// תורם שמחדש הוראת קבע מקבל אצל הספק מספר הוראה **חדש**. אם מסתכלים על כל
// מספר בנפרד, כל חידוש נראה כמו תורם חדש שנתן פעם אחת — ההיסטוריה נעלמת
// בדיוק ברגע שהוא הוכיח את נאמנותו. השרשרת מחברת את המספרים חזרה לאדם.

export interface ChainIndex {
  byId: Record<string, HkEntry>;
  nextOf: Record<string, HkEntry>;
}

export function buildChainIndex(list: HkEntry[]): ChainIndex {
  const byId: Record<string, HkEntry> = {};
  const nextOf: Record<string, HkEntry> = {};
  (list || []).forEach(h => { if (h.id) byId[String(h.id)] = h; });
  (list || []).forEach(h => {
    const prev = String(h.renewalOf || '').trim();
    if (prev) nextOf[prev] = h;
  });
  return { byId, nextOf };
}

/** מסמן על כל הוראה מי חידש אותה. פעולה טהורה — מחזירה עותקים. */
export function annotateRenewals(list: HkEntry[]): HkEntry[] {
  const idx = buildChainIndex(list);
  return (list || []).map(h => {
    const next = h.id ? idx.nextOf[String(h.id)] : undefined;
    return next ? { ...h, renewedBy: String(next.id) } : h;
  });
}

/** כל ההוראות של אותה שרשרת, מהראשונה לאחרונה. */
export function chainFor(hk: HkEntry, idx: ChainIndex): HkEntry[] {
  const guard = new Set<string>();
  let first = hk;
  while (true) {
    const prev = String(first.renewalOf || '').trim();
    if (!prev || guard.has(prev) || !idx.byId[prev]) break;
    guard.add(prev);
    first = idx.byId[prev];
  }
  const out: HkEntry[] = [first];
  while (true) {
    const last = out[out.length - 1];
    const next = last.id ? idx.nextOf[String(last.id)] : undefined;
    if (!next || out.some(o => o.id === next.id)) break;
    out.push(next);
  }
  return out;
}

export interface ChainSummary {
  orders: number;
  paid: number;
  totalGiven: number;
  since: string;
  isChain: boolean;
}

/** מה האדם הזה נתן לאורך **כל** ההוראות שלו, לא רק הנוכחית. */
export function chainSummary(chain: HkEntry[]): ChainSummary {
  let paid = 0, totalGiven = 0;
  chain.forEach(h => {
    const n = Number(h.paid) || 0;
    paid += n;
    totalGiven += n * (Number(h.amount) || 0);
  });
  return {
    orders: chain.length,
    paid,
    totalGiven,
    since: chain[0]?.startDate || '',
    isChain: chain.length > 1,
  };
}
