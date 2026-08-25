import React from 'react';
import { ActivityScenarioInput, calculateActivityScenario } from '../lib/activityScenario';
import { createMonthClosureSnapshot, MonthCloseDraft, calculateMonthClose } from '../lib/monthClose';
import {
  ActivityScenarioSnapshot, buildFinanceFlowRows, FinanceData, FinanceSummary,
  transactionEffects,
} from '../lib/finance';
import { Donation } from '../types';
import { CalendarCheck, CheckCircle2, ChevronDown, Landmark, Save, ShieldCheck, Target } from 'lucide-react';

const money = (value: number) => `₪${Math.round(value || 0).toLocaleString('he-IL')}`;
const INPUT = 'w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C]';
const monthNow = () => new Date().toISOString().slice(0, 7);

function amount(value: string): number {
  const result = Number(String(value || '').replace(/,/g, ''));
  return Number.isFinite(result) ? Math.max(0, result) : 0;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block"><span className="block text-xs font-bold text-gray-600 mb-1">{label}</span>{children}{hint && <small className="block text-[10px] text-gray-400 mt-1">{hint}</small>}</label>;
}

function NumberField({ value, setValue, placeholder = '0' }: { value: string; setValue: (value: string) => void; placeholder?: string }) {
  return <input type="number" min="0" step="0.01" value={value} onChange={event => setValue(event.target.value)} placeholder={placeholder} className={INPUT} />;
}

export function FinancePlanningTools({
  data, summary, donations, persist,
}: {
  data: FinanceData;
  summary: FinanceSummary;
  donations: Donation[];
  persist: (next: FinanceData) => Promise<boolean>;
}) {
  const [tool, setTool] = React.useState<'close' | 'scenario'>('close');
  const flowRows = React.useMemo(() => buildFinanceFlowRows(data, donations), [data, donations]);
  const reimbursementBalance = Math.max(0, data.openingPersonalBalance
    + flowRows.filter(row => row.financeKind === 'personal_expense' || row.financeKind === 'settlement_to_me')
      .reduce((sum, row) => sum + row.personalBalanceEffect, 0));
  const heldCash = Math.max(0, reimbursementBalance - summary.personalBalance);
  const charityCash = Math.max(0, flowRows
    .filter(row => row.status === 'actual' && row.includedAfterOpening && row.cashDestination === 'activity_cashbox')
    .reduce((sum, row) => sum + (row.direction === 'income' ? row.amount : -row.amount), 0));
  const computedOrgBalance = summary.currentBalance - charityCash;

  return <div className="space-y-4">
    <div className="bg-white border border-[#EDE6D6] rounded-2xl p-1 grid grid-cols-2 gap-1">
      <button onClick={() => setTool('close')} className={`rounded-xl py-2.5 text-xs font-bold ${tool === 'close' ? 'bg-[#0D1B2A] text-[#C9A84C]' : 'text-gray-500'}`}>סגירת חודש</button>
      <button onClick={() => setTool('scenario')} className={`rounded-xl py-2.5 text-xs font-bold ${tool === 'scenario' ? 'bg-[#0D1B2A] text-[#C9A84C]' : 'text-gray-500'}`}>האם אפשר לקיים פעילות?</button>
    </div>
    {tool === 'close'
      ? <MonthCloseTool data={data} summary={summary} persist={persist} computedOrgBalance={computedOrgBalance} heldCash={heldCash} charityCash={charityCash} />
      : <ScenarioTool data={data} summary={summary} persist={persist} />}
  </div>;
}

