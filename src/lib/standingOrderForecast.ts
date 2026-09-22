import { HkEntry, getHkStatus } from './standingOrders';

// ─────────────────────────────────────────────────────────────────────────────
// הוראות קבע בתחזית.
//
// התחזית יודעת לקרוא את הוראות הקבע הפעילות ולהפוך אותן להכנסות צפויות
// לפי מועדי החיוב. הן עדיין מוצגות כ„צפוי”, אבל במסך הכספים הן משתתפות
// בחישוב התזרים כדי שלא נספור את כל ההוצאות העתידיות ונעלים את ההכנסה
// הקבועה שמממנת אותן.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectedCharge {
  /** מזהה ההוראה שממנה נגזר החיוב — כדי שאפשר יהיה להסביר מאיפה המספר בא */
  hkId: string;
  name: string;
  date: string;
  amount: number;
}

/**
 * תאריכי הו״ק מגיעים מהשרת לעיתים כ-ISO ולעיתים בפורמט הישראלי
 * dd/mm/yyyy. בעבר התחזית קיבלה רק ISO, ולכן במידע האמיתי מהגיליון
 * נוצרו אפס חיובים צפויים — בדיוק הסיבה ש„מה בטוח להוציא” התעלם מהו״ק.
 */
function normalizeHkDate(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
  }

  match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
  }

  return '';
}

const isoDay = (iso: string): number => Number(iso.slice(8, 10)) || 0;

/**
 * מוסיף חודשים לתאריך ומשמר את יום החיוב.
 * ה-31 בחודש נחתך לאורך החודש בפועל, כך שחיוב ב-31 בינואר נהיה
 * 28/29 בפברואר וחוזר ל-31 במרץ.
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

/** מועדי החיוב הצפויים של הוראה אחת, מהיום ועד האופק. */
export function projectChargesFor(hk: HkEntry, todayIso: string, untilIso: string): ProjectedCharge[] {
  const status = getHkStatus(hk, 0);
  if (status === 'cancelled' || status === 'expired' || status === 'renewed') return [];
  const amount = Math.max(0, Number(hk.amount) || 0);
  if (!amount) return [];

  const nextCharge = normalizeHkDate(hk.nextCharge);
  const lastBilled = normalizeHkDate(hk.lastBilled);
  const anchor = nextCharge || lastBilled;
  if (!anchor) return [];
  const day = isoDay(anchor);

  const limit = hk.unlimited ? Infinity : Math.max(0, Number(hk.remaining) || 0);
  if (limit === 0) return [];

  const charges: ProjectedCharge[] = [];
  const anchorIsNextCharge = !!nextCharge;

  // אם יש nextCharge, הוא החיוב הראשון העתידי ולכן מתחילים ממנו.
  // אם יש רק lastBilled, העוגן הוא חיוב שכבר קרה ולכן מתחילים חודש אחריו.
  for (let step = anchorIsNextCharge ? 0 : 1; charges.length < limit && step < 120; step++) {
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

/** כמה כסף צפוי להיכנס בכל חודש מהוראות קבע. */
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
