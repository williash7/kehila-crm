import React, { useMemo, useState } from 'react';
import { useAppStore } from '../store/AppContext';
import { apiPost, explainApiError} from '../lib/api';
import { todayISO } from './CancelHkDialog';

// ─────────────────────────────────────────────────────────────────────────────
// הוספת הוראת קבע ידנית.
//
// לא כל הוראה מגיעה במייל. לפעמים ההודעה לא נשלחה, נמחקה בטעות, או שההוראה
// הוקמה בטלפון מול הספק. הסימן היחיד שהיא קיימת הוא תרומה קבועה שחוזרת כל
// חודש — ואת זה רואים רק בעיניים.
//
// השדה החשוב כאן הוא **מספר ההוראה**. הוא מה שיקשר בין ההוראה למיילי הסירוב
// שיגיעו עליה בעתיד. בלעדיו נוצר מזהה פנימי, וכשל שיגיע לא יידע לאן הוא שייך.
// ─────────────────────────────────────────────────────────────────────────────

export function AddHkDialog({ onClose, presetName, presetCampaign, onCreated }: {
  onClose: () => void;
  /** שם מוכן מראש — כשפותחים מתוך שורה בתוכנית גיוס */
  presetName?: string;
  /** הקמפיין שאליו ההוראה משויכת. זה מה שגורם לה להיספר מול היעד. */
  presetCampaign?: string;
  onCreated?: (id: string) => void;
}) {
  const { donors, refresh } = useAppStore();
  const contactNames = useMemo(() => Object.keys(donors || {}).sort(), [donors]);

  const [name, setName] = useState(presetName || '');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [unlimited, setUnlimited] = useState(false);
  const [payments, setPayments] = useState('12');
  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('');
  const [campaign, setCampaign] = useState(presetCampaign || '');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<any | null>(null);

  async function submit() {
    if (!name.trim()) { setError('חסר שם התורם'); return; }
    if (!Number(amount)) { setError('חסר סכום החיוב החודשי'); return; }
    if (!unlimited && !Number(payments)) { setError('חסר מספר תשלומים'); return; }

    setBusy(true);
    setError('');
    const res = await apiPost('addStandingOrder', {
      name: name.trim(),
      amount: Number(amount),
      startDate,
      unlimited,
      payments: unlimited ? 0 : Number(payments),
      id: orderId.trim(),
      phone: phone.trim(),
      campaign: campaign.trim(),
      notes: 'נוספה ידנית מהאפליקציה',
    });
    setBusy(false);
    if (res?.error || res?.success === false) { setError(explainApiError(res.error) || 'ההוספה נכשלה'); return; }
    setDone(res);
    // מדווחים את המזהה למי שפתח אותנו — כך שורה בתוכנית גיוס יכולה לשייך
    // אליה את ההוראה מיד, בלי שתצטרך לחפש אותה ידנית אחר כך.
    if (onCreated && res?.id) onCreated(String(res.id));
    refresh();
  }

  const field = 'w-full border border-[#EDE6D6] rounded-lg px-2 py-2 text-sm outline-none focus:border-[#C9A84C]';
  const label = 'block text-[11px] font-bold text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 bg-black/40 z-[210] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-sm p-4 shadow-xl border border-[#EDE6D6] max-h-[90vh] overflow-y-auto">
        <h3 className="font-['Frank_Ruhl_Libre'] text-base font-bold text-[#0D1B2A] mb-3">הוראת קבע ידנית</h3>

        {done ? (
          <>
            <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 mb-3">
              ההוראה נוספה (מספר {done.id}).
              {done.created > 0 ? ` ${done.created} חיובים חודשיים נוצרו למפרע מתאריך הפתיחה.` : ''}
            </p>
            <button onClick={onClose} className="w-full py-2 rounded-lg text-sm font-bold text-white bg-[#0D1B2A]">סגור</button>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-600 leading-relaxed bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-3">
              החיובים החודשיים ייווצרו אוטומטית מתאריך הפתיחה ועד היום — בדיוק כמו
              בהוראה שנקלטה ממייל. אין צורך להזין אותם אחד-אחד.
            </p>

            <label className={label}>שם התורם</label>
            <input list="add-hk-contacts" value={name} onChange={e => setName(e.target.value)}
                   placeholder="שם מלא" className={field + ' mb-3'} />
            <datalist id="add-hk-contacts">
              {contactNames.map(n => <option key={n} value={n} />)}
            </datalist>

            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className={label}>סכום לחודש</label>
                <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)}
                       placeholder="₪" className={field} />
              </div>
              <div className="flex-1">
                <label className={label}>תאריך פתיחה</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={field} />
              </div>
            </div>

            <label className={label}>מספר תשלומים</label>
            <div className="flex items-center gap-2 mb-1">
              <input type="number" min={1} value={payments} disabled={unlimited}
                     onChange={e => setPayments(e.target.value)}
                     className={field + ' flex-1 disabled:bg-gray-50 disabled:text-gray-400'} />
              <label className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0 cursor-pointer">
                <input type="checkbox" checked={unlimited} onChange={e => setUnlimited(e.target.checked)} />
                ללא הגבלה
              </label>
            </div>
            <p className="text-[10px] text-gray-400 mb-3">יום החיוב בכל חודש נקבע לפי תאריך הפתיחה.</p>

            <label className={label}>
              מספר הוראה אצל הספק <span className="font-normal text-gray-400">(מומלץ מאוד)</span>
            </label>
            <input value={orderId} onChange={e => setOrderId(e.target.value)} dir="ltr"
                   placeholder="למשל 1923587" className={field + ' mb-1'} />
            <p className="text-[10px] text-gray-400 mb-3">
              זה מה שיקשר בין ההוראה לבין מיילי סירוב שיגיעו עליה בעתיד. בלעדיו כשל
              שיגיע לא יידע לאיזו הוראה הוא שייך.
            </p>

            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className={label}>טלפון <span className="font-normal text-gray-400">(רשות)</span></label>
                <input value={phone} onChange={e => setPhone(e.target.value)} className={field} />
              </div>
              <div className="flex-1">
                <label className={label}>קמפיין <span className="font-normal text-gray-400">(רשות)</span></label>
                <input value={campaign} onChange={e => setCampaign(e.target.value)} className={field} />
              </div>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-3">{error}</p>}

            <div className="flex gap-2">
              <button onClick={onClose} disabled={busy}
                      className="flex-1 py-2 rounded-lg text-sm font-bold text-gray-600 border border-[#EDE6D6] disabled:opacity-50">
                ביטול
              </button>
              <button onClick={submit} disabled={busy}
                      className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-[#0D1B2A] disabled:opacity-50">
                {busy ? 'שומר...' : 'הוסף הוראה'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
