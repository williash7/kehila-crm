import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// מצב ריק.
//
// "אין הוראות קבע להצגה" באפור באמצע המסך הוא לא הודעה — הוא קיר מבוי סתום.
// הוא לא אומר אם משהו נשבר, אם הסינון מסתיר, או שפשוט עוד לא הכנסת כלום,
// והוא בטח לא אומר מה לעשות עכשיו.
//
// מצב ריק טוב עונה על שלוש שאלות בשלושה מבטים: מה חסר, למה, ומה הצעד הבא.
// ─────────────────────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, hint, action, tone = 'neutral' }: {
  /** אמוג'י גדול — נקודת עיגון ויזואלית שמבדילה בין "ריק" לבין "נטען" */
  icon: string;
  title: string;
  hint?: string;
  /** הצעד הבא, כשיש כזה */
  action?: React.ReactNode;
  /** 'good' למצב ריק שהוא בשורה טובה — אין שגיאות חיוב, אין משימות פתוחות */
  tone?: 'neutral' | 'good';
}) {
  const ring = tone === 'good'
    ? 'bg-emerald-50 text-emerald-500 ring-emerald-100'
    : 'bg-[#FAF6EE] text-[#C9A84C] ring-[#EDE6D6]';

  return (
    <div className="text-center py-10 px-4">
      <div className={`w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl ring-4 ${ring}`}>
        {icon}
      </div>
      <div className="text-sm font-bold text-[#0D1B2A]">{title}</div>
      {hint && <div className="text-[11px] text-gray-400 mt-1 leading-relaxed max-w-[280px] mx-auto">{hint}</div>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}
