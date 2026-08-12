// ─────────────────────────────────────────────────────────────────────────────
// אילו חגים ותאריכים להציג.
//
// הלוח מציג היום את כל מה ש-Hebcal מחזיר, וזה מציף: לצד פסח וראש השנה
// מופיעים גם "ראש השנה למעשר בהמה" וכל ראש חודש בנפרד.
//
// הפתרון בשתי רמות: מכבים **קטגוריה** שלמה (למשל כל ראשי החודשים), ובתוך
// קטגוריה שנשארה דלוקה אפשר לכבות **פריט בודד**. ברירת המחדל מציגה את
// העיקריים, ומסתירה את השוליים — בלי למחוק כלום.
// ─────────────────────────────────────────────────────────────────────────────

export type HolidayCategory = 'major' | 'minor' | 'roshchodesh' | 'fast' | 'modern' | 'chabad';

export const CATEGORY_LABEL: Record<HolidayCategory, string> = {
  major:       'חגים מרכזיים',
  minor:       'חגים ומועדים קטנים',
  roshchodesh: 'ראשי חודשים',
  fast:        'צומות',
  modern:      'ימים ממלכתיים',
  chabad:      'תאריכי חב״ד וחסידות',
};

export const CATEGORY_HINT: Record<HolidayCategory, string> = {
  major:       'פסח, שבועות, ראש השנה, יום כיפור, סוכות, חנוכה, פורים',
  minor:       'ל״ג בעומר, ט״ו בשבט, ט״ו באב וכדומה',
  roshchodesh: 'ראש חודש בכל חודש',
  fast:        'תשעה באב, צום גדליה, י״ז בתמוז וכדומה',
  modern:      'יום העצמאות, יום הזיכרון, יום ירושלים',
  chabad:      'י״ט כסלו, ג׳ תמוז, י״א ניסן וכדומה',
};

/** ברירת מחדל: מרכזיים, קטנים, צומות וחב״ד דלוקים. ראשי חודשים וממלכתיים כבויים. */
export const DEFAULT_CATEGORIES: Record<HolidayCategory, boolean> = {
  major: true,
  minor: true,
  roshchodesh: false,
  fast: true,
  modern: false,
  chabad: true,
};

const MAJOR = [
  'פסח', 'שבועות', 'ראש השנה', 'יום כיפור', 'סוכות', 'שמיני עצרת', 'שמחת תורה',
  'חנוכה', 'פורים', 'ראש השנה לאילנות',
];

/**
 * מסווג פריט מ-Hebcal לקטגוריה שלנו.
 * Hebcal מסמן roshchodesh ו-modern בעצמו; את השאר מזהים לפי השם.
 */
export function categorizeHoliday(item: any): HolidayCategory {
  if (item?.category === 'chabad') return 'chabad';
  if (item?.category === 'roshchodesh') return 'roshchodesh';
  if (item?.subcat === 'modern' || item?.subcat?.includes?.('modern')) return 'modern';
  if (item?.subcat === 'fast' || item?.category === 'fast') return 'fast';

  const name = String(item?.hebrew || item?.title || '');
  if (name.includes('צום') || name.includes('תענית') || name.includes('תשעה באב')) return 'fast';
  if (MAJOR.some(m => name.includes(m))) return 'major';
  return 'minor';
}

export interface HolidayVisibility {
  categories: Record<HolidayCategory, boolean>;
  /** פריטים בודדים שכובו במפורש, לפי שם */
  hiddenNames: string[];
}

export const DEFAULT_VISIBILITY: HolidayVisibility = {
  categories: { ...DEFAULT_CATEGORIES },
  hiddenNames: ['ראש השנה למעשר בהמה'],
};

export function isHolidayVisible(item: any, vis: HolidayVisibility): boolean {
  const name = String(item?.hebrew || item?.title || '').trim();
  if (!name) return false;
  if ((vis.hiddenNames || []).includes(name)) return false;
  const cat = categorizeHoliday(item);
  return vis.categories?.[cat] !== false;
}

/** מסנן רשימת חגים לפי ההגדרות. */
export function filterHolidays(holidays: any[], vis: HolidayVisibility): any[] {
  return (holidays || []).filter(h => isHolidayVisible(h, vis));
}

/** כל שמות החגים הייחודיים, מקובצים לפי קטגוריה — למסך ההגדרות. */
export function groupHolidayNames(holidays: any[]): Record<HolidayCategory, string[]> {
  const groups = {} as Record<HolidayCategory, string[]>;
  const seen = new Set<string>();

  (holidays || []).forEach(h => {
    const name = String(h?.hebrew || h?.title || '').trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    const cat = categorizeHoliday(h);
    (groups[cat] = groups[cat] || []).push(name);
  });

  (Object.keys(groups) as HolidayCategory[]).forEach(c => groups[c].sort((a, b) => a.localeCompare(b)));
  return groups;
}
