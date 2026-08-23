import { Donation } from '../types';

export type FinanceStatus = 'actual' | 'committed' | 'expected' | 'cancelled';
export type FinanceKind =
  | 'income'
  | 'expense'
  | 'cash_income'
  | 'personal_expense'
  | 'salary'
  | 'settlement_to_me'
  | 'settlement_to_org';
export type FinanceScopeType = 'general' | 'event' | 'holiday' | 'project';

export interface FinanceAllocation {
  id: string;
  label: string;
  amount: number;
}

export interface FinanceRevision {
  at: string;
  snapshot: Omit<FinanceTransaction, 'history'>;
}

export interface FinanceTransaction {
  id: string;
  kind: FinanceKind;
  status: FinanceStatus;
  title: string;
  amount: number;
  date: string; // ISO yyyy-MM-dd: בפועל = תאריך התנועה, אחרת = מועד צפוי
  category: string;
  method?: string;
  scopeType?: FinanceScopeType;
  scopeName?: string;
  notes?: string;
  allocations?: FinanceAllocation[];
  source?: 'manual' | 'import';
  importFingerprint?: string;
  recurringGroup?: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  history: FinanceRevision[];
}

export interface FinanceData {
  version: 1;
  openingDate: string;
  openingRecordedAt: string;
  openingBalance: number;
  openingPersonalBalance: number; // חיובי = הפעילות חייבת לי; שלילי = אני חייב לפעילות
  safetyReserve: number;
  nextRentAmount: number;
  nextRentDate: string;
  forecastDays: number;
  includeDonations: boolean;
  cashDonations: 'personal' | 'available' | 'ignore';
  categories: string[];
  transactions: FinanceTransaction[];
  lastClosedMonth?: string;
}

export interface FinanceSummary {
  currentBalance: number;
  personalBalance: number;
  actualIncome: number;
  actualExpense: number;
  committedIncome: number;
  committedExpense: number;
  expectedIncome: number;
  expectedExpense: number;
  guaranteedBalance: number;
  optimisticBalance: number;
  protectedAmount: number;
  safeToUse: number;
  donationIncome: number;
  firstRiskDate: string;
  firstOptimisticRiskDate: string;
}

export interface FinanceProjectSummary {
  key: string;
  type: FinanceScopeType;
  name: string;
  actualIncome: number;
  actualExpense: number;
  futureIncome: number;
  futureExpense: number;
  actualBalance: number;
  projectedBalance: number;
}

export interface ParsedFinanceRow {
  row: number;
  transaction: FinanceTransaction;
  duplicate: boolean;
  warning?: string;
}

export interface AIFinanceTransaction {
  kind?: FinanceKind;
  status?: FinanceStatus;
  title?: string;
  amount?: number | string;
  date?: string;
  category?: string;
  method?: string;
  scopeType?: FinanceScopeType;
  scopeName?: string;
  notes?: string;
  /** מספר חודשים כולל החודש הראשון. 1 = תנועה חד-פעמית. */
  repeatMonths?: number;
}

export interface AIFinanceImportResult {
  data: FinanceData;
  added: number;
  skipped: number;
}

export const DEFAULT_FINANCE_CATEGORIES = [
  'פעילות שוטפת', 'אירועים וחגים', 'שכירות', 'חשמל וארנונה', 'פרסום',
  'ציוד ואחזקה', 'עזרה למשפחות', 'רכב ונסיעות', 'משכורת', 'קופת צדקה',
  'תרומה כללית', 'אחר',
];

export function emptyFinanceData(): FinanceData {
  return {
    version: 1,
    openingDate: '',
    openingRecordedAt: '',
    openingBalance: 0,
    openingPersonalBalance: 0,
    safetyReserve: 0,
    nextRentAmount: 0,
    nextRentDate: '',
    forecastDays: 90,
    includeDonations: true,
    cashDonations: 'personal',
    categories: [...DEFAULT_FINANCE_CATEGORIES],
    transactions: [],
  };
}

