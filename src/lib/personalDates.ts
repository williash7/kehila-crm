// אירועי תאריכים אישיים (יום הולדת/יארצייט) הקרובים לכל אנשי הקשר —
// בעזרת חישוב אמין (nextOccurrenceDays) עם נפילה חזרה לזיהוי מקורב.

import { findGregorianBirthday, findHebrewBirthday, findHebrewYahrzeitEntries } from './donorDates';
import { buildFuzzyHebrewTable, nextOccurrenceDays } from './hebrewDates';
import { FamilyMember, familyDisplayName } from './family';

export interface PersonalDateEvent {
  name: string;
  msg: string;
  icon: string;
  dist: number;
  key: string; // יציב (לא תלוי במספר הימים שנותרו) — לשמירת "פרטים נוספים" (שעה/הערות/תתי-משימות) לאורך זמן
}

function nextGregorianRecurrenceDays(gStr: string, today: Date): number | null {
  let d = 0, m = 0;
  const isoMatch = gStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) { m = parseInt(isoMatch[2]); d = parseInt(isoMatch[3]); }
  else {
    const match = gStr.match(/(\d{1,2})[\/.\-](\d{1,2})/);
    if (match) { d = parseInt(match[1]); m = parseInt(match[2]); }
  }
  if (d > 0 && m > 0 && d <= 31 && m <= 12) {
    const dateThisYear = new Date(today.getFullYear(), m - 1, d);
    if (dateThisYear < today) dateThisYear.setFullYear(today.getFullYear() + 1);
    return Math.ceil((dateThisYear.getTime() - today.getTime()) / 86400000);
  }
  return null;
}

export function computePersonalDateEvents(
  visibleDonors: Record<string, any>,
  crm: Record<string, any>,
  today: Date
): PersonalDateEvent[] {
  const events: PersonalDateEvent[] = [];
  const fallbackTable = buildFuzzyHebrewTable(today);

  Object.keys(visibleDonors).forEach(name => {
    const donor = visibleDonors[name];
    const combined = { ...(donor as any), ...(crm[name]?.customFields || {}) };

    let hasBirthday = false;
    const hBday = findHebrewBirthday(combined);
    if (hBday) {
      const dist = nextOccurrenceDays(hBday, 'birthday', today, fallbackTable);
      if (dist !== null) {
        events.push({ name, msg: 'יום הולדת עברי ' + (dist === 0 ? 'היום' : `בעוד ${dist} ימים`), icon: '🎂', dist, key: `${name}::hbday` });
        hasBirthday = true;
      }
    }
    if (!hasBirthday) {
      const gBday = findGregorianBirthday(combined);
      if (gBday) {
        const dist = nextGregorianRecurrenceDays(gBday, today);
        if (dist !== null) events.push({ name, msg: 'יום הולדת ' + (dist === 0 ? 'היום' : `בעוד ${dist} ימים`), icon: '🎈', dist, key: `${name}::gbday` });
      }
    }

    findHebrewYahrzeitEntries(combined).forEach(({ key: yKey, value }) => {
      const dist = nextOccurrenceDays(value, 'yahrzeit', today, fallbackTable);
      if (dist !== null) {
        const label = /^(יארצייט|יורצייט|יום השנה)$/.test(yKey) ? 'יארצייט' : yKey;
        events.push({ name, msg: label + ' ' + (dist === 0 ? 'היום' : `בעוד ${dist} ימים`), icon: '🕯️', dist, key: `${name}::yahrzeit::${yKey}` });
      }
    });

    // ── תאריכים של בני משפחה ────────────────────────────────────────────
    //
    // מוצגים תחת שם איש הקשר שאצלו הם רשומים — הוא זה שמתקשרים אליו.
    // תאריך עברי מנצח לועזי כשיש שניהם: הוא המדויק לציון יארצייט ויום
    // הולדת, והלועזי הוא רק העוגן שממנו הוא חושב.
    const family: FamilyMember[] = crm[name]?.family || [];
    family.forEach(f => {
      const who = familyDisplayName(f) || f.relation || '';
      const suffix = f.relation && familyDisplayName(f) ? ` (${f.relation})` : '';

      if (f.yahrzeitHebrew || f.yahrzeit) {
        const dist = f.yahrzeitHebrew
          ? nextOccurrenceDays(f.yahrzeitHebrew, 'yahrzeit', today, fallbackTable)
          : nextGregorianRecurrenceDays(f.yahrzeit!, today);
        if (dist !== null) {
          events.push({
            name, dist, icon: '🕯️',
            msg: `יארצייט ${who}${suffix} ` + (dist === 0 ? 'היום' : `בעוד ${dist} ימים`),
            key: `${name}::fam-yahrzeit::${f.id}`,
          });
        }
      }

      if (f.birthdayHebrew || f.birthday) {
        const dist = f.birthdayHebrew
          ? nextOccurrenceDays(f.birthdayHebrew, 'birthday', today, fallbackTable)
          : nextGregorianRecurrenceDays(f.birthday!, today);
        if (dist !== null) {
          events.push({
            name, dist, icon: '🎂',
            msg: `יום הולדת ${who}${suffix} ` + (dist === 0 ? 'היום' : `בעוד ${dist} ימים`),
            key: `${name}::fam-bday::${f.id}`,
          });
        }
      }
    });
  });

  events.sort((a, b) => a.dist - b.dist);
  return events;
}
