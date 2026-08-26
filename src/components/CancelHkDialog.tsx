import React, { useState } from 'react';
import { Explain } from './Explain';
import { useAppStore } from '../store/AppContext';
import { apiPost, explainApiError} from '../lib/api';
import { buildChainIndex, chainFor, chainSummary, HkEntry } from '../lib/standingOrders';
import { activeProjects } from '../lib/projects';

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
      setError(explainApiError(res.error) || 'הפעולה נכשלה');
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
    if (res?.error || res?.success === false) { setError(explainApiError(res.error) || 'העדכון נכשל'); return; }
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


// ─────────────────────────────────────────────────────────────────────────────
// חידוש הוראת קבע.
//
// חידוש **אינו** עריכה של ההוראה הקיימת. אצל הספק זו הוראה חדשה עם מספר
// חדש, ואם היינו דורסים את השורה הישנה — תאריך הפתיחה היה קופץ קדימה,
// מונה החיובים היה מתאפס, וכל מה שהאיש נתן עד היום היה נעלם מהמסך בדיוק
// ברגע שבו הוא הוכיח שהוא ממשיך. לכן נפתחת שורה חדשה שמצביעה על הישנה,
// ושתי ההוראות נשארות שלמות — כל אחת עם הסכום שבו באמת נגבתה.
// ─────────────────────────────────────────────────────────────────────────────

