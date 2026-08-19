import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { EXPECTED_CODE_VERSION } from '../lib/version';

// ─────────────────────────────────────────────────────────────────────────────
// "הגיליון מריץ גרסה ישנה".
//
// האפליקציה והסקריפט שבגיליון מתעדכנים בנפרד: האפליקציה מתעדכנת לבד בכל
// טעינה, הסקריפט רק כשמדביקים אותו ופורסים גרסה חדשה ידנית. כשהם לא תואמים,
// פעולות חדשות נכשלות — וההודעה שמתקבלת ("פעולה לא מוכרת") לא מסגירה למה.
//
// עדיף לומר את זה מראש, פעם אחת, במקום להיתקל בזה באמצע עבודה.
// ─────────────────────────────────────────────────────────────────────────────

// הגרסה יושבת ב-lib/version.ts — מקור אחד, כדי שהבאנר וכרטיס מצב המערכת
// לא יוכלו לחלוק על השאלה מה מעודכן.
export { EXPECTED_CODE_VERSION } from '../lib/version';

const DISMISS_KEY = 'script_version_notice_dismissed';

export function ScriptVersionBanner() {
  const { summary } = useAppStore();
  const actual = (summary as any)?.codeVersion || '';
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === EXPECTED_CODE_VERSION; } catch { return false; }
  });

  // התאריכים בפורמט ISO, ולכן השוואת מחרוזות היא גם השוואת זמן.
  // בלי גרסה כלל — הסקריפט ישן מספיק כדי שלא ידווח עליה בכלל.
  const outdated = !!summary && (!actual || actual < EXPECTED_CODE_VERSION);
  if (!outdated || dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, EXPECTED_CODE_VERSION); } catch { /* לא קריטי */ }
    setDismissed(true);
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5" dir="rtl">
      <div className="mx-auto max-w-4xl flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 text-[12px] text-amber-900 leading-relaxed">
          <b>הגיליון מריץ גרסה ישנה של הסקריפט</b>
          {actual ? ` (${actual}, במקום ${EXPECTED_CODE_VERSION})` : ''}.
          פעולות חדשות — עריכת תרומה, חידוש הוראת קבע, ניקוי עמודות — ייכשלו עד לעדכון.
          <div className="text-[11px] text-amber-800/80 mt-0.5">
            בגיליון: תוספים ← Apps Script ← להדביק את Code.gs המעודכן ← פריסה ← נהל פריסות ←
            עריכה (עיפרון) ← גרסה חדשה ← פריסה. <b>לא</b> "פריסה חדשה" — היא יוצרת כתובת אחרת.
          </div>
        </div>
        <button onClick={dismiss} className="shrink-0 text-amber-600 hover:text-amber-800 p-1" title="הסתר">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
