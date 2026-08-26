export const NAV_ITEMS = [
  { id: 'home', label: 'דשבורד' },
  { id: 'search', label: 'חיפוש' },
  { id: 'inbox', label: 'קליטה' },
  { id: 'tasks', label: 'משימות' },
  { id: 'score', label: 'מעקב קשר' },
  { id: 'donors', label: 'אנשי קשר' },
  { id: 'homevisits', label: 'ביקורי בית' },
  { id: 'donations', label: 'תרומות' },
  { id: 'finance', label: 'כספים', requiresFinance: true },
  { id: 'events', label: 'פעילויות' },
  { id: 'projects', label: 'קמפיינים' },
  { id: 'calendar', label: 'לוח שנה' },
  { id: 'dates', label: 'תאריכים' },
  { id: 'history', label: 'היסטוריה' },
  { id: 'reports', label: 'דוחות' },
  { id: 'poster', label: 'פוסטר שבת' },
  { id: 'guide', label: 'מדריך' },
  { id: 'settings', label: 'הגדרות' },
] as const;

export type NavItemId = typeof NAV_ITEMS[number]['id'];

export const DEFAULT_BOTTOM_NAV_ORDER: NavItemId[] = NAV_ITEMS.map(item => item.id);
export const DEFAULT_BOTTOM_NAV_PRIMARY: NavItemId[] = ['home', 'tasks', 'donors', 'donations'];

const KNOWN_IDS = new Set<string>(DEFAULT_BOTTOM_NAV_ORDER);

/** שומר סדר ישן, מסיר מזהים שכבר אינם קיימים ומוסיף מסכים חדשים בסוף. */
export function normalizeBottomNavOrder(raw: unknown): NavItemId[] {
  const selected = Array.isArray(raw)
    ? raw.filter((id): id is NavItemId => typeof id === 'string' && KNOWN_IDS.has(id))
    : [];
  return Array.from(new Set([...selected, ...DEFAULT_BOTTOM_NAV_ORDER]));
}

/** כל פריט שנבחר מופיע ישירות; כל השאר נשארים בתפריט „עוד”. */
export function normalizeBottomNavPrimary(raw: unknown, order?: NavItemId[]): NavItemId[] {
  const normalizedOrder = order || normalizeBottomNavOrder(undefined);
  const requested = Array.isArray(raw) ? raw : DEFAULT_BOTTOM_NAV_PRIMARY;
  const allowed = new Set<string>(normalizedOrder);
  return Array.from(new Set(requested.filter((id): id is NavItemId => typeof id === 'string' && allowed.has(id))));
}

/**
 * כל מסכי הניווט.
 *
 * ── למה אין כאן יותר תנאי ──
 *
 * למרכז הכספי היה מתג הפעלה נפרד בהגדרות, ולבקרת התשלומים מתג משלה. אשר
 * שאל את השאלה הנכונה: **„מה ההבדל בינו לשאר הפונקציות?”**
 *
 * לא היה הבדל. הם נוצרו כבויים כדי לא להעמיס כשנוספו, ומאז נבנה מנגנון
 * כללי — הגדרות ← ניווט — שמאפשר להסתיר ולסדר **כל** מסך. שני המתגים היו
 * כפולים לו, ויצרו חוסר עקביות: אפשר היה לכבות כספים ולא דוחות.
 *
 * מקום אחד להסתרה, לא שניים.
 */
export function availableNavigationItems(_legacyUnused?: boolean) {
  return NAV_ITEMS;
}
