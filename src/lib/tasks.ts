// משימות חג/אירוע — כולל "משימת הזמנה" מיוחדת: רשימת אנשים להתקשר אליהם,
// עם צ'קליסט לפי איש והערכת זמן כוללת (3 דקות שיחה לכל אדם).

export interface SubTask {
  text: string;
  done: boolean;
}

export interface TaskItem {
  text: string;
  done: boolean;
  kind?: 'invite' | 'holidayReminder' | 'homeVisit' | 'eventReminder' | 'meeting' | 'thankYou';
  people?: string[];
  doneNames?: string[];
  dueDate?: string; // ISO date (YYYY-MM-DD) — "מתי". גם מזהה המופע למשימות kind:'eventReminder'
  skipped?: boolean; // true = הושלמה כ"לא עושים כלום" ולא כביצוע בפועל (רק למשימות kind:'holidayReminder')
  roundId?: string; // מזהה מערך ביקורי הבית שהמשימה נוצרה ממנו (רק למשימות kind:'homeVisit')
  personName?: string; // שם איש הקשר שהמשימה נוגעת אליו (רק למשימות kind:'homeVisit'/'meeting')
  // פרטים נוספים — רלוונטיים לכל סוגי המשימות (לא רק kind ספציפי)
  time?: string;       // שעת התחלה, HH:MM (עם dueDate כתאריך — ביחד הם "מתי בדיוק")
  location?: string;   // מקום
  endTime?: string;    // שעת סיום (HH:MM) — אופציונלי
  notes?: string;      // פרטים נוספים חופשיים
  subtasks?: SubTask[];
  createdAt?: string;   // ISO — מתויג אוטומטית ביצירה, משמש כברירת מחדל למיון לפי תאריך כשאין dueDate/תאריך הקשר
  urgent?: boolean;     // ציר "דחוף" של מטריצת אייזנהאואר
  important?: boolean;  // ציר "חשוב" של מטריצת אייזנהאואר
  donationDate?: string; // dd/MM/yyyy — התאריך של התרומה שיצרה משימת kind:'thankYou' זו (למניעת כפילות)
  doneAt?: string;      // ISO — מתויג אוטומטית כשמסמנים done=true, לשימוש בתצוגת "משימות שהושלמו" בהיסטוריה
}

export type EisenhowerQuadrant = 'do' | 'schedule' | 'delegate' | 'eliminate';

// מטריצת אייזנהאואר: "do" (דחוף+חשוב) מטופל ראשון, "eliminate" (לא דחוף
// ולא חשוב, כולל משימה שעדיין לא סווגה כלל) נדחק לסוף במיון לפי דחיפות.
export const EISENHOWER_META: Record<EisenhowerQuadrant, { label: string; emoji: string; weight: number }> = {
  do:        { label: 'דחוף וחשוב',       emoji: '🔴', weight: 0 },
  schedule:  { label: 'חשוב, לא דחוף',    emoji: '🟡', weight: 1 },
  delegate:  { label: 'דחוף, לא חשוב',    emoji: '🟠', weight: 2 },
  eliminate: { label: 'לא דחוף ולא חשוב', emoji: '🟢', weight: 3 },
};

export function hasEisenhowerRating(task: { urgent?: boolean; important?: boolean }): boolean {
  return task.urgent !== undefined || task.important !== undefined;
}

export function eisenhowerQuadrant(task: { urgent?: boolean; important?: boolean }): EisenhowerQuadrant {
  if (task.urgent && task.important) return 'do';
  if (!task.urgent && task.important) return 'schedule';
  if (task.urgent && !task.important) return 'delegate';
  return 'eliminate';
}

// מוסיף createdAt="עכשיו" לכל אובייקט משימה חדש — כדי שלכל משימה יהיה תאריך
// למיון גם אם לא הוגדר לה dueDate מפורש ואין לה הקשר חג/אירוע (ראה taskSort.ts).
export function stampCreated<T extends object>(task: T): T & { createdAt: string } {
  return { ...task, createdAt: new Date().toISOString() };
}

export const MINUTES_PER_CALL = 3;

// מזהה שמור בתוך holidayExtras עבור משימות חד-פעמיות שלא שייכות לחג/אירוע ספציפי
// (אותה טכניקת "piggyback" על אחסון קיים ומסונכרן לענן, כמו __nameMerges__)
export const STANDALONE_TASKS_ID = '__standalone__';

