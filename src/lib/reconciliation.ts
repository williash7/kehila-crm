import { parseDdMmYyyy } from './dateUtils';
import { monthKey, PaymentLedgerRow, PaymentStatus } from './paymentLedger';

export interface ReportPayment {
  id: string;
  name: string;
  date: string;
  amount: number;
  status: PaymentStatus;
  rawStatus: string;
  rowNumber: number;
}

export interface ReconciliationPair {
  app: PaymentLedgerRow;
  report: ReportPayment;
  method: 'id' | 'details';
}

export interface ReconciliationResult {
  matched: ReconciliationPair[];
  amountMismatch: ReconciliationPair[];
  reportOnly: ReportPayment[];
  appOnly: PaymentLedgerRow[];
  ambiguous: ReportPayment[];
  ignoredReport: ReportPayment[];
}

export class ReconciliationFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReconciliationFileError';
  }
}

const HEADER_ALIASES = {
  id: ['מספר אישור', 'מס אישור', 'אישור', 'מזהה', 'אסמכתא', 'מספר עסקה', 'קוד עסקה', 'transaction id', 'id'],
  name: ['שם', 'שם לקוח', 'שם תורם', 'לקוח', 'תורם', 'name'],
  date: ['תאריך', 'תאריך עסקה', 'תאריך חיוב', 'מועד עסקה', 'date'],
  amount: ['סכום', 'סכום עסקה', 'סכום חיוב', 'סהכ', 'amount'],
  status: ['סטטוס', 'מצב', 'סטטוס עסקה', 'תוצאה', 'status'],
};

function normalizeHeader(value: any): string {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/["'׳״`_.:\-\/\\()[\]{}]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function headerIndex(headers: any[], aliases: string[]): number {
  const wanted = new Set(aliases.map(normalizeHeader));
  return headers.findIndex(h => wanted.has(normalizeHeader(h)));
}

function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] || '';
  const candidates = ['\t', ',', ';'];
  return candidates.sort((a, b) => first.split(b).length - first.split(a).length)[0];
}

/** מפענח CSV/TSV, כולל שדות מצוטטים, פסיקים ושורות חדשות בתוך שדה. */
export function parseDelimited(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n') {
      row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows.filter(r => r.some(v => String(v).trim()));
}

