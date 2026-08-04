// מנוע ה"ניקוד" (gamification) — ניקוד מצטבר, רצף ימים ושיא שבועי, הכל ב-localStorage.
// כל סוגי הפעולות המנוקדות מוגדרות במקום אחד (POINT_RULES) כדי שיהיה אפשר להציג
// טבלת מידע מלאה ("כמה שווה כל פעולה") ולא לפזר מספרי-קסם בקוד.
// logAction הוא export כפונקציה רגילה (לא hook) כדי שאפשר יהיה לקרוא לה מכל מקום
// באפליקציה (כמו AppContext), ומשדר CustomEvent כדי ש-ScoreTab יתעדכן בלי תלות ישירה.

export interface WeekEntry {
  week: string; // "YYYY-Www"
  actions: number;
  points: number;
}

export interface ScoreSnapshot {
  total: number;
  streak: number;
  thisWeek: WeekEntry;
  lastWeek: WeekEntry | null;
  bestWeek: WeekEntry | null;
}

export interface ActivityLogEntry {
  label: string;
  points: number;
  date: string; // "YYYY-MM-DD"
  week: string; // "YYYY-Www"
}

export interface PointRule {
  label: string;
  points: number;
  category: 'planning' | 'execution';
}

// תכנון (planning) = יצירה/הכנה מראש. ביצוע (execution) = ביצוע בפועל — ולכן שווה יותר.
export const POINT_RULES = {
  contact_update:  { label: 'עדכון פרטי איש קשר',        points: 10, category: 'execution' },
  donation:        { label: 'תרומה מתועדת',              points: 15, category: 'execution' },
  meeting:         { label: 'מפגש נרשם',                 points: 10, category: 'execution' },
  task_create:     { label: 'יצירת משימה',               points: 5,  category: 'planning'  },
  task_complete:   { label: 'השלמת משימה',               points: 15, category: 'execution' },
  event_create:    { label: 'יצירת אירוע קבוע',          points: 10, category: 'planning'  },
  event_edit:      { label: 'עדכון אירוע קבוע',          points: 5,  category: 'planning'  },
  attendance:      { label: 'רישום נוכחות באירוע',       points: 10, category: 'execution' },
  invite_done:     { label: 'הזמנת איש קשר בוצעה',       points: 3,  category: 'execution' },
  holiday_custom:  { label: 'הוספת חג מותאם אישית',      points: 5,  category: 'planning'  },
  facebook_post:   { label: 'פרסום פוסט/סטטוס בפייסבוק',  points: 10, category: 'execution' },
  history_archive: { label: 'העברת חג/אירוע להיסטוריה',   points: 5,  category: 'planning'  },
  home_visit:      { label: 'ביקור בית בוצע',            points: 20, category: 'execution' },
} as const satisfies Record<string, PointRule>;

export type PointRuleKey = keyof typeof POINT_RULES;

export const SCORE_ACTION_EVENT = 'score-action';

const TOTAL_KEY = 'score_total';
const STREAK_KEY = 'score_streak';
const LAST_ACTION_KEY = 'score_last_action_date';
const WEEKLY_LOG_KEY = 'score_weekly_log';
const BEST_WEEK_KEY = 'score_best_week';
const BACKFILL_FLAG_KEY = 'score_backfill_v1_done';
const ACTIVITY_LOG_KEY = 'score_activity_log';
const ACTIVITY_LOG_MAX = 300; // מגביל את הגודל — לא צריך היסטוריה אינסופית

const toDateStr = (d: Date) => d.toISOString().split('T')[0];

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function readWeeklyLog(): WeekEntry[] {
  try {
    return JSON.parse(localStorage.getItem(WEEKLY_LOG_KEY) || '[]');
  } catch {
    return [];
  }
}

function readBestWeek(): WeekEntry | null {
  try {
    const raw = localStorage.getItem(BEST_WEEK_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// מוסיף פעולות/נקודות לשבוע (לפי מפתח שבוע ISO נתון) ומעדכן שיא אם צריך —
// לשימוש גם ע"י logAction (השבוע הנוכחי) וגם ע"י הגיבוי הרטרואקטיבי (שבוע היסטורי).
function addToWeek(weekStr: string, points: number, actions: number) {
  const log = readWeeklyLog();
  const idx = log.findIndex(w => w.week === weekStr);
  const updatedWeek: WeekEntry = idx >= 0
    ? { week: weekStr, actions: log[idx].actions + actions, points: log[idx].points + points }
    : { week: weekStr, actions, points };
  if (idx >= 0) log[idx] = updatedWeek;
  else log.push(updatedWeek);
  localStorage.setItem(WEEKLY_LOG_KEY, JSON.stringify(log));

  const bestWeek = readBestWeek();
  if (!bestWeek || updatedWeek.points > bestWeek.points) {
    localStorage.setItem(BEST_WEEK_KEY, JSON.stringify(updatedWeek));
  }
}

function readActivityLog(): ActivityLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_LOG_KEY) || '[]');
  } catch {
    return [];
  }
}

