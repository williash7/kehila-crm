import { slashDateToDotDate } from './dateUtils';

// חישוב רשומות "נוכחות" היסטוריות (מאירועים ומחגים) שעדיין אין להן רשומת
// "יצירת קשר" (מפגש, amount===0) תואמת ביומן donations/meetings המשותף.
// המטרה: אפשר להריץ "סנכרון חד-פעמי" שמשלים למפרע רישומי קשר שלא נוצרו
// לפני שהתכונה הזו נוספה לאפליקציה.
//
// הגבלה ידועה: רשימת "מי הוזמן/התקשרת אליו" לחגים (task מסוג invite) לא
// שומרת תאריך לכל שם בנפרד (רק מערך שמות "בוצע") — לכן אי אפשר לשחזר למפרע
// באיזה תאריך בדיוק כל אדם הוזמן, ופריטים אלו לא נכללים כאן.

export interface MissingContact {
  name: string;
  date: string; // dd/MM/yyyy
  meetType: string;
  purpose: string;
  notes: string;
  source: string; // לתצוגה בלבד: מאיפה זה הגיע (שם האירוע/החג)
}

function parseDMY(dateStr: string): Date | null {
  const parsed = new Date(String(dateStr).split('/').reverse().join('-'));
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function computeMissingAttendanceContacts(
  eventsData: any[],
  holidayExtras: Record<string, any>,
  donations: any[]
): MissingContact[] {
  // מפתח ייחודי לכל רשומת "מפגש" קיימת: שם + תאריך (יום/חודש/שנה), כדי
  // לא ליצור כפילויות עבור מה שכבר תועד (בין אם ידנית, ובין אם דרך התכונה
  // החדשה מאז שהופעלה).
  const existingKeys = new Set<string>();
  (donations || []).forEach((d: any) => {
    if ((d.amount || 0) !== 0 || !d.name) return;
    const dateStr = d.date || d.meetDate;
    if (!dateStr) return;
    existingKeys.add(`${d.name}|${dateStr}`);
  });

  const missing: MissingContact[] = [];

  // אירועים — extra.attendance: { [dateKey]: { [name]: boolean } }
  (eventsData || []).forEach((ev: any) => {
    const attendance = ev.attendance || {};
    Object.keys(attendance).forEach(dateKey => {
      const namesMap = attendance[dateKey] || {};
      Object.keys(namesMap).forEach(name => {
        if (!namesMap[name]) return;
        const key = `${name}|${dateKey}`;
        if (existingKeys.has(key)) return;
        existingKeys.add(key); // מונע כפילות גם בתוך אותה ריצת סנכרון
        missing.push({
          name,
          date: slashDateToDotDate(dateKey),
          meetType: 'נוכחות באירוע',
          purpose: ev.name || '',
          notes: `נוכחות באירוע: ${ev.name || ''} (סונכרן למפרע)`,
          source: `אירוע: ${ev.name || ''} · ${dateKey}`,
        });
      });
    });
  });

  // חגים — holidayExtras[id].attendance: { [dateKey]: { [name]: boolean } }
  Object.keys(holidayExtras || {}).forEach(id => {
    const extra = holidayExtras[id] || {};
    const attendance = extra.attendance || {};
    const holidayName = id;
    Object.keys(attendance).forEach(dateKey => {
      const namesMap = attendance[dateKey] || {};
      Object.keys(namesMap).forEach(name => {
        if (!namesMap[name]) return;
        const key = `${name}|${dateKey}`;
        if (existingKeys.has(key)) return;
        existingKeys.add(key);
        missing.push({
          name,
          date: dateKey,
          meetType: 'נוכחות בחג',
          purpose: holidayName,
          notes: `נוכחות בחג: ${holidayName} (סונכרן למפרע)`,
          source: `חג: ${holidayName} · ${dateKey}`,
        });
      });
    });
  });

  // מיון כרונולוגי, מהישן לחדש
  missing.sort((a, b) => {
    const da = parseDMY(a.date);
    const db = parseDMY(b.date);
    if (!da || !db) return 0;
    return da.getTime() - db.getTime();
  });

  return missing;
}
