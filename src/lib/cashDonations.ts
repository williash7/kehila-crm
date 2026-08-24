import { CashDestination } from '../types';

export const CASH_DESTINATION_OPTIONS: { value: CashDestination; label: string; hint: string }[] = [
  { value: 'org_account', label: 'הופקד בחשבון העמותה', hint: 'זמין בחשבון העמותה' },
  { value: 'personal', label: 'נמצא אצלי', hint: 'מזומן של הפעילות שמוחזק אצלי' },
  { value: 'activity_cashbox', label: 'בקופת הפעילות', hint: 'זמין לפעילות במזומן' },
  { value: 'unclassified', label: 'עדיין לא סווג', hint: 'לא ייכלל ביתרה עד לבירור' },
];

export function cleanPaymentMethod(value: unknown): string {
  return String(value || '').replace(/^[^\p{L}\p{N}]+\s*/u, '').trim();
}

export function isCashPaymentMethod(value: unknown): boolean {
  return cleanPaymentMethod(value).includes('מזומן');
}

export function cashDestinationLabel(value: unknown): string {
  return CASH_DESTINATION_OPTIONS.find(option => option.value === value)?.label || 'לפי ברירת המחדל בהגדרות';
}

export function normalizeCashDestination(value: unknown): CashDestination | undefined {
  return CASH_DESTINATION_OPTIONS.some(option => option.value === value) ? value as CashDestination : undefined;
}
