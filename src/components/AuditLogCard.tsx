import React from 'react';
import { ChevronDown, History, Loader2, RefreshCw, Search } from 'lucide-react';
import { AuditEntry, getAuditCloud } from '../lib/api';

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || 'זמן לא ידוע';
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short', timeStyle: 'short',
  }).format(date);
}

export function AuditLogCard() {
  const [open, setOpen] = React.useState(false);
  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState('');
  const [query, setQuery] = React.useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const result = await getAuditCloud();
    setEntries([...result.entries].sort((a, b) => String(b.at).localeCompare(String(a.at))));
    setError(result.error || '');
    setLoaded(true);
    setLoading(false);
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded && !loading) void load();
  };

  const normalized = query.trim().toLocaleLowerCase('he');
  const visible = normalized
    ? entries.filter(entry => [entry.label, entry.subject, entry.details, entry.action]
        .some(value => String(value || '').toLocaleLowerCase('he').includes(normalized)))
    : entries;

  return <section className="bg-white rounded-2xl shadow-sm border border-[#EDE6D6] overflow-hidden">
    <button onClick={toggle} className="w-full flex items-center justify-between gap-3 p-4 text-right">
      <span className="flex items-center gap-3 min-w-0">
        <span className="w-10 h-10 rounded-xl bg-[#FAF6EE] text-[#9B7A2F] flex items-center justify-center shrink-0"><History size={19} /></span>
        <span className="min-w-0">
          <span className="block font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">יומן שינויים</span>
          <span className="block text-[11px] text-gray-500 mt-0.5">מה השתנה ומתי; לקריאה בלבד</span>
        </span>
      </span>
      <ChevronDown size={18} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>

    {open && <div className="border-t border-[#EDE6D6] p-4 space-y-3">
      <p className="text-[11px] text-gray-500 leading-relaxed">היומן שומר תיאור קצר של פעולות שנשמרו בהצלחה, בלי להעתיק לתוכו את כל המידע האישי. באפליקציה האישית הפעולות הן שלך; בעתיד, אם יהיו משתמשים נפרדים, יהיה צורך להוסיף זיהוי משתמש.</p>
      <div className="flex gap-2">
        <label className="flex-1 flex items-center gap-2 bg-[#FAF6EE] rounded-xl px-3 border border-[#EDE6D6]">
          <Search size={14} className="text-gray-400" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="חפש פעולה או שם…" className="w-full bg-transparent py-2.5 text-sm outline-none" />
        </label>
        <button onClick={() => void load()} disabled={loading} title="רענן" className="w-11 rounded-xl border border-[#EDE6D6] flex items-center justify-center text-gray-500 disabled:opacity-50">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>

      {error && <div className="text-xs text-red-700 bg-red-50 rounded-xl p-3">לא ניתן לטעון את היומן כרגע: {error}</div>}
      {!loading && loaded && !error && visible.length === 0 && <div className="text-center text-xs text-gray-400 py-5">{entries.length ? 'אין תוצאות לחיפוש.' : 'עדיין אין פעולות מתועדות.'}</div>}
      {visible.length > 0 && <div className="max-h-80 overflow-auto divide-y divide-[#F1ECE1] border border-[#EDE6D6] rounded-xl">
        {visible.map((entry, index) => <div key={`${entry.id}-${index}`} className="p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#0D1B2A]">{entry.label || entry.action || 'שינוי'}</div>
              {entry.subject && <div className="text-xs text-gray-600 mt-0.5 truncate">{entry.subject}</div>}
              {entry.details && <div className="text-[11px] text-gray-400 mt-1 leading-relaxed">{entry.details}</div>}
            </div>
            <time className="text-[10px] text-gray-400 whitespace-nowrap" dateTime={entry.at}>{when(entry.at)}</time>
          </div>
        </div>)}
      </div>}
    </div>}
  </section>;
}
