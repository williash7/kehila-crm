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

/** מחזיר את גבולות הטווח שנבחר בדשבורד. שבוע בישראל: ראשון–שבת. */
export function dashboardDonationDateRange(
  period: DonationDashboardPeriod,
  rangeStart = '',
  now = new Date(),
  rangeEnd = '',
): { from: Date; to: Date } | null {
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rangeStart)) return null;
    const [year, month, day] = rangeStart.split('-').map(Number);
    from = new Date(year, month - 1, day);
    if (localIsoDate(from) !== rangeStart) return null;
    if (rangeEnd && /^\d{4}-\d{2}-\d{2}$/.test(rangeEnd)) {
      const [endYear, endMonth, endDay] = rangeEnd.split('-').map(Number);
      to = new Date(endYear, endMonth - 1, endDay);
      if (localIsoDate(to) !== rangeEnd) return null;
    } else {
      to = new Date(today);
    }
    if (from > to) [from, to] = [to, from];
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

/** מסנן את כל נתוני כרטיס התרומות לאותו טווח. */
export function filterDonationsForDashboard<T extends { date?: string }>(
  donations: T[],
  period: DonationDashboardPeriod,
  rangeStart = '',
  now = new Date(),
  rangeEnd = '',
): T[] {
  const range = dashboardDonationDateRange(period, rangeStart, now, rangeEnd);
  if (!range) return [];
  return donations.filter(donation => {
    const date = parseDdMmYyyy(donation.date);
    return !!date && date >= range.from && date <= range.to;
  });
}

/** החדשות ביותר ראשונות; באותו יום הרשומה שהגיעה מאוחר יותר למערך קודמת. */
export function recentDonationsFirst<T extends { date?: string }>(donations: T[], limit = 5): T[] {
  return donations
    .map((donation, index) => {
      const parsed = parseDdMmYyyy(donation.date);
      return { donation, index, time: parsed ? parsed.getTime() : -Infinity };
    })
    .sort((a, b) => b.time - a.time || b.index - a.index)
    .slice(0, Math.max(0, limit))
    .map(item => item.donation);
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
