import React, { useMemo, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { buildHistoryEntry, HistoryEntry } from '../lib/history';

interface Props {
  onClose: () => void;
  onSave: (entry: HistoryEntry) => void;
  nameOptions?: string[];
}

const namesFromText = (text: string) => Array.from(new Set(
  text.split(/[\n,;]+/).map(name => name.trim()).filter(Boolean)
));

export function PastOccurrenceSummaryModal({ onClose, onSave, nameOptions = [] }: Props) {
  const [type, setType] = useState<'event' | 'holiday'>('event');
  const [name, setName] = useState('');
  const [occurrenceDate, setOccurrenceDate] = useState('');
  const [summary, setSummary] = useState('');
  const [good, setGood] = useState('');
  const [improve, setImprove] = useState('');
  const [plan, setPlan] = useState('');
  const [attendees, setAttendees] = useState('');
  const [actualExpense, setActualExpense] = useState('');
  const [actualIncome, setActualIncome] = useState('');

  const options = useMemo(() => Array.from(new Set(nameOptions.filter(Boolean))).sort(), [nameOptions]);

  const save = () => {
    if (!name.trim()) return;
    const dateKey = occurrenceDate || 'ללא תאריך';
    const attendeeNames = namesFromText(attendees);
    const attendance = attendeeNames.length
      ? { [dateKey]: Object.fromEntries(attendeeNames.map(person => [person, true])) }
      : {};
    const expense = Number(actualExpense) || 0;
    const income = Number(actualIncome) || 0;
    onSave(buildHistoryEntry({
      type,
      name: name.trim(),
      occurrenceDate: occurrenceDate || undefined,
      attendance,
      budget: {
        expenses: expense ? [{ name: 'סה״כ הוצאות', planned: '', actual: expense }] : [],
        income: income ? [{ name: 'סה״כ הכנסות', planned: '', actual: income }] : [],
      },
      insights: { summary, good, improve, plan },
    }));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[220] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl p-5 pb-8 w-full max-w-[520px] max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A] flex items-center gap-2">
            <CalendarDays size={20} className="text-[#9B7A2F]" /> סיכום פעילות שהסתיימה
          </h2>
          <button onClick={onClose} aria-label="סגירת סיכום" className="bg-gray-200/60 p-2 rounded-full text-gray-500"><X size={16} /></button>
        </div>

        <p className="text-[11px] text-gray-500 leading-relaxed mb-4">
          הסיכום נשמר בהיסטוריה, יחד עם נוכחות והסכומים בפועל, כדי שיהיה אפשר ללמוד ממנו בפעם הבאה. תמיד אפשר לפתוח אותו שוב ולהוסיף פירוט.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button onClick={() => setType('event')} className={`rounded-xl border py-2 text-xs font-bold ${type === 'event' ? 'bg-[#0D1B2A] text-[#E8C97A] border-[#0D1B2A]' : 'bg-white text-gray-500 border-[#EDE6D6]'}`}>📌 פעילות או אירוע</button>
          <button onClick={() => setType('holiday')} className={`rounded-xl border py-2 text-xs font-bold ${type === 'holiday' ? 'bg-[#0D1B2A] text-[#E8C97A] border-[#0D1B2A]' : 'bg-white text-gray-500 border-[#EDE6D6]'}`}>✡️ חג</button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_150px] gap-2">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">שם הפעילות או החג *</label>
              <input list="past-occurrence-names" value={name} onChange={e => setName(e.target.value)} placeholder="ליל הסדר" className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C]" />
              <datalist id="past-occurrence-names">{options.map(option => <option key={option} value={option} />)}</datalist>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">מתי היה</label>
              <input type="date" value={occurrenceDate} onChange={e => setOccurrenceDate(e.target.value)} className="w-full bg-white border border-[#EDE6D6] rounded-lg px-2 py-2 text-sm outline-none focus:border-[#C9A84C]" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">מה היה בפועל</label>
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3} placeholder="תיאור קצר של הפעילות, התוכנית ומה קרה..." className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C] resize-none" />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">מי הגיע</label>
            <textarea value={attendees} onChange={e => setAttendees(e.target.value)} rows={2} placeholder="שם בכל שורה, או שמות מופרדים בפסיקים" className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C] resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">סה״כ הוצאות בפועל</label>
              <input type="number" min="0" value={actualExpense} onChange={e => setActualExpense(e.target.value)} placeholder="₪" className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C]" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">סה״כ הכנסות בפועל</label>
              <input type="number" min="0" value={actualIncome} onChange={e => setActualIncome(e.target.value)} placeholder="₪" className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C]" />
            </div>
          </div>

          <details className="bg-white border border-[#EDE6D6] rounded-xl p-3">
            <summary className="text-xs font-bold text-[#9B7A2F] cursor-pointer">תובנות לקראת הפעם הבאה — אופציונלי</summary>
            <div className="space-y-2 mt-3">
              <textarea value={good} onChange={e => setGood(e.target.value)} rows={2} placeholder="מה עבד טוב" className="w-full border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm resize-none outline-none focus:border-[#C9A84C]" />
              <textarea value={improve} onChange={e => setImprove(e.target.value)} rows={2} placeholder="מה כדאי לשפר" className="w-full border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm resize-none outline-none focus:border-[#C9A84C]" />
              <textarea value={plan} onChange={e => setPlan(e.target.value)} rows={2} placeholder="מה לעשות בפעם הבאה" className="w-full border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm resize-none outline-none focus:border-[#C9A84C]" />
            </div>
          </details>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2.5 bg-gray-100 rounded-xl text-gray-500 text-sm font-bold">ביטול</button>
          <button onClick={save} disabled={!name.trim()} className="flex-1 py-2.5 bg-gradient-to-br from-[#0D1B2A] to-[#1A2E45] text-[#E8C97A] rounded-xl text-sm font-bold disabled:opacity-40">שמור בהיסטוריה</button>
        </div>
      </div>
    </div>
  );
}
