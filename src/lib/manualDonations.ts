// ─────────────────────────────────────────────────────────────────────────────
// תרומות ידניות ששמורות מקומית עד שהן חוזרות מהגיליון.
//
// כשמוסיפים תרומה, היא נכתבת לגיליון **וגם** נשמרת מקומית — כדי שהיא תופיע
// על המסך מיד, בלי להמתין לסבב הקריאה הבא. ברענון הבא היא חוזרת מהשרת,
// ואז צריך לזהות שזו אותה תרומה ולא לספור אותה פעמיים.
//
// ── הבאג שהיה כאן ────────────────────────────────────────────────────────────
//
// ההשוואה נעשתה על מחרוזת `שם|תאריך|סכום` גולמית. אבל התאריך שהאפליקציה
// יוצרת מגיע מ-toLocaleDateString בעברית — "18.08.2026", עם **נקודות** —
// בעוד שהגיליון מחזיר "18/08/2026" עם לוכסנים. שתי המחרוזות לעולם לא זהות,
// ולכן כל תרומה ידנית נספרה פעמיים לנצח: פעם מהשרת ופעם מהעותק המקומי.
// והעותק המקומי מעולם לא נמחק, אז הכפילות נצברה עם כל תרומה חדשה.
//
// כאן המפתח **מנורמל** לפני ההשוואה, והעותקים שכבר הגיעו מהשרת נמחקים.
// ─────────────────────────────────────────────────────────────────────────────

import { parseDdMmYyyy } from './dateUtils';

export interface DonationLike {
  name?: string;
  date?: string;
  amount?: number | string;
  [key: string]: any;
}

/** מפתח זהות של תרומה, עמיד לפורמט התאריך ולסוג הסכום. */
export function donationKey(d: DonationLike): string {
  const name = String(d?.name || '').trim();
  const parsed = parseDdMmYyyy(d?.date);
  const date = parsed
    ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
    : String(d?.date || '').trim();
  const amount = Number(d?.amount) || 0;
  return `${name}|${date}|${amount}`;
}

export interface MergeResult<T> {
  /** מה שצריך להציג — השרת ואחריו מה שעוד לא הגיע ממנו */
  merged: T[];
  /** מה שצריך להישאר שמור מקומית. השאר כבר בגיליון ואפשר לשכוח ממנו. */
  keepLocal: T[];
  /** כמה עותקים מקומיים נמחקו בזכות זה שהם כבר הגיעו מהשרת */
  pruned: number;
}

/**
 * ממזג את התרומות מהשרת עם העותקים המקומיים.
 * עותק מקומי שכבר קיים בשרת נזרק — גם מהתצוגה וגם מהאחסון.
 */
export function mergeManualDonations<T extends DonationLike>(
  serverDonations: T[],
  localDonations: T[]
): MergeResult<T> {
  const serverKeys = new Set((serverDonations || []).map(donationKey));
  const keepLocal = (localDonations || []).filter(d => !serverKeys.has(donationKey(d)));
  return {
    merged: [...(serverDonations || []), ...keepLocal],
    keepLocal,
    pruned: (localDonations || []).length - keepLocal.length,
  };
}
