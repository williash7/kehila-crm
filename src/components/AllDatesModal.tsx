import React, { useMemo, useState } from 'react';
import { CalendarDays, List, ChevronLeft } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { FullScreenView } from './FullScreenView';
import { ProfileModal } from './ProfileModal';
import { HolidayModal } from './HolidayModal';
import { getCustomHols } from '../lib/api';
import { filterHolidays } from '../lib/holidayFilter';
import { nextEventOccurrence } from '../lib/tasks';
import { computePersonalDateEvents } from '../lib/personalDates';
import {
  DateKind, ALL_KINDS, KIND_LABEL, KIND_ICON, KIND_COLOR,
  buildAllDates, groupByMonth, countByKind, DateItem,
} from '../lib/allDates';

// ─────────────────────────────────────────────────────────────────────────────
// כל התאריכים.
//
// המסננים כאן הם **בחירה מרובה** ולא רשימת "או": השאלה האמיתית היא לרוב
// "חגים וימי הולדת, בלי כל השאר" — צירוף שרשימת בחירה יחידה לא יודעת לענות.
// ─────────────────────────────────────────────────────────────────────────────

const RANGES = [
  { days: 30, label: 'חודש' },
  { days: 90, label: '3 חודשים' },
  { days: 180, label: 'חצי שנה' },
  { days: 366, label: 'שנה' },
];

