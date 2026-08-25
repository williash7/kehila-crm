export type MonthCloseStatus = 'matched' | 'explained' | 'review';

export interface CashCount {
  id: string;
  label: string;
  computed: number;
  counted: number | null;
}

export interface MonthCloseDraft {
  month: string; // yyyy-MM
  computedOrgBalance: number;
  officialOrgBalance: number | null;
  cash: CashCount[];
  reimbursementDue: number;
  heldActivityCash: number;
  commitmentsDue: number;
  deferredChecksOut: number;
  deferredChecksIn: number;
  notes?: string;
  differencesExplained?: boolean;
}

export interface CashDifference extends CashCount {
  difference: number | null;
  matches: boolean;
}

export interface MonthCloseResult {
  month: string;
  complete: boolean;
  status: MonthCloseStatus;
  computedOrgBalance: number;
  officialOrgBalance: number | null;
  orgDifference: number | null;
  cash: CashDifference[];
  totalComputedCash: number;
  totalCountedCash: number | null;
  totalCashDifference: number | null;
  reimbursementDue: number;
  heldActivityCash: number;
  /** חיובי = הפעילות חייבת למשתמש; שלילי = המשתמש מחזיק כסף של הפעילות. */
  personalPosition: number;
  commitmentsDue: number;
  deferredChecksOut: number;
  deferredChecksIn: number;
  protectedOutgoing: number;
  notes: string;
}

export interface MonthClosureSnapshot extends MonthCloseResult {
  id: string;
  version: number;
  savedAt: string;
}

const amount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

const nonNegative = (value: unknown): number => Math.max(0, amount(value));
const sameMoney = (a: number, b: number): boolean => Math.abs(a - b) < 0.01;

/**
 * מחשב תמונת סגירת חודש בלי ליצור תנועת איזון ובלי לשנות היסטוריה.
 * הכנסות עתידיות מוצגות בנפרד ואינן מקטינות את הסכום שמחויב לצאת.
 */
export function calculateMonthClose(input: MonthCloseDraft): MonthCloseResult {
  const official = input.officialOrgBalance == null ? null : amount(input.officialOrgBalance);
  const computed = amount(input.computedOrgBalance);
  const cash = (input.cash || []).map(row => {
    const rowComputed = nonNegative(row.computed);
    const rowCounted = row.counted == null ? null : nonNegative(row.counted);
    return {
      id: String(row.id || ''),
      label: String(row.label || ''),
      computed: rowComputed,
      counted: rowCounted,
      difference: rowCounted == null ? null : amount(rowCounted - rowComputed),
      matches: rowCounted != null && sameMoney(rowCounted, rowComputed),
    };
  });

  const allCashCounted = cash.every(row => row.counted != null);
  const totalComputedCash = amount(cash.reduce((sum, row) => sum + row.computed, 0));
  const totalCountedCash = allCashCounted
    ? amount(cash.reduce((sum, row) => sum + (row.counted || 0), 0))
    : null;
  const orgDifference = official == null ? null : amount(official - computed);
  const totalCashDifference = totalCountedCash == null
    ? null
    : amount(totalCountedCash - totalComputedCash);
  const complete = official != null && allCashCounted;
  const matches = complete
    && sameMoney(orgDifference || 0, 0)
    && sameMoney(totalCashDifference || 0, 0);
  const notes = String(input.notes || '').trim();
  const status: MonthCloseStatus = matches
    ? 'matched'
    : complete && input.differencesExplained === true && !!notes
      ? 'explained'
      : 'review';

  const reimbursementDue = nonNegative(input.reimbursementDue);
  const heldActivityCash = nonNegative(input.heldActivityCash);
  const commitmentsDue = nonNegative(input.commitmentsDue);
  const deferredChecksOut = nonNegative(input.deferredChecksOut);
  const deferredChecksIn = nonNegative(input.deferredChecksIn);

  return {
    month: /^\d{4}-\d{2}$/.test(String(input.month || '')) ? String(input.month) : '',
    complete,
    status,
    computedOrgBalance: computed,
    officialOrgBalance: official,
    orgDifference,
    cash,
    totalComputedCash,
    totalCountedCash,
    totalCashDifference,
    reimbursementDue,
    heldActivityCash,
    personalPosition: amount(reimbursementDue - heldActivityCash),
    commitmentsDue,
    deferredChecksOut,
    deferredChecksIn,
    protectedOutgoing: amount(commitmentsDue + deferredChecksOut),
    notes,
  };
}

/** יוצר גרסה חדשה של תמונת הסגירה; גרסאות קודמות נשארות במערך. */
export function createMonthClosureSnapshot(
  input: MonthCloseDraft,
  previous: MonthClosureSnapshot[] = [],
  savedAt = new Date().toISOString(),
): MonthClosureSnapshot {
  const result = calculateMonthClose(input);
  const version = previous
    .filter(row => row.month === result.month)
    .reduce((max, row) => Math.max(max, Number(row.version) || 0), 0) + 1;
  return {
    ...result,
    id: `close:${result.month}:v${version}`,
    version,
    savedAt,
  };
}