// מזהה שמור בתוך holidayExtras לפרטים נוספים (שעה/מקום/הערות/תתי-משימות/דחיפות)
// של תזכורות תאריכים אישיים (יום הולדת/יארצייט) — keyed לפי PersonalDateEvent.key.
export const PERSONAL_DATE_EXTRAS_ID = '__personalDates__';

// מחשב את המופע הקרוב הבא של אירוע חוזר (עבור "כמה זמן נותר" למשימות אירוע)
export function nextEventOccurrence(ev: { date?: string; freq?: string; time?: string }, from: Date): Date | null {
  if (!ev.date) return null;
  const base = new Date(`${ev.date}T${ev.time || '00:00'}`);
  if (isNaN(base.getTime())) return null;
  if (ev.freq === 'oneoff') return base;
  const d = new Date(base);
  const stepDays = ev.freq === 'weekly' ? 7 : ev.freq === 'biweekly' ? 14 : null;
  if (stepDays) {
    while (d.getTime() < from.getTime()) d.setDate(d.getDate() + stepDays);
  } else {
    while (d.getTime() < from.getTime()) d.setMonth(d.getMonth() + 1);
  }
  return d;
}

// מציג "כמה זמן נותר" (ימים ושעות) עד לדדליין נתון
export function formatRemaining(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return 'המועד עבר';
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  if (days > 0) return `נותרו ${days} ימים ו-${hours} שעות`;
  if (hours > 0) return `נותרו ${hours} שעות`;
  return 'פחות משעה';
}

// שלוש משימות ברירת מחדל לכל אירוע: פרסום קידום לפני, צילום בזמן האירוע (בשעת
// מעשה), ופרסום סיכום אחרי — צילום ופרסום הן שתי משימות נפרדות, לא אחת משולבת.
// dueDate אופציונלי (תאריך המפגש הקרוב של האירוע) מוצמד לשלושתן.
export function createEventMediaTasks(dueDate?: string): TaskItem[] {
  return [
    stampCreated({ text: '📢 פרסום קידום לפני האירוע (סטטוס + פייסבוק)', done: false, ...(dueDate ? { dueDate } : {}) }),
    stampCreated({ text: '📷 צילום בזמן האירוע', done: false, ...(dueDate ? { dueDate } : {}) }),
    stampCreated({ text: '📸 פרסום סיכום אחרי האירוע (סטטוס + פייסבוק)', done: false, ...(dueDate ? { dueDate } : {}) }),
  ];
}

// גיבוי חד-פעמי: ממלא dueDate לכל משימת אירוע קיימת שעדיין אין לה תאריך משלה
// (כולל משימות מדיה — קידום/צילום/סיכום), לפי המופע הקרוב הבא של האירוע כרגע
// — כדי שגם משימות ישנות (מלפני שמשימות אירוע חדשות התחילו לקבל תאריך
// אוטומטית) יקבלו את תאריך האירוע בפועל, לא רק חדשות.
export function backfillEventTaskDates(events: any[], today: Date): { events: any[]; count: number } {
  let count = 0;
  const next = events.map(ev => {
    const occ = nextEventOccurrence(ev, today);
    if (!occ) return ev;
    const occIso = occ.toISOString().split('T')[0];
    const tasks = (ev.tasks || []).map((t: any) => {
      if (t.dueDate) return t;
      count++;
      return { ...t, dueDate: occIso };
    });
    return { ...ev, tasks };
  });
  return { events: next, count };
}

export function createInviteTask(label: string, people: string[]): TaskItem {
  return stampCreated({
    text: `📞 הזמנת ${label} — ${people.length} אנשים`,
    done: people.length === 0,
    kind: 'invite',
    people,
    doneNames: [],
  });
}

export function inviteRemainingMinutes(task: TaskItem): number {
  const total = task.people?.length || 0;
  const done = task.doneNames?.length || 0;
  return Math.max(0, total - done) * MINUTES_PER_CALL;
}

export function toggleInvitePerson(task: TaskItem, personName: string): TaskItem {
  const doneNames = task.doneNames || [];
  const nextDone = doneNames.includes(personName)
    ? doneNames.filter(n => n !== personName)
    : [...doneNames, personName];
  const total = task.people?.length || 0;
  return { ...task, doneNames: nextDone, done: total > 0 && nextDone.length >= total };
}

// משימת "לעדכן את החג X" — נוצרת אוטומטית 30 יום לפני חג (ראה holidayAutoTasks.ts).
export function createHolidayReminderTask(holidayName: string): TaskItem {
  return stampCreated({ text: `🗓️ לעדכן את החג — ${holidayName}`, done: false, kind: 'holidayReminder' as const });
}

