// שמות העמודות לתאריכים אישיים (לידה/יארצייט) משתנים בין גיליונות שונים
// ("תאריך לידה", "יום הולדת", "ת. לידה (לועזי)" וכו') — לכן מחפשים לפי
// תבנית בשם העמודה במקום התאמה מדויקת לשם קבוע אחד.

export const isYahrzeitKey = (k: string) => /יארצייט|יורצייט|פטירה|יום השנה/.test(k);
export const isBirthdayKey = (k: string) => k.includes('לידה') || k.includes('הולדת');
export const isImportantDateKey = (k: string) => isYahrzeitKey(k) || isBirthdayKey(k);

// שדה "(לועזי)" הוא תמיד לועזי; אחרת שדה עם 'עברי' בשם או שדה יארצייט
// (שמטבעו נשמר קודם כל בעברי באפליקציה הזו) נחשב עברי; כל השאר לועזי.
export function isHebrewStyleDateKey(key: string): boolean {
  if (key.endsWith(' (לועזי)')) return false;
  if (key.includes('עברי')) return true;
  if (isYahrzeitKey(key)) return true;
  return false;
}

// שם השדה הלועזי המקביל לשדה עברי נתון
export function gregorianPairFor(hebrewKey: string): string {
  if (hebrewKey === 'תאריך לידה עברי') return 'תאריך לידה';
  if (hebrewKey === 'יום הולדת עברי') return 'יום הולדת';
  if (hebrewKey.endsWith(' עברי')) return hebrewKey.slice(0, -' עברי'.length);
  return `${hebrewKey} (לועזי)`;
}

// שם השדה העברי המקביל לשדה לועזי נתון
export function hebrewPairFor(gregorianKey: string): string {
  if (gregorianKey === 'תאריך לידה') return 'תאריך לידה עברי';
  if (gregorianKey === 'יום הולדת') return 'יום הולדת עברי';
  if (gregorianKey.endsWith(' (לועזי)')) return gregorianKey.slice(0, -' (לועזי)'.length);
  return `${gregorianKey} עברי`;
}

export function findGregorianBirthday(fields: Record<string, any>): string | undefined {
  const key = Object.keys(fields).find(k => isBirthdayKey(k) && !isHebrewStyleDateKey(k) && fields[k]);
  return key ? String(fields[key]) : undefined;
}

export function findHebrewBirthday(fields: Record<string, any>): string | undefined {
  const key = Object.keys(fields).find(k => isBirthdayKey(k) && isHebrewStyleDateKey(k) && fields[k]);
  return key ? String(fields[key]) : undefined;
}

export function findYahrzeitEntries(fields: Record<string, any>): { key: string; value: string }[] {
  return Object.keys(fields)
    .filter(k => isYahrzeitKey(k) && fields[k])
    .map(k => ({ key: k, value: String(fields[k]) }));
}

// כנ"ל, אך רק שדות הגרסה העברית — לשימוש בחישוב "בעוד כמה ימים" (המחרוזת
// הלועזית המקבילה לא מחושבת ממנה כי היא כבר לועזית).
export function findHebrewYahrzeitEntries(fields: Record<string, any>): { key: string; value: string }[] {
  return findYahrzeitEntries(fields).filter(e => isHebrewStyleDateKey(e.key));
}
