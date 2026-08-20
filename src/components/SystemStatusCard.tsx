import React, { useState } from 'react';
import { Explain } from './Explain';
import { CheckCircle2, AlertTriangle, HelpCircle, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import {
  BUILD_TIME, BUILD_COMMIT, EXPECTED_CODE_VERSION,
  formatBuildTime, compareVersions,
} from '../lib/version';

// ─────────────────────────────────────────────────────────────────────────────
// מצב המערכת — תשובה אחת לשאלה "האם הכול מעודכן?".
//
// שלוש שכבות מתעדכנות בנפרד, וכל אחת יכולה להישאר מאחור בשקט. הכרטיס הזה
// מציג את שלושתן זו לצד זו ואומר במפורש מה חסר ומה לעשות, במקום להשאיר
// את השאלה לניחוש.
// ─────────────────────────────────────────────────────────────────────────────

export function SystemStatusCard() {
  const { summary, refresh } = useAppStore();
  const sheetVersion = (summary as any)?.codeVersion || '';
  const state = compareVersions(sheetVersion);
  const [clearing, setClearing] = useState(false);

  /**
   * טעינה נקייה: מבטלים את רישום ה-service worker ומנקים את המטמון לפני
   * הרענון. בלי זה, דפדפן שמחזיק עותק ישן של האפליקציה ימשיך להציג אותו
   * גם אחרי שהבנייה הסתיימה — וזה נראה בדיוק כמו "העדכון לא עלה".
   */
  const hardReload = async () => {
    setClearing(true);
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch {
      // לא קריטי — ממשיכים לרענון בכל מקרה
    }
    window.location.reload();
  };

  const tone =
    state === 'ok' ? { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', Icon: CheckCircle2 }
    : state === 'unknown' ? { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', Icon: HelpCircle }
    : { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', Icon: AlertTriangle };

  const headline =
    state === 'ok' ? 'הכול מעודכן'
    : state === 'sheetOutdated' ? 'הגיליון מריץ גרסה ישנה'
    : state === 'sheetAhead' ? 'הגיליון מריץ גרסה חדשה מהאפליקציה'
    : 'עדיין לא ידוע — אין חיבור לגיליון';

  const Row = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-[#EDE6D6] last:border-0">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-left min-w-0">
        <span className="text-sm font-bold text-[#0D1B2A] break-all">{value}</span>
        {hint && <span className="block text-[10px] text-gray-400">{hint}</span>}
      </span>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
      <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">מצב המערכת</h3>

      <div className={`${tone.bg} ${tone.border} ${tone.text} border rounded-xl p-3 flex items-start gap-2.5`}>
        <tone.Icon size={18} className="shrink-0 mt-0.5" />
        <div className="min-w-0 text-sm leading-relaxed">
          <div className="font-bold">{headline}</div>
          {state === 'sheetOutdated' && (
            <div className="text-[11px] mt-1">
              בגיליון: תוספים ← Apps Script ← להדביק את Code.gs המעודכן ← פריסה ←
              נהל פריסות ← עריכה (עיפרון) ← גרסה: <b>גרסה חדשה</b> ← פרוס.
              <br />
              <b>לא</b> "פריסה חדשה" — היא יוצרת כתובת אחרת שהאפליקציה לא מכירה.
            </div>
          )}
          {state === 'sheetAhead' && (
            <div className="text-[11px] mt-1">
              הדבקת בגיליון קוד חדש יותר מהאפליקציה שרצה אצלך. לחץ "טען מחדש נקי"
              כדי למשוך את הגרסה החדשה של האפליקציה.
            </div>
          )}
          {state === 'unknown' && (
            <div className="text-[11px] mt-1">
              האפליקציה עוד לא קיבלה תשובה מהגיליון. אם זה נמשך — בדוק את כתובת
              הגיליון למעלה.
            </div>
          )}
        </div>
      </div>

      <div>
        <Row
          label="האפליקציה שרצה אצלך"
          value={formatBuildTime(BUILD_TIME)}
          hint={BUILD_COMMIT ? `גרסה ${BUILD_COMMIT}` : 'נבנתה מקומית, לא מ-GitHub'}
        />
        <Row
          label="הסקריפט בגיליון"
          value={sheetVersion || '— אין תשובה —'}
          hint={`האפליקציה מצפה ל-${EXPECTED_CODE_VERSION}`}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => refresh()}
          className="flex-1 flex items-center justify-center gap-1.5 border border-[#EDE6D6] hover:border-[#C9A84C] text-[#0D1B2A] text-sm font-bold py-2.5 rounded-xl transition-colors"
        >
          <RefreshCw size={14} /> בדוק שוב
        </button>
        <button
          onClick={hardReload}
          disabled={clearing}
          className="flex-1 bg-[#0D1B2A] text-[#E8C97A] text-sm font-bold py-2.5 rounded-xl disabled:opacity-50"
          title="מנקה את העותק השמור בדפדפן וטוען מחדש"
        >
          {clearing ? 'מנקה...' : 'טען מחדש נקי'}
        </button>
      </div>

      <div className="flex justify-end">
        <Explain label="מה ההבדל בין שני הכפתורים">
          "בדוק שוב" מרענן את הנתונים מהגיליון. "טען מחדש נקי" מוחק את העותק
          ששמור בדפדפן וטוען את האפליקציה מאפס — זה מה שעושים כשעדכון לא נראה
          על המסך למרות שהוא עלה.
        </Explain>
      </div>
    </div>
  );
}
