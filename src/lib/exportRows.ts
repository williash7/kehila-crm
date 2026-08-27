import { cashDestinationLabel } from './cashDonations';

// ─────────────────────────────────────────────────────────────────────────────
// „הורד את מה שאני רואה”.
//
// ── הבקשה ─────────────────────────────────────────────────────────────────
//
// אשר ניסח אותה כך:
//
//   „שפשוט בכל חלון תמיד ניתן להוריד — למשל תרומות ניתן להוריד קובץ, ואם
//    אני מסנן את התרומות זה יוריד רק את התרומות המופיעות. וכן באנשי קשר,
//    בכספים, משימות וכו’.”
//
// ── ולמה זה מייתר „מרכז הורדות” ───────────────────────────────────────────
//
// הפיתוי הטבעי הוא לבנות מסך אחד עם רשימת שדות ותיבות סימון. אבל **הסינון
// שכבר קיים בכל מסך הוא הבורר** — אשר כבר יודע לסנן תרומות למזומן ולטווח
// תאריכים, והוא עשה את זה בעיניים. מסך נפרד היה מכריח אותו ללמוד את אותה
// בחירה פעם שנייה, בשפה אחרת, ולקוות שהיא תואמת.
//
// לכן הכלל היחיד כאן: **הקובץ מכיל בדיוק את השורות שעל המסך, באותו סדר.**
// מה שסונן החוצה לא נמצא בו, ומה שמוצג נמצא בו.
//
// ── „הכי מפורט” ───────────────────────────────────────────────────────────
//
// הוא ביקש „באופן הכי מפורט”. לכן כל טור שהמערכת מחזיקה יוצא לקובץ, גם אם
// המסך מקצר אותו: הערות מלאות, מזהה, מקור, יעד המזומן. קובץ שחסר בו שדה
// מכריח לחזור לאפליקציה — וזה בדיוק מה שהוא ניסה להימנע ממנו.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number;
}

/** תאריך בפורמט שאקסל בעברית קורא נכון. */
const asText = (v: any): string => (v === null || v === undefined ? '' : String(v));
const asNumber = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ── תרומות ──────────────────────────────────────────────────────────────────
//
// שים לב ל-`amount === 0`: ביומן יושבות גם רשומות מפגש/נוכחות, והן נראות
// כמו „תרומה על ₪0”. הטור „סוג הרשומה” מבדיל ביניהן, כדי שמי שפותח את
// הקובץ לא יסכם מפגשים כתרומות.
export const DONATION_COLUMNS: ExportColumn<any>[] = [
  { header: 'שם', value: d => asText(d.name) },
  { header: 'תאריך', value: d => asText(d.date) },
  { header: 'סכום', value: d => asNumber(d.amount) },
  { header: 'סוג הרשומה', value: d => ((d.amount || 0) === 0 ? 'מפגש / נוכחות' : 'תרומה') },
  { header: 'אמצעי תשלום', value: d => asText(d.method) },
  { header: 'ייעוד', value: d => asText(d.purpose) },
  { header: 'היכן המזומן', value: d => (d.cashDestination ? cashDestinationLabel(d.cashDestination) : '') },
  { header: 'הערות', value: d => asText(d.notes) },
  { header: 'מקור', value: d => asText(d.source) },
  { header: 'מיקום', value: d => asText(d.location) },
  { header: 'מזהה', value: d => asText(d.id) },
];

// ── אנשי קשר ────────────────────────────────────────────────────────────────
export const CONTACT_COLUMNS: ExportColumn<any>[] = [
  { header: 'שם', value: c => asText(c.name) },
  { header: 'טלפון', value: c => asText(c.phone) },
  { header: 'כתובת', value: c => asText(c.address) },
  { header: 'מעגל קרבה', value: c => asText(c.circleLabel) },
  { header: 'סה״כ תרומות', value: c => asNumber(c.total) },
  { header: 'מספר תרומות', value: c => asNumber(c.donationCount) },
  { header: 'תרומה אחרונה', value: c => asText(c.lastDate) },
  { header: 'קשר אחרון', value: c => asText(c.lastContact) },
  { header: 'הוראת קבע', value: c => (c.hasHk ? 'כן' : 'לא') },
  { header: 'להקרב', value: c => (c.target ? 'כן' : 'לא') },
  { header: 'הערות', value: c => asText(c.notes) },
];

// ── הוראות קבע ──────────────────────────────────────────────────────────────
export const STANDING_ORDER_COLUMNS: ExportColumn<any>[] = [
  { header: 'שם', value: h => asText(h.name) },
  { header: 'סכום חודשי', value: h => asNumber(h.amount) },
  { header: 'תאריך פתיחה', value: h => asText(h.startDate || h.date) },
  { header: 'סה״כ תשלומים', value: h => asNumber(h.totalPayments) },
  { header: 'נותרו', value: h => asNumber(h.remaining) },
  { header: 'סטטוס', value: h => asText(h.statusLabel) },
  { header: 'ייעוד', value: h => asText(h.purpose) },
  { header: 'הערות', value: h => asText(h.notes) },
  { header: 'מזהה', value: h => asText(h.id) },
];

