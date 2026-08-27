import React, { useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { Donation } from '../types';
import {
  CASH_DESTINATION_OPTIONS, EDIT_PAYMENT_METHODS,
  cleanPaymentMethod, isCashPaymentMethod,
} from '../lib/cashDonations';
import { apiPost, explainApiError } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// עריכת תרומה — מכל מקום שבו היא מופיעה.
//
// ── הבקשה ─────────────────────────────────────────────────────────────────
//
// אשר ניסח אותה כעיקרון ולא כפיצ׳ר:
//
//   „בכל מקום שמידע מופיע ניתן לערוך אותו ישירות מהחלון בו הוא מופיע,
//    כמובן שזה ישפיע על כל המקומות האחרים בהם זה מופיע.”
//
// אותה תרומה מופיעה בארבעה מסכים — תרומות, מרכז הכספים, כרטיס איש הקשר
// וקמפיין. עד עכשיו היא הייתה ניתנת לעריכה רק במסך אחד מהם, ובשאר היא
// הייתה טקסט מת. מי שראה סכום שגוי בקמפיין היה צריך לזכור לאן ללכת.
//
// ── ולמה רכיב אחד ולא כפתור בכל מסך ────────────────────────────────────────
//
// זה הלקח שכבר שילמנו עליו פעמיים באותו סבב: רשימת יעדי המזומן שנפרדה
// בין הלקוח לשרת, ורשימת אפיקי הגבייה שישבה בתוך רכיב מסך. ארבעה
// טפסים נפרדים מתחילים זהים ונפרדים בשקט — אחד ישכח את `cashDestination`,
// אחר ישלח `method` בלי ניקוי — ואז אותה תרומה מתנהגת אחרת לפי המסך
// שממנו נגעת בה. טופס אחד לא יכול להסתעף.
//
// ── „זה ישפיע על כל המקומות האחרים” ────────────────────────────────────────
//
// זה עובד מעצמו, וכדאי לדעת למה: אין כאן ארבעה עותקים של התרומה
// שצריך לסנכרן. יש **שורה אחת בגיליון**, וכל ארבעת המסכים קוראים אותה.
// לכן `refresh()` אחרי שמירה מספיק — הכול מתעדכן יחד כי הכול אותו דבר.
//
// ── ומה עם תרומות שנקראו מהמייל ────────────────────────────────────────────
//
// אשר שאל בדיוק את זה. התשובה: **העריכה נשמרת גם עליהן.** סריקת המייל
// כותבת שורה רק אם המזהה שלה עוד לא קיים ביומן (`addLogRow_`), ולכן
// תרומה שנערכה לא נכתבת מחדש ולא נדרסת. היחיד שחוזר הוא מה שנמחק —
// ולכן מחיקה, ולא עריכה, היא הפעולה שצריך לחשוב עליה פעמיים.
//
// היוצא מן הכלל הוא חיוב של הוראת קבע: מנוע ההוראות מחשב אותו מחדש בכל
// ריצה, וסכום שנערך כאן יסתור את ההוראה עצמה. לכן יש שם אזהרה מפורשת
// שמפנה ל„שינוי סכום”, שהוא הכלי הנכון.
// ─────────────────────────────────────────────────────────────────────────────

const INPUT = 'w-full bg-gray-50 border border-[#EDE6D6] rounded-xl p-3 text-sm outline-none focus:border-[#C9A84C]';

export interface DonationQuickEditProps {
  donation: Donation;
  /** נקרא אחרי שמירה או מחיקה מוצלחת. כאן מרעננים את הנתונים. */
  onSaved: () => void | Promise<void>;
  onClose: () => void;
  /** ברירת המחדל מאפשרת מחיקה. מסכים שבהם היא לא מתאימה יכולים לכבות אותה. */
  allowDelete?: boolean;
}

export function DonationQuickEdit({ donation, onSaved, onClose, allowDelete = true }: DonationQuickEditProps) {
  const [amount, setAmount] = useState(String(donation.amount ?? ''));
  const [date, setDate] = useState(donation.date || '');
  const [method, setMethod] = useState(cleanPaymentMethod(donation.method));
  const [cashDestination, setCashDestination] = useState(donation.cashDestination || '');
  const [purpose, setPurpose] = useState(donation.purpose || '');
  const [notes, setNotes] = useState(donation.notes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isStandingCharge = String(donation.id || '').indexOf('hk:') === 0;
  const isCash = isCashPaymentMethod(method);

  const save = async () => {
    if (busy) return;
    if (!donation.id) { setError('לתרומה הזו אין מזהה ולכן אי אפשר לעדכן אותה מכאן.'); return; }
    setBusy(true); setError('');
    try {
      const res = await apiPost('updateDonation', {
        id: donation.id,
        amount,
        date,
        method,
        // ריק מפורש כשאין מזומן: אחרת יעד ישן היה נשאר תלוי על תרומה
        // שהוסבה להעברה בנקאית, וממשיך להשפיע על היתרה.
        cashDestination: isCash ? cashDestination || 'unclassified' : '',
        purpose,
        notes,
      });
      if (res?.error || res?.success === false) {
        setError(explainApiError(res?.error) || 'העדכון נכשל');
        return;
      }
      await onSaved();
      onClose();
    } catch {
      setError('אין חיבור לשרת. השינוי לא נשמר.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy || !donation.id) return;
    if (!window.confirm(`למחוק את התרומה מהיומן? הפעולה אינה הפיכה.\n\n${donation.name} · ₪${donation.amount}`)) return;
    setBusy(true); setError('');
    try {
      const res = await apiPost('deleteDonation', { id: donation.id });
      if (res?.error || res?.success === false) {
        setError(explainApiError(res?.error) || 'המחיקה נכשלה');
        return;
      }
      await onSaved();
      onClose();
    } catch {
      setError('אין חיבור לשרת. המחיקה לא בוצעה.');
    } finally {
      setBusy(false);
    }
  };

  // z-[240]: מעל כרטיס איש הקשר (220), מעל המסך המלא של הקמפיין (200)
  // ומעל גיליון הפירוט בכספים (90). העורך נפתח **מתוך** כל אחד מהם,
  // ולכן הוא חייב להיות מעל כולם — אחרת הוא נפתח מאחורי המסך שממנו
  // נלחץ, וזה נראה בדיוק כמו כפתור שלא עושה כלום.
  return <div className="fixed inset-0 z-[240] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <div className="bg-white w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-3" dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-['Frank_Ruhl_Libre'] text-xl font-black text-[#0D1B2A] truncate">{donation.name}</h2>
          <p className="text-xs text-gray-500">עריכת תרומה · השינוי יופיע בכל המסכים</p>
        </div>
        <button onClick={onClose} className="p-2 bg-gray-100 rounded-full shrink-0"><X size={18} /></button>
      </div>

      {isStandingCharge && <p className="bg-amber-50 text-amber-800 rounded-xl p-3 text-xs">
        זהו חיוב של הוראת קבע. מנוע ההוראות מחשב אותו מחדש, ולכן שינוי סכום כאן יסתור את ההוראה עצמה. לשינוי קבוע השתמש ב„שינוי סכום” במסך הוראות הקבע.
      </p>}

      {error && <p className="bg-red-50 text-red-700 rounded-xl p-3 text-xs font-bold">{error}</p>}

      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="block text-[10px] text-gray-500 uppercase font-bold mb-1.5">סכום</span>
          <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className={INPUT} />
        </label>
        <label className="block">
          <span className="block text-[10px] text-gray-500 uppercase font-bold mb-1.5">תאריך</span>
          <input type="text" dir="ltr" placeholder="dd/mm/yyyy" value={date} onChange={e => setDate(e.target.value)} className={INPUT} />
        </label>
      </div>

      <div>
        <span className="block text-[10px] text-gray-500 uppercase font-bold mb-1.5">אפיק גבייה</span>
        <div className="grid grid-cols-2 gap-1.5">
          {EDIT_PAYMENT_METHODS.map(option => <button
            key={option}
            type="button"
            onClick={() => setMethod(cleanPaymentMethod(option))}
            className={`text-xs font-bold py-2 rounded-lg border transition-colors ${method === cleanPaymentMethod(option) ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]' : 'bg-white text-gray-600 border-[#EDE6D6]'}`}
          >{option}</button>)}
        </div>
      </div>

      {isCash && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <span className="block text-[10px] text-amber-900 uppercase font-bold mb-2">היכן המזומן נמצא בפועל?</span>
        <div className="space-y-1.5">
          {CASH_DESTINATION_OPTIONS.map(option => <button
            key={option.value}
            type="button"
            onClick={() => setCashDestination(option.value)}
            className={`w-full text-right rounded-lg border px-3 py-2 transition-colors ${cashDestination === option.value ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]' : 'bg-white text-gray-700 border-amber-200'}`}
          >
            <b className="block text-xs">{option.label}</b>
            <small className={cashDestination === option.value ? 'text-[#C9A84C]/70' : 'text-gray-500'}>{option.hint}</small>
          </button>)}
        </div>
      </div>}

      <label className="block">
        <span className="block text-[10px] text-gray-500 uppercase font-bold mb-1.5">ייעוד / קמפיין</span>
        <input type="text" value={purpose} onChange={e => setPurpose(e.target.value)} className={INPUT} />
      </label>

      <label className="block">
        <span className="block text-[10px] text-gray-500 uppercase font-bold mb-1.5">הערות</span>
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={INPUT} />
      </label>

      <div className="flex gap-2 pt-1">
        <button disabled={busy} onClick={save} className="flex-1 flex items-center justify-center gap-2 bg-[#0D1B2A] text-[#C9A84C] font-bold py-3 rounded-xl text-sm disabled:opacity-50">
          <Check size={16} /> {busy ? 'שומר…' : 'שמור'}
        </button>
        {allowDelete && <button disabled={busy} onClick={remove} className="flex items-center justify-center bg-red-50 text-red-600 font-bold py-3 px-4 rounded-xl disabled:opacity-50" title="מחיקה">
          <Trash2 size={16} />
        </button>}
        <button disabled={busy} onClick={onClose} className="flex items-center justify-center bg-gray-100 text-gray-600 font-bold py-3 px-4 rounded-xl disabled:opacity-50">
          ביטול
        </button>
      </div>
    </div>
  </div>;
}
