import { nextEventOccurrence } from './tasks';

export const EVENT_REMINDER_HOURS_BEFORE = 24;

// אירועים חוזרים (לא חד-פעמיים) שהמופע הקרוב שלהם בטווח 24 השעות הקרובות
// ועדיין אין להם משימת "מחר — X" למופע הזה בדיוק — dueDate על המשימה הקיימת
// (YYYY-MM-DD של המופע) הוא הסימון הייחודי, כדי שכל מופע חדש (שבוע הבא וכו')
// יקבל תזכורת משלו, לא רק פעם אחת לכל האירוע.
export function computeMissingEventReminders(
  events: any[],
  today: Date
): { id: string; name: string; occurrenceDateISO: string }[] {
  const result: { id: string; name: string; occurrenceDateISO: string }[] = [];
  events.forEach(ev => {
    if (!ev.freq || ev.freq === 'oneoff') return;
    const next = nextEventOccurrence(ev, today);
    if (!next) return;
    const hoursAway = (next.getTime() - today.getTime()) / 3600000;
    if (hoursAway < 0 || hoursAway > EVENT_REMINDER_HOURS_BEFORE) return;
    const occurrenceDateISO = next.toISOString().split('T')[0];
    const tasks: any[] = ev.tasks || [];
    const exists = tasks.some(t => t.kind === 'eventReminder' && t.dueDate === occurrenceDateISO);
    if (!exists) result.push({ id: ev.id, name: ev.name, occurrenceDateISO });
  });
  return result;
}
