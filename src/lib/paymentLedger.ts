import { parseDdMmYyyy } from './dateUtils';

export type PaymentStatus = 'received' | 'future' | 'failed' | 'cancelled';

export interface PaymentLedgerRow {
  id: string;
  name: string;
  date: string;
  amount: number;
  purpose?: string;
  method?: string;
  notes?: string;
  source?: string;
  status: PaymentStatus;
  rawStatus?: string;
  orderId?: string;
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  received: 'התקבל',
  future: 'עתידי',
  failed: 'נכשל',
  cancelled: 'מבוטל',
};

export const PAYMENT_STATUS_COLOR: Record<PaymentStatus, string> = {
  received: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  future: 'bg-slate-50 text-slate-600 border-slate-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

export interface PaymentStatusSummary {
  count: number;
  total: number;
}

export function monthKey(date: string): string {
  const d = parseDdMmYyyy(date);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function filterPaymentRows(
  rows: PaymentLedgerRow[],
  options: { status?: PaymentStatus | 'all'; search?: string; month?: string } = {},
): PaymentLedgerRow[] {
  const q = String(options.search || '').trim().toLowerCase();
  return rows.filter(row => {
    if (options.status && options.status !== 'all' && row.status !== options.status) return false;
    if (options.month && monthKey(row.date) !== options.month) return false;
    if (q && !`${row.name} ${row.id} ${row.orderId || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function summarizePaymentRows(rows: PaymentLedgerRow[]): Record<PaymentStatus, PaymentStatusSummary> {
  const result: Record<PaymentStatus, PaymentStatusSummary> = {
    received: { count: 0, total: 0 },
    future: { count: 0, total: 0 },
    failed: { count: 0, total: 0 },
    cancelled: { count: 0, total: 0 },
  };
  rows.forEach(row => {
    const status: PaymentStatus = result[row.status] ? row.status : 'received';
    result[status].count++;
    result[status].total += Number(row.amount) || 0;
  });
  return result;
}

