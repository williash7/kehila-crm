// ─────────────────────────────────────────────────────────────────────────────
// פרויקטי גיוס.
//
// ההבחנה מול תקציב אירוע: פרויקט נפתח כשמגייסים **מאנשים** מול יעד — יש
// רשימת התרמה ומעקב אחרי מי הבטיח ומי שילם. אם רק סופרים הוצאות והכנסות,
// תקציב באירוע מספיק ופרויקט רק מוסיף בירוקרטיה.
//
// עיקרון מרכזי: **הפרויקט אינו מנהל כסף משלו.** הוא קורא את אותו יומן
// תרומות ומסנן לפי הייעוד. אין ספירה כפולה, אין רישום כפול, ותרומה נספרת
// פעם אחת בדיוק — אותו עיקרון שסגרנו בהוראות הקבע.
// ─────────────────────────────────────────────────────────────────────────────

import { Budget, emptyBudget } from '../components/BudgetEditor';

/**
 * ── סטטוס בתוכנית הגיוס ───────────────────────────────────────────────────
 *
 * הרשימה לקוחה מגיליון הקמפיין שאתה עובד איתו בפועל, ולא הומצאה כאן. זה
 * ההבדל בין שדה שממלאים לבין שדה שמדלגים עליו: "לשלוח לינק" ו"נשלח לינק"
 * הם שני מצבים שונים לגמרי בעבודה, ו"תורם ללא סכום" הוא מי שאמר כן אבל
 * עוד לא נקב במספר — מצב שכיח שאין לו מקום ברשימה גנרית.
 */
export type SolicitationStatus =
  | 'toSend'         // לשלוח לינק
  | 'sent'           // נשלח לינק
  | 'retry'          // לנסות שוב
  | 'callBack'       // לחזור אליו
  | 'giver'          // תורם
  | 'giverNoAmount'  // תורם, בלי שנקב בסכום
  | 'notGiver';      // לא תורם

export const SOLICITATION_LABEL: Record<SolicitationStatus, string> = {
  toSend:        'לשלוח לינק',
  sent:          'נשלח לינק',
  retry:         'לנסות שוב',
  callBack:      'לחזור אליו',
  giver:         'תורם',
  giverNoAmount: 'תורם ללא סכום',
  notGiver:      'לא תורם',
};

export const SOLICITATION_COLOR: Record<SolicitationStatus, string> = {
  toSend:        'bg-gray-100 text-gray-600 border-gray-200',
  sent:          'bg-blue-50 text-blue-700 border-blue-200',
  retry:         'bg-purple-50 text-purple-700 border-purple-200',
  callBack:      'bg-amber-50 text-amber-700 border-amber-200',
  giver:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  giverNoAmount: 'bg-teal-50 text-teal-700 border-teal-200',
  notGiver:      'bg-red-50 text-red-600 border-red-200',
};

/** סדר העבודה: מה שעוד לא נגעת בו למעלה, מה שנסגר למטה. */
export const SOLICITATION_ORDER: SolicitationStatus[] =
  ['toSend', 'sent', 'retry', 'callBack', 'giverNoAmount', 'giver', 'notGiver'];

/**
 * מקבל סטטוס בכל צורה שהוא עשוי להגיע בה ומחזיר את הערך התקני.
 *
 * שלושה מקורות מזינים את השדה הזה: האפליקציה, נתונים ישנים מלפני שינוי
 * הרשימה, וייבוא בינה מלאכותית שמייצר **טקסט עברי** מהגיליונות שלך. אם
 * אחד מהם ייתן ערך שלא מזוהה, השורה תיראה ריקה בלי שום סימן למה.
 */
const STATUS_ALIASES: Record<string, SolicitationStatus> = {
  // מה שהיה בגרסה הקודמת
  todo: 'toSend', asked: 'sent', pledged: 'giverNoAmount', gave: 'giver', declined: 'notGiver',
  // הטקסט העברי כפי שהוא מופיע בגיליונות
  'לשלוח לינק': 'toSend',
  'נשלח לינק': 'sent',
  'לנסות שוב': 'retry',
  'לחזור אליו': 'callBack',
  'תורם': 'giver',
  'תורם ללא סכום': 'giverNoAmount',
  'לא תורם': 'notGiver',
  'לפנות': 'toSend', 'פנינו': 'sent', 'הבטיח': 'giverNoAmount', 'נתן': 'giver', 'סירב': 'notGiver',
};

