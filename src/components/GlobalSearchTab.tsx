import React from 'react';
import { Search, UserRound, HandCoins, CalendarCheck, Target, ClipboardList, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { buildGlobalSearchIndex, GlobalSearchKind, GlobalSearchResult, searchGlobalIndex } from '../lib/globalSearch';

const KIND_META: Record<GlobalSearchKind, { label: string; Icon: React.ComponentType<{ size?: number }> }> = {
  contact: { label: 'איש קשר', Icon: UserRound },
  donation: { label: 'תרומה', Icon: HandCoins },
  activity: { label: 'פעילות', Icon: CalendarCheck },
  project: { label: 'קמפיין', Icon: Target },
  task: { label: 'משימה', Icon: ClipboardList },
};

export function GlobalSearchTab({ onNavigate }: { onNavigate: (result: GlobalSearchResult) => void }) {
  const { donors, crm, donations, eventsData, projects, holidayExtras, holidays } = useAppStore();
  const [query, setQuery] = React.useState('');

  const index = React.useMemo(() => buildGlobalSearchIndex({
    donors,
    crm,
    donations,
    activities: eventsData,
    projects,
    holidayExtras,
    holidayNames: Object.fromEntries((holidays || []).map((holiday: any) => [holiday.id || holiday.name, holiday.name])),
  }), [donors, crm, donations, eventsData, projects, holidayExtras, holidays]);
  const results = React.useMemo(() => searchGlobalIndex(index, query), [index, query]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 md:px-8 md:py-8" dir="rtl">
      <div className="mb-5">
        <h1 className="font-['Frank_Ruhl_Libre'] text-3xl font-bold text-[#0D1B2A]">חיפוש בכל האפליקציה</h1>
        <p className="text-sm text-gray-500 mt-1">אנשים, תרומות, פעילויות, קמפיינים ומשימות — במקום אחד.</p>
      </div>

      <label className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 border-2 border-transparent focus-within:border-[#C9A84C] shadow-sm">
        <Search size={22} className="text-[#9B7A2F] shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="מה מחפשים? שם, סכום, ייעוד או משימה…"
          className="flex-1 min-w-0 bg-transparent outline-none text-base text-[#0D1B2A] placeholder:text-gray-400"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-xs text-gray-400 px-2 py-1 rounded-lg hover:bg-gray-100">נקה</button>
        )}
      </label>

      {!query.trim() ? (
        <div className="mt-8 bg-white/60 border border-[#EDE6D6] rounded-2xl p-8 text-center text-sm text-gray-500">
          אפשר לחפש גם חלק ממילה, מספר טלפון, סכום תרומה, ייעוד או תוכן של משימה.
        </div>
      ) : results.length === 0 ? (
        <div className="mt-8 bg-white/60 border border-[#EDE6D6] rounded-2xl p-8 text-center">
          <div className="font-bold text-[#0D1B2A]">לא נמצאה תוצאה</div>
          <div className="text-sm text-gray-500 mt-1">אפשר לנסות מילה קצרה יותר או כתיב אחר.</div>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          <div className="text-xs text-gray-400 px-1">{results.length} תוצאות מתוך {index.length} פריטים</div>
          {results.map(result => {
            const { label, Icon } = KIND_META[result.kind];
            return (
              <button
                key={result.id}
                onClick={() => onNavigate(result)}
                className="w-full bg-white border border-[#EDE6D6] rounded-2xl p-4 flex items-center gap-3 text-right shadow-sm hover:border-[#C9A84C] active:scale-[0.99] transition-all"
              >
                <span className="w-10 h-10 rounded-xl bg-[#C9A84C]/12 text-[#9B7A2F] flex items-center justify-center shrink-0"><Icon size={19} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-[#0D1B2A] truncate">{result.title}</span>
                    <span className="text-[10px] bg-[#FAF6EE] text-[#9B7A2F] rounded-full px-2 py-0.5 shrink-0">{label}</span>
                  </span>
                  {result.subtitle && <span className="block text-xs text-gray-500 mt-1 truncate">{result.subtitle}</span>}
                </span>
                <ArrowLeft size={16} className="text-gray-300 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
