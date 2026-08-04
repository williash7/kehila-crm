// מיזוג אנשי קשר כפולים (למשל "אברהם אריאל" ו"אברהם אריאל ציגנוב" שהם אותו
// אדם) — בלי לגעת בגיליון המקור. שומרים מיפוי שם-כינוי → שם-קנוני בתוך אותו
// אובייקט CRM שכבר מסונכרן לענן (מפתח שמור מיוחד), וממזגים בזמן טעינת הנתונים.

export const MERGES_KEY = '__nameMerges__';

export function extractMerges(rawCrm: Record<string, any>): { merges: Record<string, string>; crmRest: Record<string, any> } {
  const { [MERGES_KEY]: merges, ...crmRest } = rawCrm || {};
  return { merges: (merges && typeof merges === 'object') ? merges : {}, crmRest };
}

// עוקב אחרי שרשרת מיזוגים (למקרה שממוזגים שני שמות למי שכבר מוזג בעצמו),
// עם הגנה מפני לולאה אינסופית.
export function resolveCanonicalName(name: string, merges: Record<string, string>): string {
  const seen = new Set<string>();
  let cur = name;
  while (merges[cur] && !seen.has(cur)) {
    seen.add(cur);
    cur = merges[cur];
  }
  return cur;
}

// ממזג שני אובייקטי שדות: הערכים הלא-ריקים של base מנצחים, extra ממלא רק חוסרים
export function mergeFieldsPreferNonEmpty<T extends Record<string, any>>(base: T, extra: Record<string, any>): T {
  const out: any = { ...base };
  Object.keys(extra || {}).forEach(k => {
    if (out[k] === undefined || out[k] === null || out[k] === '') out[k] = extra[k];
  });
  return out;
}

function pickLaterDate(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  const da = new Date(a.split('/').reverse().join('-'));
  const db = new Date(b.split('/').reverse().join('-'));
  return db > da ? b : a;
}

// מקפל אנשי קשר לפי מיפוי מיזוגים: כל כינוי מתמזג לתוך הרשומה הקנונית שלו —
// תרומות מתאחדות, סה"כ מצטבר, תאריך אחרון הוא המאוחר מבין השניים.
export function coalesceDonorsByMerges<T extends Record<string, any>>(
  donors: Record<string, T>,
  merges: Record<string, string>
): Record<string, T> {
  if (!merges || Object.keys(merges).length === 0) return donors;
  const result: Record<string, any> = {};
  Object.keys(donors).forEach(name => {
    const canonical = resolveCanonicalName(name, merges);
    const donor = donors[name];
    const existing = result[canonical];
    if (!existing) {
      result[canonical] = { ...donor, name: canonical, donations: [...(donor.donations || [])] };
    } else {
      result[canonical] = {
        ...mergeFieldsPreferNonEmpty(existing, donor),
        name: canonical,
        total: (existing.total || 0) + (donor.total || 0),
        donations: [...(existing.donations || []), ...(donor.donations || [])],
        lastDate: pickLaterDate(existing.lastDate, donor.lastDate),
      };
    }
  });
  return result;
}

// מפעיל את המיזוגים על ה-CRM עצמו: שדות הכינוי ממלאים חוסרים אצל הקנוני, ואז נמחקים
export function applyMergesToCrm(crmRest: Record<string, any>, merges: Record<string, string>): Record<string, any> {
  if (!merges || Object.keys(merges).length === 0) return crmRest;
  const result: Record<string, any> = { ...crmRest };
  Object.keys(merges).forEach(alias => {
    if (!result[alias]) return;
    const canonical = resolveCanonicalName(alias, merges);
    const aliasData = result[alias];
    const canonicalData = result[canonical] || {};
    result[canonical] = {
      circle: canonicalData.circle || aliasData.circle,
      target: canonicalData.target ?? aliasData.target,
      phone: canonicalData.phone || aliasData.phone,
      customFields: { ...(aliasData.customFields || {}), ...(canonicalData.customFields || {}) },
    };
    delete result[alias];
  });
  return result;
}
