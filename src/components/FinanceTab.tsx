import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarClock, CheckCircle2,
  Download, FileUp, Landmark, Pencil, Plus, Printer, RefreshCw, Save, Settings,
  ShieldCheck, SlidersHorizontal, Undo2, WalletCards, X,
} from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import {
  FinanceData, FinanceKind, FinanceScopeType, FinanceStatus, FinanceTransaction,
  ParsedFinanceRow, cancelTransaction, emptyFinanceData, financeCsv, importFinanceRows,
  normalizeFinanceData, parseFinanceFile, saveTransaction, summarizeFinance,
  summarizeScopes, todayIso, transactionEffects,
} from '../lib/finance';
import { sumBudget } from '../lib/history';
import { Donation } from '../types';

type Pane = 'overview' | 'transactions' | 'scopes' | 'import' | 'settings';
type BudgetSource = { id?: string; title?: string; name?: string; budget?: { expenses?: unknown[]; income?: unknown[] } };
type BudgetReference = { key: string; type: string; name: string; planned: number; actual: number; income: number };

const KIND_LABELS: Record<FinanceKind, string> = {
  income: 'הכנסה נוספת',
  expense: 'הוצאה מהפעילות',
  cash_income: 'מזומן שנכנס אליי',
  personal_expense: 'הוצאה ששילמתי מכיסי',
  salary: 'משכורת מתוך המזומן שאצלי',
  settlement_to_me: 'הפעילות שילמה לי',
  settlement_to_org: 'החזרתי כסף לפעילות',
};

const STATUS_LABELS: Record<FinanceStatus, string> = {
  actual: 'בוצע בפועל', committed: 'התחייבות', expected: 'צפוי', cancelled: 'מבוטל',
};

const SCOPE_LABELS: Record<FinanceScopeType, string> = {
  general: 'פעילות כללית', event: 'אירוע', holiday: 'חג', project: 'פרויקט',
};

const money = (value: number) => `₪${Math.round(value || 0).toLocaleString('he-IL')}`;
const dateLabel = (iso: string) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('he-IL') : 'לא נקבע';
const INPUT = 'w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C]';

