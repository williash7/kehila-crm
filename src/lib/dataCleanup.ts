import type { Donation } from '../types';
import { parseDdMmYyyy } from './dateUtils';
import {
  cancelTransaction,
  normalizeFinanceData,
  type FinanceData,
  type FinanceTransaction,
} from './finance';

export type DonationSourceGroup = 'email' | 'manual' | 'import' | 'standing' | 'other';
export type FinanceDirectionFilter = 'all' | 'income' | 'expense';

export const DONATION_SOURCE_LABEL: Record<DonationSourceGroup, string> = {
  email: 'נקלטו ממייל',
  manual: 'הוכנסו ידנית',
  import: 'יובאו מקובץ',
  standing: 'חיובי הוראות קבע',
  other: 'מקור אחר או לא ידוע',
};

export function donationSourceGroup(donation: Pick<Donation, 'id' | 'source'>): DonationSourceGroup {
  const id = String(donation.id || '').trim().toLowerCase();
  const source = String(donation.source || '').trim().toLowerCase();
  if (id.startsWith('hk:') || source.includes('הוראת קבע')) return 'standing';
  if (source.includes('מייל')) return 'email';
  if (source.includes('ידני')) return 'manual';
  if (source.includes('ייבוא') || source.includes('יבוא') || source.includes('import')) return 'import';
  return 'other';
}

function inDateRange(value: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const date = parseDdMmYyyy(value);
  if (!date) return false;
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return (!from || iso >= from) && (!to || iso <= to);
}

export function filterDonationsForCleanup(
  donations: Donation[],
  filter: { source: DonationSourceGroup | 'all'; from: string; to: string },
): Donation[] {
  return donations.filter(donation => {
    if (!donation.id || !(Number(donation.amount) > 0)) return false;
    if (filter.source !== 'all' && donationSourceGroup(donation) !== filter.source) return false;
    return inDateRange(donation.date, filter.from, filter.to);
  });
}

const INCOME_KINDS = new Set(['income', 'cash_income', 'settlement_to_org']);

export function financeDirection(transaction: FinanceTransaction): 'income' | 'expense' {
  return INCOME_KINDS.has(transaction.kind) ? 'income' : 'expense';
}

export function filterFinanceForCleanup(
  transactions: FinanceTransaction[],
  filter: {
    source: 'all' | 'manual' | 'import';
    direction: FinanceDirectionFilter;
    from: string;
    to: string;
  },
): FinanceTransaction[] {
  return transactions.filter(transaction => {
    if (transaction.status === 'cancelled') return false;
    if (filter.source !== 'all' && transaction.source !== filter.source) return false;
    if (filter.direction !== 'all' && financeDirection(transaction) !== filter.direction) return false;
    return inDateRange(transaction.date, filter.from, filter.to);
  });
}

export function cancelFinanceTransactions(
  value: FinanceData,
  ids: Iterable<string>,
): { data: FinanceData; cancelled: number } {
  let data = normalizeFinanceData(value);
  let cancelled = 0;
  new Set(ids).forEach(id => {
    const before = data.transactions.find(transaction => transaction.id === id);
    if (!before || before.status === 'cancelled') return;
    data = cancelTransaction(data, id);
    cancelled++;
  });
  return { data, cancelled };
}
