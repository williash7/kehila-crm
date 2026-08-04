// חישוב אמין של "מתי זה יוצא השנה בלועזי" לתאריכים עבריים חוזרים (יום הולדת/יארצייט).
//
// כשהתאריך העברי הוזן דרך הבוררן שלנו (HebrewDatePicker) הוא נשמר במחרוזת
// גימטריה קנונית (למשל "ט״ז אייר תשפ״ד") — פורמט שגם קריא לבני אדם וגם
// ניתן לפירוש חד-משמעי בחזרה למספרים. במקרה כזה נשתמש בפונקציות היארצייט/
// יום-הולדת הרשמיות של Hebcal, שמטפלות נכון גם במקרי קצה של השנה העברית
// (חשוון/כסלו חסרים, אדר בשנה מעוברת וכו').
//
// לתאריכים ישנים שהוקלדו כטקסט חופשי בגיליון (לא דרך הבוררן) יש נפילה חזרה
// (fallback) להתאמת מחרוזות מקורבת מול טבלת 400 הימים הקרובים — בדיוק
// השיטה שהייתה בשימוש עד כה.

import { HDate } from '@hebcal/core';
import { getYahrzeit, getBirthdayOrAnniversary } from '@hebcal/hdate';

export function toCanonicalHebrewString(hdate: HDate): string {
  return hdate.renderGematriya();
}

export function parseCanonicalHebrewString(str: string): HDate | null {
  try {
    return HDate.fromGematriyaString(String(str).trim());
  } catch {
    return null;
  }
}

// dd/mm/yyyy — הפורמט הנהוג בכל שאר האפליקציה
export function formatGregorian(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function hebrewToGregorianCompanion(hdate: HDate): string {
  return formatGregorian(hdate.greg());
}

export function gregorianToHebrewCompanion(dateStr: string): HDate | null {
  let d = 0, m = 0, y = 0;
  const isoMatch = String(dateStr).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    y = parseInt(isoMatch[1], 10);
    m = parseInt(isoMatch[2], 10) - 1;
    d = parseInt(isoMatch[3], 10);
  } else {
    const dmyMatch = String(dateStr).match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
    if (dmyMatch) {
      d = parseInt(dmyMatch[1], 10);
      m = parseInt(dmyMatch[2], 10) - 1;
      y = parseInt(dmyMatch[3], 10);
      if (y < 100) y += y > 50 ? 1900 : 2000;
    }
  }
  if (y >= 1900 && y <= 2100 && m >= 0 && m <= 11 && d > 0 && d <= 31) {
    return new HDate(new Date(y, m, d));
  }
  return null;
}

// ── נפילה חזרה: התאמת מחרוזות מקורבת (לתאריכים שהוקלדו כטקסט חופשי) ──────

const cleanHeStr = (str: string) =>
  String(str).replace(/[֑-ׇ‎‏]/g, '').replace(/[^א-ת0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// בונים פעם אחת טבלת "מחרוזת עברית מנוקה → בעוד כמה ימים" לכל 400 הימים
// הקרובים, כדי לא לבנות אותה מחדש לכל איש קשר בנפרד.
export function buildFuzzyHebrewTable(today: Date): Map<string, number> {
  const table = new Map<string, number>();
  for (let i = 0; i < 400; i++) {
    const d = new HDate(new Date(today.getTime() + i * 86400000));
    const gem = d.renderGematriya ? d.renderGematriya() : d.render('he');
    let partsGem = gem.split(' '); partsGem.pop();
    let keyGem = cleanHeStr(partsGem.join(' '));
    const pGem = keyGem.split(' ');
    if (pGem.length > 1 && pGem[1].startsWith('ב') && pGem[1].length > 1) keyGem = pGem[0] + ' ' + pGem[1].substring(1);
    if (!table.has(keyGem)) table.set(keyGem, i);
    const numHe = d.render('he');
    let partsNum = numHe.split(',');
    let keyNum = cleanHeStr(partsNum[0]);
    const pNum = keyNum.split(' ');
    if (pNum.length > 1 && pNum[1].startsWith('ב') && pNum[1].length > 1) keyNum = pNum[0] + ' ' + pNum[1].substring(1);
    if (!table.has(keyNum)) table.set(keyNum, i);
  }
  return table;
}

function fuzzyMatchDays(hebrewStr: string, table: Map<string, number>): number | null {
  const clean = cleanHeStr(hebrewStr);
  for (const k of table.keys()) {
    if (clean === k || clean.startsWith(k + ' ') || k === clean + ' ' || clean.includes(' ' + k + ' ') || clean.endsWith(' ' + k)) {
      return table.get(k)!;
    }
  }
  return null;
}

// ── חישוב עיקרי ──────────────────────────────────────────────────────────

// מחזיר כמה ימים עד המופע הבא (0 = היום), או null אם לא ניתן לחשב.
// fallbackTable אופציונלי: טבלה שנבנתה מראש עם buildFuzzyHebrewTable, לשימוש
// חוזר עבור כל אנשי הקשר (יעיל יותר מלבנות טבלה חדשה לכל אחד).
export function nextOccurrenceDays(
  hebrewStr: string,
  kind: 'birthday' | 'yahrzeit',
  today: Date,
  fallbackTable?: Map<string, number>
): number | null {
  if (!hebrewStr) return null;
  const parsed = parseCanonicalHebrewString(hebrewStr);
  if (parsed) {
    const currentHYear = new HDate(today).getFullYear();
    for (const hy of [currentHYear, currentHYear + 1]) {
      const result = kind === 'yahrzeit' ? getYahrzeit(hy, parsed) : getBirthdayOrAnniversary(hy, parsed);
      if (result) {
        const days = Math.round((result.getTime() - today.getTime()) / 86400000);
        if (days >= 0) return days;
      }
    }
  }
  const table = fallbackTable || buildFuzzyHebrewTable(today);
  return fuzzyMatchDays(hebrewStr, table);
}