export function FinanceTab() {
  const { financeData, updateFinanceData, donations, eventsData, holidayExtras, projects } = useAppStore();
  const data = normalizeFinanceData(financeData || emptyFinanceData());
  const summary = useMemo(() => summarizeFinance(data, donations), [data, donations]);
  const scopes = useMemo(() => summarizeScopes(data), [data]);
  const [pane, setPane] = useState<Pane>('overview');
  const [editing, setEditing] = useState<Partial<FinanceTransaction> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'ok' | 'error'>('idle');

  const persist = async (next: FinanceData) => {
    setSaving(true); setSaveState('idle');
    const ok = await updateFinanceData(next);
    setSaving(false); setSaveState(ok ? 'ok' : 'error');
    return ok;
  };

  const begin = (kind: FinanceKind, status: FinanceStatus = 'actual') => setEditing({
    kind, status, date: todayIso(), category: kind === 'salary' ? 'משכורת' : '',
    scopeType: 'general', allocations: [],
  });

  const existingBudgets = useMemo(() => {
    const rows: BudgetReference[] = [];
    (eventsData as BudgetSource[] || []).forEach(event => {
      const b = sumBudget(event.budget);
      if (b.plannedExpense || b.actualExpense || b.plannedIncome || b.actualIncome) rows.push({
        key: `event:${event.id}`, type: 'אירוע', name: event.title || event.name || 'אירוע',
        planned: b.plannedExpense, actual: b.actualExpense, income: b.actualIncome,
      });
    });
    (Object.entries(holidayExtras || {}) as [string, BudgetSource][]).forEach(([id, extra]) => {
      const b = sumBudget(extra?.budget);
      if (b.plannedExpense || b.actualExpense || b.plannedIncome || b.actualIncome) rows.push({
        key: `holiday:${id}`, type: 'חג', name: extra.title || extra.name || id,
        planned: b.plannedExpense, actual: b.actualExpense, income: b.actualIncome,
      });
    });
    (projects as BudgetSource[] || []).forEach(project => {
      const b = sumBudget(project.budget);
      if (b.plannedExpense || b.actualExpense || b.plannedIncome || b.actualIncome) rows.push({
        key: `project:${project.id}`, type: 'פרויקט', name: project.name || 'פרויקט',
        planned: b.plannedExpense, actual: b.actualExpense, income: b.actualIncome,
      });
    });
    return rows;
  }, [eventsData, holidayExtras, projects]);

  const tabs: { id: Pane; label: string }[] = [
    { id: 'overview', label: 'תמונה עכשיו' },
    { id: 'transactions', label: 'תנועות' },
    { id: 'scopes', label: 'אירועים ויעדים' },
    { id: 'import', label: 'ייבוא ודוחות' },
    { id: 'settings', label: 'הגדרות' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-5 py-5 space-y-4" dir="rtl">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <WalletCards className="text-[#9B7A2F]" size={24} />
            <h1 className="font-['Frank_Ruhl_Libre'] text-2xl font-black text-[#0D1B2A]">מרכז כספי</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">ניהול פנימי לשליחות · אינו מחליף הנהלת חשבונות</p>
        </div>
        <div className="text-[11px] min-h-5">
          {saving && <span className="text-gray-500 flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> שומר…</span>}
          {!saving && saveState === 'ok' && <span className="text-emerald-700 flex items-center gap-1"><CheckCircle2 size={12} /> נשמר</span>}
          {!saving && saveState === 'error' && <span className="text-red-600 flex items-center gap-1"><AlertTriangle size={12} /> נשמר במכשיר, הסנכרון נכשל</span>}
        </div>
      </header>

      <nav className="bg-white border border-[#EDE6D6] rounded-2xl p-1 flex gap-1 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setPane(tab.id)} className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${pane === tab.id ? 'bg-[#0D1B2A] text-[#C9A84C]' : 'text-gray-500 hover:bg-gray-50'}`}>
            {tab.label}
          </button>
        ))}
      </nav>

      {!data.openingDate && (
        <button onClick={() => setPane('settings')} className="w-full text-right bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 shrink-0" size={20} />
          <span><b className="block text-amber-900">צריך לציין מאיפה מתחילים</b><span className="text-xs text-amber-800">הזן יתרה נוכחית ותאריך התחלה. עד אז המספרים הם טיוטה בלבד.</span></span>
        </button>
      )}

      {pane === 'overview' && <Overview summary={summary} data={data} onAdd={begin} onSettings={() => setPane('settings')} transactions={data.transactions} />}
      {pane === 'transactions' && <Transactions data={data} onAdd={begin} onEdit={setEditing} onCancel={async id => persist(cancelTransaction(data, id))} />}
      {pane === 'scopes' && <Scopes scopes={scopes} budgets={existingBudgets} onAdd={() => begin('expense', 'committed')} />}
      {pane === 'import' && <ImportAndReports data={data} donations={donations} persist={persist} />}
      {pane === 'settings' && <FinanceSettings data={data} persist={persist} />}

      {editing && (
        <TransactionEditor
          value={editing}
          categories={data.categories}
          scopeSuggestions={[
            ...(eventsData as BudgetSource[] || []).map(e => e.title || e.name).filter((x): x is string => !!x),
            ...(projects as BudgetSource[] || []).map(p => p.name).filter((x): x is string => !!x),
          ]}
          onClose={() => setEditing(null)}
          onSave={async (value, repeats) => {
            try {
              const ok = await persist(saveTransaction(data, value, repeats));
              if (ok) setEditing(null);
            } catch (error: unknown) { alert(error instanceof Error ? error.message : 'לא ניתן לשמור'); }
          }}
        />
      )}
    </div>
  );
}

