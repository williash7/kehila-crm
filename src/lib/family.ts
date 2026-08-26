// ─────────────────────────────────────────────────────────────────────────────
// בני משפחה ותאריכים אישיים שלהם.
//
// ── למה זה קיים ──────────────────────────────────────────────────────────────
//
// קודם, יארצייט נשמר כ**עמודה בגיליון** ששמה כלל את שם הנפטר:
// `יארצייט (פנחס בן לייב)`. עמודה, מעצם טבעה, קיימת אצל כל אנשי הקשר —
// ולכן הוספת יארצייט אחד הוסיפה את שם הנפטר לכולם. עם מאתיים אנשי קשר
// ושלושה נפטרים לכל אחד, הגיליון היה מגיע למאות עמודות.
//
// יארצייט אינו תכונה של איש הקשר אלא **רשומה ששייכת לו**: מי נפטר, שם
// אביו, ומתי — בשני הלוחות. אותו דבר בדיוק ליום הולדת של קרוב משפחה.
// לכן הם יושבים כאן, ברשימה בתוך הכרטיס, ולא כעמודות.
// ─────────────────────────────────────────────────────────────────────────────

export interface FamilyMember {
  id: string;
  /** אבא / אמא / בן / בת / בעל / אישה — טקסט חופשי */
  relation: string;
  /** קישור לאיש קשר קיים באפליקציה */
  linkedName?: string;
  /** שם חופשי, למי שאין לו כרטיס משלו */
  freeName?: string;
  /** שם האב — לצורך "פלוני בן פלוני" בהזכרה וביארצייט */
  fatherName?: string;

  birthday?: string;         // dd/MM/yyyy
  birthdayHebrew?: string;   // כ״ה אייר תשנ״ו

  yahrzeit?: string;         // dd/MM/yyyy — תאריך הפטירה
  yahrzeitHebrew?: string;

  notes?: string;
}

export function newFamilyId(): string {
  return `fam_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** השם כפי שמציגים אותו: "פנחס בן לייב", או רק "פנחס" אם אין שם אב. */
export function familyDisplayName(f: FamilyMember): string {
  const base = (f.linkedName || f.freeName || '').trim();
  if (!base) return '';
  return f.fatherName?.trim() ? `${base} בן ${f.fatherName.trim()}` : base;
}

/** "אבא — פנחס בן לייב", לכותרת שורה */
export function familyLabel(f: FamilyMember): string {
  const nm = familyDisplayName(f);
  if (f.relation?.trim() && nm) return `${f.relation.trim()} — ${nm}`;
  return nm || f.relation?.trim() || 'בן משפחה';
}

export function hasAnyDate(f: FamilyMember): boolean {
  return !!(f.birthday || f.birthdayHebrew || f.yahrzeit || f.yahrzeitHebrew);
}

/** מזהה תוכן יציב למניעת הוספה חוזרת של אותו קרוב בהעברת נתונים ישנים. */
export function familyMemberFingerprint(f: Partial<FamilyMember>): string {
  const clean = (value: unknown) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return [
    clean(f.relation), clean(f.linkedName), clean(f.freeName), clean(f.fatherName),
    clean(f.birthday), clean(f.birthdayHebrew), clean(f.yahrzeit), clean(f.yahrzeitHebrew),
  ].join('|');
}

/** מסיר רק רשומות משפחה זהות לחלוטין בתוכן; הבדלים בתאריך או בשם נשמרים. */
export function dedupeFamilyMembers(members: FamilyMember[]): { members: FamilyMember[]; removed: number } {
  const seen = new Set<string>();
  const unique: FamilyMember[] = [];
  (Array.isArray(members) ? members : []).forEach(member => {
    const key = familyMemberFingerprint(member);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(member);
  });
  return { members: unique, removed: Math.max(0, members.length - unique.length) };
}

// ── המרה מהמבנה הישן ────────────────────────────────────────────────────────
//
// עמודות ישנות נראות כך:
//   `יארצייט`                      — ללא שם, יארצייט כללי
//   `יארצייט (אבא)`                — עם תיאור קרבה
//   `יארצייט (פנחס בן לייב)`       — עם שם מלא
//   `יארצייט (פנחס בן לייב) (לועזי)` — הגרסה הלועזית של אותה רשומה
//
// המרה מזווגת את שתי הגרסאות לרשומה אחת, ומפרקת "בן" לשם ולשם האב.

const YAHRZEIT_KEY = /^(יארצייט|יורצייט|יום השנה|פטירה)(\s*\(([^)]*)\))?(\s*\(לועזי\))?$/;

export interface LegacyYahrzeit {
  /** התווית שבסוגריים, כפי שהופיעה */
  label: string;
  hebrew?: string;
  gregorian?: string;
  /** שמות העמודות שמהן נלקח — כדי שאפשר יהיה למחוק אותן אחר כך */
  columns: string[];
}

/** אוסף את כל שדות היארצייט הישנים של איש קשר אחד ומזווג עברי↔לועזי. */
export function collectLegacyYahrzeits(fields: Record<string, any>): LegacyYahrzeit[] {
  const byLabel: Record<string, LegacyYahrzeit> = {};

  Object.keys(fields || {}).forEach(key => {
    const m = key.match(YAHRZEIT_KEY);
    if (!m) return;
    const value = String(fields[key] ?? '').trim();
    if (!value) return;

    const label = (m[3] || '').trim();
    const isGregorian = !!m[4];

    const rec = byLabel[label] || (byLabel[label] = { label, columns: [] });
    rec.columns.push(key);
    if (isGregorian) rec.gregorian = value;
    else rec.hebrew = value;
  });

  return Object.values(byLabel);
}

/** "פנחס בן לייב" → { name: 'פנחס', father: 'לייב' } */
export function splitBenName(label: string): { name: string; father?: string } {
  const m = String(label || '').trim().match(/^(.+?)\s+ב[נן]\s+(.+)$/);
  if (m) return { name: m[1].trim(), father: m[2].trim() };
  return { name: String(label || '').trim() };
}

/** תיאורי קרבה מוכרים — אם התווית היא אחד מהם, היא הקרבה ולא שם. */
const RELATIONS = ['אב', 'אבא', 'אם', 'אמא', 'בעל', 'אישה', 'אשה', 'בן', 'בת',
                   'סבא', 'סבתא', 'אח', 'אחות', 'חם', 'חמות'];

export function legacyToFamilyMember(rec: LegacyYahrzeit): FamilyMember {
  const label = rec.label.trim();
  const isRelation = RELATIONS.indexOf(label) >= 0;
  const parts = isRelation ? { name: '', father: undefined } : splitBenName(label);

  return {
    id: newFamilyId(),
    relation: isRelation ? label : '',
    freeName: parts.name || undefined,
    fatherName: parts.father,
    yahrzeit: rec.gregorian,
    yahrzeitHebrew: rec.hebrew,
  };
}