const number = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim().replace(/[₪$€\s]/g, '');
  if (!raw) return 0;
  const normalized = raw.includes(',') && raw.includes('.')
    ? raw.replace(/,/g, '')
    : raw.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function normalizeFinanceData(value: unknown): FinanceData {
  const raw = value && typeof value === 'object' ? value as Partial<FinanceData> : {};
  const base = emptyFinanceData();
  const categories = Array.isArray(raw.categories)
    ? raw.categories.map(String).map(x => x.trim()).filter(Boolean)
    : base.categories;
  const transactions = Array.isArray(raw.transactions)
    ? raw.transactions.map(normalizeTransaction).filter((x): x is FinanceTransaction => !!x)
    : [];
  return {
    ...base,
    ...raw,
    version: 1,
    openingDate: normalizeDate(raw.openingDate || ''),
    openingRecordedAt: String(raw.openingRecordedAt || ''),
    openingBalance: number(raw.openingBalance),
    openingPersonalBalance: number(raw.openingPersonalBalance),
    safetyReserve: Math.max(0, number(raw.safetyReserve)),
    nextRentAmount: Math.max(0, number(raw.nextRentAmount)),
    nextRentDate: normalizeDate(raw.nextRentDate || ''),
    forecastDays: Math.min(730, Math.max(7, Math.round(number(raw.forecastDays) || 90))),
    includeDonations: raw.includeDonations !== false,
    cashDonations: ['personal', 'available', 'ignore'].includes(String(raw.cashDonations))
      ? raw.cashDonations as FinanceData['cashDonations']
      : 'personal',
    categories: Array.from(new Set([...categories, ...DEFAULT_FINANCE_CATEGORIES])),
    transactions,
  };
}

function normalizeTransaction(value: unknown): FinanceTransaction | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<FinanceTransaction>;
  const amount = Math.abs(number(raw.amount));
  const title = String(raw.title || '').trim();
  if (!raw.id || !title || !amount) return null;
  const now = new Date().toISOString();
  return {
    id: String(raw.id),
    kind: isKind(raw.kind) ? raw.kind : 'expense',
    status: isStatus(raw.status) ? raw.status : 'actual',
    title,
    amount,
    date: normalizeDate(raw.date || '') || todayIso(),
    category: String(raw.category || 'אחר').trim() || 'אחר',
    method: String(raw.method || '').trim(),
    scopeType: isScope(raw.scopeType) ? raw.scopeType : 'general',
    scopeName: String(raw.scopeName || '').trim(),
    notes: String(raw.notes || '').trim(),
    allocations: Array.isArray(raw.allocations)
      ? raw.allocations.map(a => ({ id: String(a.id || newId('split')), label: String(a.label || '').trim(), amount: Math.abs(number(a.amount)) }))
          .filter(a => a.label && a.amount > 0)
      : [],
    source: raw.source === 'import' ? 'import' : 'manual',
    importFingerprint: String(raw.importFingerprint || ''),
    recurringGroup: String(raw.recurringGroup || ''),
    createdAt: String(raw.createdAt || now),
    updatedAt: String(raw.updatedAt || raw.createdAt || now),
    revision: Math.max(1, Math.round(number(raw.revision) || 1)),
    history: Array.isArray(raw.history) ? raw.history : [],
  };
}

const isKind = (x: unknown): x is FinanceKind => [
  'income', 'expense', 'cash_income', 'personal_expense', 'salary',
  'settlement_to_me', 'settlement_to_org',
].includes(String(x));
const isStatus = (x: unknown): x is FinanceStatus => ['actual', 'committed', 'expected', 'cancelled'].includes(String(x));
const isScope = (x: unknown): x is FinanceScopeType => ['general', 'event', 'holiday', 'project'].includes(String(x));