function appendActivityLog(entry: ActivityLogEntry) {
  const log = readActivityLog();
  log.push(entry);
  if (log.length > ACTIVITY_LOG_MAX) log.splice(0, log.length - ACTIVITY_LOG_MAX);
  localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(log));
}

// מחזיר את כל הפעולות הבודדות שנרשמו בשבוע נתון (מהחדשה לישנה) — לשימוש
// בפתיחת "פירוט" בסיכום השבועי, כדי לראות בדיוק אילו פעולות בוצעו.
export function getWeekActivities(weekStr: string): ActivityLogEntry[] {
  return readActivityLog()
    .filter(e => e.week === weekStr)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// הרצף כפי שיוצג עכשיו: אם עברו יומיים+ בלי שום פעולה, הרצף "נשבר" לצורך תצוגה
// גם אם עוד לא נרשמה פעולה חדשה שתאפס אותו רשמית ב-storage.
function getCurrentStreakDisplay(today: Date): number {
  const lastActionStr = localStorage.getItem(LAST_ACTION_KEY);
  if (!lastActionStr) return 0;
  const todayStr = toDateStr(today);
  const yesterdayStr = toDateStr(new Date(today.getTime() - 86400000));
  if (lastActionStr !== todayStr && lastActionStr !== yesterdayStr) return 0;
  return parseInt(localStorage.getItem(STREAK_KEY) || '0', 10);
}

export function getScoreSnapshot(today: Date): ScoreSnapshot {
  const total = parseInt(localStorage.getItem(TOTAL_KEY) || '0', 10);
  const streak = getCurrentStreakDisplay(today);
  const log = readWeeklyLog();
  const thisWeekStr = getISOWeek(today);
  const lastWeekStr = getISOWeek(new Date(today.getTime() - 7 * 86400000));
  const thisWeek = log.find(w => w.week === thisWeekStr) || { week: thisWeekStr, actions: 0, points: 0 };
  const lastWeek = log.find(w => w.week === lastWeekStr) || null;
  return { total, streak, thisWeek, lastWeek, bestWeek: readBestWeek() };
}

// נקראת מכל מקום באפליקציה כשמתבצעת פעולה שראוי לתת עליה ניקוד (ראה POINT_RULES).
// count מאפשר לנקד כמה פעולות זהות בבת אחת (למשל 3 משימות שנוספו יחד).
export function logAction(key: PointRuleKey, count: number = 1) {
  if (count <= 0) return;
  const rule = POINT_RULES[key];
  const totalPoints = rule.points * count;
  const today = new Date();
  const todayStr = toDateStr(today);
  const lastActionStr = localStorage.getItem(LAST_ACTION_KEY);

  const total = parseInt(localStorage.getItem(TOTAL_KEY) || '0', 10) + totalPoints;
  localStorage.setItem(TOTAL_KEY, String(total));

  if (lastActionStr !== todayStr) {
    const yesterdayStr = toDateStr(new Date(today.getTime() - 86400000));
    const prevStreak = parseInt(localStorage.getItem(STREAK_KEY) || '0', 10);
    const nextStreak = lastActionStr === yesterdayStr ? prevStreak + 1 : 1;
    localStorage.setItem(STREAK_KEY, String(nextStreak));
    localStorage.setItem(LAST_ACTION_KEY, todayStr);
  }

  const weekStr = getISOWeek(today);
  addToWeek(weekStr, totalPoints, count);
  const label = count > 1 ? `${rule.label} ×${count}` : rule.label;
  appendActivityLog({ label, points: totalPoints, date: todayStr, week: weekStr });

  window.dispatchEvent(new CustomEvent(SCORE_ACTION_EVENT, {
    detail: { points: totalPoints, label },
  }));
}

function parseDdMmYyyy(s: string): Date | null {
  const m = String(s || '').match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const yyyy = y.length === 2 ? `20${y}` : y;
  const dt = new Date(Number(yyyy), Number(mo) - 1, Number(d));
  return isNaN(dt.getTime()) ? null : dt;
}

export interface ActivityCount {
  key: PointRuleKey;
  label: string;
  category: 'planning' | 'execution';
  count: number;
}

// מתאים שורת יומן פעילות בחזרה לסוג הפעולה (POINT_RULES) לפי תחילת הטקסט —
// הטקסט עצמו יכול לכלול סיומת "×N" (כמה פעולות זהות ביחד) או "(גיבוי)"
// (רטרואקטיבי), ששניהם נשמרים כתחילית תואמת ל-rule.label.
function matchRuleKey(label: string): PointRuleKey | null {
  const keys = Object.keys(POINT_RULES) as PointRuleKey[];
  return keys.find(k => label === POINT_RULES[k].label || label.startsWith(POINT_RULES[k].label + ' ')) || null;
}

// כמה פעמים בוצע כל סוג פעולה — לתצוגת "סטטיסטיקת פעילות" (במקום ניקוד).
// days=undefined בודק את כל יומן הפעילות השמור (עד ACTIVITY_LOG_MAX רשומות).
export function getActivityCounts(days?: number): ActivityCount[] {
  const log = readActivityLog();
  const cutoff = days ? toDateStr(new Date(Date.now() - (days - 1) * 86400000)) : null;
  const totals = new Map<PointRuleKey, number>();
  log.forEach(e => {
    if (cutoff && e.date < cutoff) return;
    const key = matchRuleKey(e.label);
    if (!key) return;
    const m = /×(\d+)/.exec(e.label);
    const n = m ? parseInt(m[1], 10) : 1;
    totals.set(key, (totals.get(key) || 0) + n);
  });
  return Array.from(totals.entries())
    .map(([key, count]) => ({ key, label: POINT_RULES[key].label, category: POINT_RULES[key].category, count }))
    .sort((a, b) => b.count - a.count);
}

export interface HeatmapDay { date: string; count: number; }

// מפת יום→כמות פעולות ל-N השבועות האחרונים (כולל השבוע הנוכחי) — לגרף ימי
// פעילות מסוג "GitHub contribution graph".
export function getActivityHeatmap(weeks: number): HeatmapDay[] {
  const log = readActivityLog();
  const counts = new Map<string, number>();
  log.forEach(e => counts.set(e.date, (counts.get(e.date) || 0) + 1));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - (weeks * 7 - 1) * 86400000);
  const days: HeatmapDay[] = [];
  for (let d = new Date(start); d.getTime() <= today.getTime(); d.setDate(d.getDate() + 1)) {
    const ds = toDateStr(d);
    days.push({ date: ds, count: counts.get(ds) || 0 });
  }
  return days;
}

