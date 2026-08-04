// מי לא יצרנו איתו קשר לאחרונה, לפי מעגל קרבה וזמן שחלף מהמפגש האחרון
// (מהיומן המשותף donations/meetings — amount===0 = רשומת מפגש, כמו ב-ReportsTab).

export interface OverdueContact {
  name: string;
  msg: string;
  icon: string;
  overdueBy: number;
  circleWeight: number;
}

const CIRCLE_LABEL: Record<string, string> = { close: '⭐ קרוב', approach: '🔄 מתקרב', third: '⭕ מעגל שלישי' };
const CIRCLE_THRESHOLD: Record<string, number> = { close: 14, approach: 30, third: 60 };

// תאריך המפגש (לא תרומה!) האחרון שתועד לכל תורם — מהיומן המשותף
// donations/meetings שכבר קיים (amount===0 = רשומת מפגש, כמו ב-ReportsTab).
export function computeLastContactByName(donations: any[]): Map<string, Date> {
  const lastMeetingByName = new Map<string, Date>();
  (donations as any[]).forEach(d => {
    if ((d.amount || 0) !== 0 || !d.name) return;
    const dateStr = d.date || d.meetDate;
    if (!dateStr) return;
    const parsed = new Date(String(dateStr).split('/').reverse().join('-'));
    if (isNaN(parsed.getTime())) return;
    const prev = lastMeetingByName.get(d.name);
    if (!prev || parsed > prev) lastMeetingByName.set(d.name, parsed);
  });
  return lastMeetingByName;
}

// כמו computeLastContactByName, אבל מחזיר גם את פרטי המפגש האחרון עצמו
// (סוג/מטרה/הערות) — כדי שאפשר יהיה להציג לצד התאריך *במה* בדיוק היה
// יצירת הקשר (למשל "נוכחות באירוע: חנוכה"), ולא רק "לפני X ימים" בלי הסבר.
export function computeLastContactDetailsByName(donations: any[]): Map<string, { date: Date; meetType?: string; purpose?: string; notes?: string }> {
  const lastByName = new Map<string, { date: Date; meetType?: string; purpose?: string; notes?: string }>();
  (donations as any[]).forEach(d => {
    if ((d.amount || 0) !== 0 || !d.name) return;
    const dateStr = d.date || d.meetDate;
    if (!dateStr) return;
    const parsed = new Date(String(dateStr).split('/').reverse().join('-'));
    if (isNaN(parsed.getTime())) return;
    const prev = lastByName.get(d.name);
    if (!prev || parsed > prev.date) {
      lastByName.set(d.name, { date: parsed, meetType: d.meetType, purpose: d.purpose || d.meetPurpose, notes: d.notes });
    }
  });
  return lastByName;
}

export function formatLastContact(date: Date | undefined, today: Date): string {
  if (!date) return 'מעולם לא תועד';
  const days = Math.floor((today.getTime() - date.getTime()) / 86400000);
  if (days === 0) return 'היום';
  if (days === 1) return 'אתמול';
  return `לפני ${days} ימים`;
}

export function computeOverdueContacts(
  visibleDonors: Record<string, any>,
  crm: Record<string, any>,
  donations: any[],
  today: Date
): OverdueContact[] {
  const lastMeetingByName = computeLastContactByName(donations);

  const overdue: OverdueContact[] = [];
  Object.keys(visibleDonors).forEach(name => {
    const circle = crm[name]?.circle;
    const isTarget = !!crm[name]?.target;
    if (!((circle && circle !== 'far') || isTarget)) return;
    const threshold = circle && CIRCLE_THRESHOLD[circle] ? CIRCLE_THRESHOLD[circle] : 30;
    const lastMeet = lastMeetingByName.get(name);
    const daysSince = lastMeet ? Math.floor((today.getTime() - lastMeet.getTime()) / 86400000) : null;
    if (daysSince === null || daysSince > threshold) {
      const circleTxt = circle && CIRCLE_LABEL[circle] ? CIRCLE_LABEL[circle] : (isTarget ? '🎯 מסומן להקרב' : '');
      const msg = daysSince === null
        ? `לא תועד קשר עדיין${circleTxt ? ' · ' + circleTxt : ''}`
        : `${daysSince} ימים בלי יצירת קשר${circleTxt ? ' · ' + circleTxt : ''}`;
      overdue.push({
        name, msg,
        icon: circle === 'close' ? '⭐' : circle === 'approach' ? '🔄' : circle === 'third' ? '⭕' : '🎯',
        overdueBy: daysSince === null ? Infinity : daysSince - threshold,
        circleWeight: circle === 'close' ? 0 : circle === 'approach' ? 1 : circle === 'third' ? 2 : 3,
      });
    }
  });

  overdue.sort((a, b) => a.circleWeight - b.circleWeight || b.overdueBy - a.overdueBy);
  return overdue;
}
