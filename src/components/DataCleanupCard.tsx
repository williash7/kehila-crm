import React from 'react';
import { AlertTriangle, CheckCircle2, Eraser, Loader2 } from 'lucide-react';
import { CardTitle } from './Explain';
import { useAppStore } from '../store/AppContext';
import { cancelDonationsBulkQueued, isNotDeployed } from '../lib/api';
import { createAndDownloadFullBackup } from '../lib/backupDownload';
import {
  DONATION_SOURCE_LABEL,
  cancelFinanceTransactions,
  donationSourceGroup,
  filterDonationsForCleanup,
  filterFinanceForCleanup,
  financeDirection,
  type DonationSourceGroup,
  type FinanceDirectionFilter,
} from '../lib/dataCleanup';

type Mode = 'donations' | 'finance';
const MAX_SELECTED = 200;
const money = (value: number) => `₪${Number(value || 0).toLocaleString('he-IL')}`;

export function DataCleanupCard() {
  const { donations, financeData, updateFinanceData, refresh } = useAppStore();
  const [mode, setMode] = React.useState<Mode>('donations');
  const [source, setSource] = React.useState<'all' | DonationSourceGroup>('all');
  const [financeSource, setFinanceSource] = React.useState<'all' | 'manual' | 'import'>('all');
  const [direction, setDirection] = React.useState<FinanceDirectionFilter>('all');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = React.useState('');
  const [reason, setReason] = React.useState('תיקון נתונים שגויים');
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  const filteredDonations = React.useMemo(
    () => filterDonationsForCleanup(donations, { source, from, to }),
    [donations, source, from, to],
  );
  const filteredFinance = React.useMemo(
    () => filterFinanceForCleanup(financeData.transactions, { source: financeSource, direction, from, to }),
    [financeData.transactions, financeSource, direction, from, to],
  );
  const rows = mode === 'donations' ? filteredDonations : filteredFinance;
  const selectableIds = rows
    .filter((row: any) => mode === 'finance' || (donationSourceGroup(row) !== 'standing' && !row.meetDate))
    .map((row: any) => String(row.id || ''))
    .filter(Boolean)
    .slice(0, MAX_SELECTED);
  const selectedRows = rows.filter((row: any) => selected.has(String(row.id || '')));
  const selectedSum = selectedRows.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);

  React.useEffect(() => {
    setSelected(new Set());
    setConfirmText('');
    setMessage('');
    setError('');
  }, [mode, source, financeSource, direction, from, to]);

  const toggle = (id: string) => {
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_SELECTED) next.add(id);
      return next;
    });
  };

  const selectVisible = () => {
    const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  };

  const runCleanup = async () => {
    if (!selected.size || confirmText.trim() !== 'נקה') return;
    setBusy(true); setError(''); setMessage('');
    try {
      setProgress('יוצר ומוריד גיבוי מלא לפני השינוי...');
      await createAndDownloadFullBackup(p => setProgress(`גיבוי: ${p.label}`));

      if (mode === 'donations') {
        setProgress('מבטל רק את התרומות שבחרת...');
        const outcome = await cancelDonationsBulkQueued({
          ids: [...selected],
          reason,
          audit: { label: 'ניקוי תרומות ממוקד', details: `${selected.size} רשומות נבחרו · ${reason}` },
        });
        if (outcome.status === 'failed') throw new Error(outcome.error);
        if (outcome.status === 'queued') {
          setMessage('הגיבוי הורד. פעולת הניקוי נשמרה במכשיר וממתינה לשליחה; אין ללחוץ שוב.');
        } else {
          const result = outcome.res || {};
          const skipped = Number(result.mixed || 0) + Number(result.protected || 0) + Number(result.missing || 0);
          setMessage(`הגיבוי הורד ו־${result.cancelled || 0} תרומות הוצאו מהסכומים.${skipped ? ` ${skipped} רשומות מוגנות לא שונו.` : ''}`);
          await refresh();
        }
      } else {
        setProgress('מבטל את התנועות ושומר אותן בהיסטוריה...');
        const original = financeData;
        const result = cancelFinanceTransactions(original, selected);
        const outcome = await updateFinanceData(result.data);
        if (outcome.status === 'failed') {
          await updateFinanceData(original);
          throw new Error(outcome.error);
        }
        setMessage(outcome.status === 'queued'
          ? `הגיבוי הורד. ${result.cancelled} תנועות בוטלו מקומית וממתינות לסנכרון; אין ללחוץ שוב.`
          : `הגיבוי הורד ו־${result.cancelled} תנועות בוטלו. הן נשארו בהיסטוריה ואינן נספרות.`);
      }
      setSelected(new Set());
      setConfirmText('');
    } catch (e: any) {
      const suffix = isNotDeployed(e) ? ' יש לעדכן את הסקריפט בגיליון ולפרוס גרסה חדשה.' : '';
      setError(`לא בוצע ניקוי: ${String(e?.message || e)}.${suffix}`);
    } finally {
      setBusy(false); setProgress('');
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0"><Eraser size={18} /></span>
        <CardTitle title="ניקוי נתונים ממוקד">
          בוחרים בדיוק אילו תרומות או תנועות שגויות להוציא מהחישובים. לפני כל שינוי יורד גיבוי מלא; הרשומות נשמרות בהיסטוריה ולא נמחקות לצמיתות.
        </CardTitle>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setMode('donations')} className={`py-2 rounded-xl text-xs font-bold border ${mode === 'donations' ? 'bg-[#0D1B2A] text-white border-[#0D1B2A]' : 'border-[#EDE6D6] text-gray-600'}`}>תרומות</button>
        <button onClick={() => setMode('finance')} className={`py-2 rounded-xl text-xs font-bold border ${mode === 'finance' ? 'bg-[#0D1B2A] text-white border-[#0D1B2A]' : 'border-[#EDE6D6] text-gray-600'}`}>תנועות כספיות</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input type="date" aria-label="מתאריך" value={from} onChange={e => setFrom(e.target.value)} className="bg-gray-50 border border-[#EDE6D6] rounded-xl px-2 py-2 text-xs" />
        <input type="date" aria-label="עד תאריך" value={to} onChange={e => setTo(e.target.value)} className="bg-gray-50 border border-[#EDE6D6] rounded-xl px-2 py-2 text-xs" />
      </div>

      {mode === 'donations' ? (
        <select value={source} onChange={e => setSource(e.target.value as any)} className="w-full bg-gray-50 border border-[#EDE6D6] rounded-xl px-3 py-2 text-xs">
          <option value="all">כל מקורות התרומות</option>
          {(Object.keys(DONATION_SOURCE_LABEL) as DonationSourceGroup[]).map(key => <option key={key} value={key}>{DONATION_SOURCE_LABEL[key]}</option>)}
        </select>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <select value={financeSource} onChange={e => setFinanceSource(e.target.value as any)} className="bg-gray-50 border border-[#EDE6D6] rounded-xl px-2 py-2 text-xs">
            <option value="all">כל המקורות</option><option value="manual">הוזן ידנית</option><option value="import">יובא מקובץ</option>
          </select>
          <select value={direction} onChange={e => setDirection(e.target.value as any)} className="bg-gray-50 border border-[#EDE6D6] rounded-xl px-2 py-2 text-xs">
            <option value="all">הכנסות והוצאות</option><option value="income">הכנסות</option><option value="expense">הוצאות</option>
          </select>
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">נמצאו {rows.length} · נבחרו {selected.size} בסך {money(selectedSum)}</span>
        <button onClick={selectVisible} disabled={!selectableIds.length} className="font-bold text-[#9B7A2F] disabled:opacity-40">{selectableIds.every(id => selected.has(id)) && selectableIds.length ? 'בטל בחירה' : 'בחר את המוצגים'}</button>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1.5 border-y border-[#EDE6D6] py-2">
        {rows.length === 0 && <div className="text-xs text-gray-400 text-center py-5">אין רשומות שמתאימות לסינון.</div>}
        {rows.slice(0, MAX_SELECTED).map((row: any) => {
          const id = String(row.id || '');
          const protectedRow = mode === 'donations' && (donationSourceGroup(row) === 'standing' || !!row.meetDate);
          const label = mode === 'donations' ? row.name : row.title;
          const sub = mode === 'donations'
            ? `${row.date || 'ללא תאריך'} · ${DONATION_SOURCE_LABEL[donationSourceGroup(row)]}`
            : `${row.date || 'ללא תאריך'} · ${financeDirection(row) === 'income' ? 'הכנסה' : 'הוצאה'} · ${row.source === 'import' ? 'ייבוא' : 'ידני'}`;
          return (
            <label key={id} className={`flex items-center gap-2 rounded-xl border p-2 ${protectedRow ? 'bg-gray-50 opacity-65' : 'bg-white'}`}>
              <input type="checkbox" checked={selected.has(id)} disabled={protectedRow || busy} onChange={() => toggle(id)} />
              <span className="flex-1 min-w-0"><span className="block text-xs font-bold truncate">{label}</span><span className="block text-[10px] text-gray-500">{sub}{protectedRow ? ' · מוגן מניקוי קבוצתי' : ''}</span></span>
              <span className="text-xs font-bold text-[#9B7A2F] shrink-0">{money(row.amount)}</span>
            </label>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
          <div className="flex gap-2 text-[11px] text-red-900 leading-relaxed"><AlertTriangle size={15} className="shrink-0 mt-0.5" />הקלד <b>נקה</b> כדי לאשר. קודם יורד גיבוי; אם הגיבוי נכשל, לא משתנה דבר.</div>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="סיבת הניקוי" className="w-full bg-white border border-red-200 rounded-lg px-2 py-2 text-xs" />
          <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="הקלד נקה" className="w-full bg-white border border-red-200 rounded-lg px-2 py-2 text-xs" />
          <button onClick={runCleanup} disabled={busy || confirmText.trim() !== 'נקה'} className="w-full bg-red-600 text-white rounded-lg py-2.5 text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-2">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Eraser size={14} />} הוצא {selected.size} רשומות מהחישובים
          </button>
        </div>
      )}

      {progress && <div className="text-[11px] text-gray-500 flex items-center gap-2"><Loader2 size={13} className="animate-spin" />{progress}</div>}
      {message && <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex gap-2"><CheckCircle2 size={14} className="shrink-0" />{message}</div>}
      {error && <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl p-2.5">{error}</div>}
    </div>
  );
}