export function RenewHkDialog({ target, onClose }: { target: any; onClose: () => void }) {
  const { hk, refresh } = useAppStore();

  const chain = React.useMemo(() => {
    const idx = buildChainIndex(hk as HkEntry[]);
    return chainFor(target as HkEntry, idx);
  }, [hk, target]);
  const past = chainSummary(chain);

  const [amount, setAmount] = useState(String(Number(target.amount) || ''));
  const [payments, setPayments] = useState(
    target.unlimited ? '' : String(Number(target.payments) || 12)
  );
  const [unlimited, setUnlimited] = useState(!!target.unlimited);
  const [startDate, setStartDate] = useState('');   // ריק = השרת מחשב את מועד החיוב הבא
  const [billingDay, setBillingDay] = useState('');
  const [preview, setPreview] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [newId, setNewId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<any | null>(null);

  // ── מתי זה ייגבה בפועל ──────────────────────────────────────────────────
  //
  // יום החיוב בחודש הוא תכונה של ההוראה אצל הספק, והחידוש נכנס למחזור
  // בהזדמנות הקרובה של אותו יום — לא חודש אחרי החיוב האחרון, ולא היום שבו
  // לחצת. זו בדיוק השאלה שנשאלת מול התורם בטלפון, ולכן היא נענית כאן
  // **לפני** האישור ולא אחריו.
  React.useEffect(() => {
    if (startDate) { setPreview(''); return; }
    let cancelled = false;
    setPreviewing(true);
    apiPost('previewRenewalDate', { id: target.id, billingDay: Number(billingDay) || 0 })
      .then(res => { if (!cancelled) setPreview(res?.success ? res.startDate : ''); })
      .catch(() => { if (!cancelled) setPreview(''); })
      .finally(() => { if (!cancelled) setPreviewing(false); });
    return () => { cancelled = true; };
  }, [target.id, billingDay, startDate]);

  async function submit() {
    const value = Number(amount);
    if (!value || value <= 0) { setError('סכום חייב להיות גדול מאפס'); return; }
    if (!unlimited && !(Number(payments) > 0)) { setError('צריך מספר תשלומים, או לסמן "ללא הגבלה"'); return; }
    setBusy(true);
    setError('');
    const res = await apiPost('renewStandingOrder', {
      id: target.id,
      amount: value,
      unlimited,
      payments: unlimited ? '' : Number(payments),
      startDate: startDate || '',
      billingDay: Number(billingDay) || 0,
      newId: newId.trim(),
    });
    setBusy(false);
    if (res?.error || res?.success === false) { setError(explainApiError(res.error) || 'החידוש נכשל'); return; }
    setDone(res);
    refresh();
  }

  const field = 'w-full border border-[#EDE6D6] rounded-lg px-2 py-2 text-sm outline-none focus:border-[#C9A84C]';
  const label = 'block text-[11px] font-bold text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 bg-black/40 z-[210] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-sm p-4 shadow-xl border border-[#EDE6D6] max-h-[90vh] overflow-y-auto">
        <h3 className="font-['Frank_Ruhl_Libre'] text-base font-bold text-[#0D1B2A] mb-1">חידוש הוראת קבע</h3>
        <p className="text-xs text-gray-500 mb-3">
          {target.name} · הוראה <span dir="ltr">#{target.id}</span>
        </p>

        {done ? (
          <>
            <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 mb-3 leading-relaxed">
              נפתחה הוראה <b dir="ltr">#{done.id}</b> על ₪{Number(done.amount).toLocaleString()} לחודש,
              {' '}החיוב הראשון ב-<b>{done.startDate}</b>{done.billingDay ? ` (ובכל ${done.billingDay} לחודש)` : ''},
              {' '}{done.payments === 'ללא הגבלה' ? 'ללא הגבלת זמן' : `${done.payments} תשלומים`}.
              {done.closedOld ? ` ההוראה הקודמת נסגרה ב-${done.closedOld} כדי שלא ייגבו שתיהן במקביל.` : ''}
              {done.created ? ` נוצרו ${done.created} חיובים.` : ''}
              <div className="mt-1">ההיסטוריה הקודמת נשמרה ומוצגת יחד עם החדשה.</div>
            </div>
            <button onClick={onClose} className="w-full py-2 rounded-lg text-sm font-bold text-white bg-[#0D1B2A]">סגור</button>
          </>
        ) : (
          <>
            {/* מה שכבר ניתן — כדי שברור שהחידוש ממשיך ולא מתחיל מאפס */}
            <div className="text-xs bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg p-2.5 mb-3 leading-relaxed">
              <div className="font-bold text-[#0D1B2A] mb-1">ההיסטוריה עד היום</div>
              <div className="text-gray-600">
                {past.orders > 1 ? `${past.orders} הוראות · ` : ''}
                {past.paid} חיובים · ₪{past.totalGiven.toLocaleString()}
                {past.since ? ` · מאז ${past.since}` : ''}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                החידוש נפתח כהוראה חדשה שמקושרת לזו — הנתונים האלה נשארים ונספרים.
              </div>
            </div>

            <label className={label}>סכום חודשי</label>
            <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)} className={field + ' mb-3'} />

            <label className={label}>מספר תשלומים</label>
            <input
              type="number" min={1} value={payments} disabled={unlimited}
              onChange={e => setPayments(e.target.value)}
              className={field + ' mb-2 disabled:bg-gray-50 disabled:text-gray-400'}
            />
            <label className="flex items-center gap-2 text-xs text-gray-600 mb-3">
              <input type="checkbox" checked={unlimited} onChange={e => setUnlimited(e.target.checked)} />
              ללא הגבלת זמן
            </label>

            <label className={label}>
              יום החיוב בחודש <span className="font-normal text-gray-400">(כפי שרשום אצל הספק)</span>
            </label>
            <input
              type="number" min={1} max={31} value={billingDay} onChange={e => setBillingDay(e.target.value)}
              placeholder={`ברירת מחדל: ${String(target.startDate || '').slice(0, 2) || '—'}`}
              className={field + ' mb-1'}
            />
            <div className="flex justify-end mb-2">
              <Explain label="למה זה משנה">
                יום החיוב הוא מה שקובע מתי ייגבה החיוב הראשון — לא היום שבו אתה
                מחדש. אם היום כבר עבר החודש, החיוב ייצא רק בחודש הבא.
              </Explain>
            </div>

            {/* התשובה לשאלה "אז מתי זה ייגבה?", לפני האישור */}
            {!startDate && (
              <div className={`rounded-lg p-2.5 mb-3 text-xs border ${
                preview ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}>
                {previewing ? 'מחשב...' : preview
                  ? <>החיוב הראשון ייגבה ב-<b>{preview}</b></>
                  : 'לא הצלחתי לחשב את מועד החיוב — אפשר לקבוע תאריך ידנית למטה.'}
              </div>
            )}

            <label className={label}>
              או תאריך התחלה מדויק <span className="font-normal text-gray-400">(לא חובה)</span>
            </label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={field + ' mb-3'} />

            <label className={label}>
              מספר ההוראה החדש <span className="font-normal text-gray-400">(מנדרים פלוס, אם יש)</span>
            </label>
            <input
              value={newId} onChange={e => setNewId(e.target.value)} dir="ltr" placeholder="1911716"
              className={field + ' mb-1'}
            />
            <div className="flex justify-end mb-2">
              <Explain label="למה כדאי למלא">
                מיילי הסירוב נושאים את מספר ההוראה. אם תמלא אותו כאן, כשל חיוב
                יוצמד להוראה הנכונה במקום להישאר בלי שיוך.
              </Explain>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-3">{error}</p>}

            <div className="flex gap-2">
              <button onClick={onClose} disabled={busy}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-gray-600 border border-[#EDE6D6] disabled:opacity-50">
                חזרה
              </button>
              <button onClick={submit} disabled={busy}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 disabled:opacity-50">
                {busy ? 'רגע...' : 'חדש הוראה'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// עריכת הוראת קבע.
//
// עד כאן אפשר היה רק לשנות סכום או לבטל, וכל תיקון אחר חייב לרדת לגיליון.
// הבעיה שזה יצר: הוראה שנפתחה בתאריך שגוי הציגה חיוב שלא היה — ותיקון
// התאריך ביד לא ניקה אותו, כי החיובים כבר נכתבו.
//
// כאן שינוי בלוח הזמנים **בונה את החיובים מחדש**, ואומרים לך מראש כמה
// ייגעו. חיוב שסומן "נכשל" נשאר — הוא אירוע אמיתי, לא תוצר של המנוע.
// ─────────────────────────────────────────────────────────────────────────────

export function EditHkDialog({ target, onClose }: { target: any; onClose: () => void }) {
  const { projects, refresh } = useAppStore();
  const openProjects = React.useMemo(() => activeProjects(projects as any), [projects]);
  const [name, setName] = useState(String(target.name || ''));
  const [amount, setAmount] = useState(String(Number(target.amount) || ''));
  const [unlimited, setUnlimited] = useState(!!target.unlimited);
  const [payments, setPayments] = useState(target.unlimited ? '' : String(Number(target.payments) || ''));
  const [campaign, setCampaign] = useState(String(target.campaign || ''));
  const [startDate, setStartDate] = useState(() => {
    const m = String(target.startDate || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
  });

  const [stats, setStats] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<any | null>(null);

  React.useEffect(() => {
    apiPost('previewStandingOrderUpdate', { id: target.id })
      .then(res => setStats(res?.success ? res : null))
      .catch(() => setStats(null));
  }, [target.id]);

  const origStart = String(target.startDate || '');
  const newStart = startDate ? startDate.split('-').reverse().join('/') : origStart;
  const scheduleChanged =
    newStart !== origStart ||
    (unlimited !== !!target.unlimited) ||
    (!unlimited && Number(payments) !== Number(target.payments));

  async function submit() {
    if (!unlimited && !(Number(payments) > 0)) { setError('צריך מספר תשלומים, או לסמן "ללא הגבלה"'); return; }
    if (scheduleChanged && !window.confirm(
      'שינוי תאריך ההתחלה או מספר התשלומים בונה את החיובים מחדש.\n\n' +
      'חיובים שיוצאים מהלוח החדש יימחקו מהיומן, כולל כאלה שנספרו ככסף שנכנס. ' +
      'חיובים שסומנו "נכשל" יישארו.\n\nלהמשיך?')) return;

    setBusy(true);
    setError('');
    const res = await apiPost('updateStandingOrder', {
      id: target.id,
      name: name.trim(),
      amount: Number(amount) || 0,
      unlimited,
      payments: unlimited ? '' : Number(payments),
      campaign: campaign.trim(),
      startDate: startDate || '',
    });
    setBusy(false);
    if (res?.error || res?.success === false) { setError(explainApiError(res.error) || 'העדכון נכשל'); return; }
    setDone(res);
    refresh();
  }

  const field = 'w-full border border-[#EDE6D6] rounded-lg px-2 py-2 text-sm outline-none focus:border-[#C9A84C]';
  const label = 'block text-[11px] font-bold text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 bg-black/40 z-[210] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-sm p-4 shadow-xl border border-[#EDE6D6] max-h-[90vh] overflow-y-auto">
        <h3 className="font-['Frank_Ruhl_Libre'] text-base font-bold text-[#0D1B2A] mb-1">עריכת הוראת קבע</h3>
        <p className="text-xs text-gray-500 mb-3">הוראה <span dir="ltr">#{target.id}</span></p>

        {done ? (
          <>
            <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 mb-3 leading-relaxed">
              ההוראה עודכנה: {done.changed?.join(', ')}.
              {done.rebuilt && ` לוח החיובים נבנה מחדש — ${done.removed} נמחקו, ${done.created} נוצרו.`}
            </div>
            <button onClick={onClose} className="w-full py-2 rounded-lg text-sm font-bold text-white bg-[#0D1B2A]">סגור</button>
          </>
        ) : (
          <>
            <label className={label}>שם התורם</label>
            <input value={name} onChange={e => setName(e.target.value)} className={field + ' mb-3'} />

            <label className={label}>סכום חודשי</label>
            <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)} className={field + ' mb-3'} />

            <label className={label}>תאריך החיוב הראשון</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={field + ' mb-1'} />
            <div className="flex justify-end mb-2">
              <Explain>היום בחודש שנקבע כאן הוא יום החיוב של כל שאר התשלומים.</Explain>
            </div>

            <label className={label}>מספר תשלומים</label>
            <input type="number" min={1} value={payments} disabled={unlimited}
                   onChange={e => setPayments(e.target.value)}
                   className={field + ' mb-2 disabled:bg-gray-50 disabled:text-gray-400'} />
            <label className="flex items-center gap-2 text-xs text-gray-600 mb-3">
              <input type="checkbox" checked={unlimited} onChange={e => setUnlimited(e.target.checked)} />
              ללא הגבלת זמן
            </label>


            {/* ── שיוך לקמפיין ────────────────────────────────────────────
                בדיוק כמו בהוספת תרומה: בחירה מרשימת הפרויקטים הפעילים
                במקום הקלדה. הקלדה חופשית פירושה שגיאת כתיב אחת, וההוראה
                לא נספרת בקמפיין — בלי שום סימן שמשהו לא בסדר. */}
            <label className={label}>
              שיוך לקמפיין <span className="font-normal text-gray-400">(מה שגורם לה להיספר מול היעד)</span>
            </label>
            {openProjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {openProjects.map(p => (
                  <button
                    key={p.id} type="button"
                    onClick={() => setCampaign(campaign === p.purposeTag ? '' : p.purposeTag)}
                    className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                      campaign === p.purposeTag ? 'bg-[#0D1B2A] text-[#C9A84C]' : 'bg-[#C9A84C]/10 text-[#9B7A2F] hover:bg-[#C9A84C]/20'
                    }`}
                  >
                    🎯 {p.name}
                  </button>
                ))}
              </div>
            )}
            <input value={campaign} onChange={e => setCampaign(e.target.value)}
                   placeholder={openProjects.length ? 'או הקלד קמפיין אחר' : 'שם הקמפיין'}
                   className={field + ' mb-3'} />

            {scheduleChanged && (
              <div className="text-[11px] bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 text-amber-900 leading-relaxed">
                <b>לוח החיובים ייבנה מחדש.</b>
                {stats && ` היום יש ${stats.existing} חיובים, מתוכם ${stats.collected} נספרים ככסף שנכנס ו-${stats.failed} מסומנים כנכשלו.`}
                {' '}מה שיוצא מהלוח החדש יימחק; מה שסומן "נכשל" יישאר.
              </div>
            )}

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-3 leading-relaxed">{error}</p>}

            <div className="flex gap-2">
              <button onClick={onClose} disabled={busy}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-gray-600 border border-[#EDE6D6] disabled:opacity-50">חזרה</button>
              <button onClick={submit} disabled={busy}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-[#0D1B2A] disabled:opacity-50">
                {busy ? 'שומר...' : 'שמור שינויים'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** כפתורי הפעולה של שורת הוראת קבע. עוצרים את ה-click כדי שלא ייפתח כרטיס התורם. */
export function CancelHkButton({ hk, onOpen, onChangeAmount, onRenew, onEdit, onMarkFailure }: {
  hk: any;
  onOpen: (hk: any) => void;
  onChangeAmount?: (hk: any) => void;
  onRenew?: (hk: any) => void;
  onEdit?: (hk: any) => void;
  onMarkFailure?: (hk: any) => void;
}) {
  if (!hk.id) return null;
  const cancelled = !!hk.cancelDate;
  // הוראה שכבר חודשה לא מוצע לחדש שוב — החידוש שלה הוא הוראה אחרת,
  // ושם המקום הנכון להמשיך ממנו.
  const canRenew = !!onRenew && !hk.renewedBy;
  return (
    <div className="mt-2 flex gap-1.5 flex-wrap">
      {canRenew && (
        <button
          onClick={e => { e.stopPropagation(); onRenew!(hk); }}
          className="flex-1 min-w-[92px] text-[11px] font-bold py-1.5 rounded-lg border text-indigo-700 border-indigo-200 hover:bg-indigo-50 transition-colors"
        >
          ↻ חידוש
        </button>
      )}
      {onEdit && (
        <button
          onClick={e => { e.stopPropagation(); onEdit(hk); }}
          className="flex-1 min-w-[92px] text-[11px] font-bold py-1.5 rounded-lg border text-[#0D1B2A] border-[#EDE6D6] hover:bg-gray-50 transition-colors"
        >
          ✎ עריכה
        </button>
      )}
      {onChangeAmount && !cancelled && (
        <button
          onClick={e => { e.stopPropagation(); onChangeAmount(hk); }}
          className="flex-1 min-w-[92px] text-[11px] font-bold py-1.5 rounded-lg border text-[#0D1B2A] border-[#EDE6D6] hover:bg-gray-50 transition-colors"
        >
          ₪ שינוי סכום
        </button>
      )}
      {onMarkFailure && (
        <button
          onClick={e => { e.stopPropagation(); onMarkFailure(hk); }}
          className="flex-1 min-w-[92px] text-[11px] font-bold py-1.5 rounded-lg border text-red-700 border-red-200 hover:bg-red-50 transition-colors"
        >
          ⚠ חיוב נכשל
        </button>
      )}
      <button
        onClick={e => { e.stopPropagation(); onOpen(hk); }}
        className={`flex-1 min-w-[92px] text-[11px] font-bold py-1.5 rounded-lg border transition-colors ${
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
