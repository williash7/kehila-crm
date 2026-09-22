import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import {
  emptyFinanceData,
  normalizeFinanceData,
  saveTransaction,
  todayIso,
  transactionEffects,
  type FinanceTransaction,
} from '../lib/finance';

const money = (value: number) => `₪${Math.round(value || 0).toLocaleString('he-IL')}`;
const dateLabel = (iso: string) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('he-IL') : 'לא נקבע';

/**
 * התחייבויות שהגיע מועדן ועדיין לא סומנו כבוצעו.
 *
 * המטרה כאן היא לא ליצור עוד מסך כספים, אלא לסגור את החור בין התחזית
 * למציאות: התחייבות לא הופכת מעצמה לתשלום רק מפני שהגיע התאריך. לכן,
 * ברגע שהמועד מגיע, מוצג כפתור אחד ברור שמסמן אותה כבוצעה בפועל.
 */
export function DueFinanceCommitments() {
  const { financeData, updateFinanceData } = useAppStore();
  const data = normalizeFinanceData(financeData || emptyFinanceData());
  const today = todayIso();
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  const due = useMemo(() => data.transactions
    .filter(tx =>
      tx.status === 'committed'
      && !!tx.date
      && tx.date <= today
      && transactionEffects(tx, true).expense > 0
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'he')),
  [data.transactions, today]);

  if (due.length === 0) return null;

  const markPaid = async (tx: FinanceTransaction) => {
    if (savingId) return;
    setSavingId(tx.id);
    setError('');
    try {
      // תאריך ההתחייבות המקורי נשמר אוטומטית בהיסטוריית הרשומה על ידי
      // saveTransaction; התאריך הפעיל הופך ליום שבו המשתמש אישר שהתשלום בוצע.
      const next = saveTransaction(data, {
        ...tx,
        status: 'actual',
        date: today,
      });
      const outcome = await updateFinanceData(next);
      if (outcome.status === 'failed') {
        setError(outcome.error || 'לא ניתן היה לשמור את הסימון.');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'לא ניתן היה לשמור את הסימון.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-5 pt-4" dir="rtl">
      <section className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-amber-200 flex items-start gap-2">
          <Clock size={18} className="text-amber-700 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-black text-amber-900">הגיע מועד לתשלום</h2>
            <p className="text-[11px] text-amber-800 mt-0.5">אחרי שהתשלום ירד בפועל, לחץ „שולם” והיתרה תתעדכן מיד.</p>
          </div>
        </div>

        {error && (
          <div className="mx-3 mt-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-2.5 text-xs flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" /> {error}
          </div>
        )}

        <div className="divide-y divide-amber-200/70">
          {due.map(tx => (
            <div key={tx.id} className="px-4 py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <b className="block text-sm text-[#0D1B2A] truncate">{tx.title}</b>
                <small className="block text-[11px] text-amber-800">מועד {dateLabel(tx.date)} · {money(tx.amount)}</small>
              </div>
              <button
                type="button"
                onClick={() => markPaid(tx)}
                disabled={!!savingId}
                className="shrink-0 inline-flex items-center gap-1.5 bg-emerald-700 text-white rounded-xl px-3 py-2 text-xs font-black disabled:opacity-50"
                aria-label={`סמן ${tx.title} כשולם`}
              >
                <CheckCircle2 size={15} />
                {savingId === tx.id ? 'שומר…' : 'שולם'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