export function newId(prefix = 'fin'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function todayIso(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function normalizeDate(value: unknown): string {
  const s = String(value || '').trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }
  return '';
}

export function donationIsCash(donation: Donation): boolean {
  const method = String(donation.method || '').toLowerCase();
  return method.includes('מזומן') || method.includes('cash') || method.includes('קופה');
}

function donationAfterOpening(donation: Donation, openingDate: string): boolean {
  if (!openingDate || !donation.date) return false;
  const date = normalizeDate(donation.date);
  // יתרת הפתיחה היא "כמה יש עכשיו". תרומה מאותו יום כבר נמצאת ביתרה,
  // ואין למייל זמן מדויק שמאפשר לדעת אם נכנסה לפניה או אחריה.
  return !!date && date > openingDate;
}

interface Effects { income: number; expense: number; cash: number; personal: number }

export function transactionEffects(tx: FinanceTransaction, projection = false): Effects {
  if (tx.status === 'cancelled') return { income: 0, expense: 0, cash: 0, personal: 0 };
  const isActual = tx.status === 'actual';
  if (!isActual && !projection) return { income: 0, expense: 0, cash: 0, personal: 0 };
  const amount = Math.abs(number(tx.amount));
  switch (tx.kind) {
    case 'income': return { income: amount, expense: 0, cash: amount, personal: 0 };
    case 'expense': return { income: 0, expense: amount, cash: -amount, personal: 0 };
    case 'cash_income': return { income: amount, expense: 0, cash: 0, personal: isActual ? -amount : 0 };
    case 'personal_expense': return { income: 0, expense: amount, cash: 0, personal: isActual ? amount : 0 };
    case 'salary': return {
      income: 0, expense: amount,
      cash: isActual ? 0 : -amount,
      personal: isActual ? amount : 0,
    };
    case 'settlement_to_me': return { income: 0, expense: 0, cash: -amount, personal: isActual ? -amount : 0 };
    case 'settlement_to_org': return { income: 0, expense: 0, cash: amount, personal: isActual ? amount : 0 };
  }
}

function donationEffects(donation: Donation, data: FinanceData): Effects {
  const amount = Math.max(0, number(donation.amount));
  if (!amount || !data.includeDonations || !donationAfterOpening(donation, data.openingDate)) {
    return { income: 0, expense: 0, cash: 0, personal: 0 };
  }
  if (!donationIsCash(donation)) return { income: amount, expense: 0, cash: amount, personal: 0 };
  if (data.cashDonations === 'ignore') return { income: 0, expense: 0, cash: 0, personal: 0 };
  if (data.cashDonations === 'available') return { income: amount, expense: 0, cash: amount, personal: 0 };
  return { income: amount, expense: 0, cash: 0, personal: -amount };
}

function forecastUntil(data: FinanceData): string {
  const d = new Date(`${todayIso()}T12:00:00`);
  d.setDate(d.getDate() + data.forecastDays);
  return d.toISOString().slice(0, 10);
}

export function summarizeFinance(dataInput: unknown, donations: Donation[] = []): FinanceSummary {
  const data = normalizeFinanceData(dataInput);
  let currentBalance = data.openingBalance;
  let personalBalance = data.openingPersonalBalance;
  let actualIncome = 0;
  let actualExpense = 0;
  let donationIncome = 0;

  donations.forEach(donation => {
    const e = donationEffects(donation, data);
    currentBalance += e.cash;
    personalBalance += e.personal;
    actualIncome += e.income;
    donationIncome += e.income;
  });

  data.transactions.forEach(tx => {
    // יתרת הפתיחה וההתחשבנות הפותחת הן תמונת מצב ליום ההתחלה. תנועות
    // היסטוריות מוקדמות יותר נשמרות לדוחות, אך אינן משנות את היתרה כיום.
    if (data.openingDate && tx.date < data.openingDate) return;
    if (data.openingDate && tx.date === data.openingDate) {
      // רשומה שיובאה מתארת את העבר ולכן כבר כלולה ביתרת "עכשיו". רשומה
      // ידנית חדשה מאותו יום כן נספרת, אך רק אם נוצרה אחרי חותמת הפתיחה.
      if (tx.source === 'import') return;
      if (data.openingRecordedAt && tx.createdAt <= data.openingRecordedAt) return;
    }
    const e = transactionEffects(tx);
    currentBalance += e.cash;
    personalBalance += e.personal;
    actualIncome += e.income;
    actualExpense += e.expense;
  });

  const horizon = forecastUntil(data);
  const future = data.transactions
    .filter(tx => (tx.status === 'committed' || tx.status === 'expected') && tx.date <= horizon)
    .sort((a, b) => a.date.localeCompare(b.date));
  const committedRent = future
    .filter(tx => tx.status === 'committed' && tx.kind === 'expense' && /שכיר(ות|ה)/.test(`${tx.category} ${tx.title}`))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const rentProtection = data.nextRentDate && data.nextRentDate <= horizon
    ? Math.max(0, data.nextRentAmount - committedRent)
    : 0;
  // כסף שהפעילות חייבת למשתמש הוא חבות אמיתית: הוא נשאר בחשבון כרגע,
  // אך אינו פנוי למשכורת נוספת או לפעילות חדשה.
  const protectedAmount = data.safetyReserve + rentProtection + Math.max(0, personalBalance);
  let guaranteedBalance = currentBalance;
  let optimisticBalance = currentBalance;
  let committedIncome = 0;
  let committedExpense = 0;
  let expectedIncome = 0;
  let expectedExpense = 0;
  let firstRiskDate = '';
  let firstOptimisticRiskDate = '';

  future.forEach(tx => {
    const e = transactionEffects(tx, true);
    if (tx.status === 'committed') {
      guaranteedBalance += e.cash;
      optimisticBalance += e.cash;
      committedIncome += e.income;
      committedExpense += e.expense;
    } else {
      optimisticBalance += e.cash;
      expectedIncome += e.income;
      expectedExpense += e.expense;
    }
    if (!firstRiskDate && guaranteedBalance < protectedAmount) firstRiskDate = tx.date;
    if (!firstOptimisticRiskDate && optimisticBalance < protectedAmount) firstOptimisticRiskDate = tx.date;
  });

  return {
    currentBalance,
    personalBalance,
    actualIncome,
    actualExpense,
    committedIncome,
    committedExpense,
    expectedIncome,
    expectedExpense,
    guaranteedBalance,
    optimisticBalance,
    protectedAmount,
    safeToUse: Math.max(0, guaranteedBalance - protectedAmount),
    donationIncome,
    firstRiskDate,
    firstOptimisticRiskDate,
  };
}

export function summarizeScopes(dataInput: unknown): FinanceProjectSummary[] {
  const data = normalizeFinanceData(dataInput);
  const map = new Map<string, FinanceProjectSummary>();
  data.transactions.forEach(tx => {
    if (tx.status === 'cancelled') return;
    const type = tx.scopeType || 'general';
    const e = transactionEffects(tx, true);
    const validAllocations = (tx.allocations || []).filter(allocation => allocation.label && allocation.amount > 0);
    const requested = validAllocations.reduce((sum, allocation) => sum + Math.max(0, allocation.amount), 0);
    const scale = requested > tx.amount && requested > 0 ? tx.amount / requested : 1;
    const allocated = Math.min(tx.amount, requested);
    const parts = validAllocations.map(allocation => ({
      name: allocation.label,
      amount: allocation.amount * scale,
    })).filter(part => part.name && part.amount > 0);
    if (allocated < tx.amount || parts.length === 0) parts.push({
      name: tx.scopeName || (type === 'general' ? 'פעילות כללית' : 'ללא שם'),
      amount: Math.max(0, tx.amount - allocated),
    });
    parts.forEach(part => {
      const key = `${type}:${part.name}`;
      const ratio = tx.amount > 0 ? part.amount / tx.amount : 0;
      const row = map.get(key) || {
        key, type, name: part.name, actualIncome: 0, actualExpense: 0,
        futureIncome: 0, futureExpense: 0, actualBalance: 0, projectedBalance: 0,
      };
      if (tx.status === 'actual') {
        row.actualIncome += e.income * ratio;
        row.actualExpense += e.expense * ratio;
      } else {
        row.futureIncome += e.income * ratio;
        row.futureExpense += e.expense * ratio;
      }
      row.actualBalance = row.actualIncome - row.actualExpense;
      row.projectedBalance = row.actualBalance + row.futureIncome - row.futureExpense;
      map.set(key, row);
    });
  });
  return [...map.values()].sort((a, b) => Math.abs(b.projectedBalance) - Math.abs(a.projectedBalance));
}

export function saveTransaction(dataInput: unknown, value: Partial<FinanceTransaction>, repeatMonths = 1): FinanceData {
  const data = normalizeFinanceData(dataInput);
  const now = new Date().toISOString();
  const existing = value.id ? data.transactions.find(tx => tx.id === value.id) : undefined;
  if (existing) {
    const snapshot = { ...existing } as Omit<FinanceTransaction, 'history'> & { history?: FinanceRevision[] };
    delete snapshot.history;
    const next = normalizeTransaction({
      ...existing,
      ...value,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now,
      revision: existing.revision + 1,
      history: [...existing.history, { at: now, snapshot }],
    });
    if (!next) throw new Error('חסרים שם או סכום');
    return { ...data, transactions: data.transactions.map(tx => tx.id === existing.id ? next : tx) };
  }

  const baseDate = normalizeDate(value.date || '') || todayIso();
  const count = Math.min(120, Math.max(1, Math.round(repeatMonths || 1)));
  const group = count > 1 ? newId('series') : '';
  const created: FinanceTransaction[] = [];
  for (let i = 0; i < count; i++) {
    const date = addMonths(baseDate, i);
    const tx = normalizeTransaction({
      ...value,
      id: newId(),
      date,
      status: value.status || 'actual',
      createdAt: now,
      updatedAt: now,
      revision: 1,
      history: [],
      recurringGroup: group,
      source: value.source || 'manual',
    });
    if (!tx) throw new Error('חסרים שם או סכום');
    created.push(tx);
  }
  return { ...data, transactions: [...created, ...data.transactions] };
}

export function cancelTransaction(dataInput: unknown, id: string): FinanceData {
  const data = normalizeFinanceData(dataInput);
  const found = data.transactions.find(tx => tx.id === id);
  if (!found || found.status === 'cancelled') return data;
  return saveTransaction(data, { ...found, status: 'cancelled' });
}

function addMonths(iso: string, count: number): string {
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + count);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

const aiFinanceFingerprint = (value: Partial<FinanceTransaction>): string => {
  const text = (x: unknown) => String(x || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return [
    value.kind || 'expense', value.status || 'actual', normalizeDate(value.date || ''),
    number(value.amount).toFixed(2), text(value.title), text(value.category),
    value.scopeType || 'general', text(value.scopeName),
  ].join('|');
};

/**
 * קולט תנועות שחולצו משיחה עם AI אל המרכז הכספי.
 * החזרה החודשית מורחבת לרשומות אמיתיות לפי חודש, ולכן התחזית והדוחות אינם
 * תלויים במנגנון מיוחד. טביעת תוכן מונעת ייבוא חוזר של אותה שכירות/הכנסה.
 */
export function importAIFinanceTransactions(dataInput: unknown, rowsInput: unknown): AIFinanceImportResult {
  const data = normalizeFinanceData(dataInput);
  const rows = Array.isArray(rowsInput) ? rowsInput : [];
  const known = new Set(data.transactions.map(aiFinanceFingerprint));
  const accepted: FinanceTransaction[] = [];
  let skipped = 0;

  rows.forEach(rawValue => {
    const raw = rawValue && typeof rawValue === 'object' ? rawValue as AIFinanceTransaction : {};
    const title = String(raw.title || '').trim();
    const amount = Math.abs(number(raw.amount));
    const date = normalizeDate(raw.date || '');
    if (!title || !amount || !date) { skipped++; return; }
    const kind: FinanceKind = isKind(raw.kind) ? raw.kind : 'expense';
    const status: FinanceStatus = isStatus(raw.status) ? raw.status : 'actual';
    const repeatMonths = Math.min(120, Math.max(1, Math.round(number(raw.repeatMonths) || 1)));
    try {
      const expanded = saveTransaction(emptyFinanceData(), {
        kind,
        status,
        title,
        amount,
        date,
        category: String(raw.category || (kind === 'income' ? 'אחר' : 'פעילות שוטפת')).trim(),
        method: String(raw.method || '').trim(),
        scopeType: isScope(raw.scopeType) ? raw.scopeType : 'general',
        scopeName: String(raw.scopeName || '').trim(),
        notes: String(raw.notes || '').trim(),
        source: 'import',
      }, repeatMonths).transactions;
      expanded.forEach(tx => {
        const key = aiFinanceFingerprint(tx);
        if (known.has(key)) { skipped++; return; }
        known.add(key);
        accepted.push(tx);
      });
    } catch {
      skipped++;
    }
  });

  const categories = Array.from(new Set([
    ...data.categories,
    ...accepted.map(tx => tx.category).filter(Boolean),
  ]));
  return {
    data: normalizeFinanceData({ ...data, categories, transactions: [...accepted, ...data.transactions] }),
    added: accepted.length,
    skipped,
  };
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      row.push(cell.trim()); cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = '';
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

const headerKey = (value: string): string => value.toLowerCase().replace(/[\s_\-"'׳״().]/g, '');
const HEADER_ALIASES: Record<string, string[]> = {
  date: ['תאריך', 'תאריךעסקה', 'תאריךערך', 'date', 'transactiondate', 'valuedate'],
  title: ['תיאור', 'פירוט', 'שם', 'ספק', 'description', 'details', 'memo', 'name'],
  amount: ['סכום', 'סכוםעסקה', 'amount', 'sum'],
  debit: ['חובה', 'חיוב', 'הוצאה', 'debit', 'withdrawal'],
  credit: ['זכות', 'זיכוי', 'הכנסה', 'credit', 'deposit'],
  category: ['קטגוריה', 'סיווג', 'category'],
  reference: ['אסמכתא', 'מספרעסקה', 'reference', 'transactionid', 'id'],
};

function findColumn(headers: string[], kind: keyof typeof HEADER_ALIASES): number {
  const normalized = headers.map(headerKey);
  return normalized.findIndex(h => HEADER_ALIASES[kind].includes(h));
}

function fingerprint(date: string, amount: number, title: string, reference = ''): string {
  return [normalizeDate(date), amount.toFixed(2), headerKey(title), headerKey(reference)].join('|');
}

export function parseFinanceFile(
  text: string,
  existing: FinanceTransaction[] = [],
  positiveMeans: 'income' | 'expense' = 'income',
): ParsedFinanceRow[] {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) throw new Error('הקובץ ריק');
  let rows: Record<string, unknown>[];
  if (clean[0] === '[' || clean[0] === '{') {
    const parsed = JSON.parse(clean);
    const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.rows) ? parsed.rows : []);
    rows = list.filter((x: unknown) => x && typeof x === 'object');
  } else {
    const first = clean.split(/\r?\n/, 1)[0];
    const delimiter = first.split('\t').length > first.split(',').length ? '\t' : ',';
    const matrix = parseDelimited(clean, delimiter);
    if (matrix.length < 2) throw new Error('לא נמצאו שורות נתונים');
    const headers = matrix[0];
    rows = matrix.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] || ''])));
  }
  if (!rows.length) throw new Error('לא נמצאו שורות נתונים');
  const headers = Object.keys(rows[0]);
  const dateCol = findColumn(headers, 'date');
  const titleCol = findColumn(headers, 'title');
  const amountCol = findColumn(headers, 'amount');
  const debitCol = findColumn(headers, 'debit');
  const creditCol = findColumn(headers, 'credit');
  const categoryCol = findColumn(headers, 'category');
  const refCol = findColumn(headers, 'reference');
  if (dateCol < 0 || titleCol < 0 || (amountCol < 0 && debitCol < 0 && creditCol < 0)) {
    throw new Error('צריך עמודות תאריך, תיאור וסכום (או חובה/זכות)');
  }
  const known = new Set(existing.map(tx => tx.importFingerprint || fingerprint(tx.date, tx.amount, tx.title)));
  return rows.map((raw, index) => {
    const get = (col: number) => col < 0 ? '' : raw[headers[col]];
    const date = normalizeDate(get(dateCol));
    const title = String(get(titleCol) || '').trim();
    const debit = Math.abs(number(get(debitCol)));
    const credit = Math.abs(number(get(creditCol)));
    const signed = number(get(amountCol));
    const amount = debit || credit || Math.abs(signed);
    const kind: FinanceKind = debit ? 'expense' : credit ? 'income'
      : (signed < 0 ? (positiveMeans === 'income' ? 'expense' : 'income') : positiveMeans);
    const reference = String(get(refCol) || '');
    const fp = fingerprint(date, amount, title, reference);
    const warning = !date ? 'תאריך לא תקין' : !title ? 'חסר תיאור' : !amount ? 'סכום לא תקין' : undefined;
    const transaction = normalizeTransaction({
      id: newId('import'), kind, status: 'actual', title: title || `שורה ${index + 2}`,
      amount: amount || 0, date: date || todayIso(), category: String(get(categoryCol) || 'אחר'),
      source: 'import', importFingerprint: fp, createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), revision: 1, history: [],
    }) || ({ id: newId('invalid') } as FinanceTransaction);
    const duplicate = known.has(fp);
    if (!warning && !duplicate) known.add(fp);
    return { row: index + 2, transaction, duplicate, warning };
  });
}