export function normalizeStatus(raw: any): SolicitationStatus {
  const v = String(raw ?? '').trim();
  if (!v) return 'toSend';
  if ((SOLICITATION_LABEL as any)[v]) return v as SolicitationStatus;
  return STATUS_ALIASES[v] || 'toSend';
}

/** האם הסטטוס הזה סוגר את הטיפול באדם הזה. */
export function isSettled(status: SolicitationStatus): boolean {
  return status === 'giver' || status === 'notGiver';
}

export interface Solicitation {
  name: string;
  status: SolicitationStatus;
  /**
   * סכום שהאדם התחייב לו אבל טרם נגבה — למשל הבטחה בעל פה או צ'ק דחוי.
   * התחייבות שמקורה בהוראת קבע **אינה** נרשמת כאן; היא נגזרת מההוראה
   * עצמה, כדי שלא תישחק מול המציאות ולא תיספר פעמיים.
   */
  pledged?: number | string;
  /**
   * כמה מתכוונים לבקש מהאדם הזה בקמפיין הזה.
   *
   * זה השדה שהופך רשימת שמות לתוכנית גיוס: בלעדיו אי אפשר לדעת אם היעד
   * בכלל מכוסה על ידי מי שברשימה, ואי אפשר לדעת אם הבקשה מהאדם הזה
   * סבירה ביחס למה שהוא נתן בעבר.
   */
  ask?: number | string;
  notes?: string;
  /** מתי ניתנה ההבטחה — כדי לדעת אילו תשלומים באו אחריה */
  pledgedDate?: string;
  /**
   * קישור מפורש להוראת קבע. בדרך כלל לא צריך אותו — הוראה שהקטגוריה שלה
   * היא הקמפיין משויכת לבד. הוא נועד למקרה ההפוך: התורם פתח הוראת קבע
   * עבור הקמפיין, אבל אצל הספק היא נרשמה תחת קטגוריה אחרת.
   */
  hkId?: string;
  /** קישור מפורש לכמה הוראות. גובר על שיוך לפי קטגוריה. */
  hkIds?: string[];
  /**
   * ── מה שהאפליקציה טעתה לגביו ──────────────────────────────────────────
   *
   * שיוך אוטומטי הוא הדבר הנכון ברוב המקרים, ובדיוק בגללו חייבת להיות דרך
   * לבטל אותו: אדם שהבטיח לתרום ובאותו חודש שילם על סיור סליחות — התשלום
   * הזה אינו הקמפיין. בלי כפתור להסיר, המספר שגוי ואין מה לעשות בנידון.
   */
  excludedDonationIds?: string[];
  /** תשלום שלא סומן לקמפיין, ואתה קובע שהוא כן שייך */
  includedDonationIds?: string[];
  /** הוראת קבע שסומנה אוטומטית ואינה קשורה */
  excludedHkIds?: string[];
}

/** מה אדם נתן — התשובה לשאלה "כמה סביר לבקש ממנו". */
export interface GivingHistory {
  /** 12 החודשים האחרונים */
  lastYear: number;
  /** מאז ומעולם */
  allTime: number;
  /** לפרויקט הזה בלבד */
  toProject: number;
  /** התרומה הגדולה ביותר שנתן אי פעם */
  largest: number;
  lastDate: string;
}

