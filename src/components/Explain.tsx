import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// הסבר שמופיע כשמבקשים אותו.
//
// כל הסבר באפליקציה נכתב בזמן שבו הוא היה נחוץ — הפעם הראשונה שנתקלים
// בפיצ'ר. אבל הוא נשאר על המסך לנצח, וכשיש עשרה כאלה זה כבר לא הסבר אלא
// קיר טקסט: העין מדלגת עליו, וגם ההסבר שבאמת דרוש נבלע.
//
// כאן הכותרת נשארת, וההסבר יושב מאחורי סימן שאלה. מי שצריך — לוחץ פעם
// אחת. מי שכבר יודע — רואה מסך נקי.
// ─────────────────────────────────────────────────────────────────────────────

export function Explain({ children, label }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        title={open ? 'הסתר הסבר' : (label || 'מה זה?')}
        aria-expanded={open}
        className={`shrink-0 p-0.5 rounded-full transition-colors ${
          open ? 'text-[#9B7A2F]' : 'text-gray-300 hover:text-gray-500'
        }`}
      >
        <HelpCircle size={14} />
      </button>
      {open && (
        <p className="text-[11px] text-gray-500 leading-relaxed mt-1.5 bg-[#FAF6EE] rounded-lg p-2.5 w-full">
          {children}
        </p>
      )}
    </>
  );
}

/** כותרת עם סימן שאלה שפותח הסבר מתחתיה. */
export function CardTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">{title}</h3>
      {children && <Explain>{children}</Explain>}
    </div>
  );
}
