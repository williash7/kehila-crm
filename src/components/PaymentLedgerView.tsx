import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSearch, Loader2, RefreshCw, Search, Upload } from 'lucide-react';
import { fetchPaymentLedger, isNotDeployed } from '../lib/api';
import {
  filterPaymentRows, PAYMENT_STATUS_COLOR, PAYMENT_STATUS_LABEL,
  PaymentLedgerRow, PaymentStatus, summarizePaymentRows,
} from '../lib/paymentLedger';
import {
  parseReconciliationFile, reconcilePayments, ReconciliationResult, ReportPayment,
} from '../lib/reconciliation';
import { EmptyState } from './EmptyState';
import { parseDdMmYyyy } from '../lib/dateUtils';
import { compareListValues, ListSortControl, usePersistentListSort } from './ListSortControl';

const PAGE_SIZE = 50;
const STATUSES: PaymentStatus[] = ['received', 'future', 'failed', 'cancelled'];
const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

function money(value: number) { return `₪${(Number(value) || 0).toLocaleString()}`; }

function ReconList({ title, tone, rows }: { title: string; tone: string; rows: any[] }) {
  if (!rows.length) return null;
  return (
    <details className="border border-[#EDE6D6] rounded-xl overflow-hidden">
      <summary className={`cursor-pointer px-3 py-2.5 text-xs font-bold ${tone}`}>{title} ({rows.length})</summary>
      <div className="divide-y divide-[#EDE6D6] bg-white max-h-64 overflow-y-auto">
        {rows.slice(0, 100).map((item: any, i) => {
          const row = item.report || item.app || item;
          const appAmount = item.app ? money(item.app.amount) : '';
          const reportAmount = item.report ? money(item.report.amount) : '';
          return (
            <div key={`${row.id || row.name}-${i}`} className="px-3 py-2 text-[11px]">
              <div className="font-bold text-[#0D1B2A]">{row.name || 'ללא שם'} · {row.date || 'ללא תאריך'}</div>
              <div className="text-gray-500 mt-0.5">
                {item.app && item.report ? `באפליקציה ${appAmount} · בדוח ${reportAmount}` : money(row.amount)}
                {row.id ? <span dir="ltr"> · #{row.id}</span> : ''}
              </div>
            </div>
          );
        })}
        {rows.length > 100 && <div className="px-3 py-2 text-[11px] text-gray-400">מוצגות 100 הרשומות הראשונות</div>}
      </div>
    </details>
  );
}

function ReconciliationPanel({ ledger, month }: { ledger: PaymentLedgerRow[]; month: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<ReportPayment[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const result: ReconciliationResult | null = useMemo(
    () => report ? reconcilePayments(ledger, report, month) : null,
    [ledger, report, month],
  );

  const choose = async (file: File) => {
    setError(''); setReport(null); setFileName(file.name);
    try { setReport(parseReconciliationFile(await file.text())); }
    catch (e: any) { setError(e?.message || String(e)); }
  };

  return (
    <div className="mt-5 bg-white rounded-2xl border border-[#EDE6D6] shadow-sm p-4 space-y-3">
      <div className="flex items-start gap-2">
        <FileSearch size={18} className="text-[#9B7A2F] shrink-0 mt-0.5" />
        <div>
          <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">התאמה חודשית מול נדרים</h3>
          <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">
            בחר דוח CSV, TSV או JSON. ההשוואה היא לקריאה בלבד ורק מול תשלומים שהתקבלו
            {month ? ` בחודש ${month}` : ''}. לא יתבצע תיקון אוטומטי.
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,.json,text/csv,text/tab-separated-values,application/json"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) choose(file);
          e.target.value = '';
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 border border-[#C9A84C] text-[#9B7A2F] rounded-xl py-2.5 text-sm font-bold"
      >
        <Upload size={15} /> {fileName ? 'בחר דוח אחר' : 'בחר דוח חודשי'}
      </button>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs">{error}</div>}
      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="bg-emerald-50 rounded-xl p-2.5 text-center border border-emerald-200">
              <div className="text-xl font-bold text-emerald-700">{result.matched.length}</div>
              <div className="text-[10px] text-emerald-700">תואמים</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-2.5 text-center border border-amber-200">
              <div className="text-xl font-bold text-amber-700">{result.amountMismatch.length}</div>
              <div className="text-[10px] text-amber-700">הפרש סכום</div>
            </div>
            <div className="bg-red-50 rounded-xl p-2.5 text-center border border-red-200">
              <div className="text-xl font-bold text-red-700">{result.reportOnly.length + result.appOnly.length}</div>
              <div className="text-[10px] text-red-700">חסרים בצד אחד</div>
            </div>
          </div>
          {result.matched.length > 0 && result.amountMismatch.length === 0 && result.reportOnly.length === 0 && result.appOnly.length === 0 && result.ambiguous.length === 0 && (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-3 text-xs font-bold">
              <CheckCircle2 size={14} /> כל התשלומים שהתקבלו תואמים לדוח.
            </div>
          )}
          <ReconList title="הפרשי סכום" tone="bg-amber-50 text-amber-800" rows={result.amountMismatch} />
          <ReconList title="בדוח ולא באפליקציה" tone="bg-red-50 text-red-700" rows={result.reportOnly} />
          <ReconList title="באפליקציה ולא בדוח" tone="bg-red-50 text-red-700" rows={result.appOnly} />
          <ReconList title="התאמות לא חד־משמעיות" tone="bg-amber-50 text-amber-800" rows={result.ambiguous} />
          {result.ignoredReport.length > 0 && (
            <div className="text-[10px] text-gray-400">
              {result.ignoredReport.length} שורות בדוח סומנו כעתידיות/כושלות/מבוטלות ולא נכללו בהתאמת הכסף שהתקבל.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PaymentLedgerView() {
  const [rows, setRows] = useState<PaymentLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<PaymentStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(currentMonth);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = usePersistentListSort('kehila:list-sort:payment-ledger');
  const [page, setPage] = useState(0);

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetchPaymentLedger();
      setRows(Array.isArray(res?.payments) ? res.payments : []);
    } catch (e: any) {
      setError(isNotDeployed(e)
        ? 'התצוגה תהיה זמינה לאחר עדכון ופריסת קוד הגיליון החדש.'
        : (e?.message || String(e)));
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { setPage(0); }, [status, search, month, dateFrom, dateTo, sort]);

  const monthRows = useMemo(() => filterPaymentRows(rows, { month, search }), [rows, month, search]);
  const summary = useMemo(() => summarizePaymentRows(monthRows), [monthRows]);
  const filtered = useMemo(() => filterPaymentRows(monthRows, { status })
    .filter(row => {
      const time = parseDdMmYyyy(row.date)?.getTime();
      if (!time) return !dateFrom && !dateTo;
      if (dateFrom && time < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
      if (dateTo && time > new Date(`${dateTo}T23:59:59`).getTime()) return false;
      return true;
    })
    .sort((a, b) => compareListValues(a, b, sort, parseDdMmYyyy)), [monthRows, status, dateFrom, dateTo, sort]);
  const shown = filtered.slice(0, (page + 1) * PAGE_SIZE);

  if (loading) return <div className="py-14 flex items-center justify-center gap-2 text-sm text-gray-500"><Loader2 size={17} className="animate-spin" /> טוען מצבי חיוב...</div>;
  if (error) return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
      <div className="flex items-start gap-2"><AlertTriangle size={17} className="shrink-0 mt-0.5" /><span>{error}</span></div>
      <button onClick={load} className="mt-3 text-xs font-bold underline">נסה שוב</button>
    </div>
  );

  return (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-800 leading-relaxed mb-3">
        זהו מסך בקרה בלבד. רק „התקבל” נספר כהכנסה; עתידי, נכשל ומבוטל מוצגים כאן כדי שלא ייעלמו מהתמונה.
      </div>
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="שם, מספר אישור או הוראה..." className="w-full bg-white border border-[#EDE6D6] rounded-xl py-2.5 pr-9 pl-3 text-sm outline-none focus:border-[#C9A84C]" />
        </div>
        <button onClick={load} className="w-10 rounded-xl bg-white border border-[#EDE6D6] flex items-center justify-center text-gray-500" title="רענן"><RefreshCw size={15} /></button>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="flex-1 bg-white border border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C]" />
        {month && <button onClick={() => setMonth('')} className="px-3 py-2 text-xs font-bold bg-gray-100 text-gray-600 rounded-xl">כל הזמנים</button>}
      </div>
      <details className="bg-white border border-[#EDE6D6] rounded-xl mb-3">
        <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-gray-600">מיון וסינון מדויק</summary>
        <div className="p-3 pt-1 space-y-2 border-t border-[#EDE6D6]">
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="חיובים מתאריך" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-gray-50 border border-[#EDE6D6] rounded-lg px-2 py-2 text-xs" />
            <input aria-label="חיובים עד תאריך" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-gray-50 border border-[#EDE6D6] rounded-lg px-2 py-2 text-xs" />
          </div>
          <ListSortControl value={sort} onChange={setSort} />
        </div>
      </details>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {STATUSES.map(key => (
          <button key={key} onClick={() => setStatus(status === key ? 'all' : key)} className={`rounded-xl p-2.5 text-center border transition-all ${PAYMENT_STATUS_COLOR[key]} ${status === key ? 'ring-2 ring-[#C9A84C]' : ''}`}>
            <div className="text-lg font-bold">{summary[key].count}</div>
            <div className="text-[10px] font-bold">{PAYMENT_STATUS_LABEL[key]} · {money(summary[key].total)}</div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#EDE6D6] shadow-sm overflow-hidden">
        {shown.length === 0 ? <EmptyState icon="🔎" title="אין חיובים בטווח הזה" hint="אפשר לבחור חודש אחר, לנקות חיפוש או להציג את כל המצבים." /> : (
          <div className="divide-y divide-[#EDE6D6]">
            {shown.map((row, i) => {
              const unknown = row.status === 'received' && !!row.rawStatus;
              return (
                <div key={`${row.id}-${i}`} className="px-3.5 py-2.5 md:grid md:grid-cols-[1fr_7rem_7rem_7rem] md:items-center gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#0D1B2A] truncate">{row.name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5" dir="ltr">{row.id ? `#${row.id}` : '—'}{row.orderId ? ` · order ${row.orderId}` : ''}</div>
                  </div>
                  <div className="text-xs text-gray-500">{row.date || '—'}</div>
                  <div className="font-['Frank_Ruhl_Libre'] font-bold text-[#0D1B2A]">{money(row.amount)}</div>
                  <div>
                    <span className={`inline-block text-[10px] font-bold px-2 py-1 rounded-full border ${unknown ? 'bg-amber-50 text-amber-800 border-amber-200' : PAYMENT_STATUS_COLOR[row.status]}`}>
                      {unknown ? `לא מוכר: ${row.rawStatus}` : PAYMENT_STATUS_LABEL[row.status]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {shown.length < filtered.length && <button onClick={() => setPage(p => p + 1)} className="w-full py-3 text-sm font-bold text-[#9B7A2F] border-t border-[#EDE6D6]">הצג עוד ({filtered.length - shown.length})</button>}
        <div className="px-3.5 py-2 bg-[#FAF6EE] border-t border-[#EDE6D6] text-[11px] text-gray-500">{filtered.length} רשומות בתצוגה</div>
      </div>

      <ReconciliationPanel ledger={rows} month={month} />
    </div>
  );
}
