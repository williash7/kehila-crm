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

export type SolicitationStatus = 'todo' | 'asked' | 'pledged' | 'gave' | 'declined';

export const SOLICITATION_LABEL: Record<SolicitationStatus, string> = {
  todo:     'לפנות',
  asked:    'פנינו',
  pledged:  'הבטיח',
  gave:     'נתן',
  declined: 'סירב',
};

export const SOLICITATION_COLOR: Record<SolicitationStatus, string> = {
  todo:     'bg-gray-100 text-gray-600',
  asked:    'bg-blue-50 text-blue-700',
  pledged:  'bg-amber-50 text-amber-700',
  gave:     'bg-emerald-50 text-emerald-700',
  declined: 'bg-red-50 text-red-600',
};

export const SOLICITATION_ORDER: SolicitationStatus[] = ['todo', 'asked', 'pledged', 'gave', 'declined'];

export interface Solicitation {
  name: string;
  status: SolicitationStatus;
  /** הסכום שהובטח — רלוונטי בעיקר בסטטוס "הבטיח" */
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
  raised: number;       // נכנס בפועל
  pledged: number;      // הובטח ועדיין לא שולם
  gap: number;          // כמה חסר ליעד
  percent: number;
  donorCount: number;
  /** ספירה לפי סטטוס ברשימת ההתרמה */
  counts: Record<SolicitationStatus, number>;
}

export function projectProgress(project: Project, donations: any[]): ProjectProgress {
  const linked = projectDonations(project, donations);
  const raised = linked.reduce((s, d) => s + num(d.amount), 0);

  const counts: Record<SolicitationStatus, number> = { todo: 0, asked: 0, pledged: 0, gave: 0, declined: 0 };
  let pledged = 0;
  (project.solicitations || []).forEach(s => {
    const st = (s.status || 'todo') as SolicitationStatus;
    if (counts[st] !== undefined) counts[st]++;
    // רק "הבטיח" נספר כצפוי. "נתן" כבר נכנס דרך יומן התרומות, וספירה שלו
    // כאן שוב הייתה מנפחת את המספר.
    if (st === 'pledged') pledged += num(s.pledged);
  });

  const goal = num(project.goal);
  return {
    goal,
    raised,
    pledged,
    gap: Math.max(0, goal - raised),
    percent: goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0,
    donorCount: new Set(linked.map(d => d.name)).size,
    counts,
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
    if (givers.has(s.name.trim()) && s.status !== 'gave') { changed = true; return { ...s, status: 'gave' as const }; }
    return s;
  });

  // תורם שנתן ואינו ברשימה — מתווסף, כדי שהרשימה תשקף את המציאות
  const listed = new Set(next.map(s => s.name.trim()));
  givers.forEach(name => {
    if (name && !listed.has(name)) { next.push({ name, status: 'gave' }); changed = true; }
  });

  return changed ? next : null;
}

/** הפרויקטים הפעילים — לרשימה הנפתחת בעת הוספת תרומה. */
export function activeProjects(projects: Project[]): Project[] {
  return (projects || []).filter(p => p.status !== 'closed');
}
