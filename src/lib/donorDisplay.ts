const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#C9A84C,#9B7A2F)',
  'linear-gradient(135deg,#4A2E8C,#2D1B69)',
  'linear-gradient(135deg,#059669,#047857)',
  'linear-gradient(135deg,#DC2626,#991B1B)',
  'linear-gradient(135deg,#2563EB,#1D4ED8)',
  'linear-gradient(135deg,#D97706,#92400E)',
];

/** צבע יציב לתמונת איש קשר, גם כאשר נתון ישן הגיע ללא שם. */
export function avatarGradient(value: unknown): string {
  const name = typeof value === 'string' ? value : '';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % AVATAR_GRADIENTS.length;
  }
  return AVATAR_GRADIENTS[Math.abs(hash)];
}

/** מונע מרשומה חלקית או פגומה להיכנס לרשימת אנשי הקשר ולשבור אותה. */
export function hasDisplayName(value: unknown): value is { name: string } {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as { name?: unknown }).name === 'string'
    && (value as { name: string }).name.trim().length > 0;
}
