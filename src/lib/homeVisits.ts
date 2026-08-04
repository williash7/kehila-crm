import { computeOverdueContacts } from './contactFocus';
import { SubTask } from './tasks';

export interface HomeVisitEntry {
  name: string;
  category: string;          // תווית מוצגת
  categoryIsCustom: boolean; // false = תמיד נגזר מ-crm[name]?.circle החי; true = תג קפוא שנבחר ידנית
  topic?: string;            // למשל שם חג
  emphasis?: string;         // דגש חופשי — מה חשוב להעלות בביקור הזה
  scheduled: boolean;
  scheduledDate?: string;    // ISO yyyy-mm-dd
  scheduledTime?: string;    // HH:MM — אופציונלי, כמו בכל שאר סוגי המשימות
  visited: boolean;
  visitedDate?: string;      // ISO yyyy-mm-dd
}

export interface HomeVisitRound {
  id: string;
  createdAt: string; // ISO
  status: 'active' | 'archived';
  entries: HomeVisitEntry[]; // סדר המערך = סדר הביקורים
  purpose?: string;          // ייעוד המערך — למה מיועדים הביקורים האלה (למשל: "לקראת ראש השנה")
  dateRangeStart?: string;   // ISO yyyy-mm-dd — טווח התאריכים שבו מתוכננים הביקורים
  dateRangeEnd?: string;     // ISO yyyy-mm-dd
  prepTasks?: SubTask[];     // משימות הכנה לביצוע לפני תחילת הביקורים
}

export interface HomeVisitsData {
  rounds: HomeVisitRound[];
}

// מעגלי קרבה קיימים (אותם ערכים/תוויות כמו ב-ProfileModal/contactFocus) +
// תגים ייעודיים חדשים לביקורי בית — יחד הם רשימת הקטגוריות שאפשר לבחור
// ידנית לרשומה ספציפית (מה שמקפיא אותה מול שינויים עתידיים במעגל הקרבה).
export const CIRCLE_CATEGORY_LABEL: Record<string, string> = {
  close: '⭐ קרוב',
  approach: '🔄 מתקרב',
  third: '⭕ מעגל שלישי',
  far: '○ רחוק',
};

export const HOME_VISIT_CATEGORY_TAGS: string[] = [
  ...Object.values(CIRCLE_CATEGORY_LABEL),
  '🆕 קשר חדש',
  '🕯️ ניחום אבלים',
  '🎉 שמחה/אירוע משפחתי',
  '📌 אחר',
];

// הקטגוריה החיה של איש קשר לפי מעגל הקרבה שלו ב-CRM (ברירת המחדל לרשומה
// חדשה, וגם מה שמוצג לרשומה קיימת כל עוד categoryIsCustom === false).
export function liveCategoryFor(name: string, crm: Record<string, any>): string {
  const circle = crm[name]?.circle;
  return (circle && CIRCLE_CATEGORY_LABEL[circle]) || (crm[name]?.target ? '🎯 מסומן להקרב' : '📌 אחר');
}

export function emptyHomeVisitEntry(name: string, category: string): HomeVisitEntry {
  return { name, category, categoryIsCustom: false, scheduled: false, visited: false };
}

// בונה רשימת מועמדים ראשונית למערך חדש — לפי אותה עדיפות בדיוק כמו ה-widget
// "לא יצרנו קשר" בדשבורד (מעגל קרבה + ימים מאז מפגש אחרון), כדי ש"מערך חדש"
// יתחיל תמיד מהאנשים שהכי דחוף לבקר אצלם.
export function buildInitialRoundEntries(
  visibleDonors: Record<string, any>,
  crm: Record<string, any>,
  donations: any[],
  today: Date,
  limit = 20
): HomeVisitEntry[] {
  const overdue = computeOverdueContacts(visibleDonors, crm, donations, today);
  return overdue.slice(0, limit).map(o => emptyHomeVisitEntry(o.name, liveCategoryFor(o.name, crm)));
}

export function moveEntry(entries: HomeVisitEntry[], from: number, to: number): HomeVisitEntry[] {
  if (to < 0 || to >= entries.length || from === to) return entries;
  const next = [...entries];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