export function importFinanceRows(dataInput: unknown, rows: ParsedFinanceRow[]): FinanceData {
  const data = normalizeFinanceData(dataInput);
  const accepted = rows.filter(row => !row.duplicate && !row.warning).map(row => row.transaction);
  return normalizeFinanceData({ ...data, transactions: [...accepted, ...data.transactions] });
}

export function financeCsv(dataInput: unknown, donations: Donation[] = []): string {
  const data = normalizeFinanceData(dataInput);
  const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const headers = ['תאריך', 'מצב', 'סוג', 'תיאור', 'קטגוריה', 'סכום', 'שיוך', 'אמצעי', 'הערות'];
  const rows = data.transactions.map(tx => [
    tx.date, tx.status, tx.kind, tx.title, tx.category, tx.amount,
    tx.scopeName || '', tx.method || '', tx.notes || '',
  ]);
  if (data.includeDonations && data.openingDate) {
    donations.filter(donation => donationAfterOpening(donation, data.openingDate)).forEach(donation => rows.push([
      normalizeDate(donation.date), 'actual', 'income', donation.name || 'תרומה',
      donation.purpose || 'תרומה כללית', Number(donation.amount) || 0,
      donation.purpose || '', donation.method || '', 'נקרא אוטומטית מיומן התרומות',
    ]));
  }
  return '\uFEFF' + [headers, ...rows].map(row => row.map(quote).join(',')).join('\r\n');
}
