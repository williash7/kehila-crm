import React, { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { shiftShabbatToFriday } from '../lib/dateUtils';

const QUICK_OFFSETS: { label: string; days: number }[] = [
  { label: '+3 ימים', days: 3 },
  { label: '+שבוע', days: 7 },
  { label: '+חודש', days: 30 },
];

function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

// דיאלוג משותף שנפתח בכל פעם שמסמנים פריט (משימה/ביקור בית/תאריך אישי) כ"בוצע":
// שואל אם ליצור משימת המשך, ואם כן — פותח טופס מיני (טקסט + תאריך) עם קיצורי
// תאריך מהירים (מוזזים משבת לשישי, ראה shiftShabbatToFriday). לא חוסם את סימון
// ה"בוצע" עצמו — זה כבר קרה לפני שהדיאלוג נפתח.
export function CompletionFollowUpModal({
  sourceLabel,
  onSkip,
  onCreateFollowUp,
}: {
  sourceLabel: string;
  onSkip: () => void;
  onCreateFollowUp: (text: string, dueDate?: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState(`המשך: ${sourceLabel}`);
  const [dueDate, setDueDate] = useState('');

  const applyOffset = (days: number) => {
    const d = shiftShabbatToFriday(new Date(Date.now() + days * 86400000));
    setDueDate(toIsoDate(d));
  };

  const submit = () => {
    if (!text.trim()) return;
    onCreateFollowUp(text.trim(), dueDate || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[230] flex items-center justify-center p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onSkip()}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
        {!showForm ? (
          <>
            <div className="flex items-center gap-2 mb-1 text-green-600">
              <CheckCircle2 size={20} />
              <span className="font-bold text-sm">בוצע!</span>
            </div>
            <div className="text-sm text-[#0D1B2A] font-medium mb-4 truncate">{sourceLabel}</div>
            <div className="text-sm text-gray-500 mb-4">ליצור משימת המשך?</div>
            <div className="flex gap-2">
              <button onClick={onSkip} className="flex-1 bg-gray-100 text-gray-600 rounded-xl py-2.5 text-sm font-bold hover:bg-gray-200 transition-colors">
                לא, תודה
              </button>
              <button onClick={() => setShowForm(true)} className="flex-1 bg-[#0D1B2A] text-[#E8C97A] rounded-xl py-2.5 text-sm font-bold hover:bg-[#16283d] transition-colors">
                כן, ליצור
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-[#0D1B2A]">משימת המשך</h3>
              <button onClick={onSkip} className="text-gray-400 p-1 hover:text-gray-600"><X size={18} /></button>
            </div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">תיאור המשימה</label>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              type="text"
              className="w-full border-2 border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C] mb-3"
            />
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">תאריך (לא חובה)</label>
            <input
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              type="date"
              className="w-full border-2 border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C] mb-2"
            />
            <div className="flex gap-1.5 mb-4">
              {QUICK_OFFSETS.map(o => (
                <button
                  key={o.days}
                  onClick={() => applyOffset(o.days)}
                  className="flex-1 text-[11px] px-2 py-1.5 rounded-full border border-[#EDE6D6] bg-[#FAF6EE] text-[#9B7A2F] font-medium hover:bg-[#F5E7C4] transition-colors"
                >
                  {o.label}
                </button>
              ))}
            </div>
            <button
              onClick={submit}
              disabled={!text.trim()}
              className="w-full bg-[#0D1B2A] text-[#E8C97A] py-3 rounded-xl font-bold text-sm shadow-lg disabled:opacity-40"
            >
              צור משימת המשך
            </button>
          </>
        )}
      </div>
    </div>
  );
}