function parseDate_(v: any): Date | null {
  if (!v) return null;
  const m = String(v).trim().match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (!m) return null;
  const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
  const d = new Date(Number(yyyy), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * מדד נתינה לכל תורם, במעבר אחד על היומן.
 *
 * חישוב לכל אדם בנפרד היה מריץ את כל היומן מאות פעמים בכל רינדור. כאן
 * עוברים פעם אחת ובונים מפה — עם 771 שורות ומאתיים אנשים זה ההבדל בין
 * מיידי לתקוע.
 */
export function buildGivingIndex(
  donations: any[],
  purposeTag: string,
  now: Date = new Date()
): Record<string, GivingHistory> {
  const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const tag = (purposeTag || '').trim();
  const out: Record<string, GivingHistory> = {};

  (donations || []).forEach(d => {
    const name = String(d?.name || '').trim();
    const amount = num(d?.amount);
    if (!name || amount <= 0) return;

    const rec = out[name] || (out[name] = { lastYear: 0, allTime: 0, toProject: 0, largest: 0, lastDate: '' });
    const date = parseDate_(d.date);

    rec.allTime += amount;
    if (amount > rec.largest) rec.largest = amount;
    if (date && date >= yearAgo) rec.lastYear += amount;
    if (tag && String(d.purpose || '').trim() === tag) rec.toProject += amount;

    const prev = parseDate_(rec.lastDate);
    if (date && (!prev || date > prev)) rec.lastDate = d.date;
  });

  return out;
}

/**
 * הצעת סכום לבקשה.
 *
 * מה שנתן בשנה האחרונה הוא הבסיס הכי אמין — הוא מעיד על היכולת ועל הרצון
 * ברגע הזה, ולא על מה שהיה לפני חמש שנים. מי שלא נתן השנה נמדד לפי
 * התרומה הגדולה שלו אי פעם. אין כאן ניסיון לחזות, רק נקודת פתיחה סבירה
 * שאפשר לשנות בשורה.
 */
export function suggestedAsk(h?: GivingHistory): number {
  if (!h) return 0;
  const base = h.lastYear > 0 ? h.lastYear : h.largest;
  if (!base) return 0;
  return Math.round(base / 10) * 10;   // עיגול לעשירייה, שלא ייראה כמו חישוב
}

/** סך מה שמתכוונים לבקש מכל מי שברשימה */
export function totalAsk(sols: Solicitation[]): number {
  return (sols || []).reduce((s, x) => s + num(x.ask), 0);
}

export interface Project {
  id: string;
  name: string;
  /** קמפיין כללי מול פרויקט ספציפי — משפיע רק על התצוגה */
  kind: 'campaign' | 'project';
  goal: number | string;
  deadline?: string;
  status: 'active' | 'closed';
  /**
   * הייעוד שנרשם בתרומות ומקשר אותן לפרויקט. ברירת המחדל היא שם הפרויקט,
   * כך שבחירה ברשימה הנפתחת בעת הוספת תרומה מייצרת את הקישור לבד ואין
   * סיכון לשגיאת כתיב.
   */
  purposeTag: string;
  holidayId?: string;
  eventId?: string;
  budget: Budget;
  tasks: any[];
  solicitations: Solicitation[];
  notes?: string;
  createdAt: string;
}

export function emptyProject(name = ''): Project {
  return {
    id: `proj_${Date.now()}`,
    name: name.trim(),
    kind: 'project',
    goal: '',
    status: 'active',
    purposeTag: name.trim(),
    budget: emptyBudget(),
    tasks: [],
    solicitations: [],
    createdAt: new Date().toISOString(),
  };
}

function num(v: any): number {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

/** התרומות ששייכות לפרויקט — לפי הייעוד שנרשם בהן. */
export function projectDonations(project: Project, donations: any[]): any[] {
  const tag = (project.purposeTag || project.name || '').trim();
  if (!tag) return [];
  return (donations || []).filter(d => String(d?.purpose || '').trim() === tag && num(d.amount) > 0);
}

export interface ProjectProgress {
  goal: number;
  raised: number;       // נכנס בפועל — כסף בקופה
  pledged: number;      // צפוי: יתרת הוראות קבע + הבטחות בעל פה
  /** מתוך הצפוי — מה שמגובה בהוראת קבע חתומה */
  hkOutstanding: number;
  /** מתוך הצפוי — מה שנשען על הבטחה בעל פה בלבד */
  pledgeOutstanding: number;
  /** נכנס + הוראות קבע. מה שאפשר לעמוד מולו. */
  secured: number;
  committed: number;    // נכנס + צפוי — זה מה שנמדד מול היעד
  gap: number;          // כמה חסר ליעד אחרי שסופרים את ההתחייבויות
  gapCash: number;      // כמה חסר במזומן, בלי להסתמך על העתיד
  percent: number;      // אחוז מהיעד לפי ההתחייבות
  percentCash: number;  // אחוז מהיעד לפי מה שנכנס בפועל
  donorCount: number;
  counts: Record<SolicitationStatus, number>;
}

/**
 * ההתקדמות נמדדת מול **ההתחייבות** ולא מול המזומן.
 *
 * תורם שפתח הוראת קבע על ₪200 לשנה־עשר חודשים סגר ₪2,400 מהיעד באותו רגע,
 * גם אם בקופה נכנס עדיין רק חודש אחד. מדידה לפי מזומן בלבד הייתה מציגה
 * קמפיין שהושג כאילו הוא בתחילת הדרך, ודוחפת לגייס כסף שכבר גויס.
 *
 * שני המספרים מוחזרים, כדי שאפשר יהיה להציג את שניהם — הצפי כדי לדעת איפה
 * הקמפיין עומד, והמזומן כדי לדעת מה אפשר להוציא.
 */
export function projectProgress(project: Project, donations: any[], hk: any[] = []): ProjectProgress {
  const linked = projectDonations(project, donations);
  const raised = linked.reduce((s, d) => s + num(d.amount), 0);

  const rows = buildSolicitationRows(project, donations, hk);
  const totals = sumSolicitationRows(rows);

  // מי שתרם לקמפיין אך אינו ברשימת ההתרמה — כספו כבר בתוך raised, ואין לו
  // התחייבות עתידית. לכן הצפי נלקח מהשורות בלבד.
  const pledged = totals.outstanding;
  const committed = raised + pledged;
  // ── שלוש דרגות ודאות, ולא שתיים ──────────────────────────────────────
  //
  // הבטחה בעל פה והוראת קבע אינן אותו דבר, גם אם שתיהן "התחייבות".
  // מי שפתח הוראת קבע — פרוצדורלית נתן: יש הרשאה חתומה אצל הספק, ואם
  // היא תבוטל תדע על כך ותוכל לעמוד מולו. מי שאמר בטלפון "אתן לך 3,000"
  // עוד לא עשה כלום, ואתה עצמך אמרת שאינך יודע אם ייתן.
  //
  // ערבוב של שניהם למספר אחד מציג קמפיין בטוח יותר ממה שהוא.
  const secured = raised + totals.hkOutstanding;

  const goal = num(project.goal);
  return {
    goal,
    raised,
    pledged,
    hkOutstanding: totals.hkOutstanding,
    pledgeOutstanding: totals.pledgeOutstanding,
    secured,
    committed,
    gap: Math.max(0, goal - committed),
    gapCash: Math.max(0, goal - raised),
    percent: goal > 0 ? Math.min(100, Math.round((committed / goal) * 100)) : 0,
    percentCash: goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0,
    donorCount: new Set(linked.map(d => d.name)).size,
    counts: totals.counts,
  };
}

/**
 * מסמן אוטומטית "נתן" למי שכבר תרם לפרויקט — כדי שלא תצטרך לעדכן ידנית
 * את מה שהמערכת כבר יודעת. מחזיר רשימה מעודכנת, או null אם אין מה לשנות.
 */
export function syncSolicitationsWithDonations(project: Project, donations: any[]): Solicitation[] | null {
  const givers = new Set(projectDonations(project, donations).map(d => String(d.name || '').trim()));
  if (!givers.size) return null;

  let changed = false;
  const next = (project.solicitations || []).map(s => {
    if (givers.has(s.name.trim()) && normalizeStatus(s.status) !== 'giver') { changed = true; return { ...s, status: 'giver' as const }; }
    return s;
  });

  // תורם שנתן ואינו ברשימה — מתווסף, כדי שהרשימה תשקף את המציאות
  const listed = new Set(next.map(s => s.name.trim()));
  givers.forEach(name => {
    if (name && !listed.has(name)) { next.push({ name, status: 'giver' }); changed = true; }
  });

  return changed ? next : null;
}

/** הפרויקטים הפעילים — לרשימה הנפתחת בעת הוספת תרומה. */
export function activeProjects(projects: Project[]): Project[] {
  return (projects || []).filter(p => p.status !== 'closed');
}

// ═══════════════════════════════════════════════════════════════════════════
//  הוראת קבע כהתחייבות לקמפיין
// ═══════════════════════════════════════════════════════════════════════════

/**
 * תורם שפתח הוראת קבע על ₪200 לשנה־עשר חודשים **התחייב ל-₪2,400**, גם אם
 * עד היום נגבו ממנו שניים. שני המספרים נכונים ושניהם נחוצים:
 *
 *   · "נכנס בפועל" — מה שיש בקופה היום. זה מה שמשלמים איתו לספקים.
 *   · "התחייבות" — מה שהקמפיין יכול לסמוך עליו. זה מה שסוגר את היעד.
 *
 * הצגת אחד מהם בלבד משקרת לכיוון אחד: הראשון גורם לקמפיין להיראות רחוק
 * מהיעד כשהוא כבר סגור, והשני גורם לו להיראות ממומן כשאין כסף בקופה.
 */
export interface HkCommitment {
  id: string;
  monthly: number;
  /** מספר התשלומים שההוראה נפתחה עליהם; להוראה ללא הגבלה — אופק של שנה */
  payments: number;
  unlimited: boolean;
  /** כמה חיובים כבר נגבו */
  paid: number;
  /** ההתחייבות המלאה: חודשי × תשלומים */
  total: number;
  /** מה שכבר נגבה מתוכה */
  collected: number;
  /** מה שעוד צפוי להיגבות */
  outstanding: number;
  /** מתי ייגבה החיוב הבא — מגיע מהגיליון */
  nextCharge?: string;
}

/** אופק ההתחייבות של הוראה ללא הגבלת זמן — שנה קדימה. */
export const UNLIMITED_HORIZON_MONTHS = 12;

export function hkCommitment(order: any): HkCommitment | null {
  if (!order) return null;
  const monthly = num(order.amount);
  if (monthly <= 0) return null;

  const unlimited = !!order.unlimited;
  const payments = unlimited ? UNLIMITED_HORIZON_MONTHS : (num(order.payments) || 0);
  if (payments <= 0) return null;

  const paid = Math.min(num(order.paid), payments);
  const total = monthly * payments;
  const collected = monthly * paid;

  // הוראה שבוטלה כבר לא מתחייבת לכלום קדימה — מה שנגבה נגבה, וזהו.
  const cancelled = !!String(order.cancelDate || '').trim();
  return {
    id: String(order.id || ''),
    monthly, payments, unlimited, paid, total, collected,
    outstanding: cancelled ? 0 : Math.max(0, total - collected),
    nextCharge: cancelled ? '' : String(order.nextCharge || ''),
  };
}

/** ההוראות ששייכות לקמפיין הזה עבור האדם הזה. */
/** כל המזהים שקושרו במפורש לשורה. */
export function explicitHkIds(sol: Solicitation): string[] {
  const out = [...(sol?.hkIds || [])];
  if (sol?.hkId && out.indexOf(sol.hkId) < 0) out.push(sol.hkId);
  return out.map(String).filter(Boolean);
}

/**
 * ההוראות ששייכות לקמפיין הזה עבור האדם הזה.
 *
 * שני מסלולים, ושניהם נחוצים: הוראה שהגיעה במייל עם קטגוריה ששווה לשם
 * הקמפיין משויכת לבד, והוראה שנרשמה תחת קטגוריה אחרת — או בלי קטגוריה
 * בכלל, כפי שקורה ברוב המיילים — מקושרת ידנית בלחיצה.
 */
export function hkForSolicitation(sol: Solicitation, project: Project, hk: any[]): HkCommitment[] {
  const name = String(sol?.name || '').trim();
  if (!name) return [];
  const tag = (project.purposeTag || project.name || '').trim();
  const explicit = explicitHkIds(sol);

  const mine = (hk || []).filter(h => String(h?.name || '').trim() === name);
  const chosen = mine.filter(h => {
    if (explicit.length) return explicit.indexOf(String(h.id)) >= 0;   // קישור מפורש גובר
    return !!tag && String(h.campaign || h.purpose || '').trim() === tag;
  });

  return chosen.map(hkCommitment).filter(Boolean) as HkCommitment[];
}

/**
 * הוראות הקבע של אותו אדם שאינן משויכות עדיין — להצעה בממשק.
 * הפעילות ראשונות, אבל גם הוראה שהסתיימה מוצעת: מה שנגבה ממנה בתקופת
 * הקמפיין הוא כסף אמיתי שהגיע.
 */
export function unlinkedHkFor(sol: Solicitation, project: Project, hk: any[]): any[] {
  const name = String(sol?.name || '').trim();
  if (!name) return [];
  const linked = new Set(hkForSolicitation(sol, project, hk).map(c => c.id));
  const excluded = new Set(sol.excludedHkIds || []);
  return (hk || [])
    .filter(h => String(h?.name || '').trim() === name)
    .filter(h => !linked.has(String(h.id)) && !excluded.has(String(h.id)))
    .sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0));
}

export interface AttachedDonation {
  id: string;
  name: string;
  date: string;
  amount: number;
  method: string;
  purpose: string;
  /** האם היא סומנה לקמפיין מעצמה, או שצירפת אותה ידנית */
  auto: boolean;
}

export interface SolicitationRow {
  sol: Solicitation;
  status: SolicitationStatus;
  /** כמה מתכוונים לבקש */
  ask: number;
  /** מה שהאדם התחייב לו בעל פה */
  pledge: number;
  /** כמה מההבטחה עוד לא כוסתה */
  pledgeRemaining: number;
  /** התשלומים שנספרים לקמפיין הזה */
  donations: AttachedDonation[];
  /** תשלומים של אותו אדם שאינם משויכים — מוצעים לצירוף */
  candidates: AttachedDonation[];
  /** הוראות הקבע ששייכות לקמפיין */
  commitments: HkCommitment[];
  /** נכנס בפועל: תשלומים משויכים + חיובי הו״ק שכבר נגבו */
  raised: number;
  /** עוד צפוי מהוראת קבע — התחייבות חתומה אצל הספק */
  hkOutstanding: number;
  /** עוד צפוי מהבטחה בעל פה — אמירה, לא מסמך */
  pledgeOutstanding: number;
  /** עוד צפוי, שניהם יחד */
  outstanding: number;
  /** נכנס + צפוי — המספר שנספר מול היעד */
  committed: number;
  history?: GivingHistory;
}

function toAttached(d: any, auto: boolean): AttachedDonation {
  return {
    id: String(d?.id || ''),
    name: String(d?.name || '').trim(),
    date: String(d?.date || ''),
    amount: num(d?.amount),
    method: String(d?.method || ''),
    purpose: String(d?.purpose || ''),
    auto,
  };
}

/**
 * ── שני מספרים, ולמה שניהם נחוצים ─────────────────────────────────────────
 *
 * "אני אתן לך אלף שקל" הוא **התחייבות**. חודש אחר כך נכנסים 500 בקישור —
 * זה **מה שנכנס**. הקמפיין צריך לדעת את שניהם: כמה התחייבויות אספתי (כמה
 * מהיעד סגור), וכמה כסף באמת יש.
 *
 * הכיסוי מזוהה לבד: כל תשלום שנרשם על שם האדם עם ייעוד הקמפיין מקוזז מול
 * ההבטחה שלו. גם הוראת קבע שנפתחה או חודשה בסכום גדול יותר מכסה אותה —
 * מי שהבטיח ₪1,000 ופתח הוראה על ₪250×12 עמד בהבטחה ואין ממנו יתרה.
 *
 * ומה שנספר לבד אפשר גם להסיר: תשלום על סיור סליחות אינו הקמפיין, גם אם
 * הוא הגיע מאותו אדם באותו חודש.
 */
export function buildSolicitationRows(
  project: Project,
  donations: any[],
  hk: any[],
  giving?: Record<string, GivingHistory>
): SolicitationRow[] {
  const tag = (project.purposeTag || project.name || '').trim();

  // מעבר אחד על היומן: כל התשלומים לפי שם
  const byName: Record<string, any[]> = {};
  (donations || []).forEach(d => {
    const n = String(d?.name || '').trim();
    if (!n || num(d?.amount) <= 0) return;
    (byName[n] || (byName[n] = [])).push(d);
  });

  return (project.solicitations || []).map(sol => {
    const name = String(sol.name || '').trim();
    const status = normalizeStatus(sol.status);
    const excluded = new Set(sol.excludedDonationIds || []);
    const included = new Set(sol.includedDonationIds || []);
    const excludedHk = new Set(sol.excludedHkIds || []);

    const commitments = hkForSolicitation(sol, project, hk)
      .filter(c => !excludedHk.has(c.id));
    const hkIds = new Set(commitments.map(c => 'hk:' + c.id + ':'));

    const attached: AttachedDonation[] = [];
    const candidates: AttachedDonation[] = [];

    (byName[name] || []).forEach(d => {
      const id = String(d?.id || '');
      const isHkCharge = id.indexOf('hk:') === 0;

      // ── חיוב של הוראת קבע נספר דרך ההוראה עצמה ולא כתשלום נפרד ──────
      //
      // אחרת אותו כסף מופיע פעמיים באותה שורה: פעם כ"נגבה מההוראה" ופעם
      // כתשלום. הזיהוי לפי המזהה, ובנוסף לפי אפיק הגבייה — שורה שנרשמה
      // ידנית כ"הוראת קבע" למי שיש לו הוראה משויכת היא אותה גבייה, גם אם
      // המזהה שלה אינו בפורמט של המנוע.
      if (commitments.length && (
            (isHkCharge && Array.from(hkIds).some(p => id.indexOf(p) === 0)) ||
            String(d.method || '').trim() === 'הוראת קבע'
          )) return;

      const taggedHere = !!tag && String(d.purpose || '').trim() === tag;
      if (excluded.has(id)) { candidates.push(toAttached(d, taggedHere)); return; }
      if (taggedHere || included.has(id)) attached.push(toAttached(d, taggedHere));
      else if (!isHkCharge) candidates.push(toAttached(d, false));
    });

    const cashRaised = attached.reduce((t, d) => t + d.amount, 0);
    const hkTotal = commitments.reduce((t, c) => t + c.total, 0);
    const hkCollected = commitments.reduce((t, c) => t + c.collected, 0);
    const hkOutstanding = commitments.reduce((t, c) => t + c.outstanding, 0);

    // ההבטחה נסגרת גם בכסף שנכנס וגם בהוראת קבע שנפתחה בעקבותיה
    const pledge = num(sol.pledged);
    const pledgeRemaining = Math.max(0, pledge - cashRaised - hkTotal);

    const raised = cashRaised + hkCollected;
    const outstanding = hkOutstanding + pledgeRemaining;

    return {
      sol, status,
      ask: num(sol.ask),
      pledge,
      pledgeRemaining,
      donations: attached,
      candidates: candidates.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6),
      commitments,
      raised,
      hkOutstanding,
      pledgeOutstanding: pledgeRemaining,
      outstanding,
      committed: raised + outstanding,
      history: giving ? giving[name] : undefined,
    };
  });
}

