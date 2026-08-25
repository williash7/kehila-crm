import React from 'react';
import { Clipboard, FileUp, Inbox, Mic, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { stampCreated, STANDALONE_TASKS_ID } from '../lib/tasks';

interface InboxDraft {
  id: string;
  text: string;
  createdAt: string;
  file?: { name: string; type: string; size: number; needsAttachment?: boolean };
  resolvedAt?: string;
  deletedAt?: string;
}

const MAX_TEXT_FILE = 200_000;

export function QuickInboxTab() {
  const { holidayExtras, updateHolidayExtras } = useAppStore();
  const container = holidayExtras[STANDALONE_TASKS_ID] || {};
  const drafts: InboxDraft[] = Array.isArray(container.quickInbox) ? container.quickInbox : [];
  const visible = drafts.filter(draft => !draft.resolvedAt && !draft.deletedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [text, setText] = React.useState('');
  const [file, setFile] = React.useState<InboxDraft['file']>();
  const [listening, setListening] = React.useState(false);
  const [undoId, setUndoId] = React.useState<string | null>(null);

  const saveDrafts = (next: InboxDraft[]) => updateHolidayExtras(STANDALONE_TASKS_ID, { quickInbox: next });
  const add = () => {
    if (!text.trim() && !file) return;
    const draft: InboxDraft = {
      id: `inbox_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      text: text.trim() || `קובץ לצירוף: ${file?.name}`,
      createdAt: new Date().toISOString(),
      ...(file ? { file } : {}),
    };
    saveDrafts([draft, ...drafts]);
    setText(''); setFile(undefined);
  };

  const onFile = async (selected?: File) => {
    if (!selected) return;
    const meta = { name: selected.name, type: selected.type || 'קובץ', size: selected.size };
    const isText = /^(text\/|application\/(json|csv))/.test(selected.type)
      || /\.(txt|md|json|csv)$/i.test(selected.name);
    if (isText && selected.size <= MAX_TEXT_FILE) {
      const contents = await selected.text();
      setText(current => [current.trim(), `--- ${selected.name} ---`, contents].filter(Boolean).join('\n'));
      setFile(meta);
    } else {
      setFile({ ...meta, needsAttachment: true });
    }
  };

  const dictate = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) { alert('הכתבה אינה זמינה בדפדפן הזה. אפשר להקליד או להשתמש במקלדת הקולית של הטלפון.'); return; }
    const recognition = new Recognition();
    recognition.lang = 'he-IL'; recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: any) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
      if (transcript) setText(current => [current.trim(), transcript].filter(Boolean).join(' '));
    };
    recognition.start();
  };

  const toTask = (draft: InboxDraft) => {
    const task = stampCreated({ text: draft.text, done: false, notes: draft.file?.needsAttachment ? `יש לצרף קובץ: ${draft.file.name}` : undefined });
    const nextDrafts = drafts.map(row => row.id === draft.id ? { ...row, resolvedAt: new Date().toISOString() } : row);
    updateHolidayExtras(STANDALONE_TASKS_ID, { tasks: [...(container.tasks || []), task], quickInbox: nextDrafts });
  };

  const remove = (id: string) => {
    const now = new Date().toISOString();
    saveDrafts(drafts.map(row => row.id === id ? { ...row, deletedAt: now } : row));
    setUndoId(id);
    window.setTimeout(() => setUndoId(current => current === id ? null : current), 5000);
  };
  const undo = () => {
    if (!undoId) return;
    saveDrafts(drafts.map(row => row.id === undoId ? { ...row, deletedAt: undefined } : row));
    setUndoId(null);
  };

  const copyForAI = async (draft: InboxDraft) => {
    const attachment = draft.file?.needsAttachment ? `\nיש גם קובץ בשם "${draft.file.name}" שאצרף בנפרד.` : '';
    const prompt = `אני מנהל פעילות קהילתית. נתח את הטיוטה הבאה, שאל רק שאלות שחסרות, והצע אם להפוך אותה למשימה, איש קשר, תרומה, הוצאה או פעילות. אל תניח שהמידע נשמר ואל תמציא פרטים.\n\n${draft.text}${attachment}`;
    try { await navigator.clipboard.writeText(prompt); alert('הפרומפט הועתק. אפשר להדביק אותו בשיחה ולצרף את הקובץ אם יש.'); }
    catch { alert('לא ניתן להעתיק אוטומטית בדפדפן הזה.'); }
  };

  return <div className="max-w-3xl mx-auto px-4 py-5 md:px-8 md:py-8" dir="rtl">
    <div className="mb-5"><h1 className="font-['Frank_Ruhl_Libre'] text-3xl font-bold text-[#0D1B2A] flex items-center gap-2"><Inbox className="text-[#9B7A2F]" /> קליטה מהירה</h1><p className="text-sm text-gray-500 mt-1">רושמים עכשיו כטיוטה. שום דבר אינו הופך לתרומה, הוצאה או משימה בלי החלטה שלך.</p></div>

    <section className="bg-white border border-[#EDE6D6] rounded-2xl p-4 shadow-sm">
      <textarea value={text} onChange={event => setText(event.target.value)} className="w-full min-h-32 resize-y outline-none text-sm text-[#0D1B2A] placeholder:text-gray-400" placeholder="מה צריך לזכור? אפשר לכתוב חופשי…" />
      {file && <div className="bg-[#FAF6EE] rounded-xl p-2.5 text-xs text-gray-600 mb-3"><b>{file.name}</b> · {Math.ceil(file.size / 1024)}KB{file.needsAttachment && <span className="block text-amber-700 mt-1">התוכן לא נשמר בגיליון. יש לצרף את הקובץ עצמו בשיחת AI.</span>}</div>}
      <div className="flex flex-wrap gap-2">
        <button onClick={dictate} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border ${listening ? 'bg-red-50 text-red-600 border-red-200' : 'border-[#EDE6D6] text-gray-600'}`}><Mic size={15} /> {listening ? 'מקשיב…' : 'הכתבה'}</button>
        <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-[#EDE6D6] text-gray-600 cursor-pointer"><FileUp size={15} /> קובץ<input type="file" accept=".txt,.md,.json,.csv,text/*,application/json,image/*,application/pdf,audio/*" onChange={event => onFile(event.target.files?.[0])} className="hidden" /></label>
        <button onClick={add} disabled={!text.trim() && !file} className="mr-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#0D1B2A] text-white disabled:opacity-40"><Plus size={15} /> שמור טיוטה</button>
      </div>
    </section>

    <div className="mt-5 space-y-2">
      {visible.length === 0 ? <div className="text-center bg-white/60 border border-[#EDE6D6] rounded-2xl p-8 text-sm text-gray-500">אין טיוטות שממתינות לטיפול.</div> : visible.map(draft => <article key={draft.id} className="bg-white border border-[#EDE6D6] rounded-2xl p-4 shadow-sm">
        <p className="text-sm text-[#0D1B2A] whitespace-pre-wrap max-h-36 overflow-auto">{draft.text}</p>
        {draft.file && <small className="block text-gray-400 mt-2">📎 {draft.file.name}</small>}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#F1ECE1]">
          <button onClick={() => toTask(draft)} className="bg-emerald-50 text-emerald-700 rounded-xl px-3 py-2 text-xs font-bold">הפוך למשימה</button>
          <button onClick={() => copyForAI(draft)} className="bg-blue-50 text-blue-700 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1"><Clipboard size={13} /> העתק ל־AI</button>
          <button onClick={() => remove(draft.id)} className="mr-auto text-red-400 rounded-xl px-2 py-2 text-xs flex items-center gap-1"><Trash2 size={13} /> מחק</button>
        </div>
      </article>)}
    </div>

    {undoId && <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0D1B2A] text-white rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-4 text-sm"><span>הטיוטה הוסרה</span><button onClick={undo} className="text-[#E8C97A] font-bold flex items-center gap-1"><RotateCcw size={14} /> ביטול</button></div>}
  </div>;
}