export interface BackfillResult { count: number; points: number; }

// גיבוי חד-פעמי: נותן נקודות רטרואקטיביות על תרומות ומפגשים מ-7 הימים האחרונים,
// לפי התאריך האמיתי של כל פעולה (לא היום) — כדי שהניקוד השבועי ישקף את מה שבאמת קרה.
// רץ פעם אחת בלבד (משאיר סימון קבוע ב-localStorage) כדי לא לספור פעמיים בכל טעינה.
// משימות ואירועים לא ניתנים לגיבוי — אין להם תאריך יצירה שמור בנתונים.
export function backfillLastWeek(donations: any[]): BackfillResult | null {
  if (localStorage.getItem(BACKFILL_FLAG_KEY)) return null;
  localStorage.setItem(BACKFILL_FLAG_KEY, 'true');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today.getTime() - 6 * 86400000); // 7 ימים אחרונים כולל היום

  let totalPoints = 0;
  let totalCount = 0;

  (donations || []).forEach((d: any) => {
    const date = parseDdMmYyyy(d.date);
    if (!date || date < cutoff || date > today) return;
    const isMeeting = (d.amount || 0) === 0;
    const rule = isMeeting ? POINT_RULES.meeting : POINT_RULES.donation;
    const weekStr = getISOWeek(date);
    addToWeek(weekStr, rule.points, 1);
    appendActivityLog({ label: `${rule.label} (גיבוי)`, points: rule.points, date: toDateStr(date), week: weekStr });
    totalPoints += rule.points;
    totalCount += 1;
  });

  if (totalCount > 0) {
    const total = parseInt(localStorage.getItem(TOTAL_KEY) || '0', 10) + totalPoints;
    localStorage.setItem(TOTAL_KEY, String(total));
  }

  return { count: totalCount, points: totalPoints };
}
