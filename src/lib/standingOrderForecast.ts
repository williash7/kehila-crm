import { HkEntry, getHkStatus } from './standingOrders';

// ─────────────────────────────────────────────────────────────────────────────
// הוראות קבע בתחזית.
//
// ── מה היה שבור ────────────────────────────────────────────────────────────
//
// אשר ניסח את זה כך:
//
//   „להגיד לך שאין לך כסף כי בעוד שלושה חודשים יש צ׳ק — זה לא ממש נכון,
//    כי יש הו״ק ויהיו עוד הכנסות.”
//
// והוא צדק. התחזית ידעה לקרוא כל הוצאה עתידית שהוזנה, אבל את ההכנסה
// הקבועה והצפויה ביותר שיש לפעילות — הוראות הקבע — היא לא ראתה בכלל.
// חיוב של הו״ק נכנס למערכת רק **אחרי** שהוא נגבה, כשורת תרומה. לפני כן
// הוא לא היה קיים בשום מקום שהתזרים מסתכל בו.
//
// התוצאה היא תחזית שרואה רק את הצד השלילי: כל מה שיוצא מופיע, כל מה
// שנכנס באופן קבוע נעלם. זו לא זהירות — זו טעות בכיוון אחד.
//
// ── מה כאן ─────────────────────────────────────────────────────────────────
//
// חיזוי של מועדי החיוב הבאים לכל הוראה פעילה, עד אופק התחזית. שמרני
// בכוונה בשלוש נקודות:
//
//   1. **רק הוראות פעילות.** הוראה שבוטלה, הסתיימה או חודשה תחת מספר אחר
//      אינה מייצרת הכנסה עתידית.
//   2. **רק מה שנספר.** הוראה מוגבלת מפסיקה אחרי `remaining` חיובים — לא
//      נמשכת עד סוף האופק כאילו היא אינסופית.
//   3. **רק מהיום והלאה.** חיוב שכבר נגבה יושב כבר כשורת תרומה אמיתית.
//      אילו חזינו גם אותו, אותו כסף היה נספר פעמיים.
//
// ── ולמה זה נשאר „צפוי” ולא „מחויב” ────────────────────────────────────────
//
// הוראת קבע יכולה להיכשל — כרטיס שפג, חשבון שנסגר, תורם שביטל בבנק ולא
// עדכן. לכן החיזוי נכנס למסלול ה„צפוי” של התחזית, לא למסלול הבטוח:
// הוא משפר את התמונה האופטימית ואינו מרשה להסתמך עליו כאילו הכסף כבר כאן.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectedCharge {
  /** מזהה ההוראה שממנה נגזר החיוב — כדי שאפשר יהיה להסביר מאיפה המספר בא */
  hkId: string;
  name: string;
  date: string;
  amount: number;
}

const isoDay = (iso: string): number => Number(iso.slice(8, 10)) || 0;

/**
 * מוסיף חודשים לתאריך ומשמר את יום החיוב.
 *
 * ה-31 בחודש הוא המקרה שמפיל מימושים תמימים: `setMonth` על 31 בינואר
 * מגלגל ל-3 במרץ. כאן היום נחתך לאורך החודש בפועל, כך שהוראה שנגבית
 * ב-31 תיגבה ב-28 בפברואר ותחזור ל-31 במרץ — ולא תקפוץ קדימה.
 */
export function addMonthsKeepingDay(iso: string, months: number, day: number): string {
  const base = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(base.getTime())) return '';
  const year = base.getFullYear();
  const month = base.getMonth() + months;
  const lastDayOfTarget = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(day || base.getDate(), lastDayOfTarget);
  const result = new Date(year, month, safeDay, 12, 0, 0);
  return result.toISOString().slice(0, 10);
}

/**
 * מועדי החיוב הצפויים של הוראה אחת, מהיום ועד האופק.
 *
 * `threshold` אינו משנה את החיזוי — הוא רק מה ש-getHkStatus צריך כדי
 * להבדיל בין „פעילה” ל„מסתיימת בקרוב”. שתיהן ממשיכות לחייב.
 */
export function projectChargesFor(hk: HkEntry, todayIso: string, untilIso: string): ProjectedCharge[] {
  const status = getHkStatus(hk, 0);
  if (status === 'cancelled' || status === 'expired' || status === 'renewed') return [];
  const amount = Math.max(0, Number(hk.amount) || 0);
  if (!amount) return [];

  // בלי מועד חיוב הבא ובלי חיוב אחרון אין על מה לבסס לוח זמנים. הימנעות
  // מניחוש כאן עדיפה על תחזית שנראית מדויקת ואינה.
  const anchor = (hk.nextCharge || '').slice(0, 10) || (hk.lastBilled || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return [];
  const day = isoDay(anchor);

  const limit = hk.unlimited ? Infinity : Math.max(0, Number(hk.remaining) || 0);
  if (limit === 0) return [];

  const charges: ProjectedCharge[] = [];
  // אם העוגן הוא החיוב האחרון שכבר נגבה, הוא לא מתחיל את הרצף — הוא
  // רק נותן את יום החודש. הלולאה בכל מקרה מדלגת על כל מה שאינו עתידי.
  for (let step = 0; charges.length < limit && step < 120; step++) {
    const date = step === 0 ? anchor : addMonthsKeepingDay(anchor, step, day);
    if (!date) break;
    if (date > untilIso) break;
    if (date <= todayIso) continue;
    charges.push({ hkId: String(hk.id || ''), name: hk.name || 'הוראת קבע', date, amount });
  }
  return charges;
}

/** כל החיובים הצפויים מכל ההוראות, ממוינים לפי תאריך. */
export function projectStandingOrderCharges(list: HkEntry[], todayIso: string, untilIso: string): ProjectedCharge[] {
  return (list || [])
    .flatMap(hk => projectChargesFor(hk, todayIso, untilIso))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface MonthlyStandingOrderIncome {
  month: string;
  amount: number;
  count: number;
}

/**
 * „כמה כסף נכנס בחודש מהוראות קבע.”
 *
 * זו השאלה שאשר שאל מילה במילה, ולכן היא ראויה לפונקציה משלה ולא
 * לחישוב שנעשה בתוך רכיב תצוגה.
 */
export function standingOrderIncomeByMonth(charges: ProjectedCharge[]): MonthlyStandingOrderIncome[] {
  const byMonth = new Map<string, MonthlyStandingOrderIncome>();
  charges.forEach(charge => {
    const month = charge.date.slice(0, 7);
    const current = byMonth.get(month) || { month, amount: 0, count: 0 };
    current.amount += charge.amount;
    current.count++;
    byMonth.set(month, current);
  });
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}