function MonthCloseTool({ data, summary, persist, computedOrgBalance, heldCash, charityCash }: {
  data: FinanceData; summary: FinanceSummary; persist: (next: FinanceData) => Promise<boolean>;
  computedOrgBalance: number; heldCash: number; charityCash: number;
}) {
  const checks = data.transactions.filter(tx => tx.status === 'committed' && /צ.?ק/.test(String(tx.method || '')));
  const checksOut = checks.reduce((sum, tx) => sum + transactionEffects(tx, true).expense, 0);
  const checksIn = checks.reduce((sum, tx) => sum + transactionEffects(tx, true).income, 0);
  const [month, setMonth] = React.useState(monthNow());
  const [official, setOfficial] = React.useState('');
  const [mine, setMine] = React.useState('');
  const [box, setBox] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [explained, setExplained] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const draft: MonthCloseDraft = {
    month,
    computedOrgBalance,
    officialOrgBalance: official === '' ? null : Number(official),
    cash: [
      { id: 'held', label: 'מזומן של הפעילות אצלי', computed: heldCash, counted: mine === '' ? null : Number(mine) },
      { id: 'box', label: 'קופת צדקה', computed: charityCash, counted: box === '' ? null : Number(box) },
    ],
    reimbursementDue: Math.max(0, summary.personalBalance),
    heldActivityCash: heldCash,
    commitmentsDue: Math.max(0, summary.committedExpense - checksOut),
    deferredChecksOut: checksOut,
    deferredChecksIn: checksIn,
    notes,
    differencesExplained: explained,
  };
  const result = calculateMonthClose(draft);

  const save = async () => {
    const snapshot = createMonthClosureSnapshot(draft, data.monthClosures);
    const lastClosedMonth = snapshot.status === 'review' ? data.lastClosedMonth : month;
    if (await persist({ ...data, monthClosures: [...data.monthClosures, snapshot], lastClosedMonth })) setSaved(true);
  };
  const load = (snapshot: FinanceData['monthClosures'][number]) => {
    setMonth(snapshot.month); setOfficial(String(snapshot.officialOrgBalance ?? ''));
    setMine(String(snapshot.cash.find(row => row.id === 'held')?.counted ?? ''));
    setBox(String(snapshot.cash.find(row => row.id === 'box')?.counted ?? ''));
    setNotes(snapshot.notes || ''); setExplained(snapshot.status === 'explained'); setSaved(false);
  };

  return <div className="space-y-4">
    <section className="bg-white border border-[#EDE6D6] rounded-2xl p-4 space-y-4">
      <div><h2 className="font-bold text-[#0D1B2A] flex items-center gap-2"><Landmark size={18} /> התאמה חודשית</h2><p className="text-xs text-gray-500 mt-1">מקלידים את היתרה הרשמית ואת המזומן שנספר. האפליקציה מציגה פערים ואינה יוצרת תנועת איזון.</p></div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="חודש"><input type="month" value={month} onChange={event => { setMonth(event.target.value); setSaved(false); }} className={INPUT} /></Field>
        <Field label="יתרת חשבון רשמית" hint={`לפי האפליקציה, ללא קופת הצדקה: ${money(computedOrgBalance)}`}><NumberField value={official} setValue={value => { setOfficial(value); setSaved(false); }} /></Field>
        <Field label="כמה מזומן של הפעילות נמצא אצלי" hint={`לפי הרישום: ${money(heldCash)}`}><NumberField value={mine} setValue={value => { setMine(value); setSaved(false); }} /></Field>
        <Field label="כמה נספר בקופת הצדקה" hint={`לפי התרומות שסווגו לקופה מאז נקודת הפתיחה: ${money(charityCash)}`}><NumberField value={box} setValue={value => { setBox(value); setSaved(false); }} /></Field>
      </div>

      <div className={`rounded-2xl p-4 border ${result.status === 'matched' ? 'bg-emerald-50 border-emerald-200' : result.status === 'explained' ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
        <b className="flex items-center gap-2 text-[#0D1B2A]">{result.status === 'matched' ? <CheckCircle2 size={17} /> : <ShieldCheck size={17} />}{result.status === 'matched' ? 'הכול תואם' : result.complete ? 'יש פער שדורש הסבר' : 'יש להשלים את הספירה'}</b>
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <span>פער בחשבון<b className="block text-sm">{result.orgDifference == null ? '—' : money(result.orgDifference)}</b></span>
          <span>פער במזומן<b className="block text-sm">{result.totalCashDifference == null ? '—' : money(result.totalCashDifference)}</b></span>
          <span>הפעילות חייבת לי<b className="block text-sm">{money(Math.max(0, result.personalPosition))}</b></span>
          <span>מחויב לצאת<b className="block text-sm">{money(result.protectedOutgoing)}</b></span>
        </div>
      </div>

      {result.complete && result.status !== 'matched' && <>
        <Field label="הסבר לפער"><textarea value={notes} onChange={event => { setNotes(event.target.value); setSaved(false); }} className={`${INPUT} min-h-20`} placeholder="למשל: עמלה שטרם הוזנה" /></Field>
        <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={explained} onChange={event => { setExplained(event.target.checked); setSaved(false); }} /> בדקתי והפער מוסבר</label>
      </>}
      <button onClick={save} disabled={!month || saved} className="w-full bg-[#0D1B2A] text-white disabled:opacity-50 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"><Save size={16} /> {saved ? 'התמונה נשמרה' : 'שמור תמונת מצב'}</button>
    </section>

    {data.monthClosures.length > 0 && <SavedList title="סגירות קודמות" rows={[...data.monthClosures].reverse().slice(0, 6).map(row => ({ id: row.id, title: `${row.month} · גרסה ${row.version}`, subtitle: row.status === 'matched' ? 'תואם' : row.status === 'explained' ? 'פער מוסבר' : 'דורש בדיקה', onClick: () => load(row) }))} />}
  </div>;
}

function ScenarioTool({ data, summary, persist }: {
  data: FinanceData; summary: FinanceSummary; persist: (next: FinanceData) => Promise<boolean>;
}) {
  const committedSalary = data.transactions.filter(tx => tx.status === 'committed' && tx.kind === 'salary').reduce((sum, tx) => sum + tx.amount, 0);
  const defaults = (): Record<string, string> => ({
    name: '', activityDate: '', plannedCost: '', alreadyPaid: '', designatedAvailable: '',
    restrictedElsewhere: '', salaryDue: String(committedSalary || ''),
    otherCommitments: String(Math.max(0, summary.committedExpense - committedSalary) || ''),
    guaranteedFutureIncome: String(summary.committedIncome || ''), expectedFutureIncome: String(summary.expectedIncome || ''),
  });
  const [form, setForm] = React.useState(defaults);
  const [saved, setSaved] = React.useState(false);
  const patch = (key: string, value: string) => { setForm(prev => ({ ...prev, [key]: value })); setSaved(false); };
  const input: ActivityScenarioInput = {
    name: form.name,
    activityDate: form.activityDate,
    currentBalance: summary.currentBalance,
    safetyReserve: data.safetyReserve,
    rentDue: data.nextRentAmount,
    salaryDue: amount(form.salaryDue),
    otherCommitments: amount(form.otherCommitments),
    reimbursementDue: Math.max(0, summary.personalBalance),
    restrictedElsewhere: amount(form.restrictedElsewhere),
    designatedAvailable: amount(form.designatedAvailable),
    plannedCost: amount(form.plannedCost),
    alreadyPaid: amount(form.alreadyPaid),
    guaranteedFutureIncome: amount(form.guaranteedFutureIncome),
    expectedFutureIncome: amount(form.expectedFutureIncome),
  };
  const result = calculateActivityScenario(input);

  const save = async () => {
    const now = new Date().toISOString();
    const snapshot: ActivityScenarioSnapshot = { id: `scenario:${Date.now()}`, savedAt: now, input, result };
    if (await persist({ ...data, activityScenarios: [...data.activityScenarios, snapshot] })) setSaved(true);
  };
  const load = (row: ActivityScenarioSnapshot) => {
    setForm({
      name: row.input.name, activityDate: row.input.activityDate, plannedCost: String(row.input.plannedCost || ''),
      alreadyPaid: String(row.input.alreadyPaid || ''), designatedAvailable: String(row.input.designatedAvailable || ''),
      restrictedElsewhere: String(row.input.restrictedElsewhere || ''), salaryDue: String(row.input.salaryDue || ''),
      otherCommitments: String(row.input.otherCommitments || ''), guaranteedFutureIncome: String(row.input.guaranteedFutureIncome || ''),
      expectedFutureIncome: String(row.input.expectedFutureIncome || ''),
    });
    setSaved(false);
  };

  return <div className="space-y-4">
    <section className="bg-white border border-[#EDE6D6] rounded-2xl p-4 space-y-4">
      <div><h2 className="font-bold text-[#0D1B2A] flex items-center gap-2"><Target size={18} /> בדיקת אפשרות לפעילות</h2><p className="text-xs text-gray-500 mt-1">תרחיש בלבד. הוא אינו יוצר פעילות, קמפיין או התחייבות עד שתחליט לעשות זאת בעצמך.</p></div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="שם הפעילות"><input value={form.name} onChange={event => patch('name', event.target.value)} className={INPUT} placeholder="למשל: ליל הסדר" /></Field>
        <Field label="תאריך הפעילות"><input type="date" value={form.activityDate} onChange={event => patch('activityDate', event.target.value)} className={INPUT} /></Field>
        <Field label="עלות מתוכננת"><NumberField value={form.plannedCost} setValue={value => patch('plannedCost', value)} /></Field>
        <Field label="כבר שולם"><NumberField value={form.alreadyPaid} setValue={value => patch('alreadyPaid', value)} /></Field>
        <Field label="כסף שכבר מיועד לפעילות הזו"><NumberField value={form.designatedAvailable} setValue={value => patch('designatedAvailable', value)} /></Field>
        <Field label="כסף שמיועד למטרות אחרות"><NumberField value={form.restrictedElsewhere} setValue={value => patch('restrictedElsewhere', value)} /></Field>
        <Field label="משכורת שעוד צריך לשלם"><NumberField value={form.salaryDue} setValue={value => patch('salaryDue', value)} /></Field>
        <Field label="התחייבויות נוספות"><NumberField value={form.otherCommitments} setValue={value => patch('otherCommitments', value)} /></Field>
        <Field label="הכנסה עתידית מובטחת"><NumberField value={form.guaranteedFutureIncome} setValue={value => patch('guaranteedFutureIncome', value)} /></Field>
        <Field label="הכנסה צפויה בלבד"><NumberField value={form.expectedFutureIncome} setValue={value => patch('expectedFutureIncome', value)} /></Field>
      </div>

      <div className={`rounded-2xl p-4 border ${result.canProceedSafely ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
        <b className="block text-[#0D1B2A]">{result.canProceedSafely ? 'לפי הנתונים אפשר לקיים את הפעילות' : `חסר לגייס ${money(result.fundraisingGap)}`}</b>
        {result.dependsOnExpectedIncome && <p className="text-xs text-amber-800 mt-1">אם כל הצפי ייכנס, הפער ירד ל־{money(result.optimisticFundraisingGap)}. הצפי אינו נחשב כסף בטוח.</p>}
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <span>עלות שנותרה<b className="block text-sm">{money(result.remainingCost)}</b></span>
          <span>זמין בבטחה<b className="block text-sm">{money(result.guaranteedAvailable)}</b></span>
          <span>יתרה כללית בטוחה<b className="block text-sm">{money(result.generalSafeBalance)}</b></span>
          <span>מיועד לפעילות<b className="block text-sm">{money(result.designatedAvailable)}</b></span>
        </div>
        <details className="mt-3 text-xs text-gray-600"><summary className="cursor-pointer font-bold flex items-center gap-1">מה נשמר בצד? <ChevronDown size={13} /></summary><p className="mt-2">רזרבה {money(result.protectedBreakdown.safetyReserve)} · שכירות {money(result.protectedBreakdown.rentDue)} · משכורת {money(result.protectedBreakdown.salaryDue)} · התחייבויות {money(result.protectedBreakdown.otherCommitments)} · החזרים {money(result.protectedBreakdown.reimbursementDue)} · ייעודים אחרים {money(result.protectedBreakdown.restrictedElsewhere)}</p></details>
      </div>
      <button onClick={save} disabled={!form.name.trim() || !form.plannedCost || saved} className="w-full bg-[#0D1B2A] text-white disabled:opacity-50 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"><CalendarCheck size={16} /> {saved ? 'התרחיש נשמר' : 'שמור תרחיש לבדיקה חוזרת'}</button>
    </section>
    {data.activityScenarios.length > 0 && <SavedList title="תרחישים שמורים" rows={[...data.activityScenarios].reverse().slice(0, 6).map(row => ({ id: row.id, title: row.result.name || 'ללא שם', subtitle: row.result.canProceedSafely ? 'אפשרי לפי הנתונים' : `פער ${money(row.result.fundraisingGap)}`, onClick: () => load(row) }))} />}
  </div>;
}

function SavedList({ title, rows }: { title: string; rows: { id: string; title: string; subtitle: string; onClick: () => void }[] }) {
  return <section className="bg-[#FAF6EE] border border-[#EDE6D6] rounded-2xl p-4"><h3 className="font-bold text-sm text-[#0D1B2A] mb-2">{title}</h3><div className="space-y-2">{rows.map(row => <button key={row.id} onClick={row.onClick} className="w-full bg-white border border-[#EDE6D6] rounded-xl p-3 text-right"><b className="block text-sm">{row.title}</b><small className="text-gray-500">{row.subtitle}</small></button>)}</div></section>;
}
