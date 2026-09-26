// ─────────────────────────────────────────────────────────────────────────────
// הגדרות הארגון — הלב של הגרסה הגנרית.
//
// בגרסה המקורית שם הארגון, העיר, שם הרב וכתובת ה-Google Apps Script היו
// כתובים "קשיח" בתוך הקוד. כאן הכל יושב באובייקט אחד שנשמר ב-localStorage
// של הדפדפן, ומוגדר פעם אחת באשף ההגדרה הראשוני (SetupWizard).
//
// כלל ברזל: שום קובץ באפליקציה לא כותב שם ארגון / עיר / כתובת שרת בעצמו —
// הכל נקרא מכאן דרך getOrg().
// ─────────────────────────────────────────────────────────────────────────────

export interface LocalizedName {
  he: string;
  en: string;
  ru: string;
}

export interface OrgConfig {
  /** האם המשתמש כבר סיים את אשף ההגדרה */
  configured: boolean;

  /** שם הארגון המלא, בשלוש שפות (משמש במכתבי תודה ובדוחות) */
  orgName: LocalizedName;
  /** שם קצר לכותרות, לניווט ולמסך הטעינה */
  shortName: string;

  /** שם החותם על מכתבי התודה (הרב / מנהל הארגון) */
  signerName: LocalizedName;

  /** העיר — משמשת לחיפושי מפה, ל-geocoding ולזמני שבת */
  city: string;
  /** כתובת המקום (רחוב ומספר) — מופיעה בפוסטר השבועי */
  address: string;
  /** שם בית הכנסת / המקום כפי שיופיע בפוסטר */
  venueName: string;
  /** טלפון ליצירת קשר — מופיע בפוסטר */
  phone: string;
  /** שפת הפוסטר השבועי */
  posterLang: 'he' | 'ru' | 'en';
  /** קואורדינטות העיר לחישוב זמני שבת וחגים (מתמלא אוטומטית באשף) */
  lat: number;
  lon: number;
  /** אזור זמן בפורמט IANA */
  tzid: string;
  /** מנהג הדלקת נרות — כמה דקות לפני השקיעה (18 ברוב המקומות, 40 בירושלים) */
  candleMinutes: number;
  /** צאת השבת — דקות אחרי השקיעה. null = לפי צאת הכוכבים של Hebcal */
  havdalahMinutes: number | null;
  /** האם נוהגים כמנהג ארץ ישראל (יום טוב אחד) */
  israelHolidays: boolean;

  /** כתובת ה-Web App של ה-Google Apps Script המחובר לגיליון */
  gsUrl: string;

  /** תיאור קהל היעד — נכנס לתוך הפרומפטים של עוזר התוכן */
  audience: string;
  /** שפת הפוסטים לרשתות החברתיות (למשל "רוסית", "אנגלית", "עברית") */
  postLanguage: string;

  /** סמל המטבע */
  currency: string;
  /** צבע המותג */
  accent: string;
}

export const DEFAULT_ORG: OrgConfig = {
  configured: false,
  orgName: { he: '', en: '', ru: '' },
  shortName: '',
  signerName: { he: '', en: '', ru: '' },
  city: '',
  address: '',
  venueName: '',
  phone: '',
  posterLang: 'he',
  lat: 31.7683,
  lon: 35.2137,
  tzid: 'Asia/Jerusalem',
  candleMinutes: 18,
  havdalahMinutes: null,
  israelHolidays: true,
  gsUrl: '',
  audience: 'חברי הקהילה המקומית',
  postLanguage: 'עברית',
  currency: '₪',
  accent: '#C9A84C',
};

const STORAGE_KEY = 'org_config_v1';

let cached: OrgConfig | null = null;

/** קורא את הגדרות הארגון. תמיד מחזיר אובייקט שלם (משלים שדות חסרים מברירת המחדל). */
export function getOrg(): OrgConfig {
  if (cached) return cached;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    cached = {
      ...DEFAULT_ORG,
      ...raw,
      orgName: { ...DEFAULT_ORG.orgName, ...(raw.orgName || {}) },
      signerName: { ...DEFAULT_ORG.signerName, ...(raw.signerName || {}) },
    };
  } catch {
    cached = { ...DEFAULT_ORG };
  }
  return cached!;
}

/** שומר הגדרות ארגון (מיזוג חלקי מותר). */
export function saveOrg(patch: Partial<OrgConfig>): OrgConfig {
  const next = { ...getOrg(), ...patch };
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage חסום (גלישה פרטית) — ההגדרות יישארו לסשן הנוכחי בלבד
  }
  return next;
}