function Overview({ summary, data, onAdd, onSettings, transactions }: {
  summary: ReturnType<typeof summarizeFinance>; data: FinanceData;
  onAdd: (kind: FinanceKind, status?: FinanceStatus) => void; onSettings: () => void;
  transactions: FinanceTransaction[];
}) {
  const upcoming = transactions.filter(tx => tx.status === 'committed' || tx.status === 'expected')
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  const personalText = summary.personalBalance > 0
    ? `הפעילות חייבת לך ${money(summary.personalBalance)}`
    : summary.personalBalance < 0
      ? `אתה מחזיק עבור הפעילות ${money(Math.abs(summary.personalBalance))}`
      : 'ההתחשבנות מאוזנת';
  const rentCovered = summary.currentBalance >= data.nextRentAmount + data.safetyReserve + Math.max(0, summary.personalBalance);
  return <div className="space-y-4">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      <Metric title="זמין כרגע" value={money(summary.currentBalance)} hint={`כולל ${money(summary.donationIncome)} תרומות מאז הפתיחה`} icon={<Landmark size={18} />} tone={summary.currentBalance >= 0 ? 'blue' : 'red'} />
      <Metric title="מחויב לצאת" value={money(summary.committedExpense)} hint={`מול ${money(summary.committedIncome)} הכנסה מובטחת`} icon={<CalendarClock size={18} />} tone="amber" />
      <Metric title="בטוח לשימוש" value={money(summary.safeToUse)} hint="לפעילות חדשה או משכורת, אחרי כל ההגנות" icon={<ShieldCheck size={18} />} tone={summary.safeToUse > 0 ? 'green' : 'red'} />
      <Metric title="ההתחשבנות שלי" value={summary.personalBalance === 0 ? 'מאוזן' : money(Math.abs(summary.personalBalance))} hint={personalText} icon={<WalletCards size={18} />} tone={summary.personalBalance >= 0 ? 'purple' : 'amber'} />
    </div>

    <div className="grid lg:grid-cols-2 gap-3">
      <section className="bg-white border border-[#EDE6D6] rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2 mb-3"><h2 className="font-bold text-[#0D1B2A]">מה אפשר לעשות עכשיו</h2><button onClick={onSettings} className="text-xs text-[#9B7A2F] font-bold flex items-center gap-1"><Settings size={13} /> כללי חישוב</button></div>
        <div className="space-y-2 text-sm">
          <Line label={`תחזית בטוחה ל־${data.forecastDays} יום`} value={money(summary.guaranteedBalance)} />
          <Line label="תחזית אם גם הצפוי ייכנס" value={money(summary.optimisticBalance)} />
          <Line label="כסף שמוגן לשכירות, רזרבה וחובות" value={money(summary.protectedAmount)} />
        </div>
        {data.nextRentAmount > 0 && <div className={`mt-3 rounded-xl p-3 text-xs font-bold ${rentCovered ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
          {rentCovered ? '✓ לפי המצב הנוכחי יש כיסוי לשכירות הקרובה' : `⚠ חסרים ${money(data.nextRentAmount + data.safetyReserve + Math.max(0, summary.personalBalance) - summary.currentBalance)} לכיסוי השכירות, הרזרבה והחובות`}
        </div>}
        {(summary.firstRiskDate || summary.currentBalance < summary.protectedAmount) && <div className="mt-2 bg-red-50 text-red-700 rounded-xl p-3 text-xs font-bold">
          ⚠ התזרים הבטוח יורד מתחת לסכום המוגן {summary.firstRiskDate ? `ב־${dateLabel(summary.firstRiskDate)}` : 'כבר עכשיו'}
        </div>}
      </section>

      <section className="bg-white border border-[#EDE6D6] rounded-2xl p-4">
        <h2 className="font-bold text-[#0D1B2A] mb-3">הוספה מהירה</h2>
        <div className="grid grid-cols-2 gap-2">
          <Quick label="הוצאה" icon={<ArrowDownLeft size={17} />} onClick={() => onAdd('expense')} />
          <Quick label="הוצאה מכיסי" icon={<WalletCards size={17} />} onClick={() => onAdd('personal_expense')} />
          <Quick label="מזומן שקיבלתי" icon={<ArrowUpRight size={17} />} onClick={() => onAdd('cash_income')} />
          <Quick label="הוצאה עתידית" icon={<CalendarClock size={17} />} onClick={() => onAdd('expense', 'committed')} />
          <Quick label="הכנסה צפויה" icon={<Plus size={17} />} onClick={() => onAdd('income', 'expected')} />
          <Quick label="משכורת מהמזומן" icon={<Landmark size={17} />} onClick={() => onAdd('salary')} />
        </div>
      </section>
    </div>

    <section className="bg-white border border-[#EDE6D6] rounded-2xl p-4">
      <h2 className="font-bold text-[#0D1B2A] mb-3">הקרוב בתזרים</h2>
      {upcoming.length === 0 ? <p className="text-sm text-gray-400">אין כרגע התחייבויות או צפי. אפשר להוסיף מראש הוצאות קבועות.</p> : <div className="divide-y divide-[#F1ECE1]">
        {upcoming.map(tx => <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3 text-sm"><span className="min-w-0"><b className="block truncate text-[#0D1B2A]">{tx.title}</b><small className="text-gray-500">{dateLabel(tx.date)} · {STATUS_LABELS[tx.status]}</small></span><b className={tx.kind.includes('income') ? 'text-emerald-700' : 'text-red-600'}>{money(tx.amount)}</b></div>)}
      </div>}
    </section>
  </div>;
}

function Transactions({ data, onAdd, onEdit, onCancel }: {
  data: FinanceData; onAdd: (kind: FinanceKind, status?: FinanceStatus) => void;
  onEdit: (tx: FinanceTransaction) => void; onCancel: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FinanceStatus | 'all'>('all');
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const list = data.transactions.filter(tx => {
    if (status !== 'all' && tx.status !== status) return false;
    if (month && !tx.date.startsWith(month)) return false;
    const haystack = `${tx.title} ${tx.category} ${tx.scopeName || ''} ${tx.notes || ''}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  }).sort((a, b) => b.date.localeCompare(a.date));
  const totals = list.reduce((sum, tx) => {
    const e = transactionEffects(tx);
    sum.income += e.income; sum.expense += e.expense;
    if (tx.status === 'committed') sum.committed += transactionEffects(tx, true).expense;
    return sum;
  }, { income: 0, expense: 0, committed: 0 });
  return <section className="bg-white border border-[#EDE6D6] rounded-2xl overflow-hidden">
    <div className="p-4 border-b border-[#EDE6D6] flex flex-wrap items-center gap-2">
      <button onClick={() => onAdd('expense')} className="bg-[#0D1B2A] text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1"><Plus size={14} /> תנועה</button>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש" className="flex-1 min-w-36 bg-gray-50 border border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none" />
      <select value={status} onChange={e => setStatus(e.target.value as FinanceStatus | 'all')} className="bg-gray-50 border border-[#EDE6D6] rounded-xl px-2 py-2 text-xs">
        <option value="all">כל המצבים</option>{Object.entries(STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
      <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="bg-gray-50 border border-[#EDE6D6] rounded-xl px-2 py-2 text-xs" aria-label="חודש" />
      {month && <button onClick={() => setMonth('')} className="text-[11px] text-gray-500 font-bold">כל הזמנים</button>}
    </div>
    <div className="bg-[#FAF6EE] px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1 text-xs"><span>הכנסות בפועל <b className="text-emerald-700">{money(totals.income)}</b></span><span>הוצאות בפועל <b className="text-red-600">{money(totals.expense)}</b></span><span>עוד מחויב לצאת <b className="text-amber-700">{money(totals.committed)}</b></span></div>
    {list.length === 0 ? <p className="p-8 text-center text-sm text-gray-400">לא נמצאו תנועות</p> : <div className="divide-y divide-[#F1ECE1]">
      {list.map(tx => <div key={tx.id} className={`p-3 sm:p-4 flex items-center gap-3 ${tx.status === 'cancelled' ? 'opacity-45' : ''}`}>
        <span className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${isIncoming(tx.kind) ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{isIncoming(tx.kind) ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}</span>
        <span className="min-w-0 flex-1"><b className="block text-sm text-[#0D1B2A] truncate">{tx.title}</b><small className="text-gray-500 block truncate">{dateLabel(tx.date)} · {tx.category} · {STATUS_LABELS[tx.status]}{tx.scopeName ? ` · ${tx.scopeName}` : ''}{tx.history.length ? ` · ${tx.history.length} שינויים` : ''}</small></span>
        <b className={`text-sm shrink-0 ${isIncoming(tx.kind) ? 'text-emerald-700' : 'text-red-600'}`}>{money(tx.amount)}</b>
        <button onClick={() => onEdit(tx)} className="p-2 text-gray-500" aria-label="ערוך"><Pencil size={15} /></button>
        {tx.status !== 'cancelled' && <button onClick={() => { if (confirm('לבטל את הרשומה? היא תישמר בהיסטוריה ולא תימחק.')) onCancel(tx.id); }} className="p-2 text-red-400" aria-label="בטל"><Undo2 size={15} /></button>}
      </div>)}
    </div>}
  </section>;
}

function Scopes({ scopes, budgets, onAdd }: { scopes: ReturnType<typeof summarizeScopes>; budgets: BudgetReference[]; onAdd: () => void }) {
  return <div className="space-y-4">
    <section className="bg-white border border-[#EDE6D6] rounded-2xl p-4">
      <div className="flex justify-between items-center mb-3"><div><h2 className="font-bold text-[#0D1B2A]">מה עלה וכמה חסר</h2><p className="text-xs text-gray-500">לפי התנועות ששויכו במרכז הכספי</p></div><button onClick={onAdd} className="text-xs text-[#9B7A2F] font-bold flex items-center gap-1"><Plus size={13} /> תכנון</button></div>
      {scopes.length === 0 ? <p className="text-sm text-gray-400 py-5 text-center">שייך תנועה לאירוע, חג או פרויקט כדי לראות כאן תמונה מלאה.</p> : <div className="grid md:grid-cols-2 gap-2">
        {scopes.map(row => <div key={row.key} className="border border-[#EDE6D6] rounded-xl p-3"><div className="flex justify-between gap-2"><span><small className="text-gray-400">{SCOPE_LABELS[row.type]}</small><b className="block text-sm text-[#0D1B2A]">{row.name}</b></span><b className={row.projectedBalance >= 0 ? 'text-emerald-700' : 'text-red-600'}>{money(row.projectedBalance)}</b></div><div className="mt-2 text-[11px] text-gray-500 flex flex-wrap gap-x-3"><span>נכנס {money(row.actualIncome)}</span><span>יצא {money(row.actualExpense)}</span><span>עוד צפוי לצאת {money(row.futureExpense)}</span></div>{row.projectedBalance < 0 && <p className="text-[11px] text-red-600 font-bold mt-2">צריך להשיג {money(Math.abs(row.projectedBalance))} כדי שהיעד יכסה את עצמו</p>}</div>)}
      </div>}
    </section>
    {budgets.length > 0 && <section className="bg-[#FAF6EE] border border-[#EDE6D6] rounded-2xl p-4"><h2 className="font-bold text-[#0D1B2A]">תקציבים שכבר קיימים באפליקציה</h2><p className="text-xs text-gray-500 mb-3">מוצגים כהפניה בלבד ואינם נספרים שוב בתזרים.</p><div className="grid md:grid-cols-2 gap-2">{budgets.map(row => <div key={row.key} className="bg-white rounded-xl p-3 border border-[#EDE6D6]"><small className="text-gray-400">{row.type}</small><b className="block text-sm">{row.name}</b><p className="text-xs text-gray-500 mt-1">תוכנן {money(row.planned)} · יצא {money(row.actual)} · נכנס {money(row.income)}</p></div>)}</div></section>}
  </div>;
}

function ImportAndReports({ data, donations, persist }: { data: FinanceData; donations: Donation[]; persist: (data: FinanceData) => Promise<boolean> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedFinanceRow[]>([]);
  const [error, setError] = useState('');
  const [positiveMeans, setPositiveMeans] = useState<'income' | 'expense'>('income');
  const accepted = rows.filter(row => !row.duplicate && !row.warning);
  const read = async (file?: File) => {
    if (!file) return;
    setError('');
    try { setRows(parseFinanceFile(await file.text(), data.transactions, positiveMeans)); }
    catch (e: unknown) { setRows([]); setError(e instanceof Error ? e.message : 'לא ניתן לקרוא את הקובץ'); }
  };
  const download = () => {
    const blob = new Blob([financeCsv(data, donations)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `כספים-${todayIso()}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return <div className="grid lg:grid-cols-2 gap-4">
    <section className="bg-white border border-[#EDE6D6] rounded-2xl p-4 space-y-3">
      <h2 className="font-bold text-[#0D1B2A] flex items-center gap-2"><FileUp size={17} /> ייבוא תנועות</h2>
      <p className="text-xs text-gray-500">הקובץ נקרא במכשיר. CSV, TSV או JSON; קובץ Excel אפשר לשמור תחילה כ־CSV.</p>
      <label className="block text-xs font-bold text-gray-600">בקובץ עם עמודת סכום אחת, סכום חיובי הוא
        <select value={positiveMeans} onChange={e => setPositiveMeans(e.target.value as 'income' | 'expense')} className="mr-2 border border-[#EDE6D6] rounded-lg px-2 py-1"><option value="income">הכנסה</option><option value="expense">הוצאה</option></select>
      </label>
      <input ref={fileRef} type="file" accept=".csv,.tsv,.json,.txt,text/csv,application/json" className="hidden" onChange={e => read(e.target.files?.[0])} />
      <button onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-[#D9CBAA] rounded-xl p-5 text-sm font-bold text-[#9B7A2F]">בחר קובץ</button>
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
      {rows.length > 0 && <div className="space-y-2"><div className="text-xs flex gap-3"><b>{accepted.length} מוכנות</b><span>{rows.filter(r => r.duplicate).length} כפולות</span><span>{rows.filter(r => r.warning).length} דורשות תיקון</span></div><div className="max-h-52 overflow-auto border border-[#EDE6D6] rounded-xl divide-y">{rows.slice(0, 100).map(row => <div key={row.row} className="p-2 text-xs flex justify-between gap-2"><span className="truncate">{row.transaction.date} · {row.transaction.title}</span><span className={row.duplicate || row.warning ? 'text-amber-600' : 'text-[#0D1B2A]'}>{row.duplicate ? 'כפולה' : row.warning || money(row.transaction.amount)}</span></div>)}</div><button disabled={!accepted.length} onClick={async () => { if (await persist(importFinanceRows(data, rows))) setRows([]); }} className="w-full bg-[#0D1B2A] text-white disabled:opacity-40 rounded-xl py-2.5 text-sm font-bold">ייבא {accepted.length} תנועות</button></div>}
    </section>
    <section className="bg-white border border-[#EDE6D6] rounded-2xl p-4 space-y-3">
      <h2 className="font-bold text-[#0D1B2A]">ייצוא ושיתוף</h2>
      <button onClick={download} className="w-full flex items-center justify-between border border-[#EDE6D6] rounded-xl p-3 text-sm font-bold"><span><b className="block">Excel / CSV מלא</b><small className="font-normal text-gray-500">כל התנועות במצבן הנוכחי, כולל רשומות מבוטלות</small></span><Download size={18} /></button>
      <button onClick={() => printPublicReport(data, donations)} className="w-full flex items-center justify-between border border-[#EDE6D6] rounded-xl p-3 text-sm font-bold"><span><b className="block">דוח נקי לשיתוף</b><small className="font-normal text-gray-500">מאחד משכורת והתחשבנות תחת „פעילות כללית”; הסכום הכולל אינו משתנה</small></span><Printer size={18} /></button>
      <div className="bg-blue-50 text-blue-800 rounded-xl p-3 text-xs">בדוח לשיתוף אין שמות תורמים, הערות או פירוט אישי. הוא מציג רק סכומי אמת לפי קטגוריות.</div>
    </section>
  </div>;
}

function FinanceSettings({ data, persist }: { data: FinanceData; persist: (data: FinanceData) => Promise<boolean> }) {
  const [draft, setDraft] = useState(data);
  const [newCategory, setNewCategory] = useState('');
  const patch = <K extends keyof FinanceData>(key: K, value: FinanceData[K]) => setDraft(prev => ({ ...prev, [key]: value }));
  return <div className="grid lg:grid-cols-2 gap-4">
    <section className="bg-white border border-[#EDE6D6] rounded-2xl p-4 space-y-3">
      <h2 className="font-bold text-[#0D1B2A]">נקודת פתיחה והגנות</h2>
      <Field label="תאריך התחלה"><input type="date" value={draft.openingDate} onChange={e => patch('openingDate', e.target.value)} className={INPUT} /></Field>
      <Field label="כמה זמין עכשיו"><MoneyInput value={draft.openingBalance} onChange={v => patch('openingBalance', v)} /><small className="text-gray-500">מה שכבר נכנס היום נחשב כחלק מהסכום הזה; רק תנועות חדשות יתווספו אליו</small></Field>
      <Field label="התחשבנות בתחילת הדרך"><MoneyInput value={draft.openingPersonalBalance} onChange={v => patch('openingPersonalBalance', v)} /><small className="text-gray-500">חיובי = הפעילות חייבת לך; שלילי = אתה חייב לפעילות</small></Field>
      <Field label="רזרבת ביטחון"><MoneyInput value={draft.safetyReserve} onChange={v => patch('safetyReserve', v)} /></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="שכירות קרובה"><MoneyInput value={draft.nextRentAmount} onChange={v => patch('nextRentAmount', v)} /></Field><Field label="מועד שכירות"><input type="date" value={draft.nextRentDate} onChange={e => patch('nextRentDate', e.target.value)} className={INPUT} /></Field></div>
      <Field label="כמה ימים קדימה"><input type="number" min="7" max="730" value={draft.forecastDays} onChange={e => patch('forecastDays', Number(e.target.value))} className={INPUT} /></Field>
    </section>
    <section className="space-y-4">
      <div className="bg-white border border-[#EDE6D6] rounded-2xl p-4 space-y-3"><h2 className="font-bold text-[#0D1B2A]">תרומות קיימות</h2><Toggle label="כלול תרומות אוטומטית החל מתאריך הפתיחה" on={draft.includeDonations} set={v => patch('includeDonations', v)} /><Field label="תרומת מזומן שנרשמה באפליקציה"><select value={draft.cashDonations} onChange={e => patch('cashDonations', e.target.value)} className={INPUT}><option value="personal">נמצאת אצלי — חלק מההתחשבנות</option><option value="available">זמינה לפעילות</option><option value="ignore">לא לכלול בחישוב</option></select></Field><p className="text-xs text-gray-500">תרומות אינן מועתקות ואינן משתנות. המרכז רק קורא אותן כדי למנוע הזנה כפולה.</p></div>
      <div className="bg-white border border-[#EDE6D6] rounded-2xl p-4 space-y-3"><h2 className="font-bold text-[#0D1B2A]">קטגוריות</h2><div className="flex flex-wrap gap-1.5">{draft.categories.map(category => <span key={category} className="bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-1 text-xs">{category}</span>)}</div><div className="flex gap-2"><input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="קטגוריה חדשה" className={`${INPUT} flex-1`} /><button onClick={() => { const value = newCategory.trim(); if (!value) return; patch('categories', Array.from(new Set([...draft.categories, value]))); setNewCategory(''); }} className="bg-gray-100 px-3 rounded-xl text-xs font-bold">הוסף</button></div></div>
      <button onClick={() => persist(normalizeFinanceData({ ...draft, openingRecordedAt:
        draft.openingDate !== data.openingDate || draft.openingBalance !== data.openingBalance
          ? new Date().toISOString() : data.openingRecordedAt
      }))} className="w-full bg-[#0D1B2A] text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"><Save size={16} /> שמור הגדרות</button>
    </section>
  </div>;
}

function TransactionEditor({ value, categories, scopeSuggestions, onClose, onSave }: {
  value: Partial<FinanceTransaction>; categories: string[]; scopeSuggestions: string[];
  onClose: () => void; onSave: (value: Partial<FinanceTransaction>, repeats: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [advanced, setAdvanced] = useState(false);
  const [repeats, setRepeats] = useState(1);
  const patch = <K extends keyof FinanceTransaction>(key: K, val: FinanceTransaction[K]) => setDraft(prev => ({ ...prev, [key]: val }));
  const addSplit = () => patch('allocations', [...(draft.allocations || []), { id: `split_${Date.now()}`, label: '', amount: 0 }]);
  const valid = !!String(draft.title || '').trim() && Number(draft.amount) > 0 && !!draft.date;
  return <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="bg-white w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4" dir="rtl">
      <div className="flex justify-between items-center"><div><h2 className="font-['Frank_Ruhl_Libre'] text-xl font-black text-[#0D1B2A]">{draft.id ? 'עריכת תנועה' : 'תנועה חדשה'}</h2><p className="text-xs text-gray-500">כל שינוי נשמר בהיסטוריה; ביטול אינו מוחק.</p></div><button onClick={onClose} className="p-2"><X size={20} /></button></div>
      <Field label="מה קרה"><select value={draft.kind || 'expense'} onChange={e => patch('kind', e.target.value)} className={INPUT}>{Object.entries(KIND_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="סכום"><MoneyInput value={Number(draft.amount || 0)} onChange={v => patch('amount', v)} /></Field><Field label="תאריך / מועד"><input type="date" value={draft.date || ''} onChange={e => patch('date', e.target.value)} className={INPUT} /></Field></div>
      <Field label="תיאור"><input value={draft.title || ''} onChange={e => patch('title', e.target.value)} placeholder="למשל: קניות לפורים" className={INPUT} autoFocus /></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="מצב"><select value={draft.status || 'actual'} onChange={e => patch('status', e.target.value)} className={INPUT}>{Object.entries(STATUS_LABELS).filter(([id]) => id !== 'cancelled').map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field><Field label="קטגוריה"><input list="finance-categories" value={draft.category || ''} onChange={e => patch('category', e.target.value)} className={INPUT} /><datalist id="finance-categories">{categories.map(c => <option key={c} value={c} />)}</datalist></Field></div>
      {!draft.id && draft.status !== 'actual' && <Field label="חזרה חודשית"><select value={repeats} onChange={e => setRepeats(Number(e.target.value))} className={INPUT}><option value="1">פעם אחת</option><option value="3">3 חודשים</option><option value="6">6 חודשים</option><option value="12">12 חודשים</option><option value="24">24 חודשים</option></select></Field>}
      <button onClick={() => setAdvanced(!advanced)} className="text-xs text-[#9B7A2F] font-bold flex items-center gap-1"><SlidersHorizontal size={13} /> {advanced ? 'פחות פרטים' : 'שיוך, חלוקה והערות'}</button>
      {advanced && <div className="bg-[#FAF6EE] rounded-2xl p-3 space-y-3"><div className="grid grid-cols-2 gap-2"><Field label="סוג שיוך"><select value={draft.scopeType || 'general'} onChange={e => patch('scopeType', e.target.value)} className={INPUT}>{Object.entries(SCOPE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field><Field label="שם האירוע / היעד"><input list="finance-scopes" value={draft.scopeName || ''} onChange={e => patch('scopeName', e.target.value)} className={INPUT} /><datalist id="finance-scopes">{scopeSuggestions.map(x => <option key={x} value={x} />)}</datalist></Field></div><Field label="אמצעי"><input value={draft.method || ''} onChange={e => patch('method', e.target.value)} placeholder="בנק, מזומן, צ׳ק…" className={INPUT} /></Field><Field label="הערות"><textarea value={draft.notes || ''} onChange={e => patch('notes', e.target.value)} className={`${INPUT} min-h-16`} /></Field><div><div className="flex justify-between items-center"><label className="text-xs font-bold text-gray-600">חלוקה בין כמה יעדים</label><button onClick={addSplit} className="text-xs text-[#9B7A2F] font-bold">+ חלק</button></div>{(draft.allocations || []).map((a, i) => <div key={a.id} className="grid grid-cols-[1fr_100px_28px] gap-1.5 mt-1.5"><input value={a.label} onChange={e => patch('allocations', (draft.allocations || []).map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="שם יעד" className={INPUT} /><MoneyInput value={a.amount} onChange={v => patch('allocations', (draft.allocations || []).map((x, j) => j === i ? { ...x, amount: v } : x))} /><button onClick={() => patch('allocations', (draft.allocations || []).filter((_, j) => j !== i))} className="text-red-400"><X size={15} /></button></div>)}</div></div>}
      {draft.kind === 'cash_income' && <p className="text-xs bg-amber-50 text-amber-800 rounded-xl p-3">ההכנסה תיספר לפעילות, ובמקביל ההתחשבנות תראה שהכסף נמצא אצלך.</p>}
      {draft.kind === 'personal_expense' && <p className="text-xs bg-blue-50 text-blue-800 rounded-xl p-3">ההוצאה תיספר, ובמקביל ההתחשבנות תראה שהפעילות חייבת לך.</p>}
      {!!draft.history?.length && <details className="border border-[#EDE6D6] rounded-xl p-3 text-xs"><summary className="font-bold text-gray-600 cursor-pointer">היסטוריית שינויים ({draft.history.length})</summary><div className="mt-2 divide-y divide-[#EDE6D6]">{[...draft.history].reverse().map((revision, index) => <div key={`${revision.at}_${index}`} className="py-2"><b>{new Date(revision.at).toLocaleString('he-IL')}</b><div className="text-gray-500">{revision.snapshot.title} · {money(revision.snapshot.amount)} · {STATUS_LABELS[revision.snapshot.status]}</div></div>)}</div></details>}
      <button disabled={!valid} onClick={() => onSave(draft, repeats)} className="w-full bg-[#0D1B2A] text-white disabled:opacity-40 py-3 rounded-xl font-bold">שמור</button>
    </div>
  </div>;
}

function Metric({ title, value, hint, icon, tone }: { title: string; value: string; hint: string; icon: React.ReactNode; tone: string }) {
  const colors: Record<string, string> = { blue: 'bg-blue-50 text-blue-800', red: 'bg-red-50 text-red-700', amber: 'bg-amber-50 text-amber-800', green: 'bg-emerald-50 text-emerald-800', purple: 'bg-purple-50 text-purple-800' };
  return <div className={`rounded-2xl p-3.5 min-h-28 ${colors[tone] || colors.blue}`}><div className="flex items-center gap-1.5 text-xs font-bold opacity-80">{icon}{title}</div><div className="text-xl sm:text-2xl font-black mt-2">{value}</div><div className="text-[10px] mt-1 opacity-80 leading-tight">{hint}</div></div>;
}
function Quick({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) { return <button onClick={onClick} className="border border-[#EDE6D6] hover:bg-[#FAF6EE] rounded-xl p-3 text-right text-xs font-bold text-[#0D1B2A] flex items-center gap-2">{icon}{label}</button>; }
function Line({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-3"><span className="text-gray-500">{label}</span><b className="text-[#0D1B2A]">{value}</b></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1"><span className="block text-xs font-bold text-gray-600">{label}</span>{children}</label>; }
function MoneyInput({ value, onChange }: { value: number; onChange: (value: number) => void }) { return <div className="relative"><span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span><input type="number" inputMode="decimal" value={value || ''} onChange={e => onChange(Number(e.target.value) || 0)} className={`${INPUT} pr-8`} /></div>; }
function Toggle({ label, on, set }: { label: string; on: boolean; set: (value: boolean) => void }) { return <button type="button" onClick={() => set(!on)} className="w-full flex items-center justify-between gap-3 text-right"><span className="text-sm font-bold text-[#0D1B2A]">{label}</span><span className={`w-11 h-6 rounded-full relative ${on ? 'bg-[#C9A84C]' : 'bg-gray-200'}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-0.5' : 'right-0.5'}`} /></span></button>; }
function isIncoming(kind: FinanceKind) { return kind === 'income' || kind === 'cash_income' || kind === 'settlement_to_org'; }

function printPublicReport(data: FinanceData, donations: Donation[]) {
  const grouped = new Map<string, { income: number; expense: number }>();
  data.transactions.filter(tx => tx.status === 'actual').forEach(tx => {
    const sensitive = tx.kind === 'salary' || tx.kind === 'personal_expense' || tx.kind.startsWith('settlement');
    const category = sensitive ? 'פעילות כללית' : (tx.category || 'אחר');
    const row = grouped.get(category) || { income: 0, expense: 0 };
    if (isIncoming(tx.kind)) row.income += tx.amount;
    else if (tx.kind !== 'settlement_to_me') row.expense += tx.amount;
    grouped.set(category, row);
  });
  if (data.includeDonations && data.openingDate) donations.forEach(donation => {
    const rawDate = String(donation.date || '');
    const parts = rawDate.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
    const date = parts ? `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}` : rawDate.slice(0, 10);
    if (!date || date <= data.openingDate || Number(donation.amount) <= 0) return;
    const category = String(donation.purpose || 'תרומה כללית');
    const row = grouped.get(category) || { income: 0, expense: 0 };
    row.income += Number(donation.amount) || 0;
    grouped.set(category, row);
  });
  const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
  const rows = [...grouped.entries()].map(([name, row]) => `<tr><td>${escape(name)}</td><td>₪${row.income.toLocaleString('he-IL')}</td><td>₪${row.expense.toLocaleString('he-IL')}</td></tr>`).join('');
  const totalIncome = [...grouped.values()].reduce((sum, row) => sum + row.income, 0);
  const totalExpense = [...grouped.values()].reduce((sum, row) => sum + row.expense, 0);
  const win = window.open('', '_blank');
  if (!win) { alert('הדפדפן חסם את חלון הדוח. אפשר חלונות קופצים ונסה שוב.'); return; }
  win.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>דוח פעילות כספית</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#172033}h1{margin-bottom:4px}p{color:#667085}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:right}tfoot{font-weight:bold}.note{font-size:12px;margin-top:24px}@media print{button{display:none}}</style></head><body><h1>דוח פעילות כספית</h1><p>סיכום פנימי שהוכן לשיתוף · ${new Date().toLocaleDateString('he-IL')}</p><table><thead><tr><th>קטגוריה</th><th>הכנסות</th><th>הוצאות</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td>סה״כ</td><td>₪${totalIncome.toLocaleString('he-IL')}</td><td>₪${totalExpense.toLocaleString('he-IL')}</td></tr></tfoot></table><p class="note">פרטים אישיים אוחדו תחת „פעילות כללית”. הסכומים הכוללים נשמרו ללא שינוי.</p><button onclick="print()">הדפס / שמור PDF</button></body></html>`);
  win.document.close();
}
