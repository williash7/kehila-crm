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
  /**
   * קישור מפורש להוראת קבע. בדרך כלל לא צריך אותו — הוראה שהקטגוריה שלה
   * היא הקמפיין משויכת לבד. הוא נועד למקרה ההפוך: התורם פתח הוראת קבע
   * עבור הקמפיין, אבל אצל הספק היא נרשמה תחת קטגוריה אחרת.
   */
  hkId?: string;
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
  pledged: number;      // צפוי: יתרת הוראות קבע + הבטחות ידניות
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

  const goal = num(project.goal);
  return {
    goal,
    raised,
    pledged,
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
  };
}

/** ההוראות ששייכות לקמפיין הזה עבור האדם הזה. */
export function hkForSolicitation(sol: Solicitation, project: Project, hk: any[]): HkCommitment[] {
  const name = String(sol?.name || '').trim();
  if (!name) return [];
  const tag = (project.purposeTag || project.name || '').trim();

  const mine = (hk || []).filter(h => String(h?.name || '').trim() === name);
  const chosen = mine.filter(h => {
    if (sol.hkId) return String(h.id) === String(sol.hkId);        // קישור מפורש גובר
    return !!tag && String(h.campaign || h.purpose || '').trim() === tag;
  });

  return chosen.map(hkCommitment).filter(Boolean) as HkCommitment[];
}

/** הוראות פעילות של אותו אדם שאינן משויכות לקמפיין — להצעה בממשק. */
export function unlinkedHkFor(sol: Solicitation, project: Project, hk: any[]): any[] {
  const name = String(sol?.name || '').trim();
  if (!name) return [];
  const linked = new Set(hkForSolicitation(sol, project, hk).map(c => c.id));
  return (hk || []).filter(h =>
    String(h?.name || '').trim() === name && h.active && !linked.has(String(h.id)));
}

export interface SolicitationRow {
  sol: Solicitation;
  status: SolicitationStatus;
  /** כמה מתכוונים לבקש */
  ask: number;
  /** כמה כבר נכנס בפועל מהאדם הזה לקמפיין הזה */
  raised: number;
  /** הוראות הקבע ששייכות לקמפיין */
  commitments: HkCommitment[];
  /** מה שעוד צפוי: יתרת הוראות הקבע + הבטחה ידנית */
  outstanding: number;
  /** נכנס + צפוי — המספר שנספר מול היעד */
  committed: number;
  history?: GivingHistory;
}

export function buildSolicitationRows(
  project: Project,
  donations: any[],
  hk: any[],
  giving?: Record<string, GivingHistory>
): SolicitationRow[] {
  const tag = (project.purposeTag || project.name || '').trim();

  // כמה כל אדם כבר נתן לקמפיין — מעבר אחד על היומן
  const byName: Record<string, number> = {};
  (donations || []).forEach(d => {
    if (!tag || String(d?.purpose || '').trim() !== tag) return;
    const n = String(d?.name || '').trim();
    const a = num(d?.amount);
    if (n && a > 0) byName[n] = (byName[n] || 0) + a;
  });

  return (project.solicitations || []).map(sol => {
    const status = normalizeStatus(sol.status);
    const commitments = hkForSolicitation(sol, project, hk);
    const raised = byName[String(sol.name || '').trim()] || 0;

    // הבטחה ידנית נספרת רק אם אין הוראת קבע שכבר מכסה את ההתחייבות,
    // אחרת אותו כסף היה נספר פעמיים.
    const hkOutstanding = commitments.reduce((t, c) => t + c.outstanding, 0);
    const manualPledge = commitments.length ? 0 : num(sol.pledged);
    const outstanding = hkOutstanding + manualPledge;

    return {
      sol, status,
      ask: num(sol.ask),
      raised,
      commitments,
      outstanding,
      committed: raised + outstanding,
      history: giving ? giving[String(sol.name || '').trim()] : undefined,
    };
  });
}

export interface SolicitationTotals {
  ask: number;
  raised: number;
  outstanding: number;
  committed: number;
  counts: Record<SolicitationStatus, number>;
}

export function sumSolicitationRows(rows: SolicitationRow[]): SolicitationTotals {
  const counts: Record<SolicitationStatus, number> = {
    toSend: 0, sent: 0, retry: 0, callBack: 0, giver: 0, giverNoAmount: 0, notGiver: 0,
  };
  let ask = 0, raised = 0, outstanding = 0;
  (rows || []).forEach(r => {
    counts[r.status]++;
    ask += r.ask;
    raised += r.raised;
    outstanding += r.outstanding;
  });
  return { ask, raised, outstanding, committed: raised + outstanding, counts };
}
