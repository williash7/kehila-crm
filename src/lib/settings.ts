import { HolidayVisibility, DEFAULT_VISIBILITY } from './holidayFilter';
import {
  DEFAULT_BOTTOM_NAV_ORDER, DEFAULT_BOTTOM_NAV_PRIMARY, NavItemId,
  normalizeBottomNavOrder, normalizeBottomNavPrimary,
} from './navigation';

// הגדרות תצוגה גלובליות: אילו אנשי קשר להציג ברחבי האפליקציה (רשימת אנשי
// קשר, המלצות ליצירת קשר בדשבורד, הזמנות לחג, נוכחות באירועים, טבלת
// התורמים המובילים בדוחות). לא משפיע על סכומי הכסף/דוחות כספיים (אלה
// מגיעים ישירות מהגיליון) ולא על מסכי "הוסף תרומה/מפגש" (שם תמיד רוצים
// למצוא כל איש קשר, גם אם הוא מסונן מהתצוגה).

export interface AppSettings {
  visibleCircles: string[]; // 'close' | 'approach' | 'third' | 'far' | 'none' (ללא מעגל מוגדר)
  addressOnly: boolean;
  phoneOnly: boolean;
  donorsOnly: boolean; // רק מי שתרם בפועל לפחות פעם אחת
  targetOnly: boolean; // רק מסומנים "🎯 להקרב"
  fbPageId: string;      // מזהה דף הפייסבוק
  fbAccessToken: string; // טוקן גישה לדף
  hkExpiringThreshold: number; // כמה חיובים נותרו כדי לסמן הוראת קבע כ"מסתיימת בקרוב"
  donationsSinceDate: string; // ISO "yyyy-MM-dd" — מציגים סכומי תרומות רק מתאריך זה ואילך. '' = כל הזמנים.
  showPaymentStatuses: boolean; // מציג טאב בקרה נפרד; אינו משנה סכומים או נתונים
  showFinanceCenter: boolean; // מרכז כספי נפרד; כבוי כברירת מחדל כדי לשמור על ממשק נקי
  dailyReminderEnabled: boolean; // תזכורת מקומית למכשיר; הרשאה והזמן הם בחירה מפורשת
  dailyReminderTime: string; // HH:mm, נבדק כשהאפליקציה פעילה/מתעוררת
  defaultTaskView: 'grouped' | 'flat' | 'calendar'; // תצוגת ברירת המחדל שנפתחת בטאב משימות
  holidayVisibility: HolidayVisibility; // אילו חגים ותאריכים מוצגים בלוח

  // ── מראה ────────────────────────────────────────────────────────────────
  // נשמר מקומית בלבד, כמו כל שאר ההגדרות. מכשיר אחר יכול להיראות אחרת —
  // וזה מכוון: מסך גדול בבית ומסך קטן בכיס אינם צריכים אותה צפיפות.
  theme: ThemeName;
  /** גימור: פינות, עובי גבול ועומק צל — נעים יחד */
  finish: FinishName;
  /**
   * המשטחים הכהים: הסרגל, הפס העליון, הכפתורים הראשיים והכרטיסים הכהים.
   * כולם יחד — הם ממלאים את אותו תפקיד, וסרגל בהיר לצד פס עליון כחול
   * הוא לא בחירה אלא אי-עקביות.
   */
  surface: SurfaceName;
  /** עובי הקו של האייקונים, וכמה בולט הפריט הפעיל */
  icons: IconsName;
  /** שילוב הגופנים */
  font: FontName;
  uiSize: 'small' | 'normal' | 'large' | 'xlarge';
  density: 'compact' | 'normal' | 'roomy';
  graphics: boolean;
  /** אילו כרטיסים מוצגים בדשבורד, ובאיזה סדר. ריק = ברירת המחדל. */
  dashboardCards: string[];
  /** סדר כל המסכים בניווט הטלפון; מי שלא נבחר לסרגל מופיע תחת „עוד”. */
  bottomNavOrder: NavItemId[];
  /** המסכים שמופיעים ישירות בסרגל התחתון; אין מגבלת כמות. */
  bottomNavPrimary: NavItemId[];
}

export type ThemeName =
  | 'classic' | 'clean' | 'warm' | 'olive' | 'dark' | 'contrast'
  | 'bordeaux' | 'sky' | 'mono' | 'plum' | 'midnight' | 'jerusalem';

export type FinishName = 'soft' | 'sharp' | 'defined' | 'float';
export type SurfaceName = 'auto' | 'dark' | 'light' | 'color';
export type IconsName  = 'thin' | 'normal' | 'bold';
export type FontName   = 'classic' | 'modern' | 'native';

