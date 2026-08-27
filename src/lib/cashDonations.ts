import { CashDestination } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// לאן הלך המזומן.
//
// ── למה בכלל שואלים ────────────────────────────────────────────────────────
//
// שטר של 200 ש״ח שנתרם ביד אינו „כסף בעמותה” עד שמישהו אומר לאן הוא הלך.
// אותו שטר יכול להיות מופקד בבנק, לשכב בקופת הפעילות, להיות בכיס של אשר,
// או להיות מה שהוא לקח כמשכורת. ארבעת המצבים האלה נראים זהה ברשימת
// התרומות ומתנהגים הפוך לגמרי בתזרים — ולכן זו שאלה ולא ניחוש.
//
// ── „לקחתי את זה כמשכורת” ──────────────────────────────────────────────────
//
// זה המצב שהכי הפיל את החשבון. בלי היעד הזה, מי ששילם לעצמו משכורת מתוך
// מזומן היה צריך לרשום שתי תנועות נפרדות — החזרת המזומן לעמותה, ואז
// משכורת — כדי שהחשבון יסתדר. אף אחד לא עושה את זה, ולכן המזומן נשאר
// רשום כ„נמצא אצלי” לנצח, המשכורת לא נספרה כהוצאה, וכל תמונת ההוצאות
// יצאה נמוכה מדי.
//
// עכשיו זו בחירה אחת: ההכנסה נספרת, המשכורת נספרת כהוצאה, והבנק לא זז —
// כי הכסף הזה מעולם לא עבר דרך הבנק.
// ─────────────────────────────────────────────────────────────────────────────

export const CASH_DESTINATION_OPTIONS: { value: CashDestination; label: string; hint: string }[] = [
  { value: 'org_account', label: 'הופקד בחשבון העמותה', hint: 'זמין בחשבון העמותה' },
  { value: 'activity_cashbox', label: 'בקופת הפעילות', hint: 'זמין לפעילות במזומן' },
  { value: 'salary', label: 'נלקח כמשכורת', hint: 'נספר כהכנסה וכהוצאת משכורת. הבנק לא זז' },
  { value: 'personal', label: 'נשמר בצד אצלי', hint: 'עדיין לא הוחלט מה קורה איתו' },
  { value: 'unclassified', label: 'עדיין לא סווג', hint: 'לא ייכלל ביתרה עד לבירור' },
];

/**
 * יעדים שמשאירים שאלה פתוחה.
 *
 * שניהם אומרים „המזומן קיים אבל לא ידוע מה קרה איתו”, ולכן שניהם צריכים
 * להופיע באזהרה. ההפרדה ביניהם היא רק בכמה מפורשת הייתה הבחירה.
 */
export const CASH_DESTINATIONS_NEEDING_ATTENTION: CashDestination[] = ['personal', 'unclassified'];

export function cashDestinationNeedsAttention(value: unknown): boolean {
  const normalized = normalizeCashDestination(value);
  return !normalized || CASH_DESTINATIONS_NEEDING_ATTENTION.includes(normalized);
}

/**
 * אפיקי הגבייה שמוצעים בעריכה.
 *
 * יושב כאן ולא בתוך רכיב מסך כי יותר ממסך אחד עורך תרומות. רשימה
 * שמשוכפלת בין מסכים מתחילה זהה ונפרדת בשקט — ואז אותה תרומה מציעה
 * אפשרויות שונות תלוי מאיפה נכנסת אליה.
 */
export const EDIT_PAYMENT_METHODS = [
  '🔗 קישור ישיר', '💵 מזומן', '🏦 העברה בנקאית',
  '📱 ביט/פייבוקס', '🔄 הוראת קבע', '🌐 אתר תרומות',
];

export function cleanPaymentMethod(value: unknown): string {
  return String(value || '').replace(/^[^\p{L}\p{N}]+\s*/u, '').trim();
}

export function isCashPaymentMethod(value: unknown): boolean {
  return cleanPaymentMethod(value).includes('מזומן');
}

export function cashDestinationLabel(value: unknown): string {
  return CASH_DESTINATION_OPTIONS.find(option => option.value === value)?.label || 'לפי ברירת המחדל בהגדרות';
}

export function normalizeCashDestination(value: unknown): CashDestination | undefined {
  return CASH_DESTINATION_OPTIONS.some(option => option.value === value) ? value as CashDestination : undefined;
}
