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

// ─────────────────────────────────────────────────────────────────────────────
// שינוי סכום.
//
// גם כאן הספק לא שולח מייל. תורם שהעלה את ההוראה מ-₪100 ל-₪300 נשאר רשום
// על 100, וכל החיובים החודשיים — כולל אלה שכבר נכתבו מראש קדימה — נושאים
// את הסכום הישן. לכן צריך תאריך: מאיזה חיוב הסכום החדש תקף.
// ─────────────────────────────────────────────────────────────────────────────

export function ChangeHkAmountDialog({ target, onClose }: { target: any; onClose: () => void }) {
  const { refresh } = useAppStore();
  const [amount, setAmount] = useState(String(Number(target.amount) || ''));
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<any | null>(null);

  async function submit() {
    const value = Number(amount);
    if (!value || value <= 0) { setError('סכום חייב להיות גדול מאפס'); return; }
    setBusy(true);
    setError('');
    const res = await apiPost('updateStandingOrderAmount', { id: target.id, amount: value, date });
    setBusy(false);
    if (res?.error || res?.success === false) { setError(res.error || 'העדכון נכשל'); return; }
    setDone(res);
    refresh();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[210] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-sm p-4 shadow-xl border border-[#EDE6D6]">
        <h3 className="font-['Frank_Ruhl_Libre'] text-base font-bold text-[#0D1B2A] mb-1">שינוי סכום ההוראה</h3>
        <p className="text-xs text-gray-500 mb-3">
          {target.name} · כרגע ₪{(Number(target.amount) || 0).toLocaleString()} לחודש
        </p>

        {done ? (
          <>
            <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 mb-3">
              הסכום עודכן ל-₪{Number(done.amount).toLocaleString()} החל מ-{done.from}.
              {done.updated > 0 ? ` ${done.updated} חיובים עודכנו בהתאם.` : ' לא נמצאו חיובים לעדכון מהתאריך הזה.'}
            </p>
            <button onClick={onClose} className="w-full py-2 rounded-lg text-sm font-bold text-white bg-[#0D1B2A]">סגור</button>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-600 leading-relaxed bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-3">
              חיובים <b>לפני</b> התאריך שתבחר נשארים בסכום הישן — כך הם באמת נגבו.
              מהתאריך והלאה יעודכנו לסכום החדש, כולל חיובים עתידיים שכבר נרשמו.
            </p>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">הסכום החדש</label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full border border-[#EDE6D6] rounded-lg px-2 py-2 text-sm outline-none focus:border-[#C9A84C] mb-3"
            />
            <label className="block text-[11px] font-bold text-gray-600 mb-1">מאיזה חיוב הוא תקף</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-[#EDE6D6] rounded-lg px-2 py-2 text-sm outline-none focus:border-[#C9A84C] mb-3"
            />

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-3">{error}</p>}

            <div className="flex gap-2">
              <button onClick={onClose} disabled={busy}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-gray-600 border border-[#EDE6D6] disabled:opacity-50">
                חזרה
              </button>
              <button onClick={submit} disabled={busy}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-[#0D1B2A] disabled:opacity-50">
                {busy ? 'רגע...' : 'עדכן סכום'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** כפתורי הפעולה של שורת הוראת קבע. עוצרים את ה-click כדי שלא ייפתח כרטיס התורם. */
export function CancelHkButton({ hk, onOpen, onChangeAmount }: {
  hk: any;
  onOpen: (hk: any) => void;
  onChangeAmount?: (hk: any) => void;
}) {
  if (!hk.id) return null;
  const cancelled = !!hk.cancelDate;
  return (
    <div className="mt-2 flex gap-1.5">
      {onChangeAmount && !cancelled && (
        <button
          onClick={e => { e.stopPropagation(); onChangeAmount(hk); }}
          className="flex-1 text-[11px] font-bold py-1.5 rounded-lg border text-[#0D1B2A] border-[#EDE6D6] hover:bg-gray-50 transition-colors"
        >
          ₪ שינוי סכום
        </button>
      )}
      <button
        onClick={e => { e.stopPropagation(); onOpen(hk); }}
        className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg border transition-colors ${
          cancelled
            ? 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
            : 'text-orange-700 border-orange-200 hover:bg-orange-50'
        }`}
      >
        {cancelled ? '↺ החזר את ההוראה' : '⃠ בטל הוראה'}
      </button>
    </div>
  );
}
