// מיזוג אנשי קשר כפולים (למשל "אברהם אריאל" ו"אברהם אריאל ציגנוב" שהם אותו
// אדם). מקור האמת החדש הוא לשונית "מיפוי שמות": שורה אחת לכל כינוי מול
// השם הקנוני. המפתח הישן נשאר בחוזה שמוחזר ללקוח, כדי לאפשר מעבר הדרגתי
// מגרסאות שבהן כל החיבורים נשמרו יחד בתא CRM אחד.

export const MERGES_KEY = '__nameMerges__';

export type NameMergeSuggestionReason = 'wordOrder' | 'oneLetter' | 'extendedName';

export interface NameMergeSuggestion {
  nameA: string;
  nameB: string;
  reason: NameMergeSuggestionReason;
  /** המלצה מבנית בלבד; הממשק יכול להעדיף שם שיש לו כרטיס עשיר יותר. */
  recommendedCanonical: string;
}

function nameTokens(value: string): string[] {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0591-\u05C7\u0300-\u036f]/g, '')
    .replace(/[^א-תA-Za-z0-9]+/g, ' ')
    .trim()
    .toLocaleLowerCase('he')
    .split(/\s+/)
    .filter(Boolean);
}

function sameTokenBag(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.slice().sort().join('\u0000') === b.slice().sort().join('\u0000');
}

function tokenSubset(shorter: string[], longer: string[]): boolean {
  const counts = new Map<string, number>();
  longer.forEach(token => counts.set(token, (counts.get(token) || 0) + 1));
  return shorter.every(token => {
    const left = counts.get(token) || 0;
    if (!left) return false;
    counts.set(token, left - 1);
    return true;
  });
}

/** בדיקת מרחק עריכה 1 בלי לחשב מטריצה מלאה. */
function oneEditApart(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    let differences = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i] && ++differences > 1) return false;
    }
    return differences === 1;
  }
  const short = a.length < b.length ? a : b;
  const long = a.length < b.length ? b : a;
  let i = 0, j = 0, skipped = false;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) { i++; j++; continue; }
    if (skipped) return false;
    skipped = true;
    j++;
  }
  return true;
}

function oneTokenHasOneLetterDifference(a: string[], b: string[]): boolean {
  if (a.length < 2 || a.length !== b.length) return false;
  let changed = 0;
  let exact = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) { exact++; continue; }
    if (!oneEditApart(a[i], b[i]) || ++changed > 1) return false;
  }
  return changed === 1 && exact >= 1;
}

function structuralRecommendation(
  nameA: string, tokensA: string[], nameB: string, tokensB: string[], reason: NameMergeSuggestionReason
): string {
  if (reason === 'extendedName' && tokensA.length !== tokensB.length) {
    return tokensA.length > tokensB.length ? nameA : nameB;
  }
  if (nameA.length !== nameB.length) return nameA.length > nameB.length ? nameA : nameB;
  return nameA.localeCompare(nameB, 'he') <= 0 ? nameA : nameB;
}

/**
 * מציע כפילויות אפשריות בלבד. ההחלטה והמיזוג נשארים תמיד בידי המשתמש.
 * הכללים בכוונה שמרניים כדי ששמות פרטיים דומים לא יהפכו להצעות שווא.
 */
export function suggestNameMerges(
  values: string[], existingMerges: Record<string, string> = {}, limit = 100
): NameMergeSuggestion[] {
  const names = Array.from(new Set((values || []).map(v => String(v || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'he'));
  const prepared = names.map(name => ({ name, tokens: nameTokens(name) }))
    .filter(item => item.tokens.length >= 2);
  const suggestions: NameMergeSuggestion[] = [];

  for (let i = 0; i < prepared.length; i++) {
    for (let j = i + 1; j < prepared.length; j++) {
      const a = prepared[i], b = prepared[j];
      if (resolveCanonicalName(a.name, existingMerges) === resolveCanonicalName(b.name, existingMerges)) continue;

      let reason: NameMergeSuggestionReason | null = null;
      if (sameTokenBag(a.tokens, b.tokens) && a.tokens.join(' ') !== b.tokens.join(' ')) {
        reason = 'wordOrder';
      } else if (oneTokenHasOneLetterDifference(a.tokens, b.tokens)) {
        reason = 'oneLetter';
      } else if (a.tokens.length !== b.tokens.length) {
        const shorter = a.tokens.length < b.tokens.length ? a.tokens : b.tokens;
        const longer = a.tokens.length < b.tokens.length ? b.tokens : a.tokens;
        if (shorter.length >= 2 && tokenSubset(shorter, longer)) reason = 'extendedName';
      }
      if (!reason) continue;

      suggestions.push({
        nameA: a.name,
        nameB: b.name,
        reason,
        recommendedCanonical: structuralRecommendation(a.name, a.tokens, b.name, b.tokens, reason),
      });
    }
  }

  const weight: Record<NameMergeSuggestionReason, number> = { wordOrder: 0, oneLetter: 1, extendedName: 2 };
  return suggestions
    .sort((a, b) => weight[a.reason] - weight[b.reason]
      || a.nameA.localeCompare(b.nameA, 'he')
      || a.nameB.localeCompare(b.nameB, 'he'))
    .slice(0, Math.max(0, limit));
}

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

/**
 * ממזג את רשומת ה-CRM של כינוי לתוך זו של השם הקנוני.
 *
 * ── מה שהיה כאן קודם ──────────────────────────────────────────────────────
 *
 * הפונקציה בנתה אובייקט חדש עם **ארבעה שדות בלבד** — מעגל, יעד, טלפון
 * ושדות מותאמים — וכל השאר נמחק בשקט. כלומר מיזוג שני אנשי קשר מחק את
 * רשומות המשפחה (היארצייטים!) של שניהם, וכל שדה עתידי שיתווסף לכרטיס היה
 * נמחק גם הוא, בלי שאיש ישים לב.
 *
 * עכשיו הבסיס הוא **כל השדות של שניהם**, והכללים המפורשים חלים רק מעליו.
 */
export function mergeCrmPair(aliasData: any, canonicalData: any): any {
  const a = aliasData || {};
  const c = canonicalData || {};
  // הקנוני מנצח בהתנגשות; הכינוי ממלא רק מה שחסר
  const out: any = { ...a, ...c };

  out.circle = c.circle || a.circle;
  out.target = c.target ?? a.target;
  out.phone = c.phone || a.phone;
  out.customFields = { ...(a.customFields || {}), ...(c.customFields || {}) };

  // רשומות משפחה מצטרפות ולא נדרסות — לאותו אדם יכולים להיות כמה יארצייטים,
  // ומיזוג שני כרטיסים אמור לאסוף את כולם.
  const family = [...(a.family || []), ...(c.family || [])];
  const seen = new Set<string>();
  const uniqueFamily = family.filter(f => f && f.id && !seen.has(f.id) && !!seen.add(f.id));
  if (uniqueFamily.length) out.family = uniqueFamily;
  else delete out.family;

  return out;
}

// מפעיל את המיזוגים על ה-CRM עצמו: שדות הכינוי ממלאים חוסרים אצל הקנוני, ואז נמחקים
export function applyMergesToCrm(crmRest: Record<string, any>, merges: Record<string, string>): Record<string, any> {
  if (!merges || Object.keys(merges).length === 0) return crmRest;
  const result: Record<string, any> = { ...crmRest };
  Object.keys(merges).forEach(alias => {
    if (!result[alias]) return;
    const canonical = resolveCanonicalName(alias, merges);
    result[canonical] = mergeCrmPair(result[alias], result[canonical]);
    delete result[alias];
  });
  return result;
}
