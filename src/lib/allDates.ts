// ─────────────────────────────────────────────────────────────────────────────
// כל התאריכים במקום אחד.
//
// עד כאן החגים ישבו בלוח השנה, האירועים הקבועים במסך האירועים, וימי ההולדת
// והיארצייטים בדשבורד ובכרטיסי אנשי הקשר. כדי לענות על שאלה פשוטה — "מה יש
// לי בשבועיים הקרובים?" — היה צריך לעבור בין שלושה מסכים ולחבר בראש.
//
// כאן הם מתאחדים לרשימה אחת ממוינת, עם סוג לכל פריט כדי שאפשר יהיה לסנן.
// ─────────────────────────────────────────────────────────────────────────────

import { PersonalDateEvent } from './personalDates';

export type DateKind = 'holiday' | 'event' | 'birthday' | 'yahrzeit';

export const KIND_LABEL: Record<DateKind, string> = {
  holiday: 'חגים',
  event: 'אירועים',
  birthday: 'ימי הולדת',
  yahrzeit: 'יארצייטים',
};

export const KIND_ICON: Record<DateKind, string> = {
  holiday: '✡️',
  event: '📌',
  birthday: '🎂',
  yahrzeit: '🕯️',
};

export const KIND_COLOR: Record<DateKind, string> = {
  holiday: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  event: 'bg-sky-50 text-sky-700 border-sky-200',
  birthday: 'bg-amber-50 text-amber-700 border-amber-200',
  yahrzeit: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const ALL_KINDS: DateKind[] = ['holiday', 'event', 'birthday', 'yahrzeit'];

export interface DateItem {
  key: string;
  kind: DateKind;
  /** מה מציינים */
  title: string;
  /** אצל מי — לתאריכים אישיים */
  person?: string;
  /** תאריך המופע הקרוב */
  date: Date;
  /** בעוד כמה ימים */
  dist: number;
  icon: string;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
}

export interface BuildInput {
  /** מ-Hebcal ומהחגים שהוגדרו ידנית: { name, dateStr } */
  holidays: { name: string; dateStr: string }[];
  /** אירועים קבועים, עם מועד המופע הבא שכבר חושב */
  events: { id?: string; name: string; next: Date | null }[];
  /** מ-computePersonalDateEvents */
  personal: PersonalDateEvent[];
}

/**
 * הסוג נגזר מהאייקון שמייצר computePersonalDateEvents. זה נראה עקיף, אבל
 * הוא המקור היחיד שם שמבחין בין יום הולדת ליארצייט — ועדיף לגזור ממנו
 * מאשר לנתח את הטקסט בעברית, שמשתנה עם הניסוח.
 */
function personalKind(icon: string): DateKind {
  return icon === '🕯️' ? 'yahrzeit' : 'birthday';
}

/** מנקה מהטקסט את זנב "בעוד X ימים" — הוא מוצג בנפרד ובעיצוב משלו. */
export function stripDistance(msg: string): string {
  return msg.replace(/\s*(היום|בעוד\s+\d+\s+ימים)\s*$/, '').trim();
}

export function buildAllDates(input: BuildInput, today: Date, horizonDays: number): DateItem[] {
  const base = startOfDay(today);
  const out: DateItem[] = [];

  input.holidays.forEach(h => {
    const d = new Date(h.dateStr);
    if (isNaN(d.getTime())) return;
    const dist = daysBetween(base, d);
    if (dist < 0 || dist > horizonDays) return;
    out.push({ key: `hol::${h.name}::${h.dateStr}`, kind: 'holiday', title: h.name, date: startOfDay(d), dist, icon: KIND_ICON.holiday });
  });

  input.events.forEach((e, i) => {
    if (!e.next) return;
    const dist = daysBetween(base, e.next);
    if (dist < 0 || dist > horizonDays) return;
    out.push({ key: `ev::${e.id || i}`, kind: 'event', title: e.name, date: startOfDay(e.next), dist, icon: KIND_ICON.event });
  });

  input.personal.forEach(p => {
    if (p.dist < 0 || p.dist > horizonDays) return;
    const d = new Date(base);
    d.setDate(d.getDate() + p.dist);
    out.push({
      key: `pd::${p.key}`,
      kind: personalKind(p.icon),
      title: stripDistance(p.msg),
      person: p.name,
      date: d,
      dist: p.dist,
      icon: p.icon,
    });
  });

  // אותו יום → קודם החגים, אחר כך האירועים, ואז האנשים. חג הוא ההקשר שבתוכו
  // כל השאר קורה, ולכן הוא צריך להיות מעל.
  const order: Record<DateKind, number> = { holiday: 0, event: 1, yahrzeit: 2, birthday: 3 };
  return out.sort((a, b) => a.dist - b.dist || order[a.kind] - order[b.kind] || a.title.localeCompare(b.title, 'he'));
}

/** קיבוץ לפי חודש קלנדרי, לתצוגת לוח השנה. */
export function groupByMonth(items: DateItem[]): { key: string; label: string; days: { date: Date; items: DateItem[] }[] }[] {
  const months = new Map<string, DateItem[]>();
  items.forEach(it => {
    const k = `${it.date.getFullYear()}-${String(it.date.getMonth() + 1).padStart(2, '0')}`;
    const arr = months.get(k) || [];
    arr.push(it);
    months.set(k, arr);
  });

  return Array.from(months.entries()).map(([key, list]) => {
    const byDay = new Map<string, DateItem[]>();
    list.forEach(it => {
      const dk = it.date.toDateString();
      const arr = byDay.get(dk) || [];
      arr.push(it);
      byDay.set(dk, arr);
    });
    const days = Array.from(byDay.values())
      .map(dayItems => ({ date: dayItems[0].date, items: dayItems }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    return {
      key,
      label: list[0].date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }),
      days,
    };
  });
}

export function countByKind(items: DateItem[]): Record<DateKind, number> {
  const counts: Record<DateKind, number> = { holiday: 0, event: 0, birthday: 0, yahrzeit: 0 };
  items.forEach(i => { counts[i.kind]++; });
  return counts;
}
