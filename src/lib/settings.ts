import { HolidayVisibility, DEFAULT_VISIBILITY } from './holidayFilter';

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
  defaultTaskView: 'grouped' | 'flat' | 'calendar'; // תצוגת ברירת המחדל שנפתחת בטאב משימות
  holidayVisibility: HolidayVisibility; // אילו חגים ותאריכים מוצגים בלוח

  // ── מראה ────────────────────────────────────────────────────────────────
  // נשמר מקומית בלבד, כמו כל שאר ההגדרות. מכשיר אחר יכול להיראות אחרת —
  // וזה מכוון: מסך גדול בבית ומסך קטן בכיס אינם צריכים אותה צפיפות.
  theme: ThemeName;
  /** גימור: פינות, עובי גבול ועומק צל — נעים יחד */
  finish: FinishName;
  /** סרגל הניווט: כהה, בהיר, או בצבע ההדגשה */
  nav: NavName;
  /** עובי הקו של האייקונים, וכמה בולט הפריט הפעיל */
  icons: IconsName;
  /** שילוב הגופנים */
  font: FontName;
  uiSize: 'small' | 'normal' | 'large' | 'xlarge';
  density: 'compact' | 'normal' | 'roomy';
  graphics: boolean;
  /** אילו כרטיסים מוצגים בדשבורד, ובאיזה סדר. ריק = ברירת המחדל. */
  dashboardCards: string[];
}

export type ThemeName =
  | 'classic' | 'clean' | 'warm' | 'olive' | 'dark' | 'contrast'
  | 'bordeaux' | 'sky' | 'mono' | 'earth' | 'midnight' | 'jerusalem';

export type FinishName = 'soft' | 'sharp' | 'defined' | 'float';
export type NavName    = 'dark' | 'light' | 'color';
export type IconsName  = 'thin' | 'normal' | 'bold';
export type FontName   = 'classic' | 'modern' | 'native';

export const THEMES: { id: ThemeName; label: string; hint: string; swatch: string[] }[] = [
  { id: 'classic',  label: 'כחול־זהב',      hint: 'הערכה המקורית',            swatch: ['#0D1B2A', '#C9A84C', '#FAF6EE'] },
  { id: 'clean',    label: 'בהיר ונקי',      hint: 'פחות חום, יותר ניגודיות',  swatch: ['#1E293B', '#2563EB', '#F8FAFC'] },
  { id: 'warm',     label: 'חם',             hint: 'קרם וטרקוטה',              swatch: ['#44281D', '#C2703D', '#FDF6EF'] },
  { id: 'olive',    label: 'ירוק זית',       hint: 'רגוע, פחות רשמי',          swatch: ['#1F2D24', '#6B8E4E', '#F6F8F3'] },
  { id: 'dark',     label: 'כהה',            hint: 'לעבודה בערב',              swatch: ['#0B1220', '#E0B94F', '#1B2434'] },
  { id: 'contrast', label: 'ניגודיות גבוהה', hint: 'לקריאה קלה יותר',          swatch: ['#000000', '#B45309', '#FFFFFF'] },
  { id: 'bordeaux', label: 'בורדו־זהב',    hint: 'עמוק וחגיגי',              swatch: ['#3D0F1B', '#C0A062', '#FBF5F2'] },
  { id: 'sky',      label: 'תכלת־כסף',     hint: 'קריר, בלי חום',            swatch: ['#16323F', '#3E92B8', '#F4F9FB'] },
  { id: 'mono',     label: 'שחור־זהב',     hint: 'מינימלי ומדויק',           swatch: ['#111111', '#B99537', '#FAFAFA'] },
  { id: 'earth',    label: 'אדמה',          hint: 'חול וחמרה',                swatch: ['#33322A', '#A8763E', '#FAF7F0'] },
  { id: 'midnight', label: 'לילה כחול',     hint: 'כהה, אך לא שחור',          swatch: ['#0B1526', '#7FA6E8', '#1B2740'] },
  { id: 'jerusalem',label: 'ירושלים',       hint: 'אבן ירושלמית וזהב',        swatch: ['#3D3427', '#B8873B', '#FBF7EF'] },
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

export const NAVS: { id: NavName; label: string; hint: string }[] = [
  { id: 'dark',  label: 'כהה',    hint: 'הסרגל מנוגד למסך' },
  { id: 'light', label: 'בהיר',   hint: 'הסרגל ממשיך את המסך' },
  { id: 'color', label: 'צבעוני', hint: 'הסרגל בצבע ההדגשה' },
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
  defaultTaskView: 'grouped',
  holidayVisibility: DEFAULT_VISIBILITY,
  theme: 'classic',
  finish: 'float',
  nav: 'dark',
  icons: 'thin',
  font: 'classic',
  uiSize: 'normal',
  density: 'normal',
  graphics: true,
  dashboardCards: [],
};

const STORAGE_KEY = 'app_settings_v1';

export function loadSettings(): AppSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      visibleCircles: raw.visibleCircles || DEFAULT_SETTINGS.visibleCircles,
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
