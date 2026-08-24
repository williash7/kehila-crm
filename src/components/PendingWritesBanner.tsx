import React, { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import {
  QueuedWrite, subscribe, queueState, flushQueue, pendingLabel,
} from '../lib/writeQueue';

// ─────────────────────────────────────────────────────────────────────────────
// „N שינויים ממתינים לשמירה”.
//
// זה הרכיב שהופך את תור הכתיבות למשהו שאפשר לסמוך עליו. התור לבדו רק דוחה
// את הבעיה: אם הניסיונות החוזרים נכשלים שוב ושוב — כי הגיליון נמחק, כי
// ההרשאה נשללה, כי המכשיר לא היה מחובר יומיים — הנתונים עדיין לא נשמרו,
// ובלי מחוון המשתמש שוב לא יודע.
//
// **הכלל: כל עוד יש משהו בתור, זה נראה על המסך.** לא התראה חולפת שאפשר
// לפספס, ולא נורית קטנה בפינה — פס שנשאר עד שהתור מתרוקן.
//
// כשהתור ריק הרכיב אינו מצייר כלום. מי שהכול נשמר אצלו לא צריך לדעת
// שקיים כאן מנגנון.
// ─────────────────────────────────────────────────────────────────────────────

/** מתי כדאי להפסיק להרגיע ולהתחיל להדאיג. */
const STUCK_ATTEMPTS = 3;

export function PendingWritesBanner() {
  const [items, setItems] = useState<QueuedWrite[]>([]);
  const [persistFailed, setPersistFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const [justSent, setJustSent] = useState(0);

  useEffect(() => {
    const read = () => { const s = queueState(); setItems(s.items); setPersistFailed(s.persistFailed); };
    read();
    const un = subscribe(read);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { un(); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // הודעת ההצלחה נעלמת מעצמה. היא בשורה טובה, לא משימה.
  useEffect(() => {
    if (!justSent) return;
    const t = setTimeout(() => setJustSent(0), 4000);
    return () => clearTimeout(t);
  }, [justSent]);

  const retry = async () => {
    setBusy(true);
    try {
      const { apiPost } = await import('../lib/api');
      const { sent } = await flushQueue(apiPost);
      if (sent > 0) setJustSent(sent);
    } finally {
      setBusy(false);
    }
  };

  if (justSent > 0 && items.length === 0) {
    return (
      <div className="bg-emerald-600 text-white px-3 py-2 text-[12px] font-bold text-center w-full">
        ✓ {justSent === 1 ? 'השינוי נשמר' : `${justSent} השינויים נשמרו`}
      </div>
    );
  }

  if (items.length === 0 && !persistFailed) return null;

  // המצב החמור: הכתיבה נכשלה **וגם** לא הצלחנו לזכור אותה לניסיון חוזר.
  if (persistFailed) {
    return (
      <div className="bg-red-600 text-white px-3 py-2 text-[12px] w-full text-center">
        <div className="font-bold flex items-center justify-center gap-1.5">
          <AlertTriangle size={14} /> שינוי לא נשמר, ולא ניתן היה לשמור אותו לניסיון חוזר
        </div>
        <div className="opacity-90 mt-0.5">
          האחסון במכשיר מלא. כדאי לרענן את הדף ולבצע את השינוי שוב.
        </div>
      </div>
    );
  }

  const stuck = items.some(i => i.attempts >= STUCK_ATTEMPTS);
  const tone = stuck ? 'bg-red-600' : online ? 'bg-amber-500' : 'bg-slate-600';

  return (
    <div className={`${tone} text-white px-3 py-2 text-[12px] w-full`} dir="rtl">
      <div className="max-w-[1100px] mx-auto flex items-center gap-2 justify-center flex-wrap">
        <CloudOff size={14} className="shrink-0" />
        <span className="font-bold">{pendingLabel(items.length)}</span>

        <span className="opacity-90">
          {!online
            ? '· אין חיבור. יישלח כשהחיבור יחזור.'
            : stuck
              ? '· הניסיונות החוזרים נכשלים. הנתונים שמורים במכשיר ולא אבדו.'
              : '· נשמר במכשיר, מנסה שוב ברקע.'}
        </span>

        <button
          onClick={retry}
          disabled={busy}
          className="bg-white/20 hover:bg-white/30 disabled:opacity-60 rounded-lg px-2 py-0.5 font-bold flex items-center gap-1 shrink-0"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          נסה עכשיו
        </button>
      </div>

      {stuck && (
        <div className="max-w-[1100px] mx-auto mt-1 text-[11px] opacity-90 text-center">
          שגיאה אחרונה: {items.find(i => i.attempts >= STUCK_ATTEMPTS)?.lastError}
        </div>
      )}
    </div>
  );
}
