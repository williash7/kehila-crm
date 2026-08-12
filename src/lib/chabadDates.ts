// ─────────────────────────────────────────────────────────────────────────────
// תאריכים חסידיים ותאריכי חב"ד.
//
// Hebcal לא מכיר אותם, ולכן הם מוגדרים כאן לפי התאריך העברי ומחושבים לשנה
// הנוכחית ולשנה הבאה — בדיוק כמו שאר החגים.
//
// כל תאריך שייך לקטגוריה, וניתן לכבות קטגוריה שלמה או פריט בודד בהגדרות
// (ראה holidayFilter.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { HDate, months } from '@hebcal/core';

export interface ChabadDate {
  name: string;
  /** חודש עברי לפי @hebcal/core */
  month: number;
  day: number;
  emoji: string;
  note?: string;
}

export const CHABAD_DATES: ChabadDate[] = [
  { name: 'כ׳ חשוון — הולדת הרש״ב',        month: months.CHESHVAN, day: 20, emoji: '🕯️' },
  { name: 'י״ט כסלו — חג הגאולה',           month: months.KISLEV,   day: 19, emoji: '📖', note: 'ראש השנה לחסידות' },
  { name: 'כ׳ כסלו — המשך חג הגאולה',       month: months.KISLEV,   day: 20, emoji: '📖' },
  { name: 'ה׳ טבת — דידן נצח',              month: months.TEVET,    day: 5,  emoji: '📚' },
  { name: 'כ״ד טבת — הילולת אדמו״ר הזקן',   month: months.TEVET,    day: 24, emoji: '🕯️' },
  { name: 'י׳ שבט — יום ההילולא והקבלת הנשיאות', month: months.SHVAT, day: 10, emoji: '👑' },
  { name: 'כ״ב שבט — הרבנית חיה מושקא',     month: months.SHVAT,    day: 22, emoji: '🕯️' },
  { name: 'ז׳ אדר — הולדת ופטירת משה רבנו', month: months.ADAR_I,   day: 7,  emoji: '🕯️' },
  { name: 'ב׳ ניסן — הילולת הרש״ב',         month: months.NISAN,    day: 2,  emoji: '🕯️' },
  { name: 'י״א ניסן — הולדת הרבי',          month: months.NISAN,    day: 11, emoji: '🎂' },
  { name: 'ב׳ אייר — הולדת הרש״ב',          month: months.IYYAR,    day: 2,  emoji: '🕯️' },
  { name: 'ג׳ תמוז — הילולת הרבי',          month: months.TAMUZ,    day: 3,  emoji: '👑' },
  { name: 'י״ב-י״ג תמוז — חג הגאולה',       month: months.TAMUZ,    day: 12, emoji: '🎉' },
  { name: 'ח״י אלול — הולדת הבעש״ט ואדמו״ר הזקן', month: months.ELUL, day: 18, emoji: '🌟' },
];

/**
 * מחזיר את תאריכי חב"ד כרשימה בפורמט של Hebcal, כדי שישתלבו בלוח בלי
 * טיפול מיוחד. מחושב לשנה העברית הנוכחית ולשנה שאחריה.
 */
export function chabadHolidayItems(today = new Date()): any[] {
  const startYear = new HDate(today).getFullYear();
  const out: any[] = [];

  [startYear, startYear + 1].forEach(hYear => {
    CHABAD_DATES.forEach(d => {
      try {
        const hd = new HDate(d.day, d.month, hYear);
        out.push({
          title: d.name,
          hebrew: d.name,
          date: hd.greg().toISOString(),
          category: 'chabad',
          emoji: d.emoji,
          memo: d.note,
        });
      } catch {
        // חודש שאינו קיים בשנה הזו (אדר ב׳ בשנה פשוטה) — פשוט מדלגים
      }
    });
  });

  return out;
}
