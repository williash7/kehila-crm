import React, { useState } from 'react';
import { Bot, Copy, Check, ChevronDown, Sparkles } from 'lucide-react';
import { getOrg } from '../lib/orgConfig';

export interface AIPlanResult {
  tasks?: string[];
  budget?: { name: string; type: 'income' | 'expense'; amount: number }[];
  reminders?: { title: string; days: number }[];
}

interface AIPlanningAssistantProps {
  title: string;
  contextLines: string[];
  includeBudget?: boolean;
  includeReminders?: boolean;
  onApply: (result: AIPlanResult) => void;
}

// יוצר פרומפט תכנון להעתקה לצ'אט AI חיצוני (ChatGPT/Claude וכו'), ומאפשר
// להדביק בחזרה את הפלט שהצ'אט הפיק (בפורמט JSON מוגדר) — ואז מעדכן אוטומטית
// את המשימות/תקציב/תזכורות במקום למלא ידנית שדה-שדה.
export function AIPlanningAssistant({ title, contextLines, includeBudget, includeReminders, onApply }: AIPlanningAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [status, setStatus] = useState<null | { ok: boolean; msg: string }>(null);

  const buildPrompt = () => {
    const parts: string[] = [];
    parts.push(`אני מנהל את ${getOrg().orgName.he || 'הארגון'} ומתכנן את "${title}". בוא נחשוב יחד על תכנון טוב.`);
    if (contextLines.length > 0) {
      parts.push('\nרקע ומידע קיים:');
      contextLines.forEach(l => parts.push(`- ${l}`));
    }
    parts.push('\nאשמח שתעזור לי לגבש:');
    parts.push('1. רשימת משימות מעשיות להכנה (הזמנות, רכש, לוגיסטיקה, תוכן, ניקיון וכו׳)');
    if (includeBudget) parts.push('2. הצעה לסעיפי תקציב (הכנסות והוצאות צפויות) עם סכום משוער בש"ח לכל סעיף');
    if (includeReminders) parts.push('3. תזכורות — כמה ימים לפני הפעילות כדאי להתחיל כל דבר');
    parts.push('\nבוא נשוחח על זה קודם ותשאל אותי שאלות אם צריך. כשנסיים ונגיע לתוכנית סופית, אנא סכם הכל בבלוק קוד JSON יחיד, בדיוק במבנה הבא (רק שדות שרלוונטיים, בלי טקסט נוסף בתוך הבלוק):');
    parts.push('```json');
    const schema: any = { tasks: ['משימה 1', 'משימה 2'] };
    if (includeBudget) schema.budget = [{ name: 'שם הסעיף', type: 'expense', amount: 500 }];
    if (includeReminders) schema.reminders = [{ title: 'שלח הזמנות', days: 14 }];
    parts.push(JSON.stringify(schema, null, 2));
    parts.push('```');
    setPrompt(parts.join('\n'));
    setIsOpen(true);
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatus({ ok: false, msg: 'ההעתקה האוטומטית לא עבדה — סמן/י את הטקסט והעתק/י ידנית.' });
    }
  };

  const applyPasted = () => {
    const fenceMatch = pasteText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = (fenceMatch ? fenceMatch[1] : pasteText).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      const result: AIPlanResult = {
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks.filter((t: any) => typeof t === 'string' && t.trim()) : [],
        budget: Array.isArray(parsed.budget)
          ? parsed.budget.filter((b: any) => b && typeof b.name === 'string').map((b: any) => ({ name: b.name, type: b.type === 'income' ? 'income' : 'expense', amount: Number(b.amount) || 0 }))
          : undefined,
        reminders: Array.isArray(parsed.reminders)
          ? parsed.reminders.filter((r: any) => r && typeof r.title === 'string').map((r: any) => ({ title: r.title, days: Number(r.days) || 7 }))
          : undefined,
      };
      const total = (result.tasks?.length || 0) + (result.budget?.length || 0) + (result.reminders?.length || 0);
      if (total === 0) {
        setStatus({ ok: false, msg: 'לא נמצא תוכן תקין ב-JSON שהודבק. ודא/י שהעתקת את כל בלוק הקוד.' });
        return;
      }
      onApply(result);
      setStatus({ ok: true, msg: `נוספו ${result.tasks?.length || 0} משימות${result.budget ? `, ${result.budget.length} סעיפי תקציב` : ''}${result.reminders ? `, ${result.reminders.length} תזכורות` : ''}.` });
      setPasteText('');
    } catch {
      setStatus({ ok: false, msg: 'לא הצלחתי לקרוא את הטקסט כ-JSON תקין. ודא/י שהדבקת בדיוק את בלוק הקוד שה-AI החזיר.' });
    }
  };

  return (
    <div className="bg-gradient-to-br from-[#1B0042]/5 to-[#3B0082]/5 border border-purple-200 rounded-xl overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-purple-700" />
          <span className="text-sm font-bold text-[#0D1B2A]">תכנון עם בינה מלאכותית</span>
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="p-3 pt-0 space-y-3">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            צרו פרומפט, העתיקו אותו לצ'אט AI (כמו ChatGPT או Claude), שוחחו איתו על התכנון — ובסוף בקשו ממנו את סיכום ה-JSON. הדביקו את הפלט למטה וזה יתעדכן אוטומטית באפליקציה, בלי להזין כל משימה בנפרד.
          </p>

          {!prompt ? (
            <button onClick={buildPrompt} className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white text-sm font-bold py-2.5 rounded-xl active:scale-95 transition-transform">
              <Sparkles size={15} /> צור פרומפט תכנון
            </button>
          ) : (
            <>
              <div className="relative">
                <textarea readOnly value={prompt} rows={6} className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 text-[11px] leading-relaxed outline-none resize-none" dir="rtl" />
                <button onClick={copyPrompt} className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-md flex items-center gap-1">
                  {copied ? <><Check size={12} /> הועתק</> : <><Copy size={12} /> העתק</>}
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">הדביקו כאן את פלט ה-JSON שקיבלתם מה-AI:</label>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  rows={5}
                  className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-400 resize-none"
                  placeholder='{"tasks": [...], ...}'
                  dir="ltr"
                />
              </div>
              <button
                onClick={applyPasted}
                disabled={!pasteText.trim()}
                className="w-full bg-[#0D1B2A] text-[#E8C97A] text-sm font-bold py-2.5 rounded-xl disabled:opacity-40"
              >
                עדכן אוטומטית באפליקציה
              </button>
              {status && (
                <div className={`text-xs rounded-lg p-2.5 ${status.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {status.msg}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