export const THEMES: { id: ThemeName; label: string; hint: string; swatch: string[] }[] = [
  { id: 'classic',  label: 'כחול־זהב',      hint: 'הערכה המקורית',            swatch: ['#0D1B2A', '#C9A84C', '#FAF6EE'] },
  { id: 'clean',    label: 'בהיר ונקי',    hint: 'סרגל לבן, כחול',           swatch: ['#FFFFFF', '#2563EB', '#F1F5F9'] },
  { id: 'warm',     label: 'חם',           hint: 'טרקוטה מלאה',              swatch: ['#A6461A', '#D2691E', '#FEF6EE'] },
  { id: 'olive',    label: 'ירוק',         hint: 'סרגל ירוק רווי',           swatch: ['#33691E', '#558B2F', '#F4F8EF'] },
  { id: 'dark',     label: 'כהה',            hint: 'לעבודה בערב',              swatch: ['#0B1220', '#E0B94F', '#1B2434'] },
  { id: 'contrast', label: 'ניגודיות',     hint: 'שחור־לבן־ענבר',            swatch: ['#000000', '#FFB300', '#FFFFFF'] },
  { id: 'bordeaux', label: 'בורדו',        hint: 'יין עמוק ורווי',           swatch: ['#6B1030', '#A81D46', '#FDF3F6'] },
  { id: 'sky',      label: 'תכלת',         hint: 'טורקיז, סרגל צבעוני',      swatch: ['#06697F', '#0891B2', '#EFFAFC'] },
  { id: 'mono',     label: 'שחור־לבן',     hint: 'סרגל לבן, בלי צבע',        swatch: ['#FFFFFF', '#111111', '#F4F4F4'] },
  { id: 'plum',     label: 'סגול',          hint: 'הכי רחוק מהמקורי',         swatch: ['#4C1D95', '#7C3AED', '#F7F4FE'] },
  { id: 'midnight', label: 'לילה כחול',     hint: 'כהה, אך לא שחור',          swatch: ['#0B1526', '#7FA6E8', '#1B2740'] },
  { id: 'jerusalem',label: 'ירושלים',      hint: 'סרגל אבן בהיר',            swatch: ['#F0E4C8', '#B8873B', '#FBF6EA'] },
];

// ── הצירים הנוספים ────────────────────────────────────────────────────────
//
// כל ציר עונה על שאלה אחרת, וכולם מצטרפים זה לזה: ערכה כהה עם גימור חד
// ואייקונים דקים היא בחירה חוקית, ואיש לא צריך להכין אותה מראש.

export const FINISHES: { id: FinishName; label: string; hint: string }[] = [
  { id: 'float',   label: 'מרחף',  hint: 'בלי גבול, עם עומק' },
  { id: 'soft',    label: 'רך',    hint: 'פינות גדולות, גבול עדין' },
  { id: 'defined', label: 'מוגדר', hint: 'גבול עבה, בלי צל' },
  { id: 'sharp',   label: 'חד',    hint: 'פינות ישרות, טבלאי' },
];

export const SURFACES: { id: SurfaceName; label: string; hint: string }[] = [
  { id: 'auto',  label: 'לפי הערכה', hint: 'כל ערכה והמבנה שלה' },
  { id: 'dark',  label: 'כהים',      hint: 'מנוגדים לתוכן' },
  { id: 'light', label: 'בהירים',    hint: 'ממשיכים את המסך' },
  { id: 'color', label: 'צבעוניים',  hint: 'בצבע ההדגשה' },
];

export const ICON_STYLES: { id: IconsName; label: string; hint: string }[] = [
  { id: 'thin',   label: 'דק',   hint: 'קווים עדינים, סימון פס' },
  { id: 'normal', label: 'רגיל', hint: 'סימון ברקע מלא' },
  { id: 'bold',   label: 'עבה',  hint: 'ברור במסך קטן' },
];

export const FONTS: { id: FontName; label: string; hint: string }[] = [
  { id: 'classic', label: 'קלאסי',  hint: 'כותרות מסורתיות' },
  { id: 'modern',  label: 'מודרני', hint: 'גופן אחד, נקי' },
  { id: 'native',  label: 'ניטרלי', hint: 'גופן המכשיר' },
];

export const UI_SIZES: { id: AppSettings['uiSize']; label: string }[] = [
  { id: 'small',  label: 'קטן' },
  { id: 'normal', label: 'רגיל' },
  { id: 'large',  label: 'גדול' },
  { id: 'xlarge', label: 'גדול מאוד' },
];

export const DENSITIES: { id: AppSettings['density']; label: string; hint: string }[] = [
  { id: 'compact', label: 'צפוף',  hint: 'יותר שורות במסך' },
  { id: 'normal',  label: 'רגיל',  hint: '' },
  { id: 'roomy',   label: 'מרווח', hint: 'יותר אוויר' },
];

export { DEFAULT_VISIBILITY };

export const ALL_CIRCLES = ['close', 'approach', 'third', 'far', 'none'];

