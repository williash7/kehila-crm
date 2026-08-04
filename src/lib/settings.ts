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
}

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
};

const STORAGE_KEY = 'app_settings_v1';

export function loadSettings(): AppSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...raw, visibleCircles: raw.visibleCircles || DEFAULT_SETTINGS.visibleCircles };
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
