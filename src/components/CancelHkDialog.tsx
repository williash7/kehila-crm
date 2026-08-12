import React, { useState } from 'react';
import { useAppStore } from '../store/AppContext';
import { apiPost } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// ביטול הוראת קבע.
//
// הוראות קבע מוצגות בשני מקומות (מסך התרומות ומודאל הוראות הקבע), ולכן
// הדיאלוג יושב כאן ולא בתוך אחד מהם. אם היה משוכפל, אחד מהשניים היה נשאר
// מאחור בעדכון הבא.
//
// מה שנשלח לשרת הוא **תאריך אחד בלבד**. כל השאר — אילו חיובים מתבטלים, מה
// יוצא מהסכומים — מחושב בגיליון בכל ריצה. לכן ביטול מהאפליקציה וכתיבה ידנית
// של התאריך בגיליון הם אותה פעולה בדיוק.
// ─────────────────────────────────────────────────────────────────────────────

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CancelHkDialog({ target, onClose }: { target: any; onClose: () => void }) {
  const { refresh } = useAppStore();
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isCancelled = !!target.cancelDate;

  async function submit() {
    setBusy(true);
    setError('');
    const res = await apiPost('cancelStandingOrder', {
      id: target.id,
      date: isCancelled ? '' : date,
      reason: isCancelled ? '' : reason.trim(),
    });
    setBusy(false);
    if (res?.error || res?.success === false) {
      setError(res.error || 'הפעולה נכשלה');
      return;
    }
    onClose();
    refresh();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[210] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-sm p-4 shadow-xl border border-[#EDE6D6]">
        <h3 className="font-['Frank_Ruhl_Libre'] text-base font-bold text-[#0D1B2A] mb-1">
          {isCancelled ? 'החזרת הוראת קבע' : 'ביטול הוראת קבע'}
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          {target.name} · ₪{(Number(target.amount) || 0).toLocaleString()} לחודש
        </p>

        {isCancelled ? (
          <p className="text-xs text-gray-600 leading-relaxed bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 mb-3">
            ההוראה בוטלה בתאריך <b>{target.cancelDate}</b>. החזרה תמחק את תאריך הביטול,
            והחיובים החודשיים ייווצרו וייספרו שוב מאותו תאריך והלאה.
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-600 leading-relaxed bg-orange-50 border border-orange-200 rounded-lg p-2.5 mb-3">
              חיובים <b>לפני</b> התאריך שתבחר נשארים ונספרים. מהתאריך והלאה — לא ייווצרו,
              ומה שכבר נוצר יסומן "מבוטל" ויצא מהסכומים. אפשר להחזיר בכל רגע.
            </p>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">מאיזה תאריך</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-[#EDE6D6] rounded-lg px-2 py-2 text-sm outline-none focus:border-[#C9A84C] mb-3"
            />
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              סיבה <span className="font-normal text-gray-400">(נשמרת בהערות בגיליון)</span>
            </label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="למשל: בקשת התורם / כרטיס פג תוקף"
              className="w-full border border-[#EDE6D6] rounded-lg px-2 py-2 text-sm outline-none focus:border-[#C9A84C] mb-3"
            />
          </>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-3">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2 rounded-lg text-sm font-bold text-gray-600 border border-[#EDE6D6] disabled:opacity-50"
          >
            חזרה
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className={`flex-1 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 ${
              isCancelled ? 'bg-emerald-600' : 'bg-orange-600'
            }`}
          >
            {busy ? 'רגע...' : isCancelled ? 'החזר הוראה' : 'בטל הוראה'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** כפתור אחיד לשורת הוראת קבע. עוצר את ה-click כדי שלא ייפתח כרטיס התורם. */
export function CancelHkButton({ hk, onOpen }: { hk: any; onOpen: (hk: any) => void }) {
  if (!hk.id) return null;
  const cancelled = !!hk.cancelDate;
  return (
    <button
      onClick={e => { e.stopPropagation(); onOpen(hk); }}
      className={`mt-2 w-full text-[11px] font-bold py-1.5 rounded-lg border transition-colors ${
        cancelled
          ? 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
          : 'text-orange-700 border-orange-200 hover:bg-orange-50'
      }`}
    >
      {cancelled ? '↺ החזר את ההוראה' : '⃠ בטל הוראה'}
    </button>
  );
}
