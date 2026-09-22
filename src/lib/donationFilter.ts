// עוזרי סינון וחישוב לתרומות לפי "תאריך התחלה" גלובלי שנקבע בהגדרות
// (settings.donationsSinceDate, פורמט ISO "yyyy-MM-dd", מחרוזת ריקה = כל הזמנים).
// נועד לשמש בכל מקום שמציג "סה"כ תרומות" — דשבורד, אנשי קשר, דוחות, תרומות —
// כדי שכולם ישקפו את אותו טווח תאריכים באופן עקבי.

import { parseDdMmYyyy } from './dateUtils';
import { Donation } from '../types';

export function isDonationSince(dateStr: string | undefined | null, sinceIso: string): boolean {
  if (!sinceIso) return true;
  const d = parseDdMmYyyy(dateStr);
  if (!d) return true; // תאריך שלא ניתן לפענוח — לא מסננים כדי לא "לאבד" רשומות
  const since = new Date(sinceIso);
  if (isNaN(since.getTime())) return true;
  since.setHours(0, 0, 0, 0);
  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);
  return dd.getTime() >= since.getTime();
}

export function filterDonationsSince<T extends { date?: string }>(donations: T[], sinceIso: string): T[] {
  if (!sinceIso) return donations;
  return donations.filter(d => isDonationSince(d?.date, sinceIso));
}

export interface SinceSummary {
  total: number;
  thisMonthTotal: number;
  donorCount: number;
  byMethod: Record<string, number>;
}

export type DonationDashboardPeriod = 'today' | 'week' | 'month' | 'year' | 'date';

function localIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** מסנן את כל נתוני כרטיס התרומות לאותו טווח. שבוע בישראל: ראשון–שבת. */
export function filterDonationsForDashboard<T extends { date?: string }>(
  donations: T[],
  period: DonationDashboardPeriod,
  specificDate = '',
  now = new Date(),
): T[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from = new Date(today);
  let to = new Date(today);

  if (period === 'week') {
    from.setDate(today.getDate() - today.getDay());
    to.setDate(from.getDate() + 6);
  } else if (period === 'month') {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
    to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (period === 'year') {
    from = new Date(today.getFullYear(), 0, 1);
    to = new Date(today.getFullYear(), 11, 31);
  } else if (period === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(specificDate)) return [];
    const [year, month, day] = specificDate.split('-').map(Number);
    from = new Date(year, month - 1, day);
    to = new Date(from);
    if (localIsoDate(from) !== specificDate) return [];
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return donations.filter(donation => {
    const date = parseDdMmYyyy(donation.date);
    return !!date && date >= from && date <= to;
  });
}

// מחשב תקציר (סה"כ, החודש, מס' תורמים, לפי אפיק) מרשימת התרומות הגולמית,
// עבור טווח תאריכים נתון. amount<=0 (רשומות "מפגש") לא נספרות בסכום.
export function computeSummarySince(donations: Donation[], sinceIso: string): SinceSummary {
  const filtered = filterDonationsSince(donations, sinceIso);
  const donorSet = new Set<string>();
  const byMethod: Record<string, number> = {};
  const now = new Date();
  let total = 0;
  let thisMonthTotal = 0;

  filtered.forEach((d: any) => {
    const amt = d.amount || 0;
    if (amt <= 0) return;
    total += amt;
    if (d.name) donorSet.add(d.name);
    if (d.method) byMethod[d.method] = (byMethod[d.method] || 0) + amt;
    const dt = parseDdMmYyyy(d.date);
    if (dt && dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth()) {
      thisMonthTotal += amt;
    }
  });

  return { total, thisMonthTotal, donorCount: donorSet.size, byMethod };
}

// סכום התרומות של תורם בודד בטווח התאריכים הנתון (או סה"כ ההיסטוריה אם אין טווח).
export function computeDonorTotalSince(donorDonations: Donation[] | undefined, sinceIso: string): number {
  const list = donorDonations || [];
  return filterDonationsSince(list, sinceIso).reduce((s, d: any) => s + (d.amount || 0), 0);
}