/** מוחק את ההגדרות ומחזיר את האפליקציה למצב "התקנה ראשונה". */
export function resetOrg() {
  cached = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/**
 * האם האפליקציה מוכנה לשימוש.
 * כתובת שרת אינה חובה: האשף מציע במפורש מצב הדגמה, ו-api.ts יודע להחזיר
 * בו נתוני דמה. דרישת gsUrl כאן החזירה את המשתמש לאשף מיד אחרי שסיים אותו.
 */
export function isConfigured(): boolean {
  const o = getOrg();
  return o.configured && !!o.orgName.he;
}

// ── עזרי נגזרות ──────────────────────────────────────────────────────────────

/** שם הארגון בשפה מבוקשת, עם נפילה לעברית ואז לשם הקצר. */
export function orgNameIn(lang: keyof LocalizedName): string {
  const o = getOrg();
  return o.orgName[lang] || o.orgName.he || o.shortName || 'הארגון';
}

/** שם החותם בשפה מבוקשת. */
export function signerIn(lang: keyof LocalizedName): string {
  const o = getOrg();
  return o.signerName[lang] || o.signerName.he || '';
}

/** מוסיף את שם העיר לכתובת, לחיפוש במפות. */
export function withCity(address: string): string {
  const city = getOrg().city;
  if (!city) return address;
  return address.includes(city) ? address : `${address} ${city}`;
}

/**
 * מחזיר את התאריך האזרחי הנוכחי לפי אזור הזמן של הארגון.
 * חשוב במיוחד לזמני שבת: הדפדפן יכול להיות באזור זמן שונה מהמקום עצמו.
 */
function localDateParts(tzid: string): { year: number; month: number; day: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tzid,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(new Date());
    const value = (type: string) => Number(parts.find(part => part.type === type)?.value || 0);
    const year = value('year');
    const month = value('month');
    const day = value('day');
    if (year && month && day) return { year, month, day };
  } catch {
    // fallback למטה
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function isoDateUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/**
 * חלון מדויק של סוף השבוע הרלוונטי לפוסטר: שישי + שבת בלבד.
 * בשבת עצמה ממשיכים להציג את השבת הנוכחית; מיום ראשון עוברים לשישי הבא.
 */
function currentShabbatWindow(tzid: string): { start: string; end: string } {
  const local = localDateParts(tzid);
  const today = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const weekday = today.getUTCDay();

  let offsetToFriday: number;
  if (weekday === 6) offsetToFriday = -1; // שבת: השישי של אתמול
  else offsetToFriday = (5 - weekday + 7) % 7;

  const friday = new Date(today.getTime() + offsetToFriday * 86400000);
  const saturday = new Date(friday.getTime() + 86400000);
  return { start: isoDateUtc(friday), end: isoDateUtc(saturday) };
}

/**
 * בונה כתובת URL ל-Hebcal לפי מיקום הארגון.
 * endpoint: 'shabbat' | 'hebcal' | 'converter'
 */
export function hebcalUrl(endpoint: string, extra: Record<string, string | number> = {}): string {
  const o = getOrg();
  const params: Record<string, string | number> = {
    cfg: 'json',
    latitude: o.lat,
    longitude: o.lon,
    tzid: o.tzid,
    geo: 'pos',
    b: o.candleMinutes,
    ...extra,
  };

  let actualEndpoint = endpoint;

  // ה-/shabbat endpoint מחזיר לפעמים, בשבוע שיש בו חג, הבדלה ממועד קודם
  // יחד עם הדלקת הנרות של סוף השבוע הבא. המחולל לקח את הפריט הראשון מכל
  // סוג ולכן חיבר למשל את הדלקת הנרות של סוכות עם תאריך יום כיפור.
  // במקום לנסות לנחש מתוך רשימה מעורבת, עבור הפוסטר אנחנו מבקשים מה-calendar
  // endpoint *רק* את שישי ושבת הרלוונטיים. כך אין בכלל אירוע ישן שאפשר לבחור.
  if (endpoint === 'shabbat') {
    const window = currentShabbatWindow(o.tzid);
    actualEndpoint = 'hebcal';
    params.v = 1;
    params.start = window.start;
    params.end = window.end;
    params.c = 'on';
    params.s = 'on';
    params.maj = 'on';
    params.ss = 'on';
    params.mf = 'on';
    params.nx = 'on';
  }

  if (o.havdalahMinutes == null) params.M = 'on';
  else params.m = o.havdalahMinutes;
  if (o.israelHolidays) params.i = 'on';

  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `https://www.hebcal.com/${actualEndpoint}?${qs}`;
}