export interface SolicitationTotals {
  ask: number;
  /** סך ההתחייבויות שנאספו — הבטחות בעל פה והוראות קבע */
  pledged: number;
  raised: number;
  hkOutstanding: number;
  pledgeOutstanding: number;
  outstanding: number;
  committed: number;
  counts: Record<SolicitationStatus, number>;
}

export function sumSolicitationRows(rows: SolicitationRow[]): SolicitationTotals {
  const counts: Record<SolicitationStatus, number> = {
    toSend: 0, sent: 0, retry: 0, callBack: 0, giver: 0, giverNoAmount: 0, notGiver: 0,
  };
  let ask = 0, raised = 0, outstanding = 0, pledged = 0;
  let hkOutstanding = 0, pledgeOutstanding = 0;
  (rows || []).forEach(r => {
    counts[r.status]++;
    ask += r.ask;
    raised += r.raised;
    outstanding += r.outstanding;
    hkOutstanding += r.hkOutstanding;
    pledgeOutstanding += r.pledgeOutstanding;
    // "כמה התחייבויות אספתי": ההבטחה בעל פה, או ההוראה שנפתחה במקומה —
    // הגדולה מביניהן, כדי שאותה התחייבות לא תיספר פעמיים.
    pledged += Math.max(r.pledge, r.commitments.reduce((t, c) => t + c.total, 0));
  });
  return { ask, pledged, raised, hkOutstanding, pledgeOutstanding, outstanding,
           committed: raised + outstanding, counts };
}
