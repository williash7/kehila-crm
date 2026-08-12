import React, { useMemo, useState } from 'react';
import { Bot, X, Copy, Check, Sparkles, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { buildHolidayList } from '../lib/holidayList';
import { getCustomHols } from '../lib/api';
import { stampCreated, STANDALONE_TASKS_ID } from '../lib/tasks';
import { getOrg } from '../lib/orgConfig';

type TargetKind = 'holiday' | 'event' | 'homeVisit' | 'contact' | 'standalone';

interface ParsedItem {
  key: string;
  text: string;
  targetKind: TargetKind;
  targetId: string; // holiday id / event id / round id / contact name — empty for standalone
}

const KIND_LABELS: Record<TargetKind, string> = {
  holiday: '📅 חג',
  event: '📌 אירוע',
  homeVisit: '🏠 ביקורי בית (הכנה)',
  contact: '👤 אדם פרטי',
  standalone: '📋 משימה חד-פעמית',
};

// מוצא את ההתאמה הכי טובה לתווית חופשית שה-AI החזיר מתוך רשימת מועמדים אמיתיים —
// קודם התאמה מדויקת (אחרי נרמול רווחים/אותיות), ואז הכלה חלקית בכל כיוון.
function bestMatch(label: string, candidates: { id: string; label: string }[]): string {
  if (!label) return candidates[0]?.id || '';
  const norm = (s: string) => s.trim().toLowerCase();
  const nLabel = norm(label);
  const exact = candidates.find(c => norm(c.label) === nLabel);
  if (exact) return exact.id;
  const partial = candidates.find(c => norm(c.label).includes(nLabel) || nLabel.includes(norm(c.label)));
  if (partial) return partial.id;
  return candidates[0]?.id || '';
}

export function GlobalAIImportModal({ onClose }: { onClose: () => void }) {
  const { holidays, eventsData, homeVisits, donors, holidayExtras, updateHolidayExtras, updateEventsData, updateHomeVisitRoundMeta } = useAppStore();
  const [step, setStep] = useState<'prompt' | 'review'>('prompt');
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parseError, setParseError] = useState('');
  const [items, setItems] = useState<ParsedItem[]>([]);

  const holidayOptions = useMemo(() => buildHolidayList(holidays, getCustomHols(), new Date()).filter(h => h.daysAway >= 0).map(h => ({ id: h.id, label: `${h.emoji} ${h.name} (בעוד ${h.daysAway} ימים)` })), [holidays]);
  const eventOptions = useMemo(() => (eventsData as any[]).map(e => ({ id: e.id, label: e.name })), [eventsData]);
  const roundOptions = useMemo(() => (homeVisits.rounds || []).filter((r: any) => r.status === 'active').map((r: any) => ({
    id: r.id,
    label: r.purpose || `מערך מ-${new Date(r.createdAt).toLocaleDateString('he-IL')}`,
  })), [homeVisits]);
  const contactNames = useMemo(() => Object.keys(donors).sort(), [donors]);

  const buildPrompt = () => {
    const parts: string[] = [];
    parts.push(`אני מנהל את ${getOrg().orgName.he || 'הארגון'}. יש לי רשימת משימות שונות ואני רוצה שתעזור לי לארגן אותה — פשוט תכתוב לי רשימה (חופשי, כל דבר שעולה לך בראש) ותשייך כל משימה למקום הכי הגיוני: חג, אירוע קבוע, מערך ביקורי בית, אדם ספציפי, או משימה כללית.`);
    parts.push('\nלהלן רשימת החגים/אירועים/מערכי ביקורים הפעילים אצלי כרגע, כדי שתשייך אליהם כשרלוונטי (אפשר גם משהו אחר שלא ברשימה, פשוט תכתוב את השם):');
    if (holidayOptions.length) parts.push(`חגים: ${holidayOptions.map(h => h.label).join(', ')}`);
    if (eventOptions.length) parts.push(`אירועים קבועים: ${eventOptions.map(e => e.label).join(', ')}`);
    if (roundOptions.length) parts.push(`מערכי ביקורי בית פעילים: ${roundOptions.map(r => r.label).join(', ')}`);
    parts.push('\nלכל משימה שאתה מציע, כתוב שיוך (targetKind) אחד מתוך: "holiday" (חג), "event" (אירוע קבוע), "homeVisit" (הכנה למערך ביקורי בית), "contact" (משימה שקשורה לאדם ספציפי — כתוב את שמו), "standalone" (משימה כללית שלא שייכת לאף אחד מהנ"ל).');
    parts.push('כשנסיים לשוחח ותגיע לרשימה סופית, סכם הכל בבלוק קוד JSON יחיד, בדיוק במבנה הזה (בלי טקסט נוסף בתוך הבלוק):');
    parts.push('```json');
    parts.push(JSON.stringify({ items: [
      { text: 'משימה לדוגמה הקשורה לחג', targetKind: 'holiday', targetLabel: 'שם החג' },
      { text: 'משימה לדוגמה הקשורה לאדם', targetKind: 'contact', targetLabel: 'שם האדם' },
      { text: 'משימה כללית', targetKind: 'standalone' },
    ] }, null, 2));
    parts.push('```');
    setPrompt(parts.join('\n'));
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setParseError('ההעתקה האוטומטית לא עבדה — סמן/י את הטקסט והעתק/י ידנית.');
    }
  };

  const parsePasted = () => {
    setParseError('');
    const fenceMatch = pasteText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = (fenceMatch ? fenceMatch[1] : pasteText).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      const rawItems: any[] = Array.isArray(parsed.items) ? parsed.items : [];
      const valid = rawItems.filter(it => it && typeof it.text === 'string' && it.text.trim());
      if (valid.length === 0) {
        setParseError('לא נמצאו משימות תקינות ב-JSON שהודבק. ודא/י שהעתקת את כל בלוק הקוד.');
        return;
      }
      const resolved: ParsedItem[] = valid.map((it, i) => {
        const kind: TargetKind = ['holiday', 'event', 'homeVisit', 'contact'].includes(it.targetKind) ? it.targetKind : 'standalone';
        const label = typeof it.targetLabel === 'string' ? it.targetLabel : '';
        let targetId = '';
        if (kind === 'holiday') targetId = bestMatch(label, holidayOptions);
        else if (kind === 'event') targetId = bestMatch(label, eventOptions);
        else if (kind === 'homeVisit') targetId = bestMatch(label, roundOptions);
        else if (kind === 'contact') targetId = bestMatch(label, contactNames.map(n => ({ id: n, label: n })));
        return { key: `item_${i}`, text: it.text.trim(), targetKind: kind, targetId };
      });
      setItems(resolved);
      setStep('review');
    } catch {
      setParseError('לא הצלחתי לקרוא את הטקסט כ-JSON תקין. ודא/י שהדבקת בדיוק את בלוק הקוד שה-AI החזיר.');
    }
  };

  const patchItem = (key: string, patch: Partial<ParsedItem>) => {
    setItems(prev => prev.map(it => it.key === key ? { ...it, ...patch } : it));
  };

  const removeItem = (key: string) => setItems(prev => prev.filter(it => it.key !== key));

  const commit = () => {
    const active = items;
    if (active.length === 0) return;

    const byHoliday = new Map<string, ParsedItem[]>();
    const byEvent = new Map<string, ParsedItem[]>();
    const byRound = new Map<string, ParsedItem[]>();
    const contactItems: ParsedItem[] = [];
    const standaloneItems: ParsedItem[] = [];

    active.forEach(it => {
      if (it.targetKind === 'holiday' && it.targetId) {
        if (!byHoliday.has(it.targetId)) byHoliday.set(it.targetId, []);
        byHoliday.get(it.targetId)!.push(it);
      } else if (it.targetKind === 'event' && it.targetId) {
        if (!byEvent.has(it.targetId)) byEvent.set(it.targetId, []);
        byEvent.get(it.targetId)!.push(it);
      } else if (it.targetKind === 'homeVisit' && it.targetId) {
        if (!byRound.has(it.targetId)) byRound.set(it.targetId, []);
        byRound.get(it.targetId)!.push(it);
      } else if (it.targetKind === 'contact' && it.targetId) {
        contactItems.push(it);
      } else {
        standaloneItems.push(it);
      }
    });

    byHoliday.forEach((its, id) => {
      const existing = holidayExtras[id]?.tasks || [];
      updateHolidayExtras(id, { tasks: [...existing, ...its.map(it => stampCreated({ text: it.text, done: false }))] });
    });
    if (byEvent.size > 0) {
      updateEventsData((eventsData as any[]).map((e: any) => byEvent.has(e.id)
        ? { ...e, tasks: [...(e.tasks || []), ...byEvent.get(e.id)!.map(it => stampCreated({ text: it.text, done: false }))] }
        : e));
    }
    byRound.forEach((its, id) => {
      const round = (homeVisits.rounds || []).find((r: any) => r.id === id);
      updateHomeVisitRoundMeta(id, { prepTasks: [...(round?.prepTasks || []), ...its.map(it => ({ text: it.text, done: false }))] });
    });
    if (contactItems.length > 0 || standaloneItems.length > 0) {
      const existing = holidayExtras[STANDALONE_TASKS_ID]?.tasks || [];
      const newContactTasks = contactItems.map(it => stampCreated({ text: `👤 ${it.targetId}: ${it.text}`, done: false, personName: it.targetId }));
      const newStandaloneTasks = standaloneItems.map(it => stampCreated({ text: it.text, done: false }));
      updateHolidayExtras(STANDALONE_TASKS_ID, { tasks: [...existing, ...newContactTasks, ...newStandaloneTasks] });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl p-5 pb-8 w-full max-w-[480px] max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A] flex items-center gap-2">
            <Bot size={20} className="text-purple-700" /> יבוא משימות מבינה מלאכותית
          </h2>
          <button onClick={onClose} className="bg-gray-200/50 p-2 rounded-full text-gray-500 hover:bg-gray-200"><X size={16} /></button>
        </div>

        {step === 'prompt' && (
          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3">
            <p className="text-[11px] text-gray-500 leading-relaxed">
              צרו פרומפט, העתיקו אותו לצ'אט AI, שוחחו איתו על כל המשימות שיש לכם — הוא ישייך כל אחת מהן לחג/אירוע/מערך ביקורים/אדם/כללי. הדביקו את פלט ה-JSON למטה, ולפני השמירה תוכלו לעבור על כל שיוך ולתקן אותו.
            </p>
            {!prompt ? (
              <button onClick={buildPrompt} className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white text-sm font-bold py-2.5 rounded-xl active:scale-95 transition-transform">
                <Sparkles size={15} /> צור פרומפט
              </button>
            ) : (
              <>
                <div className="relative">
                  <textarea readOnly value={prompt} rows={7} className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 text-[11px] leading-relaxed outline-none resize-none" dir="rtl" />
                  <button onClick={copyPrompt} className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-md flex items-center gap-1">
                    {copied ? <><Check size={12} /> הועתק</> : <><Copy size={12} /> העתק</>}
                  </button>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">הדביקו כאן את פלט ה-JSON שקיבלתם מה-AI:</label>
                  <textarea
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    rows={6}
                    className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-400 resize-none"
                    placeholder='{"items": [...]}'
                    dir="ltr"
                  />
                </div>
                <button onClick={parsePasted} disabled={!pasteText.trim()} className="w-full bg-[#0D1B2A] text-[#E8C97A] text-sm font-bold py-2.5 rounded-xl disabled:opacity-40">
                  המשך לאישור שיוך
                </button>
                {parseError && <div className="text-xs rounded-lg p-2.5 bg-red-50 text-red-700">{parseError}</div>}
              </>
            )}
          </div>
        )}

        {step === 'review' && (
          <>
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2 mb-3">
              <p className="text-[11px] text-gray-500 mb-1">בדקו את השיוך של כל משימה לפני השמירה — אפשר לתקן, לבטל שיוך, או להסיר משימה.</p>
              {items.map(it => (
                <div key={it.key} className="bg-white rounded-xl p-3 shadow-sm border border-[#EDE6D6] space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm text-[#0D1B2A] flex-1">{it.text}</span>
                    <button onClick={() => removeItem(it.key)} className="text-red-300 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
                  </div>
                  <div className="flex gap-1.5">
                    <select
                      value={it.targetKind}
                      onChange={e => patchItem(it.key, { targetKind: e.target.value as TargetKind, targetId: '' })}
                      className="flex-1 bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#C9A84C]"
                    >
                      {(Object.keys(KIND_LABELS) as TargetKind[]).map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                    </select>
                    {it.targetKind === 'holiday' && (
                      <select value={it.targetId} onChange={e => patchItem(it.key, { targetId: e.target.value })} className="flex-1 bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#C9A84C]">
                        {holidayOptions.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
                      </select>
                    )}
                    {it.targetKind === 'event' && (
                      <select value={it.targetId} onChange={e => patchItem(it.key, { targetId: e.target.value })} className="flex-1 bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#C9A84C]">
                        {eventOptions.map(ev => <option key={ev.id} value={ev.id}>{ev.label}</option>)}
                      </select>
                    )}
                    {it.targetKind === 'homeVisit' && (
                      <select value={it.targetId} onChange={e => patchItem(it.key, { targetId: e.target.value })} className="flex-1 bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#C9A84C]">
                        {roundOptions.length === 0 && <option value="">אין מערך פעיל</option>}
                        {roundOptions.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                    )}
                    {it.targetKind === 'contact' && (
                      <>
                        <input
                          list="global-ai-import-contacts"
                          value={it.targetId}
                          onChange={e => patchItem(it.key, { targetId: e.target.value })}
                          className="flex-1 bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#C9A84C]"
                          placeholder="שם איש הקשר"
                        />
                        <datalist id="global-ai-import-contacts">
                          {contactNames.map(n => <option key={n} value={n} />)}
                        </datalist>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {items.length === 0 && <div className="text-center text-gray-400 text-sm py-6">כל המשימות הוסרו</div>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setStep('prompt')} className="px-4 bg-gray-100 rounded-xl text-gray-500 font-bold text-sm">חזרה</button>
              <button onClick={commit} disabled={items.length === 0} className="flex-1 bg-gradient-to-br from-[#0D1B2A] to-[#1A2E45] text-white rounded-xl py-3 font-bold shadow-md disabled:opacity-40">
                שמור {items.length} משימות
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
