// ─────────────────────────────────────────────────────────────────────────────
// הקשר בין חג לאירועים שבתוכו.
//
// חג אינו התכנסות — אף אחד לא "מגיע לחנוכה", מגיעים למסיבה שבחנוכה. לכן חג
// יכול להחזיק כמה אירועים: בראש השנה למשל גם סעודת ליל חג קהילתית וגם
// תקיעת שופר בבית הכנסת, לכל אחד שעה, מקום ורשימת נוכחות משלו.
//
// המימוש: לאירוע נוסף שדה holidayId. הנתונים ממשיכים לחיות במערך האירועים,
// שם כבר קיימות נוכחות, משימות, אמנים ועוזר הפרסום — רק הממשק ליצירה יושב
// במסך החג. כך לא משכפלים שום מנגנון.
//
// מזהה החג הוא שם החג עצמו, כמו בכל שאר האפליקציה (ראה holidayList.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { createEventMediaTasks, nextEventOccurrence } from './tasks';
import { normalizeActivity } from './activities';

export interface HolidayEventDraft {
  name: string;
  type: string;
  date: string;
  time: string;
  location?: string;
  entryPrice?: number;
}

/** האירועים שמשוייכים לחג נתון, ממוינים לפי תאריך. */
export function eventsForHoliday(eventsData: any[], holidayId: string): any[] {
  if (!holidayId) return [];
  return (eventsData || [])
    .filter(e => e && e.holidayId === holidayId)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

/** יוצר אירוע חדש המשוייך לחג. אותו מבנה בדיוק כמו אירוע רגיל. */
export function buildHolidayEvent(holidayId: string, draft: HolidayEventDraft): any {
  const occ = nextEventOccurrence({ date: draft.date, freq: 'oneoff', time: draft.time }, new Date());
  return normalizeActivity({
    id: `ev_${Date.now()}`,
    holidayId,
    activityKind: 'holiday',
    name: draft.name.trim(),
    type: draft.type,
    freq: 'oneoff',        // אירוע בחג הוא חד-פעמי; החג עצמו הוא שחוזר כל שנה
    date: draft.date,
    time: draft.time,
    location: draft.location || '',
    entryPrice: draft.entryPrice || 0,
    purposeTag: draft.name.trim(),
    attendance: {},
    tasks: createEventMediaTasks(occ ? occ.toISOString().split('T')[0] : undefined),
    performers: [],
    budget: { expenses: [], income: [] },
  });
}

/** כמה נוכחים נרשמו באירוע אחד, על פני כל התאריכים שלו. */
export function eventAttendeeNames(ev: any): Set<string> {
  const names = new Set<string>();
  Object.values(ev?.attendance || {}).forEach((byDate: any) => {
    Object.keys(byDate || {}).forEach(name => { if (byDate[name]) names.add(name); });
  });
  return names;
}

/**
 * כמה אנשים **שונים** היו איתך בחג הזה — איחוד הנוכחות של החג עצמו ושל כל
 * האירועים שבתוכו. מי שהגיע לתקיעת שופר אבל לא לסעודה עדיין היה איתך בראש
 * השנה, ולכן נספר פעם אחת.
 *
 * הנוכחות שנרשמה ישירות על החג (לפני שהיו אירועים) ממשיכה להיספר — שום
 * נתון קיים לא הולך לאיבוד.
 */
export function holidayAttendeeNames(extra: any, linkedEvents: any[]): Set<string> {
  const names = new Set<string>();
  Object.values(extra?.attendance || {}).forEach((byDate: any) => {
    Object.keys(byDate || {}).forEach(name => { if (byDate[name]) names.add(name); });
  });
  (linkedEvents || []).forEach(ev => {
    eventAttendeeNames(ev).forEach(n => names.add(n));
  });
  return names;
}

/** סכום שורות תקציב (מתוכנן או בפועל). משותף לחג, לאירוע ולפרויקט. */
export function sumBudgetLines(lines: any[], field: 'planned' | 'actual'): number {
  return (lines || []).reduce((sum, l) => sum + (Number(l?.[field]) || 0), 0);
}

/** מאזן תקציב של אירוע: הכנסות בפועל פחות הוצאות בפועל. */
export function eventBalance(ev: any): { income: number; expense: number; balance: number } {
  const income = sumBudgetLines(ev?.budget?.income, 'actual');
  const expense = sumBudgetLines(ev?.budget?.expenses, 'actual');
  return { income, expense, balance: income - expense };
}