export const CIRCLE_LABELS: Record<string, string> = {
  close: '⭐ קרוב',
  approach: '🔄 מתקרב',
  third: '⭕ מעגל שלישי',
  far: '○ רחוק',
  none: '— ללא מעגל',
};

export const DEFAULT_SETTINGS: AppSettings = {
  visibleCircles: [...ALL_CIRCLES],
  addressOnly: false,
  phoneOnly: false,
  donorsOnly: false,
  targetOnly: false,
  fbPageId: '',
  fbAccessToken: '',
  hkExpiringThreshold: 2,
  donationsSinceDate: '',
  showPaymentStatuses: false,
  showFinanceCenter: false,
  dailyReminderEnabled: false,
  dailyReminderTime: '08:00',
  defaultTaskView: 'grouped',
  holidayVisibility: DEFAULT_VISIBILITY,
  theme: 'classic',
  finish: 'float',
  surface: 'auto',
  icons: 'thin',
  font: 'classic',
  uiSize: 'normal',
  density: 'normal',
  graphics: true,
  dashboardCards: [],
  bottomNavOrder: [...DEFAULT_BOTTOM_NAV_ORDER],
  bottomNavPrimary: [...DEFAULT_BOTTOM_NAV_PRIMARY],
};

const STORAGE_KEY = 'app_settings_v1';

export function loadSettings(): AppSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const bottomNavOrder = normalizeBottomNavOrder(raw.bottomNavOrder);
    let bottomNavPrimary = normalizeBottomNavPrimary(raw.bottomNavPrimary, bottomNavOrder);

    // ── הגירה: המתג של המרכז הכספי בוטל ──
    //
    // מי שהיה לו כבוי לא צריך לגלות פתאום מסך חדש בסרגל. מוציאים את
    // „כספים” מהכפתורים הראשיים — הוא עדיין נגיש תחת „עוד”, וניתן להחזיר
    // אותו בהגדרות ← ניווט.
    //
    // ההגירה רצה **פעם אחת בלבד**: אחריה `showFinanceCenter` נמחק, כך
    // שמי שיחזיר את המסך ידנית לא ימצא אותו מוסתר שוב בטעינה הבאה.
    if (raw.showFinanceCenter === false) {
      bottomNavPrimary = bottomNavPrimary.filter(id => id !== 'finance');
      delete raw.showFinanceCenter;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...raw, bottomNavPrimary }));
      } catch { /* הגירת נוחות — לא חוסמת טעינה */ }
    }

    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      // הציר נקרא פעם "nav" ונגע רק בסרגל. מי שכבר בחר בו לא צריך
      // לגלות שהבחירה נעלמה כי שינינו שם.
      surface: raw.surface || raw.nav || DEFAULT_SETTINGS.surface,
      visibleCircles: raw.visibleCircles || DEFAULT_SETTINGS.visibleCircles,
      bottomNavOrder,
      bottomNavPrimary,
      // מיזוג עמוק: קטגוריה שנוספה בגרסה חדשה מקבלת את ברירת המחדל שלה
      // במקום להיעלם כי ההגדרות השמורות לא הכירו אותה.
      holidayVisibility: {
        categories: { ...DEFAULT_VISIBILITY.categories, ...(raw.holidayVisibility?.categories || {}) },
        hiddenNames: raw.holidayVisibility?.hiddenNames || DEFAULT_VISIBILITY.hiddenNames,
      },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage לא זמין — לא קריטי, ההגדרות פשוט לא יישמרו בין ביקורים
  }
}

function hasAddress(donor: any): boolean {
  return !!String(donor?.['כתובת'] || '').trim();
}

function hasPhone(donor: any, crmData: any): boolean {
  return !!String(crmData?.phone || donor?.['טלפון'] || '').trim();
}

function hasDonated(donor: any): boolean {
  return (donor?.total || 0) > 0 || (donor?.donations?.length || 0) > 0;
}

// מסנן מפת אנשי קשר לפי הגדרות התצוגה. משמש בכל מקום שבו מציגים/דפדפים
// ברשימת אנשי קשר (לא במקומות שבהם צריך למצוא כל אחד, כמו הוספת תרומה).
export function filterDonorsBySettings<T extends Record<string, any>>(
  donors: Record<string, T>,
  crm: Record<string, any>,
  settings: AppSettings
): Record<string, T> {
  const result: Record<string, T> = {};
  Object.keys(donors).forEach(name => {
    const donor = donors[name];
    const crmData = crm[name] || {};
    const circle = crmData.circle || 'none';
    if (!settings.visibleCircles.includes(circle)) return;
    if (settings.addressOnly && !hasAddress(donor)) return;
    if (settings.phoneOnly && !hasPhone(donor, crmData)) return;
    if (settings.donorsOnly && !hasDonated(donor)) return;
    if (settings.targetOnly && !crmData.target) return;
    result[name] = donor;
  });
  return result;
}
