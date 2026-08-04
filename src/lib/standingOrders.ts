// לוגיקה סביב הוראות קבע (הוק): חישוב סטטוס (פעילה / מסתיימת בקרוב / הסתיימה),
// סידור הרשימה כך שמה שדורש התייחסות עולה למעלה, וניהול תזכורת חודשית שמופיעה
// בדשבורד כדי לוודא שעוברים על הרשימה מדי חודש (חשוב במיוחד סביב קמפיין שבו
// המון הוראות קבע חדשות נפתחות, לצד ישנות שעומדות להסתיים).

export interface HkEntry {
  name: string;
  active: boolean;
  amount: number;
  remaining: number;
  lastBilled: string;
  [key: string]: any;
}

export type HkStatus = 'expired' | 'expiring' | 'active';

export function getHkStatus(hk: HkEntry, threshold: number): HkStatus {
  const remaining = Number(hk.remaining);
  if (!hk.active || !Number.isFinite(remaining) || remaining <= 0) return 'expired';
  if (remaining <= threshold) return 'expiring';
  return 'active';
}

export const HK_STATUS_LABEL: Record<HkStatus, string> = {
  expired: 'הסתיימה',
  expiring: 'מסתיימת בקרוב',
  active: 'פעילה',
};

export const HK_STATUS_COLOR: Record<HkStatus, string> = {
  expired: 'bg-gray-100 text-gray-500 border-gray-200',
  expiring: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// מסדר: קודם מי שיש לו כשל חיוב פתוח, אחר כך לפי דחיפות סטטוס
// (מסתיימת בקרוב > הסתיימה > פעילה), ולבסוף לפי כמה חיובים נותרו.
export function sortHkList(hk: HkEntry[], failNames: Set<string>, threshold: number): HkEntry[] {
  const statusOrder: Record<HkStatus, number> = { expiring: 0, expired: 1, active: 2 };
  return [...hk].sort((a, b) => {
    const aFail = failNames.has(a.name) ? 0 : 1;
    const bFail = failNames.has(b.name) ? 0 : 1;
    if (aFail !== bFail) return aFail - bFail;
    const sa = getHkStatus(a, threshold);
    const sb = getHkStatus(b, threshold);
    if (statusOrder[sa] !== statusOrder[sb]) return statusOrder[sa] - statusOrder[sb];
    return (Number(a.remaining) || 0) - (Number(b.remaining) || 0);
  });
}

export function countHkByStatus(hk: HkEntry[], threshold: number): Record<HkStatus, number> {
  const counts: Record<HkStatus, number> = { active: 0, expiring: 0, expired: 0 };
  hk.forEach(h => { counts[getHkStatus(h, threshold)]++; });
  return counts;
}

// ── תזכורת חודשית ────────────────────────────────────────────────────────────
// נשמר מקומית מתי בפעם האחרונה "סומן כנבדק" חודש נתון, כדי שהבאנר בדשבורד
// יופיע פעם אחת בכל חודש קלנדרי ולא בכל טעינה.

const REMINDER_KEY = 'hk_monthly_reminder_reviewed';

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}`;
}

export function isMonthlyReminderReviewed(): boolean {
  try {
    return localStorage.getItem(REMINDER_KEY) === currentMonthKey();
  } catch {
    return false;
  }
}

export function markMonthlyReminderReviewed(): void {
  try {
    localStorage.setItem(REMINDER_KEY, currentMonthKey());
  } catch {
    // localStorage לא זמין — לא קריטי
  }
}
