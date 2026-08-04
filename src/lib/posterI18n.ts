// ─────────────────────────────────────────────────────────────────────────────
// תרגומי הפוסטר השבועי.
//
// בגרסה המקורית הפוסטר היה כתוב רוסית קשיחה, כי הוא נועד לקהילה דוברת
// רוסית אחת. כאן כל מחרוזת יושבת במילון, והשפה נבחרת בהגדרות הארגון —
// כך שאותו עיצוב משרת קהילה בעברית, ברוסית או באנגלית.
//
// להוספת שפה: מוסיפים מפתח למילון POSTER_TEXT ומרחיבים את OrgConfig.posterLang.
// ─────────────────────────────────────────────────────────────────────────────

export type PosterLang = 'he' | 'ru' | 'en';

export interface PosterText {
  dir: 'rtl' | 'ltr';
  locale: string;
  /** כותרת ראשית, מפוצלת לשתי שורות מעוצבות */
  titleLine1: string;
  titleLine2: string;
  parashaPrefix: string;
  friday: string;
  saturday: string;
  candles: string;
  minchaEve: string;
  kabbalat: string;
  kiddushEve: string;
  chassidut: string;
  shacharit: string;
  minchaDay: string;
  nigunim: string;
  havdalah: string;
  tehillimTitle: string;
  kiddushWidget: string;
  kiddushWidgetSub: string;
  halachaClass: string;
  farewell: string;
  atVenue: (venue: string) => string;
  /** שמות החודשים הלועזיים */
  months: string[];
  /** תרגום שמות החודשים העבריים מהפורמט האנגלי של @hebcal */
  hebMonths: Record<string, string>;
}

const HEB_MONTHS_HE: Record<string, string> = {
  Nisan: 'ניסן', Iyyar: 'אייר', Sivan: 'סיוון', Tamuz: 'תמוז', Av: 'אב', Elul: 'אלול',
  Tishrei: 'תשרי', Cheshvan: 'חשוון', Kislev: 'כסלו', Tevet: 'טבת', "Sh'vat": 'שבט',
  'Adar I': 'אדר א׳', 'Adar II': 'אדר ב׳', Adar: 'אדר',
};

const HEB_MONTHS_RU: Record<string, string> = {
  Nisan: 'Нисан', Iyyar: 'Ияр', Sivan: 'Сиван', Tamuz: 'Тамуз', Av: 'Ав', Elul: 'Элул',
  Tishrei: 'Тишрей', Cheshvan: 'Хешван', Kislev: 'Кислев', Tevet: 'Тевет', "Sh'vat": 'Шват',
  'Adar I': 'Адар I', 'Adar II': 'Адар II', Adar: 'Адар',
};

const HEB_MONTHS_EN: Record<string, string> = {
  Nisan: 'Nisan', Iyyar: 'Iyyar', Sivan: 'Sivan', Tamuz: 'Tamuz', Av: 'Av', Elul: 'Elul',
  Tishrei: 'Tishrei', Cheshvan: 'Cheshvan', Kislev: 'Kislev', Tevet: 'Tevet', "Sh'vat": "Sh'vat",
  'Adar I': 'Adar I', 'Adar II': 'Adar II', Adar: 'Adar',
};

export const POSTER_TEXT: Record<PosterLang, PosterText> = {
  he: {
    dir: 'rtl',
    locale: 'he-IL',
    titleLine1: 'זמני',
    titleLine2: 'תפילה',
    parashaPrefix: 'פרשת',
    friday: 'יום שישי',
    saturday: 'שבת קודש',
    candles: 'הדלקת נרות',
    minchaEve: 'מנחה',
    kabbalat: 'קבלת שבת',
    kiddushEve: 'קידוש',
    chassidut: 'שיעור חסידות',
    shacharit: 'שחרית',
    minchaDay: 'מנחה',
    nigunim: 'סדר ניגונים',
    havdalah: 'צאת השבת',
    tehillimTitle: 'תהילים\n"שבת מברכים"',
    kiddushWidget: 'קידוש\nוהתוועדות',
    kiddushWidgetSub: 'לאחר תפילת שחרית',
    halachaClass: 'שיעור בהלכה',
    farewell: 'שבת שלום!',
    atVenue: v => `ב${v}`,
    months: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
    hebMonths: HEB_MONTHS_HE,
  },

  ru: {
    dir: 'ltr',
    locale: 'ru-RU',
    titleLine1: 'Время',
    titleLine2: 'молитв',
    parashaPrefix: 'Недельная глава:',
    friday: 'Пятница',
    saturday: 'Суббота',
    candles: 'Зажжение свечей',
    minchaEve: 'Минха',
    kabbalat: 'Кабалат Шабат',
    kiddushEve: 'Кидуш',
    chassidut: 'Урок Хасидут',
    shacharit: 'Шахарит',
    minchaDay: 'Минха',
    nigunim: 'Седер Нигуним',
    havdalah: 'Исход Шаббата',
    tehillimTitle: 'Теилим\n"Шабат Мевархим"',
    kiddushWidget: 'Кидуш и\nфарбренген',
    kiddushWidgetSub: 'после утренней молитвы',
    halachaClass: 'Урок по Аалахе',
    farewell: 'Шаббат шалом!',
    atVenue: v => `в синагоге «${v}»`,
    months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    hebMonths: HEB_MONTHS_RU,
  },

  en: {
    dir: 'ltr',
    locale: 'en-US',
    titleLine1: 'Shabbat',
    titleLine2: 'Times',
    parashaPrefix: 'Parashat',
    friday: 'Friday',
    saturday: 'Shabbat',
    candles: 'Candle Lighting',
    minchaEve: 'Mincha',
    kabbalat: 'Kabbalat Shabbat',
    kiddushEve: 'Kiddush',
    chassidut: 'Chassidut Class',
    shacharit: 'Shacharit',
    minchaDay: 'Mincha',
    nigunim: 'Seder Nigunim',
    havdalah: 'Shabbat Ends',
    tehillimTitle: 'Tehillim\n"Shabbat Mevarchim"',
    kiddushWidget: 'Kiddush &\nFarbrengen',
    kiddushWidgetSub: 'after morning prayers',
    halachaClass: 'Halacha Class',
    farewell: 'Shabbat Shalom!',
    atVenue: v => `at ${v}`,
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    hebMonths: HEB_MONTHS_EN,
  },
};

/** קוד השפה שמעבירים ל-Hebcal כדי לקבל את שם הפרשה מתורגם */
export const HEBCAL_LANG: Record<PosterLang, string> = { he: 'he', ru: 'ru', en: 'en' };
