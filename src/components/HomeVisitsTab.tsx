import React, { useState } from 'react';
import { useAppStore } from '../store/AppContext';
import { DoorOpen, Plus, X, Check, ChevronUp, ChevronDown, CalendarClock, CalendarRange, CheckCircle2, Bell, Search, ClipboardList, Trash2 } from 'lucide-react';
import {
  HomeVisitEntry, HomeVisitRound, HOME_VISIT_CATEGORY_TAGS, liveCategoryFor,
  emptyHomeVisitEntry, buildInitialRoundEntries,
} from '../lib/homeVisits';
import { buildHolidayList } from '../lib/holidayList';
import { getCustomHols } from '../lib/api';
import { STANDALONE_TASKS_ID, stampCreated } from '../lib/tasks';
import { logAction } from '../lib/score';
import { CompletionFollowUpModal } from './CompletionFollowUpModal';
import { AIPlanningAssistant } from './AIPlanningAssistant';

export function HomeVisitsTab({ addTrigger }: { addTrigger?: { tab: string; count: number } }) {
  const {
    homeVisits, visibleDonors, crm, donations, holidays, holidayExtras,
    startHomeVisitRound, markHomeVisitDone, createHomeVisitTaskForEntry, updateHolidayExtras,
    updateHomeVisitEntry, reorderHomeVisitEntries, archiveHomeVisitRound, deleteHomeVisitRound,
    removeHomeVisitEntry, addHomeVisitEntries, updateHomeVisitRoundMeta,
  } = useAppStore();

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerRoundId, setPickerRoundId] = useState<string | null>(null);
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  const [pickerSearch, setPickerSearch] = useState('');
  const [completionPrompt, setCompletionPrompt] = useState<string | null>(null);

  const handleMarkDone = (roundId: string, name: string) => {
    markHomeVisitDone(roundId, name);
    setCompletionPrompt(`🏠 ביקור בית — ${name}`);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeRounds = [...homeVisits.rounds]
    .filter(r => r.status === 'active')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const archivedRounds = [...homeVisits.rounds]
    .filter(r => r.status === 'archived')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const allActiveNames = React.useMemo(
    () => new Set(activeRounds.flatMap(r => r.entries.map(e => e.name))),
    [activeRounds]
  );

  // רשימת שמות חגים קרובים (עד 120 יום) — להצעה מהירה בשדה "נושא" (datalist)
  const holidayNames = React.useMemo(() => {
    const list = buildHolidayList(holidays, getCustomHols(), today);
    return list.filter(h => h.daysAway >= 0 && h.daysAway <= 120).map(h => h.name);
  }, [holidays]);

  const standaloneTasks: any[] = holidayExtras[STANDALONE_TASKS_ID]?.tasks || [];
  const hasOpenTask = (roundId: string, name: string) =>
    standaloneTasks.some(t => t.kind === 'homeVisit' && t.roundId === roundId && t.personName === name && !t.done);

  const openNewRoundPicker = () => {
    const initial = buildInitialRoundEntries(visibleDonors, crm, donations, today, 20)
      .filter(e => !allActiveNames.has(e.name));
    setPickerRoundId(null);
    setPickerSelected(new Set(initial.slice(0, 10).map(e => e.name)));
    setPickerSearch('');
    setIsPickerOpen(true);
  };

  const openAddToRoundPicker = (roundId: string) => {
    setPickerRoundId(roundId);
    setPickerSelected(new Set());
    setPickerSearch('');
    setIsPickerOpen(true);
  };

  React.useEffect(() => {
    if (addTrigger?.tab === 'homevisits' && addTrigger.count) openNewRoundPicker();
  }, [addTrigger]);

  // כל אנשי הקשר הזמינים לבחירה (לא רק "באיחור ליצירת קשר") — כדי שבחירת
  // קטגוריה שלמה תכלול באמת את כולם, לא רק את מי שכבר הוצע כמועמד.
  const allCandidates = React.useMemo(
    () => Object.keys(visibleDonors)
      .filter(name => !allActiveNames.has(name))
      .map(name => ({ name, category: liveCategoryFor(name, crm) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'he')),
    [visibleDonors, crm, allActiveNames]
  );

  const filteredCandidates = pickerSearch
    ? allCandidates.filter(e => e.name.includes(pickerSearch))
    : allCandidates;

  // קיבוץ המועמדים (המסוננים) לפי קטגוריה — לבחירה מהירה של קטגוריה שלמה (אחת או יותר)
  const categoryGroups = React.useMemo(() => {
    const map = new Map<string, string[]>();
    filteredCandidates.forEach(e => {
      if (!map.has(e.category)) map.set(e.category, []);
      map.get(e.category)!.push(e.name);
    });
    return Array.from(map.entries());
  }, [filteredCandidates]);

  const togglePicked = (name: string) => {
    setPickerSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const toggleCategoryPicked = (names: string[]) => {
    const allSelected = names.every(n => pickerSelected.has(n));
    setPickerSelected(prev => {
      const next = new Set(prev);
      names.forEach(n => allSelected ? next.delete(n) : next.add(n));
      return next;
    });
  };

  const confirmPicker = () => {
    const names = Array.from(pickerSelected) as string[];
    if (names.length > 0) {
      const entries = names.map(name => emptyHomeVisitEntry(name, liveCategoryFor(name, crm)));
      if (pickerRoundId) addHomeVisitEntries(pickerRoundId, entries);
      else startHomeVisitRound(entries);
    }
    setIsPickerOpen(false);
  };

  const totalOpen = activeRounds.reduce((s, r) => s + r.entries.filter(e => !e.visited).length, 0);

  return (
    <div className="animate-in fade-in pb-24 md:pb-6">
      {/* Topbar */}
      <div className="bg-[#0D1B2A] px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="w-9 h-9 bg-gradient-to-br from-[#C9A84C] to-[#9B7A2F] rounded-lg flex items-center justify-center shrink-0 md:hidden">
          <DoorOpen size={20} className="text-white" />
        </div>
        <div className="flex-1 px-3 md:px-0">
          <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#C9A84C]">ביקורי בית</div>
          <div className="text-[11px] text-white/45 mt-[1px]">{totalOpen} ממתינים לביקור · {activeRounds.length} מערכים פעילים</div>
        </div>
        <button onClick={openNewRoundPicker} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white/80 shrink-0 hover:bg-white/20 transition-colors">
          <Plus size={18} />
        </button>
      </div>

      <div className="p-4 md:p-6 max-w-2xl space-y-6">
        {activeRounds.length === 0 && (
          <div className="bg-white rounded-xl p-5 text-center text-gray-500 shadow-sm text-sm border border-[#EDE6D6] space-y-3">
            <div>אין עדיין מערך ביקורים פעיל.</div>
            <button
              onClick={openNewRoundPicker}
              className="inline-flex items-center gap-1.5 bg-[#0D1B2A] text-[#E8C97A] font-bold text-sm py-2.5 px-4 rounded-xl shadow-sm"
            >
              <Plus size={14} /> התחל מערך ביקורים חדש
            </button>
          </div>
        )}

        {activeRounds.map(round => (
          <RoundCard
            key={round.id}
            round={round}
            crm={crm}
            holidayNames={holidayNames}
            hasOpenTask={hasOpenTask}
            onUpdateEntry={(name, patch) => updateHomeVisitEntry(round.id, name, patch)}
            onReorder={(from, to) => reorderHomeVisitEntries(round.id, from, to)}
            onMarkDone={(name) => handleMarkDone(round.id, name)}
            onCreateTask={(name) => createHomeVisitTaskForEntry(round.id, name)}
            onRemove={(name) => removeHomeVisitEntry(round.id, name)}
            onArchive={() => archiveHomeVisitRound(round.id)}
            onDelete={() => {
              if (window.confirm('למחוק את המערך הזה לצמיתות? כל האנשים והמשימות שבו יימחקו.')) deleteHomeVisitRound(round.id);
            }}
            onAddMore={() => openAddToRoundPicker(round.id)}
            onUpdateMeta={(patch) => updateHomeVisitRoundMeta(round.id, patch)}
          />
        ))}

        {archivedRounds.length > 0 && (
          <div>
            <h2 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] mb-3">מערכים שהסתיימו</h2>
            <div className="space-y-2">
              {archivedRounds.map(r => {
                const visited = r.entries.filter(e => e.visited).length;
                return (
                  <div key={r.id} className="bg-white rounded-xl p-3 shadow-sm border border-[#EDE6D6] flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <span className="text-gray-500">{new Date(r.createdAt).toLocaleDateString('he-IL')}</span>
                      {r.purpose && <span className="text-gray-400 text-xs mr-2 truncate">· {r.purpose}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[#0D1B2A] font-bold">{visited}/{r.entries.length} בוקרו</span>
                      <button
                        onClick={() => { if (window.confirm('למחוק את המערך הזה לצמיתות?')) deleteHomeVisitRound(r.id); }}
                        className="text-red-300 hover:text-red-500"
                        title="מחק מערך"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* בחירת אנשים למערך */}
      {isPickerOpen && (
        <div className="fixed inset-0 bg-black/60 z-[220] flex items-center justify-center p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setIsPickerOpen(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <h3 className="font-bold text-xl text-[#0D1B2A]">{pickerRoundId ? 'הוספת אנשים למערך' : 'מערך ביקורים חדש'}</h3>
              <button onClick={() => setIsPickerOpen(false)} className="text-gray-400 p-1 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="relative mb-3 shrink-0">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                type="text"
                className="w-full bg-[#FAF6EE] border border-[#EDE6D6] rounded-xl pr-8 pl-3 py-2.5 text-sm outline-none focus:border-[#C9A84C]"
                placeholder="חיפוש איש קשר..."
              />
            </div>
            {categoryGroups.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3 shrink-0">
                {categoryGroups.map(([category, names]) => {
                  const allSelected = names.every(n => pickerSelected.has(n));
                  return (
                    <button
                      key={category}
                      onClick={() => toggleCategoryPicked(names)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${allSelected ? 'bg-[#0D1B2A] text-[#E8C97A] border-[#0D1B2A]' : 'bg-[#FAF6EE] text-[#9B7A2F] border-[#EDE6D6]'}`}
                    >
                      {allSelected ? '✓ ' : ''}{category} ({names.length})
                    </button>
                  );
                })}
              </div>
            )}
            <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-1.5 mb-3">
              {filteredCandidates.length === 0 && (
                <div className="text-center text-sm text-gray-400 py-6">אין מועמדים תואמים</div>
              )}
              {filteredCandidates.map(e => {
                const picked = pickerSelected.has(e.name);
                return (
                  <button
                    key={e.name}
                    onClick={() => togglePicked(e.name)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-sm text-right transition-colors ${picked ? 'bg-[#FDF6E3] border-[#C9A84C]' : 'bg-white border-[#EDE6D6]'}`}
                  >
                    <span className="text-[#0D1B2A] font-medium truncate">{e.name}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-gray-400">{e.category}</span>
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${picked ? 'bg-[#C9A84C] border-[#C9A84C]' : 'border-gray-300'}`}>
                        {picked && <Check size={12} className="text-white" />}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={confirmPicker}
              disabled={pickerSelected.size === 0}
              className="w-full bg-[#0D1B2A] text-[#E8C97A] py-3 rounded-xl font-bold text-sm shadow-lg disabled:opacity-40 shrink-0"
            >
              {pickerRoundId ? `הוסף ${pickerSelected.size || ''} למערך` : `התחל מערך עם ${pickerSelected.size || ''} אנשים`}
            </button>
          </div>
        </div>
      )}

      {completionPrompt && (
        <CompletionFollowUpModal
          sourceLabel={completionPrompt}
          onSkip={() => setCompletionPrompt(null)}
          onCreateFollowUp={(text, dueDate) => {
            const newTask: any = stampCreated({ text, done: false });
            if (dueDate) newTask.dueDate = dueDate;
            const tasks = holidayExtras[STANDALONE_TASKS_ID]?.tasks || [];
            updateHolidayExtras(STANDALONE_TASKS_ID, { tasks: [...tasks, newTask] });
            logAction('task_create');
            setCompletionPrompt(null);
          }}
        />
      )}
    </div>
  );
}

function RoundCard({
  round, crm, holidayNames, hasOpenTask,
  onUpdateEntry, onReorder, onMarkDone, onCreateTask, onRemove, onArchive, onDelete, onAddMore, onUpdateMeta,
}: {
  round: HomeVisitRound;
  crm: Record<string, any>;
  holidayNames: string[];
  hasOpenTask: (roundId: string, name: string) => boolean;
  onUpdateEntry: (name: string, patch: Partial<HomeVisitEntry>) => void;
  onReorder: (from: number, to: number) => void;
  onMarkDone: (name: string) => void;
  onCreateTask: (name: string) => void;
  onRemove: (name: string) => void;
  onArchive: () => void;
  onDelete: () => void;
  onAddMore: () => void;
  onUpdateMeta: (patch: Partial<HomeVisitRound>) => void;
} & { key?: any }) {
  const visited = round.entries.filter(e => e.visited).length;
  const allVisited = round.entries.length > 0 && visited === round.entries.length;
  const [prepText, setPrepText] = useState('');

  const addPrepTask = () => {
    if (!prepText.trim()) return;
    onUpdateMeta({ prepTasks: [...(round.prepTasks || []), { text: prepText.trim(), done: false }] });
    setPrepText('');
  };
  const togglePrepTask = (idx: number) => {
    const tasks = [...(round.prepTasks || [])];
    tasks[idx] = { ...tasks[idx], done: !tasks[idx].done };
    onUpdateMeta({ prepTasks: tasks });
  };
  const removePrepTask = (idx: number) => {
    const tasks = [...(round.prepTasks || [])];
    tasks.splice(idx, 1);
    onUpdateMeta({ prepTasks: tasks });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">מערך מ-{new Date(round.createdAt).toLocaleDateString('he-IL')}</h2>
          <div className="text-[11px] text-gray-400">{visited}/{round.entries.length} בוקרו</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onAddMore} className="text-[11px] px-2.5 py-1.5 rounded-full border border-[#EDE6D6] text-[#9B7A2F] bg-white flex items-center gap-1">
            <Plus size={12} /> הוסף
          </button>
          <button
            onClick={onArchive}
            className={`text-[11px] px-2.5 py-1.5 rounded-full border flex items-center gap-1 ${allVisited ? 'border-[#10B981] text-[#065F46] bg-[#D1FAE5]' : 'border-[#EDE6D6] text-gray-400 bg-white'}`}
            title="סיים את המערך"
          >
            <CheckCircle2 size={12} /> סיים מערך
          </button>
          <button onClick={onDelete} className="text-red-300 hover:text-red-500 p-1.5" title="מחק מערך">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ייעוד המערך + טווח תאריכים + משימות הכנה — מטא-דאטה של המערך עצמו, לא של איש קשר ספציפי */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-[#EDE6D6] mb-3 space-y-2">
        <input
          value={round.purpose || ''}
          onChange={e => onUpdateMeta({ purpose: e.target.value })}
          type="text"
          placeholder="ייעוד המערך (למשל: לקראת ראש השנה)..."
          className="w-full bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2.5 py-1.5 text-sm font-medium outline-none focus:border-[#C9A84C]"
        />
        <label className="flex items-center gap-2 text-[11px] text-gray-500">
          <CalendarRange size={12} className="shrink-0" />
          <span className="shrink-0">טווח תאריכים:</span>
          <input
            value={round.dateRangeStart || ''}
            onChange={e => onUpdateMeta({ dateRangeStart: e.target.value })}
            type="date"
            className="flex-1 min-w-0 bg-[#FAF6EE] border border-[#EDE6D6] rounded-md px-2 py-1 text-xs outline-none focus:border-[#C9A84C]"
          />
          <span className="shrink-0">עד</span>
          <input
            value={round.dateRangeEnd || ''}
            onChange={e => onUpdateMeta({ dateRangeEnd: e.target.value })}
            type="date"
            className="flex-1 min-w-0 bg-[#FAF6EE] border border-[#EDE6D6] rounded-md px-2 py-1 text-xs outline-none focus:border-[#C9A84C]"
          />
        </label>

        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1">
            <ClipboardList size={12} /> משימות לפני תחילת הביקורים
          </div>
          {(round.prepTasks || []).length > 0 && (
            <div className="space-y-1 mb-1.5">
              {(round.prepTasks || []).map((pt, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-[#FAF6EE] border border-[#EDE6D6] rounded-md px-2 py-1">
                  <button
                    onClick={() => togglePrepTask(i)}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${pt.done ? 'bg-[#C9A84C] border-[#C9A84C]' : 'border-gray-300'}`}
                  >
                    {pt.done && <Check size={9} className="text-white" />}
                  </button>
                  <span className={`flex-1 text-xs ${pt.done ? 'text-gray-400 line-through' : 'text-[#0D1B2A]'}`}>{pt.text}</span>
                  <button onClick={() => removePrepTask(i)} className="text-red-300 hover:text-red-500 shrink-0"><X size={11} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <input
              value={prepText}
              onChange={e => setPrepText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPrepTask()}
              type="text"
              placeholder="משימת הכנה חדשה..."
              className="flex-1 bg-[#FAF6EE] border border-[#EDE6D6] rounded-md px-2 py-1 text-xs outline-none focus:border-[#C9A84C]"
            />
            <button onClick={addPrepTask} className="bg-[#0D1B2A] text-[#E8C97A] rounded-md px-2 shrink-0"><Plus size={12} /></button>
          </div>
        </div>

        <AIPlanningAssistant
          title={round.purpose ? `ביקורי בית — ${round.purpose}` : 'מערך ביקורי בית'}
          contextLines={[
            `${round.entries.length} אנשי קשר במערך (${visited} כבר בוקרו)`,
            ...(round.dateRangeStart ? [`טווח תאריכים: ${round.dateRangeStart}${round.dateRangeEnd ? ` עד ${round.dateRangeEnd}` : ''}`] : []),
            ...(round.prepTasks?.length ? [`משימות הכנה שכבר קיימות: ${round.prepTasks.map(t => t.text).join(', ')}`] : []),
          ]}
          onApply={(result) => {
            if (!result.tasks?.length) return;
            onUpdateMeta({ prepTasks: [...(round.prepTasks || []), ...result.tasks.map(text => ({ text, done: false }))] });
          }}
        />
      </div>

      <div className="space-y-2">
        {round.entries.map((entry, idx) => (
          <EntryRow
            key={entry.name}
            entry={entry}
            idx={idx}
            total={round.entries.length}
            crm={crm}
            holidayNames={holidayNames}
            hasOpenTask={hasOpenTask(round.id, entry.name)}
            onUpdate={patch => onUpdateEntry(entry.name, patch)}
            onMoveUp={() => onReorder(idx, idx - 1)}
            onMoveDown={() => onReorder(idx, idx + 1)}
            onMarkDone={() => onMarkDone(entry.name)}
            onCreateTask={() => onCreateTask(entry.name)}
            onRemove={() => onRemove(entry.name)}
          />
        ))}
      </div>
    </div>
  );
}

function EntryRow({
  entry, idx, total, crm, holidayNames, hasOpenTask,
  onUpdate, onMoveUp, onMoveDown, onMarkDone, onCreateTask, onRemove,
}: {
  entry: HomeVisitEntry;
  idx: number;
  total: number;
  crm: Record<string, any>;
  holidayNames: string[];
  hasOpenTask: boolean;
  onUpdate: (patch: Partial<HomeVisitEntry>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMarkDone: () => void;
  onCreateTask: () => void;
  onRemove: () => void;
} & { key?: any }) {
  const displayCategory = entry.categoryIsCustom ? entry.category : liveCategoryFor(entry.name, crm);
  const datalistId = `holiday-topics-${entry.name.replace(/\s+/g, '_')}`;

  return (
    <div className={`bg-white rounded-xl p-3 shadow-sm border ${entry.visited ? 'border-[#10B981]/40 opacity-70' : 'border-[#EDE6D6]'}`}>
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
          <button onClick={onMoveUp} disabled={idx === 0} className="text-gray-300 disabled:opacity-30 hover:text-gray-500"><ChevronUp size={14} /></button>
          <button onClick={onMoveDown} disabled={idx === total - 1} className="text-gray-300 disabled:opacity-30 hover:text-gray-500"><ChevronDown size={14} /></button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className={`text-sm font-bold ${entry.visited ? 'text-gray-400 line-through' : 'text-[#0D1B2A]'}`}>{entry.name}</span>
            <button onClick={onRemove} className="text-red-300 hover:text-red-500 shrink-0" title="הסר מהמערך"><X size={14} /></button>
          </div>

          <select
            value={entry.categoryIsCustom ? entry.category : '__live__'}
            onChange={e => {
              const v = e.target.value;
              if (v === '__live__') onUpdate({ category: liveCategoryFor(entry.name, crm), categoryIsCustom: false });
              else onUpdate({ category: v, categoryIsCustom: true });
            }}
            className="w-full bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#C9A84C] mb-2"
          >
            <option value="__live__">🔄 {liveCategoryFor(entry.name, crm)} (לפי מעגל קרבה)</option>
            {HOME_VISIT_CATEGORY_TAGS.map(tag => <option key={tag} value={tag}>{tag}</option>)}
          </select>

          <div className="flex gap-2 mb-2">
            <input
              value={entry.topic || ''}
              onChange={e => onUpdate({ topic: e.target.value })}
              list={datalistId}
              type="text"
              placeholder="נושא (למשל חג)..."
              className="flex-1 min-w-0 bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#C9A84C]"
            />
            <datalist id={datalistId}>
              {holidayNames.map(n => <option key={n} value={n} />)}
            </datalist>
            <input
              value={entry.emphasis || ''}
              onChange={e => onUpdate({ emphasis: e.target.value })}
              type="text"
              placeholder="דגש לביקור..."
              className="flex-1 min-w-0 bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#C9A84C]"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={entry.scheduled}
                onChange={e => onUpdate({
                  scheduled: e.target.checked,
                  scheduledDate: e.target.checked ? entry.scheduledDate : undefined,
                  scheduledTime: e.target.checked ? entry.scheduledTime : undefined,
                })}
                className="accent-[#C9A84C]"
              />
              <CalendarClock size={12} /> קבעתי זמן
            </label>
            {entry.scheduled && (
              <>
                <input
                  value={entry.scheduledDate || ''}
                  onChange={e => onUpdate({ scheduledDate: e.target.value })}
                  type="date"
                  className="bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-1 text-xs outline-none focus:border-[#C9A84C]"
                />
                <input
                  value={entry.scheduledTime || ''}
                  onChange={e => onUpdate({ scheduledTime: e.target.value })}
                  type="time"
                  title="שעה (לא חובה)"
                  className="bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-1 text-xs outline-none focus:border-[#C9A84C]"
                />
              </>
            )}

            <span className="text-[10px] text-[#9B7A2F] bg-[#FDF6E3] px-1.5 py-0.5 rounded-full">{displayCategory}</span>

            <div className="mr-auto flex items-center gap-1.5 shrink-0">
              {!entry.visited && !hasOpenTask && (
                <button onClick={onCreateTask} className="text-[10px] px-2 py-1 rounded-full border border-[#EDE6D6] bg-white text-[#9B7A2F] flex items-center gap-1">
                  <Bell size={10} /> הוסף למשימות
                </button>
              )}
              {entry.visited ? (
                <span className="text-[10px] px-2 py-1 rounded-full bg-[#D1FAE5] text-[#065F46] font-bold flex items-center gap-1">
                  <Check size={10} /> בוצע {entry.visitedDate ? `· ${new Date(entry.visitedDate).toLocaleDateString('he-IL')}` : ''}
                </span>
              ) : (
                <button onClick={onMarkDone} className="text-[10px] px-2.5 py-1 rounded-full bg-[#0D1B2A] text-[#E8C97A] font-bold">
                  ✓ בוצע ביקור
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