function parseAmount(value: any): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let s = String(value ?? '').replace(/[₪$€\s]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '');
  else if (s.includes(',')) {
    const decimal = /,\d{1,2}$/.test(s);
    s = decimal ? s.replace(',', '.') : s.replace(/,/g, '');
  }
  s = s.replace(/[^\d.\-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatDate(value: any): string {
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  }
  const parsed = parseDdMmYyyy(String(value ?? '').trim());
  if (!parsed) return String(value ?? '').trim();
  return `${String(parsed.getDate()).padStart(2, '0')}/${String(parsed.getMonth() + 1).padStart(2, '0')}/${parsed.getFullYear()}`;
}

function reportStatus(value: any): PaymentStatus {
  const s = String(value ?? '').trim().toLowerCase();
  if (/נכשל|נדחה|סורב|failed|declined|rejected/.test(s)) return 'failed';
  if (/בוטל|זוכה|הוחזר|cancel|refund/.test(s)) return 'cancelled';
  if (/עתיד|ממתין|future|pending/.test(s)) return 'future';
  return 'received';
}

function rowsFromJson(value: any): { headers: string[]; rows: any[][] } {
  const list = Array.isArray(value) ? value : Array.isArray(value?.rows) ? value.rows : Array.isArray(value?.data) ? value.data : null;
  if (!list) throw new ReconciliationFileError('בקובץ JSON צריך להיות מערך רשומות');
  if (!list.length) return { headers: [], rows: [] };
  if (Array.isArray(list[0])) {
    const headers = (value.headers || list[0]).map(String);
    return { headers, rows: value.headers ? list : list.slice(1) };
  }
  const headers: string[] = Array.from(new Set<string>(
    list.flatMap((item: any) => Object.keys(item || {})) as string[],
  ));
  return { headers, rows: list.map((item: any) => headers.map(h => item?.[h])) };
}

export function parseReconciliationFile(text: string): ReportPayment[] {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new ReconciliationFileError('הקובץ ריק');
  let headers: string[];
  let rows: any[][];
  if (/^[\[{]/.test(trimmed)) {
    let value;
    try { value = JSON.parse(trimmed); }
    catch { throw new ReconciliationFileError('קובץ ה־JSON אינו תקין'); }
    ({ headers, rows } = rowsFromJson(value));
  } else {
    const matrix = parseDelimited(trimmed);
    headers = matrix[0] || [];
    rows = matrix.slice(1);
  }

  const idx = {
    id: headerIndex(headers, HEADER_ALIASES.id),
    name: headerIndex(headers, HEADER_ALIASES.name),
    date: headerIndex(headers, HEADER_ALIASES.date),
    amount: headerIndex(headers, HEADER_ALIASES.amount),
    status: headerIndex(headers, HEADER_ALIASES.status),
  };
  if (idx.amount < 0 || (idx.id < 0 && (idx.name < 0 || idx.date < 0))) {
    throw new ReconciliationFileError('לא זוהו העמודות הנדרשות: סכום, ומספר אישור או שם+תאריך');
  }

  return rows.map((row, i) => ({
    id: idx.id >= 0 ? String(row[idx.id] ?? '').trim().replace(/\.0$/, '') : '',
    name: idx.name >= 0 ? String(row[idx.name] ?? '').trim() : '',
    date: idx.date >= 0 ? formatDate(row[idx.date]) : '',
    amount: parseAmount(row[idx.amount]),
    status: reportStatus(idx.status >= 0 ? row[idx.status] : ''),
    rawStatus: idx.status >= 0 ? String(row[idx.status] ?? '').trim() : '',
    rowNumber: i + 2,
  })).filter(r => r.id || r.name || r.amount);
}

function nameKey(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/["'׳״`.,\-]/g, '').replace(/\s+/g, ' ');
}

function dateKey(value: string): string {
  const d = parseDdMmYyyy(value);
  return d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : String(value || '').trim();
}

function amountKey(value: number): number { return Math.round((Number(value) || 0) * 100); }
function idKey(value: string): string { return String(value || '').trim().replace(/\.0$/, ''); }
function detailKey(value: { name: string; date: string; amount: number }): string {
  return `${nameKey(value.name)}|${dateKey(value.date)}|${amountKey(value.amount)}`;
}

export function reconcilePayments(
  ledger: PaymentLedgerRow[],
  report: ReportPayment[],
  month = '',
): ReconciliationResult {
  const app = ledger.filter(r => r.status === 'received' && (!month || monthKey(r.date) === month));
  const ignoredReport = report.filter(r => r.status !== 'received');
  const wantedReport = report.filter(r => r.status === 'received' && (!month || !r.date || monthKey(r.date) === month));
  const unused = new Set(app.map((_, i) => i));
  const result: ReconciliationResult = {
    matched: [], amountMismatch: [], reportOnly: [], appOnly: [], ambiguous: [], ignoredReport,
  };

  const choose = (record: ReportPayment, candidates: number[], method: 'id' | 'details') => {
    const available = candidates.filter(i => unused.has(i));
    if (available.length !== 1) return false;
    const index = available[0];
    unused.delete(index);
    const pair = { app: app[index], report: record, method };
    if (amountKey(pair.app.amount) === amountKey(record.amount)) result.matched.push(pair);
    else result.amountMismatch.push(pair);
    return true;
  };

  wantedReport.forEach(record => {
    if (record.id) {
      const ids = app.map((r, i) => idKey(r.id) === idKey(record.id) ? i : -1).filter(i => i >= 0);
      if (ids.length && choose(record, ids, 'id')) return;
      if (ids.length) { result.ambiguous.push(record); return; }
    }
    if (record.name && record.date) {
      const key = detailKey(record);
      const details = app.map((r, i) => detailKey(r) === key ? i : -1).filter(i => i >= 0);
      if (details.length && choose(record, details, 'details')) return;
      if (details.length) { result.ambiguous.push(record); return; }
    }
    result.reportOnly.push(record);
  });
  result.appOnly = app.filter((_, i) => unused.has(i));
  return result;
}
