// ─────────────────────────────────────────────────────────────────────────────
// זיהוי שורות שכבר קיימות ביומן, לפני הייבוא.
//
// ── מה זה כן, ומה זה בכוונה לא ──────────────────────────────────────────────
//
// זו **שכבת הסבר, לא הגנה.** ההגנה האמיתית מפני כפילות יושבת בשרת, במזהים
// הייחודיים של importRows_. וזה מכוון: המצב שבזיכרון האפליקציה עלול להיות
// ישן (מישהו הוסיף תרומה ממכשיר אחר), חלקי, או מסונן לפי טווח התאריכים
// שנבחר בהגדרות — ואז בדיקה מקומית תפספס בדיוק את השורות שכבר קיימות.
//
// אז למה בכלל? כי בלי זה המשתמש מגלה רק **אחרי** השמירה שחצי מהקובץ כבר
// היה בפנים. עדיף שיראה את זה לפני, ויחליט בעצמו.
//
// ── הנרמול ──────────────────────────────────────────────────────────────────
//
// בגיליון יושבים שני פורמטים של תאריך זה לצד זה: מיילים מנדרים פלוס מגיעים
// עם לוכסנים (17/08/2026), ומה שהאפליקציה כותבת מגיע עם נקודות (16.08.2026).
// השוואה על המחרוזת הגולמית הייתה מפספסת בדיוק את מה שהיא מחפשת.
// ─────────────────────────────────────────────────────────────────────────────

/** תאריך בכל פורמט → yyyy-MM-dd. מחרוזת שאינה תאריך חוזרת כפי שהיא. */
export function normDate(v: any): string {
  if (v === undefined || v === null || v === '') return '';
  const s = String(v).trim();
  const dmy = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})\b/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  return s;
}

/** "₪1,200.00" → 120000. אגורות שלמות, כדי שייצוג עשרוני לא ישנה זהות. */
export function normAmount(v: any): number {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

/** רווחים כפולים, גרשיים וסימני כיווניות אינם הופכים אדם לאדם אחר. */
export function normName(v: any): string {
  return String(v ?? '')
    .replace(/[​-‏‪-‮﻿]/g, '')
    .replace(/["'`׳״]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** החתימה שמזהה תרומה. אותו היגיון שהשרת מפעיל, כדי שהשניים יסכימו. */
export function donationKey(d: { name?: any; date?: any; amount?: any }): string {
  return `${normName(d.name)}|${normDate(d.date)}|${normAmount(d.amount)}`;
}

export interface DupeReport<T> {
  /** שורות שלא נמצאו ביומן — אלה שכדאי לייבא */
  fresh: T[];
  /** שורות שכבר קיימות ביומן */
  existing: T[];
  /** שורות שחוזרות על עצמן בתוך הקובץ עצמו */
  repeatedInFile: T[];
}

/**
 * משווה שורות ייבוא מול היומן הקיים.
 *
 * `repeatedInFile` נשמר בנפרד ואינו מסומן ככפילות: תורם שנתן פעמיים ₪100
 * באותו יום הוא מקרה אמיתי, והשרת יודע לשמור את שניהם עם סיומת סידורית.
 * זו אזהרה למשתמש, לא סינון.
 */
export function findDuplicates<T extends { id?: any; name?: any; date?: any; amount?: any }>(
  rows: T[],
  existingDonations: { id?: any; name?: any; date?: any; amount?: any }[]
): DupeReport<T> {
  const byId = new Set<string>();
  const byKey = new Set<string>();

  (existingDonations || []).forEach(d => {
    const raw = String(d?.id ?? '');
    // המזהה בגיליון נושא קידומת מקור (imp:, ned:, man:). מסירים אותה
    // כדי שמספר קבלה מהקובץ יימצא גם אם הוא נכנס בעבר ממקור אחר.
    const bare = raw.replace(/^(imp|ned|man|meet|legacy):/, '');
    if (bare) byId.add(bare);
    byKey.add(donationKey(d));
  });

  const seenInFile = new Set<string>();
  const out: DupeReport<T> = { fresh: [], existing: [], repeatedInFile: [] };

  (rows || []).forEach(r => {
    if (!r) return;
    const id = String(r.id ?? '').trim();
    const key = donationKey(r);

    if ((id && byId.has(id)) || byKey.has(key)) { out.existing.push(r); return; }
    if (seenInFile.has(key)) { out.repeatedInFile.push(r); out.fresh.push(r); return; }

    seenInFile.add(key);
    out.fresh.push(r);
  });

  return out;
}
