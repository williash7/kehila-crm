import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import type { HkEntry } from '../lib/standingOrders';
import { addManualChargeFailureQueued } from '../lib/api';
import { useAppStore } from '../store/AppContext';

function todayIso() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function ManualFailureDialog({ target, onClose }: { target: HkEntry; onClose: () => void }) {
  const { refresh } = useAppStore();
  const [date, setDate] = React.useState(todayIso());
  const [amount, setAmount] = React.useState(String(target.amount || ''));
  const [reason, setReason] = React.useState('לא התקבל מייל שגיאה מהספק');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [done, setDone] = React.useState('');

  const submit = async () => {
    if (!target.id || !date || !(Number(amount) > 0) || !reason.trim()) return;
    setBusy(true); setError('');
    const outcome = await addManualChargeFailureQueued({
      orderId: target.id,
      date,
      amount: Number(amount),
      reason: reason.trim(),
      audit: { label: 'סימון כשל חיוב ידני', subject: target.name, details: `הוראה ${target.id}` },
    });
    setBusy(false);
    if (outcome.status === 'failed') {
      setError(outcome.error);
      return;
    }
    if (outcome.status === 'queued') {
      setDone('הסימון נשמר במכשיר וממתין לשליחה. אין צורך ללחוץ שוב.');
      return;
    }
    setDone(outcome.res?.duplicate
      ? 'הכשל כבר היה רשום בחודש הזה; החיוב סומן שוב כנכשל בלי ליצור כפילות.'
      : 'הכשל נרשם והחיוב של החודש הוצא מסכומי התרומות.');
    refresh();
  };

  return (
    <div className="fixed inset-0 z-[220] bg-black/45 flex items-end sm:items-center justify-center" dir="rtl" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-4 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2">
            <span className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0"><AlertTriangle size={18} /></span>
            <div><h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">סימון חיוב שנכשל</h3><p className="text-[11px] text-gray-500 mt-0.5">למקרה שהחיוב נדחה אך לא התקבל מייל שגיאה.</p></div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={19} /></button>
        </div>

        <div className="bg-[#FAF6EE] border border-[#EDE6D6] rounded-xl p-3 mb-3 text-xs">
          <div className="font-bold text-[#0D1B2A]">{target.name}</div>
          <div className="text-gray-500 mt-1">הוראה <span dir="ltr">#{target.id}</span> · {Number(target.amount || 0).toLocaleString('he-IL')} ₪ לחודש</div>
        </div>

        {!done ? <div className="space-y-3">
          <label className="block text-xs font-bold text-gray-700">תאריך החיוב
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full bg-gray-50 border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm" />
          </label>
          <label className="block text-xs font-bold text-gray-700">סכום שנכשל
            <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 w-full bg-gray-50 border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm" />
          </label>
          <label className="block text-xs font-bold text-gray-700">סיבה או הערה
            <input value={reason} onChange={e => setReason(e.target.value)} className="mt-1 w-full bg-gray-50 border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm" />
          </label>
          <div className="text-[11px] text-red-800 bg-red-50 border border-red-200 rounded-xl p-2.5 leading-relaxed">הפעולה תוסיף את הכשל ליומן ותסמן את חיוב החודש כ„נכשל”, ולכן הוא לא ייספר ככסף שנכנס. הוראת הקבע עצמה לא תבוטל.</div>
          {error && <div className="text-xs text-red-600">{error}</div>}
          <div className="flex gap-2">
            <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 rounded-xl border border-[#EDE6D6] text-xs font-bold text-gray-600">חזרה</button>
            <button onClick={submit} disabled={busy || !date || !(Number(amount) > 0) || !reason.trim()} className="flex-[2] py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-2">{busy && <Loader2 size={14} className="animate-spin" />}סמן את החיוב כנכשל</button>
          </div>
        </div> : (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs leading-relaxed flex gap-2"><CheckCircle2 size={16} className="shrink-0" />{done}</div>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#0D1B2A] text-white text-xs font-bold">סגור</button>
          </div>
        )}
      </div>
    </div>
  );
}
