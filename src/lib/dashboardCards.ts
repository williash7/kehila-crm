// ─────────────────────────────────────────────────────────────────────────────
// כרטיסי הדשבורד — מה מוצג, ובאיזה סדר.
//
// עד כאן הסדר היה קבוע בקוד, וזהה לכולם. אבל הדשבורד הוא המסך שנפתח בכל
// בוקר, ומה שחשוב בו משתנה מאדם לאדם ומתקופה לתקופה: בקמפיין רוצים את
// הכסף למעלה, בערב חג את המשימות, ומי שלא עוקב אחרי הוראות קבע לא צריך
// לראות תזכורת חודשית עליהן בכלל.
//
// הרשימה נשמרת כמערך של מזהים. **סדר המערך הוא סדר התצוגה**, ומה שאינו
// בו — מוסתר. מערך ריק פירושו "לא נגעתי", ואז חלה ברירת המחדל.
// ─────────────────────────────────────────────────────────────────────────────

export type DashCardId =
  | 'focus'
  | 'shabbat' | 'rebbe' | 'tasks' | 'hero' | 'stats'
  | 'quick' | 'holidays' | 'hkReminder' | 'failures' | 'recent';

export interface DashCardMeta {
  id: DashCardId;
  label: string;
  hint: string;
  icon: string;
  /** בפריסת המחשב: עמודה ראשית או צדדית */
  column: 'main' | 'side';
}

export const DASH_CARDS: DashCardMeta[] = [
  // ── למה זה כרטיס ולא "מצב בית" ──────────────────────────────────────────
  //
  // ההצעה המקורית הייתה הגדרה נפרדת: מצב "רגיל" מול מצב "לטיפול".
  // אבל העורך הזה כבר עונה בדיוק על השאלה "מה אני רואה במסך הבית ובאיזה
  // סדר" — ומצב נוסף היה תשובה שנייה לאותה שאלה.
  //
  // וזה לא עניין של טעם: זה מייצר התנגשויות שצריך להכריע בהן. כרטיס
  // שהוסתר כאן מול אותו מידע שהמצב מציג — מי גובר? הסדר שנקבע כאן מול
  // הסדר שהמצב כופה — מה קורה כשחוזרים?
  //
  // ככרטיס, השאלות האלה לא קיימות. מי שרוצה "רק מה שדורש טיפול" מסתיר
  // את השאר כאן, ומקבל בדיוק את זה — בלי שנמציא לו מצב.
  { id: 'focus',      label: 'מה דורש טיפול',    hint: 'כשלים, תודות, משימות ותאריכים', icon: '🎯', column: 'main' },
  { id: 'hero',       label: 'תרומות החודש',      hint: 'הסכום הגדול ופילוח לפי אפיק', icon: '💰', column: 'main' },
  { id: 'stats',      label: 'שלושת המספרים',     hint: 'תרומות, תורמים, הוראות קבע',  icon: '📊', column: 'main' },
  { id: 'tasks',      label: 'סיכום משימות',      hint: 'כמה פתוחות ומה דחוף',         icon: '📋', column: 'main' },
  { id: 'recent',     label: 'תרומות אחרונות',    hint: 'חמש האחרונות שנכנסו',         icon: '🧾', column: 'main' },
  { id: 'failures',   label: 'שגיאות חיוב',       hint: 'כרטיסים שנדחו ב-30 יום',      icon: '⚠️', column: 'main' },
  { id: 'hkReminder', label: 'תזכורת הוראות קבע', hint: 'לעבור על הרשימה פעם בחודש',   icon: '🔄', column: 'main' },
  { id: 'shabbat',    label: 'זמני שבת',          hint: 'הדלקת נרות וצאת השבת',        icon: '🕯️', column: 'side' },
  { id: 'rebbe',      label: 'כתיבה לרבי',        hint: 'מתי נכתב בפעם האחרונה',       icon: '✉️', column: 'side' },
  { id: 'holidays',   label: 'חגים ותאריכים',     hint: 'מה מתקרב ומה דורש הכנה',      icon: '📅', column: 'side' },
  { id: 'quick',      label: 'פעולות מהירות',     hint: 'הוספת תרומה, איש קשר, משימה', icon: '⚡', column: 'side' },
];

/** הסדר שהיה מקובע בקוד עד היום — ברירת המחדל למי שלא בחר. */
/**
 * הסדר שהיה מקובע בקוד עד היום — ברירת המחדל למי שלא בחר.
 *
 * **`focus` אינו כאן במכוון.** הוא רשום ב-DASH_CARDS ולכן מופיע בעורך
 * תחת "מוסתרים", מוכן להוספה בלחיצה — אבל מי שלא ביקש אותו לא מוצא
 * ביום בהיר אחד כרטיס חדש בראש מסך הבית. שיפור נכנס בבחירה, לא בהפתעה.
 */
export const DEFAULT_ORDER: DashCardId[] =
  ['shabbat', 'rebbe', 'tasks', 'hero', 'stats', 'quick', 'holidays', 'hkReminder', 'failures', 'recent'];

/**
 * מנרמל את מה ששמור בהגדרות.
 *
 * שני מקרים שחייבים טיפול, ושניהם קורים בפועל: הגדרה ריקה (מי שלא נגע),
 * וכרטיס חדש שנוסף לאפליקציה **אחרי** שהמשתמש כבר סידר את הדשבורד שלו.
 * בלי הטיפול השני, כל תוספת עתידית הייתה נעלמת בשקט מכל מי שהתאים לעצמו.
 */
export function resolveCards(saved?: string[] | null): DashCardId[] {
  const known = new Set(DASH_CARDS.map(c => c.id));
  const list = (saved || []).filter(id => known.has(id as DashCardId)) as DashCardId[];
  if (!list.length) return [...DEFAULT_ORDER];
  return list;
}

/** כרטיסים שקיימים באפליקציה ואינם ברשימה — כלומר כבויים. */
export function hiddenCards(saved?: string[] | null): DashCardId[] {
  const shown = new Set(resolveCards(saved));
  return DASH_CARDS.map(c => c.id).filter(id => !shown.has(id));
}

export function moveCard(list: DashCardId[], from: number, to: number): DashCardId[] {
  const next = [...list];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