export function AllDatesModal({ onClose }: { onClose: () => void }) {
  const { holidays: rawHolidays, eventsData, visibleDonors, crm, settings, holidayExtras } = useAppStore();

  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [kinds, setKinds] = useState<DateKind[]>(ALL_KINDS);
  const [horizon, setHorizon] = useState(90);
  const [openContact, setOpenContact] = useState<string | null>(null);
  const [openHoliday, setOpenHoliday] = useState<any | null>(null);

  const today = useMemo(() => new Date(), []);

  const items = useMemo(() => {
    const hols: { name: string; dateStr: string }[] = [];
    filterHolidays(rawHolidays, settings.holidayVisibility).forEach((h: any) => {
      const dateStr = h.date?.split('T')[0];
      const name = h.hebrew || h.title;
      if (dateStr && name) hols.push({ name, dateStr });
    });
    (getCustomHols() || []).forEach((c: any) => {
      if (c.name && c.date) hols.push({ name: c.name, dateStr: c.date });
    });

    const events = (eventsData || []).map((e: any) => ({
      id: e.id, name: e.name, next: nextEventOccurrence(e, today),
    }));

    const personal = computePersonalDateEvents(visibleDonors, crm, today);

    return buildAllDates({ holidays: hols, events, personal }, today, horizon);
  }, [rawHolidays, settings.holidayVisibility, eventsData, visibleDonors, crm, today, horizon]);

  const counts = useMemo(() => countByKind(items), [items]);
  const shown = useMemo(() => items.filter(i => kinds.includes(i.kind)), [items, kinds]);
  const months = useMemo(() => groupByMonth(shown), [shown]);

  const toggleKind = (k: DateKind) => {
    setKinds(prev => {
      // אף מסנן דלוק פירושו מסך ריק בלי הסבר. במקום זה, כיבוי האחרון
      // מדליק את כולם — הרבה יותר קרוב למה שהתכוונת.
      const next = prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k];
      return next.length ? next : ALL_KINDS;
    });
  };

  const openItem = (it: DateItem) => {
    if (it.person) { setOpenContact(it.person); return; }
    if (it.kind === 'holiday') {
      const ex = holidayExtras[it.title] || {};
      setOpenHoliday({ name: it.title, dateStr: it.date.toISOString().slice(0, 10), hebrew: '', emoji: '✡️', desc: ex.desc || '' });
    }
  };

  const Row = ({ it, showDate }: { key?: React.Key; it: DateItem; showDate?: boolean }) => (
    <button
      onClick={() => openItem(it)}
      className="w-full text-right bg-white rounded-xl border border-[#EDE6D6] px-3 py-2.5 flex items-center gap-3 hover:border-[#C9A84C] transition-colors"
    >
      <span className="text-xl shrink-0">{it.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-[#0D1B2A] truncate">
          {it.person ? <>{it.person} <span className="font-normal text-gray-400">· {it.title}</span></> : it.title}
        </div>
        {showDate && (
          <div className="text-[11px] text-gray-400">
            {it.date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        )}
      </div>
      <span className={`text-[10px] font-bold px-2 py-1 rounded-full border shrink-0 ${KIND_COLOR[it.kind]}`}>
        {it.dist === 0 ? 'היום' : it.dist === 1 ? 'מחר' : `בעוד ${it.dist} ימים`}
      </span>
      {(it.person || it.kind === 'holiday') && <ChevronLeft size={14} className="text-gray-300 shrink-0" />}
    </button>
  );

  return (
    <FullScreenView
      eyebrow="לוח אישי"
      title="כל התאריכים"
      backLabel="חזרה"
      onClose={onClose}
      layout="wide"
      actions={
        <button
          onClick={() => setView(v => (v === 'list' ? 'calendar' : 'list'))}
          className="flex items-center gap-1.5 h-9 px-3 rounded-full text-white/70 hover:bg-white/10 text-xs font-bold transition-colors"
          title={view === 'list' ? 'עבור ללוח שנה' : 'עבור לרשימה'}
        >
          {view === 'list' ? <><CalendarDays size={14} /> <span className="hidden md:inline">לוח שנה</span></>
                           : <><List size={14} /> <span className="hidden md:inline">רשימה</span></>}
        </button>
      }
    >
      <>
        {/* מסננים */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {ALL_KINDS.map(k => {
            const on = kinds.includes(k);
            return (
              <button
                key={k}
                onClick={() => toggleKind(k)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  on ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]' : 'bg-white text-gray-400 border-[#EDE6D6]'
                }`}
              >
                {KIND_ICON[k]} {KIND_LABEL[k]} ({counts[k]})
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-[11px] text-gray-400 ml-1">טווח:</span>
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setHorizon(r.days)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                horizon === r.days ? 'bg-[#C9A84C]/15 text-[#9B7A2F] border-[#C9A84C]/40' : 'bg-white text-gray-400 border-[#EDE6D6]'
              }`}
            >
              {r.label}
            </button>
          ))}
          <span className="text-[11px] text-gray-400 mr-auto">{shown.length} תאריכים</span>
        </div>

        {shown.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            אין תאריכים בטווח ובסינון שנבחרו.
          </div>
        ) : view === 'list' ? (
          // ── רשימה רצופה, מקובצת ל"היום / השבוע / החודש / אחר כך" ──────
          <div className="space-y-4">
            {[
              { label: 'היום ומחר', from: 0, to: 1 },
              { label: 'השבוע הקרוב', from: 2, to: 7 },
              { label: 'החודש', from: 8, to: 30 },
              { label: 'בהמשך', from: 31, to: Infinity },
            ].map(group => {
              const inGroup = shown.filter(i => i.dist >= group.from && i.dist <= group.to);
              if (!inGroup.length) return null;
              return (
                <section key={group.label}>
                  <h3 className="text-xs font-bold text-gray-400 mb-1.5">{group.label} ({inGroup.length})</h3>
                  <div className="space-y-1.5">
                    {inGroup.map(it => <Row key={it.key} it={it} showDate />)}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          // ── לוח שנה: חודש אחרי חודש, יום אחרי יום ─────────────────────
          <div className="space-y-5">
            {months.map(m => (
              <section key={m.key}>
                <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] mb-2 sticky top-0 bg-[#FAF6EE] py-1">
                  {m.label}
                </h3>
                <div className="space-y-2">
                  {m.days.map(d => (
                    <div key={d.date.toDateString()} className="flex gap-3">
                      <div className="w-12 shrink-0 text-center pt-1.5">
                        <div className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A] leading-none">{d.date.getDate()}</div>
                        <div className="text-[10px] text-gray-400">{d.date.toLocaleDateString('he-IL', { weekday: 'short' })}</div>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {d.items.map(it => <Row key={it.key} it={it} />)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </>

      {openContact && <ProfileModal name={openContact} onClose={() => setOpenContact(null)} backLabel="כל התאריכים" />}
      {openHoliday && <HolidayModal holiday={openHoliday} onClose={() => setOpenHoliday(null)} backLabel="כל התאריכים" />}
    </FullScreenView>
  );
}
