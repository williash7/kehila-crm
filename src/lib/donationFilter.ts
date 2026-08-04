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
