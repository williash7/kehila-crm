// רשימת חגים מאוחדת (Hebcal + חגים מותאמים אישית), עם ימים-עד-החג — נבנית כאן
// כדי לשמש לוגיקה שאינה תלוית-תצוגה (כרגע: תזכורת אוטומטית 30 יום לפני חג ב-
// holidayAutoTasks.ts). ה-id של כל חג הוא שם החג עצמו — אותה מוסכמה כמו ב-
// holidayExtras (ראה CalendarTab/HomeTab/TasksTab: h.hebrew || h.title).

export interface HolidayListItem {
  id: string;
  name: string;
  dateStr: string;
  emoji: string;
  daysAway: number;
}

export function buildHolidayList(holidays: any[], customHols: any[], today: Date): HolidayListItem[] {
  const list: { name: string; dateStr: string; emoji: string }[] = [];
  holidays.forEach(h => {
    const dateStr = h.date?.split('T')[0];
    const name = h.hebrew || h.title;
    if (dateStr && name) list.push({ name, dateStr, emoji: '✡️' });
  });
  (customHols || []).forEach((c: any) => {
    if (c.name && c.date) list.push({ name: c.name, dateStr: c.date, emoji: '📅' });
  });

  // אותו חג עלול להופיע פעמיים (Hebcal סורק שנתיים קדימה) — שומרים רק את המופע
  // הקרוב ביותר להיום לכל שם.
  const byName = new Map<string, { name: string; dateStr: string; emoji: string }>();
  list.forEach(h => {
    const existing = byName.get(h.name);
    if (!existing || Math.abs(new Date(h.dateStr).getTime() - today.getTime()) < Math.abs(new Date(existing.dateStr).getTime() - today.getTime())) {
      byName.set(h.name, h);
    }
  });

  return Array.from(byName.values())
    .map(h => ({
      id: h.name,
      name: h.name,
      dateStr: h.dateStr,
      emoji: h.emoji,
      daysAway: Math.ceil((new Date(h.dateStr).getTime() - today.getTime()) / 86400000),
    }))
    .sort((a, b) => a.daysAway - b.daysAway);
}