// ── תנועות כספיות ───────────────────────────────────────────────────────────
export const FINANCE_COLUMNS: ExportColumn<any>[] = [
  { header: 'תאריך', value: t => asText(t.date) },
  { header: 'כיוון', value: t => (
    t.direction === 'expense' || t.kind === 'expense' || t.kind === 'personal_expense' || t.kind === 'salary'
      ? 'הוצאה'
      : 'הכנסה'
  ) },
  { header: 'סוג', value: t => asText(t.kindLabel || t.kind) },
  { header: 'סכום', value: t => asNumber(t.amount) },
  { header: 'מצב', value: t => asText(t.statusLabel || t.status) },
  { header: 'קטגוריה', value: t => asText(t.category) },
  { header: 'שיוך', value: t => asText(t.scopeLabel) },
  { header: 'תיאור', value: t => asText(t.description) },
  { header: 'אמצעי תשלום', value: t => asText(t.method) },
  { header: 'הערות', value: t => asText(t.notes) },
  { header: 'מזהה', value: t => asText(t.id) },
];

// ── משימות ──────────────────────────────────────────────────────────────────
export const TASK_COLUMNS: ExportColumn<any>[] = [
  { header: 'משימה', value: t => asText(t.text || t.title) },
  { header: 'שייכת ל', value: t => asText(t.parentName) },
  { header: 'תאריך יעד', value: t => asText(t.dueDate || t.date) },
  { header: 'בוצע', value: t => (t.done ? 'כן' : 'לא') },
  { header: 'סוג', value: t => asText(t.kind) },
  { header: 'הערות', value: t => asText(t.notes) },
  { header: 'מזהה', value: t => asText(t.id) },
];

// ── פעילויות ────────────────────────────────────────────────────────────────
export const ACTIVITY_COLUMNS: ExportColumn<any>[] = [
  { header: 'שם', value: e => asText(e.name) },
  { header: 'סוג', value: e => asText(e.activityKind) },
  { header: 'תדירות', value: e => asText(e.freq) },
  { header: 'תאריך', value: e => asText(e.date) },
  { header: 'שעה', value: e => asText(e.time) },
  { header: 'מיקום', value: e => asText(e.location) },
  { header: 'מחיר כניסה', value: e => asNumber(e.entryPrice) },
  { header: 'ייעודים', value: e => (Array.isArray(e.purposeTags) ? e.purposeTags.join(' · ') : '') },
  { header: 'מזהה', value: e => asText(e.id) },
];

// ── היסטוריה: מופעים שהסתיימו ───────────────────────────────────────────────
//
// כאן יושב הידע שנצבר — כמה הגיעו, מה עלה, מה עבד ומה לא. **זה החומר שהכי
// כדאי לשמור מחוץ לאפליקציה**, כי הוא לא ניתן לשחזור מהזיכרון בעוד שנה.
export const HISTORY_COLUMNS: ExportColumn<any>[] = [
  { header: 'שם', value: h => asText(h.name) },
  { header: 'סוג', value: h => (h.type === 'holiday' ? 'חג' : 'פעילות') },
  { header: 'תאריך המופע', value: h => asText(h.occurrenceDate) },
  { header: 'נשמר בתאריך', value: h => asText(h.archivedAt).slice(0, 10) },
  { header: 'נוכחות', value: h => asNumber(h.attendanceCount) },
  { header: 'משימות', value: h => asNumber((h.tasks || []).length) },
  { header: 'הוצאות', value: h => asNumber(h.expenseTotal) },
  { header: 'הכנסות', value: h => asNumber(h.incomeTotal) },
  { header: 'סיכום', value: h => asText(h.insights?.summary) },
  { header: 'מה עבד', value: h => asText(h.insights?.good) },
  { header: 'מה לשפר', value: h => asText(h.insights?.improve) },
  { header: 'לפעם הבאה', value: h => asText(h.insights?.plan) },
  { header: 'מזהה', value: h => asText(h.id) },
];

// ── נוכחות ──────────────────────────────────────────────────────────────────
//
// שורה לכל אדם בכל מופע — לא טבלה רחבה עם עמודה לכל תאריך.
//
// זה מכוון: טבלה רחבה נשברת ברגע שנוסף מופע, ואי אפשר לסנן בה באקסל.
// שורה לכל צירוף היא מה שמאפשר „תראה לי את כל מי שהגיע בחנוכה”.
export const ATTENDANCE_COLUMNS: ExportColumn<any>[] = [
  { header: 'שם', value: a => asText(a.name) },
  { header: 'פעילות', value: a => asText(a.activityName) },
  { header: 'תאריך', value: a => asText(a.date) },
  { header: 'נכח', value: a => (a.present ? 'כן' : 'לא') },
];

/**
 * הופך רשימה מוצגת לשורות לייצוא.
 *
 * **הפונקציה אינה מסננת ואינה ממיינת.** היא מקבלת את הרשימה כפי שהמסך
 * מציג אותה, וזה מכוון: ברגע שהיא תתחיל להחליט מה נכנס, הקובץ יוכל
 * להיפרד ממה שעל המסך — וזו בדיוק ההבטחה היחידה שאנחנו נותנים כאן.
 */
export function toExportRows<T>(rows: T[], columns: ExportColumn<T>[]): (string | number)[][] {
  return rows.map(row => columns.map(col => {
    try { return col.value(row); } catch { return ''; }
  }));
}

export function exportHeaders<T>(columns: ExportColumn<T>[]): string[] {
  return columns.map(c => c.header);
}

/**
 * שם קובץ שמספר מה יש בפנים.
 *
 * כשמורידים כמה חתכים באותו יום — „מזומן”, ואז „אתר חב״ד” — שלושה קבצים
 * בשם „תרומות” הם שלושה קבצים שאי אפשר להבדיל ביניהם בתיקיית ההורדות.
 */
export function exportFileName(base: string, filterHint?: string): string {
  const clean = (filterHint || '').trim().replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
  return clean ? `${base}_${clean}` : base;
}
