import { HolidayListItem } from './holidayList';

export const HOLIDAY_REMINDER_DAYS = 30;

// חגים שנכנסו לטווח 30 הימים (ולא עברו) ועדיין אין להם משימת "לעדכן את החג" —
// לא משנה אם המשימה כבר בוצעה/דולגה: קיום המשימה עצמה (בכל מצב) מספיק כדי
// שלא ניצור אותה שוב בכל רענון.
export function computeMissingHolidayReminders(
  list: HolidayListItem[],
  holidayExtras: Record<string, any>
): HolidayListItem[] {
  return list.filter(h => {
    if (h.daysAway < 0 || h.daysAway > HOLIDAY_REMINDER_DAYS) return false;
    const tasks: any[] = holidayExtras[h.id]?.tasks || [];
    return !tasks.some(t => t.kind === 'holidayReminder');
  });
}
