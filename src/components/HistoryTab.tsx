import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/AppContext';
import { History, Users, Wallet, ChevronDown, Lightbulb, X, Plus, Trash2, CheckCircle2, RotateCcw } from 'lucide-react';
import { countAttendance, sumBudget, HistoryEntry } from '../lib/history';
import { STANDALONE_TASKS_ID, PERSONAL_DATE_EXTRAS_ID } from '../lib/tasks';

const COMPLETED_TASKS_PAGE = 15;

export function HistoryTab() {
  const {
    history, updateHistoryEntry, deleteHistoryEntry, visibleDonors,
    holidayExtras, eventsData, updateHolidayExtras, updateEventsData, unmarkHomeVisitDone,
  } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'holiday' | 'event'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, { good: string; improve: string; plan: string }>>({});
  const [attNameInput, setAttNameInput] = useState<Record<string, string>>({});
  const [newAttDate, setNewAttDate] = useState('');
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  // משימות שהושלמו (done:true) מכל שלושת מקורות המשימות — נשארות במקום
  // המקורי שלהן (לא מועברות/משוכפלות לשום מקום), רק נאספות כאן לתצוגה +
  // "בטל ביצוע" חוזר אל אותו מקור. "לדלג" (skipped) אינו נחשב ביצוע בפועל
  // ולכן לא מופיע כאן — עקבי עם שאר האפליקציה שלא סופרת דילוג כביצוע.
  const completedTasks = useMemo(() => {
    const rows: { key: string; text: string; contextLabel: string; doneAt?: string; onUndo: () => void }[] = [];

    Object.keys(holidayExtras).forEach(id => {
      if (id === STANDALONE_TASKS_ID || id === PERSONAL_DATE_EXTRAS_ID) return;
      (holidayExtras[id]?.tasks || []).forEach((t: any, idx: number) => {
        if (!t.done || t.skipped) return;
        rows.push({
          key: `h-${id}-${idx}`,
          text: t.text,
          contextLabel: `🗓️ ${id}`,
          doneAt: t.doneAt,
          onUndo: () => {
            const tasks = [...(holidayExtras[id]?.tasks || [])];
            tasks[idx] = { ...tasks[idx], done: false };
            updateHolidayExtras(id, { tasks });
          },
        });
      });
    });

    (eventsData as any[]).forEach(ev => {
      (ev.tasks || []).forEach((t: any, idx: number) => {
        if (!t.done) return;
        rows.push({
          key: `e-${ev.id}-${idx}`,
          text: t.text,
          contextLabel: `📅 ${ev.name}`,
          doneAt: t.doneAt,
          onUndo: () => {
            updateEventsData((eventsData as any[]).map((e: any) => {
              if (e.id !== ev.id) return e;
              const tasks = [...(e.tasks || [])];
              tasks[idx] = { ...tasks[idx], done: false };
              return { ...e, tasks };
            }));
          },
        });
      });
    });

    const standalone: any[] = holidayExtras[STANDALONE_TASKS_ID]?.tasks || [];
    standalone.forEach((t: any, idx: number) => {
      if (!t.done) return;
      rows.push({
        key: `s-${idx}`,
        text: t.text,
        contextLabel: '📌 חד-פעמית',
        doneAt: t.doneAt,
        onUndo: () => {
          if (t.kind === 'homeVisit') {
            unmarkHomeVisitDone(t.roundId, t.personName);
          } else {
            const tasks = [...standalone];
            tasks[idx] = { ...tasks[idx], done: false };
            updateHolidayExtras(STANDALONE_TASKS_ID, { tasks });
          }
        },
      });
    });

    return rows.sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  }, [holidayExtras, eventsData, updateHolidayExtras, updateEventsData, unmarkHomeVisitDone]);

  const visibleCompletedTasks = showAllCompleted ? completedTasks : completedTasks.slice(0, COMPLETED_TASKS_PAGE);

  const sorted = useMemo(
    () => [...history].sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime()),
    [history]
  );
  const list = filter === 'all' ? sorted : sorted.filter(h => h.type === filter);

  const getForm = (h: typeof history[number]) => forms[h.id] || h.insights || { good: '', improve: '', plan: '' };

  const saveInsights = (id: string) => {
    const form = forms[id];
    if (!form) return;
    updateHistoryEntry(id, { insights: form });
  };

  // עריכת תקציב — אותה מבנה נתונים (expenses/income, כל שורה {name,planned,actual}) כמו בכרטיס החג/אירוע החי.
  const patchBudget = (h: HistoryEntry, budget: { expenses: any[]; income: any[] }) => updateHistoryEntry(h.id, { budget });
  const addBudgetLine = (h: HistoryEntry, type: 'expenses' | 'income') => {
    const budget = h.budget || { expenses: [], income: [] };
    patchBudget(h, { ...budget, [type]: [...(budget[type] || []), { name: '', planned: '', actual: '' }] });
  };
  const updateBudgetLine = (h: HistoryEntry, type: 'expenses' | 'income', idx: number, field: string, value: string) => {
    const budget = h.budget || { expenses: [], income: [] };
    const arr = [...(budget[type] || [])];
    arr[idx] = { ...arr[idx], [field]: value };
    patchBudget(h, { ...budget, [type]: arr });
  };
  const removeBudgetLine = (h: HistoryEntry, type: 'expenses' | 'income', idx: number) => {
    const budget = h.budget || { expenses: [], income: [] };
    const arr = [...(budget[type] || [])];
    arr.splice(idx, 1);
    patchBudget(h, { ...budget, [type]: arr });
  };

  // עריכת נוכחות — attendance הוא Record<dateKey, Record<personName, boolean>>
  const patchAttendance = (h: HistoryEntry, attendance: Record<string, Record<string, boolean>>) => updateHistoryEntry(h.id, { attendance });
  const toggleAttendanceName = (h: HistoryEntry, dateKey: string, personName: string) => {
    const attendance = { ...(h.attendance || {}) };
    attendance[dateKey] = { ...(attendance[dateKey] || {}), [personName]: !attendance[dateKey]?.[personName] };
    patchAttendance(h, attendance);
  };
  const removeAttendanceName = (h: HistoryEntry, dateKey: string, personName: string) => {
    const attendance = { ...(h.attendance || {}) };
    const byName = { ...(attendance[dateKey] || {}) };
    delete byName[personName];
    attendance[dateKey] = byName;
    patchAttendance(h, attendance);
  };
  const removeAttendanceDate = (h: HistoryEntry, dateKey: string) => {
    const attendance = { ...(h.attendance || {}) };
    delete attendance[dateKey];
    patchAttendance(h, attendance);
  };
  const addAttendanceName = (h: HistoryEntry, dateKey: string, personName: string) => {
    if (!personName.trim()) return;
    const attendance = { ...(h.attendance || {}) };
    attendance[dateKey] = { ...(attendance[dateKey] || {}), [personName.trim()]: true };
    patchAttendance(h, attendance);
  };
  const addAttendanceDate = (h: HistoryEntry, dateISO: string) => {
    if (!dateISO) return;
    const attendance = { ...(h.attendance || {}) };
    if (!attendance[dateISO]) attendance[dateISO] = {};
    patchAttendance(h, attendance);
  };

  return (
    <div className="animate-in fade-in pb-24 md:pb-6">
      <div className="bg-[#0D1B2A] px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="w-9 h-9 bg-gradient-to-br from-[#C9A84C] to-[#9B7A2F] rounded-lg flex items-center justify-center shrink-0 md:hidden">
          <History size={18} className="text-white" />
        </div>
        <div className="flex-1 px-3 md:px-0">
          <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#C9A84C]">היסטוריה</div>
          <div className="text-[11px] text-white/45 mt-[1px]">חגים ואירועים שסומנו כהסתיימו</div>
        </div>
      </div>

      <div className="p-4 md:p-6">
        <div className="bg-white rounded-xl p-3.5 border border-[#EDE6D6] shadow-sm mb-4 text-[11px] text-gray-500 leading-relaxed">
          כדי להעביר חג או אירוע לכאן, פתחו אותו ולחצו על <b>"סמן כהסתיים והעבר להיסטוריה"</b>. הפעולה שומרת תמונת מצב (נוכחות, תקציב, משימות) ומרוקנת את המשימות של המופע החי כדי שהשנה הבאה תתחיל נקי — אפשר לייבא בחזרה את אותן משימות בלחיצת כפתור. נוכחות ותקציב ניתנים לעריכה גם כאן, אחרי ההעברה.
        </div>

        {/* משימות שהושלמו — נשארות במקומן המקורי, רק נאספות כאן עם אפשרות "בטל ביצוע" */}
        <div className="bg-white rounded-xl border border-[#EDE6D6] shadow-sm mb-4 overflow-hidden">
          <div className="flex items-center gap-1.5 px-3.5 py-3 border-b border-[#EDE6D6]">
            <CheckCircle2 size={15} className="text-green-600 shrink-0" />
            <span className="font-bold text-sm text-[#0D1B2A]">משימות שהושלמו</span>
            <span className="text-[11px] text-gray-400 mr-auto">{completedTasks.length}</span>
          </div>
          {completedTasks.length === 0 ? (
            <div className="text-center py-5 text-gray-400 text-xs">עדיין אין משימות שהושלמו</div>
          ) : (
            <>
              <div className="divide-y divide-[#EDE6D6]">
                {visibleCompletedTasks.map(row => (
                  <div key={row.key} className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm text-[#0D1B2A] truncate">{row.text}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {row.contextLabel}
                        {row.doneAt && ` · הושלם ${new Date(row.doneAt).toLocaleDateString('he-IL')}`}
                      </div>
                    </div>
                    <button
                      onClick={row.onUndo}
                      title="בטל ביצוע"
                      className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-[#9B7A2F] bg-[#FAF6EE] border border-[#EDE6D6] px-2.5 py-1.5 rounded-lg hover:bg-[#F5E7C4] transition-colors"
                    >
                      <RotateCcw size={12} /> בטל ביצוע
                    </button>
                  </div>
                ))}
              </div>
              {completedTasks.length > COMPLETED_TASKS_PAGE && (
                <button
                  onClick={() => setShowAllCompleted(v => !v)}
                  className="w-full text-center text-[11px] font-bold text-[#9B7A2F] py-2 border-t border-[#EDE6D6] hover:bg-[#FAF6EE] transition-colors"
                >
                  {showAllCompleted ? 'הצג פחות' : `הצג הכל (${completedTasks.length})`}
                </button>
              )}
            </>
          )}
        </div>

        <div className="flex gap-1.5 mb-4">
          {([
            { id: 'all', label: 'הכל' },
            { id: 'holiday', label: '✡️ חגים' },
            { id: 'event', label: '📌 אירועים' },
          ] as { id: 'all' | 'holiday' | 'event'; label: string }[]).map(t => (
            <button key={t.id} onClick={() => setFilter(t.id)} className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${filter === t.id ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]' : 'bg-white text-gray-500 border-[#EDE6D6]'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            עדיין אין רשומות היסטוריה. סמנו חג או אירוע שהסתיים כדי לראות אותו כאן.
          </div>
        ) : (
          <div className="space-y-3">
            {list.map(h => {
              const attCount = countAttendance(h.attendance);
              const budget = sumBudget(h.budget);
              const isOpen = openId === h.id;
              const form = getForm(h);
              return (
                <div key={h.id} className="bg-white rounded-xl border border-[#EDE6D6] shadow-sm overflow-hidden">
                  <div className="w-full flex items-center gap-1">
                    <button onClick={() => setOpenId(isOpen ? null : h.id)} className="flex-1 min-w-0 flex items-center justify-between p-3.5 text-right">
                      <div className="min-w-0">
                        <div className="font-bold text-[#0D1B2A] text-sm flex items-center gap-2">
                          <span>{h.type === 'holiday' ? '✡️' : '📌'}</span>
                          {h.name}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          הועבר להיסטוריה ב-{new Date(h.archivedAt).toLocaleDateString('he-IL')}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className="bg-[#D1FAE5] text-[#065F46] px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1"><Users size={10} /> {attCount} נכחו</span>
                          {(budget.actualIncome > 0 || budget.plannedIncome > 0) && (
                            <span className="bg-[#FEF3C7] text-[#92400E] px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1"><Wallet size={10} /> הכנסות: ₪{(budget.actualIncome || budget.plannedIncome).toLocaleString()}</span>
                          )}
                          {(budget.actualExpense > 0 || budget.plannedExpense > 0) && (
                            <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">הוצאות: ₪{(budget.actualExpense || budget.plannedExpense).toLocaleString()}</span>
                          )}
                          {(h.tasks || []).length > 0 && (
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md text-[10px] font-bold">📋 {(h.tasks || []).filter((t: any) => t.done).length}/{(h.tasks || []).length} משימות</span>
                          )}
                        </div>
                      </div>
                      <ChevronDown size={16} className={`text-gray-300 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                      onClick={() => { if (window.confirm(`למחוק את "${h.name}" מההיסטוריה לצמיתות? (למשל אם הועבר לכאן בטעות)`)) deleteHistoryEntry(h.id); }}
                      title="מחק מההיסטוריה"
                      className="shrink-0 p-2 mr-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-[#EDE6D6] p-3.5 bg-[#FAF6EE]">
                      <div className="flex items-center gap-1.5 mb-2 text-[#9B7A2F] font-bold text-sm">
                        <Lightbulb size={14} /> תובנות והערות לקראת השנה הבאה
                      </div>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">מה עבד טוב</label>
                          <textarea
                            value={form.good}
                            onChange={e => setForms(prev => ({ ...prev, [h.id]: { ...form, good: e.target.value } }))}
                            onBlur={() => saveInsights(h.id)}
                            rows={2}
                            className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C] resize-none"
                            placeholder="..."
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">מה כדאי לשפר</label>
                          <textarea
                            value={form.improve}
                            onChange={e => setForms(prev => ({ ...prev, [h.id]: { ...form, improve: e.target.value } }))}
                            onBlur={() => saveInsights(h.id)}
                            rows={2}
                            className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C] resize-none"
                            placeholder="..."
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">תוכנית לשנה הבאה</label>
                          <textarea
                            value={form.plan}
                            onChange={e => setForms(prev => ({ ...prev, [h.id]: { ...form, plan: e.target.value } }))}
                            onBlur={() => saveInsights(h.id)}
                            rows={2}
                            className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C] resize-none"
                            placeholder="..."
                          />
                        </div>
                      </div>

                      {/* תקציב — ניתן לעריכה */}
                      <div className="mt-4">
                        <div className="flex items-center gap-1.5 mb-2 text-[#9B7A2F] font-bold text-sm">
                          <Wallet size={14} /> תקציב (ניתן לעריכה)
                        </div>
                        <div className="space-y-1 mb-2">
                          {(h.budget?.expenses || []).map((exp: any, i: number) => (
                            <div key={i} className="flex gap-1.5 items-center">
                              <input value={exp.name} onChange={e => updateBudgetLine(h, 'expenses', i, 'name', e.target.value)} placeholder="שם הוצאה" className="flex-1 bg-white border border-[#EDE6D6] rounded-md px-2 py-1 text-xs outline-none focus:border-[#C9A84C]" />
                              <input value={exp.planned} onChange={e => updateBudgetLine(h, 'expenses', i, 'planned', e.target.value)} type="number" placeholder="מתוכנן" className="w-16 bg-white border border-[#EDE6D6] rounded-md px-2 py-1 text-xs outline-none focus:border-[#C9A84C]" />
                              <input value={exp.actual} onChange={e => updateBudgetLine(h, 'expenses', i, 'actual', e.target.value)} type="number" placeholder="בפועל" className="w-16 bg-white border border-[#EDE6D6] rounded-md px-2 py-1 text-xs outline-none focus:border-[#C9A84C]" />
                              <button onClick={() => removeBudgetLine(h, 'expenses', i)} className="text-red-300 hover:text-red-500 shrink-0"><X size={14} /></button>
                            </div>
                          ))}
                          <button onClick={() => addBudgetLine(h, 'expenses')} className="text-xs text-[#9B7A2F] font-bold">+ הוצאה</button>
                        </div>
                        <div className="space-y-1">
                          {(h.budget?.income || []).map((inc: any, i: number) => (
                            <div key={i} className="flex gap-1.5 items-center">
                              <input value={inc.name} onChange={e => updateBudgetLine(h, 'income', i, 'name', e.target.value)} placeholder="שם הכנסה" className="flex-1 bg-white border border-[#EDE6D6] rounded-md px-2 py-1 text-xs outline-none focus:border-[#C9A84C]" />
                              <input value={inc.planned} onChange={e => updateBudgetLine(h, 'income', i, 'planned', e.target.value)} type="number" placeholder="מתוכנן" className="w-16 bg-white border border-[#EDE6D6] rounded-md px-2 py-1 text-xs outline-none focus:border-[#C9A84C]" />
                              <input value={inc.actual} onChange={e => updateBudgetLine(h, 'income', i, 'actual', e.target.value)} type="number" placeholder="בפועל" className="w-16 bg-white border border-[#EDE6D6] rounded-md px-2 py-1 text-xs outline-none focus:border-[#C9A84C]" />
                              <button onClick={() => removeBudgetLine(h, 'income', i)} className="text-red-300 hover:text-red-500 shrink-0"><X size={14} /></button>
                            </div>
                          ))}
                          <button onClick={() => addBudgetLine(h, 'income')} className="text-xs text-[#9B7A2F] font-bold">+ הכנסה</button>
                        </div>
                      </div>

                      {/* נוכחות — ניתן לעריכה */}
                      <div className="mt-4">
                        <div className="flex items-center gap-1.5 mb-2 text-[#9B7A2F] font-bold text-sm">
                          <Users size={14} /> נוכחות (ניתן לעריכה)
                        </div>
                        {Object.keys(h.attendance || {}).length === 0 && (
                          <div className="text-xs text-gray-400 mb-2">אין עדיין רישום נוכחות</div>
                        )}
                        {Object.entries(h.attendance || {}).map(([dateKey, byName]) => (
                          <div key={dateKey} className="bg-white rounded-lg p-2 mb-2 border border-[#EDE6D6]">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-[#0D1B2A]">{dateKey}</span>
                              <button onClick={() => removeAttendanceDate(h, dateKey)} className="text-red-300 hover:text-red-500" title="מחק תאריך"><X size={12} /></button>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-1.5">
                              {Object.entries(byName as Record<string, boolean>).map(([pname, present]) => (
                                <span key={pname} className={`text-[10px] pr-2 pl-1 py-1 rounded-full border flex items-center gap-1 ${present ? 'bg-[#D1FAE5] border-[#10B981] text-[#065F46]' : 'bg-gray-50 border-gray-200 text-gray-400 line-through'}`}>
                                  <button onClick={() => toggleAttendanceName(h, dateKey, pname)}>{pname}</button>
                                  <button onClick={() => removeAttendanceName(h, dateKey, pname)} className="hover:text-red-500"><X size={9} /></button>
                                </span>
                              ))}
                            </div>
                            <div className="flex gap-1.5">
                              <input
                                list="history-donor-names"
                                value={attNameInput[dateKey] || ''}
                                onChange={e => setAttNameInput(prev => ({ ...prev, [dateKey]: e.target.value }))}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    addAttendanceName(h, dateKey, attNameInput[dateKey] || '');
                                    setAttNameInput(prev => ({ ...prev, [dateKey]: '' }));
                                  }
                                }}
                                type="text"
                                placeholder="הוסף שם..."
                                className="flex-1 bg-[#FAF6EE] border border-[#EDE6D6] rounded-md px-2 py-1 text-xs outline-none focus:border-[#C9A84C]"
                              />
                              <button
                                onClick={() => {
                                  addAttendanceName(h, dateKey, attNameInput[dateKey] || '');
                                  setAttNameInput(prev => ({ ...prev, [dateKey]: '' }));
                                }}
                                className="bg-[#0D1B2A] text-[#E8C97A] rounded-md px-2 shrink-0"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                        <datalist id="history-donor-names">
                          {Object.keys(visibleDonors).map(n => <option key={n} value={n} />)}
                        </datalist>
                        <div className="flex gap-1.5">
                          <input
                            value={newAttDate}
                            onChange={e => setNewAttDate(e.target.value)}
                            type="date"
                            className="flex-1 bg-white border border-[#EDE6D6] rounded-md px-2 py-1.5 text-xs outline-none focus:border-[#C9A84C]"
                          />
                          <button
                            onClick={() => { addAttendanceDate(h, newAttDate); setNewAttDate(''); }}
                            disabled={!newAttDate}
                            className="bg-[#0D1B2A] text-[#E8C97A] rounded-md px-3 text-xs font-bold shrink-0 disabled:opacity-40"
                          >
                            + הוסף תאריך
                          </button>
                        </div>
                      </div>

                      {(h.tasks || []).length > 0 && (
                        <div className="mt-4">
                          <div className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">משימות שהיו במופע הזה</div>
                          <div className="space-y-1">
                            {h.tasks.map((t: any, i: number) => (
                              <div key={i} className="text-xs text-gray-600 flex items-center gap-1.5">
                                <span>{t.done ? '✅' : '⬜'}</span> {t.text}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
