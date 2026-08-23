export const NAV_ITEMS = [
  { id: 'home', label: 'דשבורד' },
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
export const MAX_BOTTOM_NAV_PRIMARY = 4;

const KNOWN_IDS = new Set<string>(DEFAULT_BOTTOM_NAV_ORDER);

/** שומר סדר ישן, מסיר מזהים שכבר אינם קיימים ומוסיף מסכים חדשים בסוף. */
export function normalizeBottomNavOrder(raw: unknown): NavItemId[] {
  const selected = Array.isArray(raw)
    ? raw.filter((id): id is NavItemId => typeof id === 'string' && KNOWN_IDS.has(id))
    : [];
  return Array.from(new Set([...selected, ...DEFAULT_BOTTOM_NAV_ORDER]));
}

/** עד ארבעה פריטים ישירים; כל השאר נשארים בתפריט „עוד”. */
export function normalizeBottomNavPrimary(raw: unknown, order?: NavItemId[]): NavItemId[] {
  const normalizedOrder = order || normalizeBottomNavOrder(undefined);
  const requested = Array.isArray(raw) ? raw : DEFAULT_BOTTOM_NAV_PRIMARY;
  const allowed = new Set<string>(normalizedOrder);
  return Array.from(new Set(requested.filter((id): id is NavItemId => typeof id === 'string' && allowed.has(id))))
    .slice(0, MAX_BOTTOM_NAV_PRIMARY);
}

export function availableNavigationItems(showFinanceCenter: boolean) {
  return NAV_ITEMS.filter(item => !('requiresFinance' in item) || !item.requiresFinance || showFinanceCenter);
}