// משימת "ביקור בית: X" — נוצרת אוטומטית ל-5 האנשים הראשונים כשמתחילים מערך ביקורים חדש.
export function createHomeVisitTask(personName: string, roundId: string): TaskItem {
  return stampCreated({ text: `🏠 ביקור בית — ${personName}`, done: false, kind: 'homeVisit' as const, roundId, personName });
}

// תזכורת יום לפני מופע של אירוע חוזר (ראה eventAutoTasks.ts) — dueDate הוא תאריך
// המופע עצמו (YYYY-MM-DD), ומשמש גם כמזהה המופע כדי לא ליצור תזכורת כפולה לו,
// וגם להצגת "כמה זמן נותר" (renderTaskItem הקיים כבר יודע להציג dueDate).
export function createEventReminderTask(eventName: string, occurrenceDateISO: string): TaskItem {
  return stampCreated({ text: `🔔 מחר — ${eventName}`, done: false, kind: 'eventReminder' as const, dueDate: occurrenceDateISO });
}

export const THANKYOU_BACKFILL_DAYS = 10;

function parseDdMmYyyyLocal(s: string | undefined | null): Date | null {
  const m = String(s || '').match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const yyyy = y.length === 2 ? `20${y}` : y;
  const dt = new Date(Number(yyyy), Number(mo) - 1, Number(d));
  return isNaN(dt.getTime()) ? null : dt;
}

// תרומות מה-10 הימים האחרונים (כולל היום) שעדיין אין להן משימת "לשלוח
// תודה" — לגיבוי רטרואקטיבי חד-פעמי (ראה AppContext, שרץ פעם אחת בלבד לפי
// דגל ב-localStorage, באותו דפוס כמו backfillLastWeek ב-score.ts). מפגשים
// (amount<=0) לא נכללים — רק תרומות אמיתיות.
export function computeMissingThankYouTasks(donations: any[], standaloneTasks: TaskItem[], today: Date): TaskItem[] {
  const cutoff = new Date(today);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (THANKYOU_BACKFILL_DAYS - 1));
  const existing = new Set(
    standaloneTasks.filter(t => t.kind === 'thankYou').map(t => `${t.personName}::${t.donationDate}`)
  );
  const result: TaskItem[] = [];
  (donations || []).forEach((d: any) => {
    if (!d?.name || !((d.amount || 0) > 0)) return;
    const parsed = parseDdMmYyyyLocal(d.date);
    if (!parsed || parsed < cutoff || parsed > today) return;
    const key = `${d.name}::${d.date}`;
    if (existing.has(key)) return;
    result.push(createThankYouTask(d.name, d.amount, d.date));
    existing.add(key);
  });
  return result;
}

// משימת "פגישה עם X" — נוצרת ידנית מכרטיס איש הקשר (ProfileModal).
export function createMeetingTask(personName: string, dueDate?: string, time?: string): TaskItem {
  return stampCreated({ text: `🤝 פגישה עם ${personName}`, done: false, kind: 'meeting' as const, personName, dueDate, time });
}

// משימת "לשלוח תודה" — נוצרת אוטומטית בכל תרומה חדשה (ראה addManualDonation
// ב-AppContext), וגם רטרואקטיבית (חד-פעמי) עבור תרומות מ-10 הימים האחרונים.
// donationDate משמש למניעת יצירה כפולה לאותה תרומה בדיוק.
export function createThankYouTask(personName: string, amount: number, donationDate: string): TaskItem {
  return stampCreated({
    text: `🙏 לשלוח תודה — ${personName} (₪${amount.toLocaleString()})`,
    done: false,
    kind: 'thankYou' as const,
    personName,
    donationDate,
  });
}

export function addSubtask(task: TaskItem, text: string): TaskItem {
  if (!text.trim()) return task;
  return { ...task, subtasks: [...(task.subtasks || []), { text: text.trim(), done: false }] };
}

export function toggleSubtask(task: TaskItem, idx: number): TaskItem {
  const subtasks = [...(task.subtasks || [])];
  subtasks[idx] = { ...subtasks[idx], done: !subtasks[idx].done };
  return { ...task, subtasks };
}

export function removeSubtask(task: TaskItem, idx: number): TaskItem {
  const subtasks = [...(task.subtasks || [])];
  subtasks.splice(idx, 1);
  return { ...task, subtasks };
}
