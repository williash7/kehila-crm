import React, { useState } from 'react';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { signIn, isGoogleLoginAvailable } from '../lib/googleAuth';
import { loadConfigFromDrive } from '../lib/driveConfig';
import { saveOrg } from '../lib/orgConfig';

// ─────────────────────────────────────────────────────────────────────────────
// מסך הכניסה.
//
// מוצג לפני האשף. מי שכבר הגדיר פעם אחת — מתחבר וההגדרות נטענות מהחשבון,
// בלי לעבור שוב שום שלב. מי שחדש — מתחבר ואז ממשיך לאשף, וההגדרות שלו
// יישמרו לחשבון בסיום.
//
// תמיד יש גם מסלול ידני, כדי שהאפליקציה תעבוד גם בלי חשבון גוגל ובלי
// תלות בהגדרת OAuth.
// ─────────────────────────────────────────────────────────────────────────────

export function SignInScreen({ onReady, onManual }: {
  /** נקרא כשההגדרות נטענו מהחשבון והאפליקציה מוכנה */
  onReady: () => void;
  /** נקרא כשצריך להמשיך לאשף ההגדרה */
  onManual: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setBusy(true);
    setError('');
    try {
      await signIn();
      const cfg = await loadConfigFromDrive();

      if (cfg?.gsUrl && cfg?.orgName?.he) {
        // כבר הוגדר בעבר במכשיר אחר — טוענים וממשיכים ישר לאפליקציה
        saveOrg({ ...cfg, configured: true });
        onReady();
      } else {
        // חשבון חדש — ממשיכים לאשף, והוא יישמר לחשבון בסיום
        onManual();
      }
    } catch (e: any) {
      setError(e?.message || 'ההתחברות נכשלה');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-[#0D1B2A] overflow-y-auto flex items-center justify-center" dir="rtl">
      <div className="w-full max-w-md px-6 py-10">
        <div className="text-center mb-8">
          <div className="font-['Frank_Ruhl_Libre'] text-5xl text-[#C9A84C] mb-3">✦</div>
          <h1 className="font-['Frank_Ruhl_Libre'] text-2xl text-white mb-1">לוח בקרה קהילתי</h1>
          <p className="text-sm text-white/50">ניהול אנשי קשר, תרומות ואירועים</p>
        </div>

        {isGoogleLoginAvailable() ? (
          <>
            <button
              onClick={handleSignIn}
              disabled={busy}
              className="w-full bg-white text-[#0D1B2A] font-bold py-3 rounded-xl flex items-center justify-center gap-2.5 disabled:opacity-60 hover:brightness-95 transition-all"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <GoogleMark />}
              {busy ? 'מתחבר…' : 'התחבר עם Google'}
            </button>

            <div className="flex items-start gap-2 mt-3 text-[11px] text-white/40 leading-relaxed">
              <ShieldCheck size={14} className="shrink-0 mt-0.5 text-[#C9A84C]/70" />
              <span>
                האפליקציה מבקשת גישה <b className="text-white/60">רק לתיקייה הפרטית שלה</b> — לא לקבצים,
                לא למיילים ולא לגיליונות שלך. שם נשמרות ההגדרות, כדי שבמכשיר הבא לא תצטרך להגדיר שוב.
              </span>
            </div>

            {error && (
              <div className="flex items-start gap-2 mt-4 bg-amber-500/10 text-amber-300 rounded-lg px-3 py-2.5 text-xs leading-relaxed">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button onClick={onManual} className="w-full text-white/40 text-xs mt-6 hover:text-white/70 transition-colors">
              או המשך בהגדרה ידנית, בלי חשבון גוגל
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-white/60 leading-relaxed text-center mb-5">
              כמה שאלות קצרות, ומתחילים לעבוד.
            </p>
            <button
              onClick={onManual}
              className="w-full bg-[#C9A84C] text-[#0D1B2A] font-bold py-3 rounded-xl hover:brightness-110 transition-all"
            >
              התחל בהגדרה
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12.1c-.2 2-1.6 5-4.5 7l6.9 5.3c4.1-3.8 6.6-9.4 6.6-15.6z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.3c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8.1 41 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.5 28.5c-.5-1.4-.7-2.9-.7-4.5s.3-3.1.7-4.5l-7.1-5.5C2.9 17 2 20.4 2 24s.9 7 2.4 10z" />
      <path fill="#EA4335" d="M24 10.7c3.2 0 5.4 1.4 6.7 2.5l6.1-6C33.1 3.9 29.9 2 24 2 15.4 2 8.1 7 4.4 14l7.1 5.5c1.8-5.3 6.7-8.8 12.5-8.8z" />
    </svg>
  );
}
