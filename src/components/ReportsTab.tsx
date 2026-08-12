import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/AppContext';
import { RefreshCw, Download, FileText, X, PieChart, List, Search, ChevronDown, Check } from 'lucide-react';
import { Donor } from '../types';
import { StandingOrdersModal } from './StandingOrdersModal';
import { downloadCSV } from '../lib/csvExport';
import { collectAllTasks, ExportableTask, TASK_CATEGORY_LABELS } from '../lib/taskExport';

const CIRCLE_LABELS: Record<string, string> = { close: '⭐ קרוב', approach: '🔄 מתקרב', third: '⭕ מעגל שלישי', far: '○ רחוק', none: 'לא מסווג' };

export function ReportsTab() {
  const { summary, effectiveSummary, donations, visibleDonors, donors, crm, refresh, settings, holidayExtras, eventsData, homeVisits } = useAppStore();
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportDataTypes, setExportDataTypes] = useState<Set<'donations' | 'tasks' | 'contacts'>>(new Set(['donations']));
  const [exportMethods, setExportMethods] = useState<Set<string>>(new Set());
  const [exportPurposes, setExportPurposes] = useState<Set<string>>(new Set());
  const [exportTaskCats, setExportTaskCats] = useState<Set<string>>(new Set());
  const [exportCircles, setExportCircles] = useState<Set<string>>(new Set());
  const [manualMode, setManualMode] = useState(false);

  // מסך הייצוא בנוי סביב סוג נתונים אחד פעיל בכל רגע, בעוד הייצוא עצמו
  // (שורה 123 והלאה) תומך בקבוצה של סוגים. שתי השורות הבאות מגשרות:
  // הטאב הפעיל הוא הסוג הראשון בקבוצה, ומעבר טאב מחליף את הקבוצה כולה.
  const exportDataTab: 'donations' | 'tasks' | 'contacts' =
    [...exportDataTypes][0] || 'donations';

  const switchExportTab = (id: 'donations' | 'tasks' | 'contacts') => {
    setExportDataTypes(new Set([id]));
    setManualSelected(new Set()); // הבחירה הידנית שייכת לסוג הקודם
  };
  const [manualSelected, setManualSelected] = useState<Set<string>>(new Set());
  const [isHkOpen, setIsHkOpen] = useState(false);
  const [showAllDonations, setShowAllDonations] = useState(true);
  const [donTab, setDonTab] = useState<'donations' | 'meetings' | 'all'>('donations');
  const [donSearch, setDonSearch] = useState('');
  const [donMethod, setDonMethod] = useState('');
  const [donPurpose, setDonPurpose] = useState('');
  const [donSort, setDonSort] = useState<'date' | 'amount'>('date');
  const [donPage, setDonPage] = useState(0);
  const PAGE_SIZE = 30;

  if (!summary) return null;

  const total = effectiveSummary?.total || 1;
  const methods = Object.entries(effectiveSummary?.byMethod || {}).sort((a, b) => (b[1] as number) - (a[1] as number));

  const topDonors: Donor[] = (Object.values(visibleDonors) as Donor[])
    .sort((a: Donor, b: Donor) => (b.total || 0) - (a.total || 0))
    .slice(0, 8);
  const maxD = topDonors[0]?.total || 1;

  let close = 0, approach = 0, third = 0, target = 0;
  Object.values(crm).forEach((c: any) => {
    if (c.circle === 'close') close++;
    else if (c.circle === 'approach') approach++;
    else if (c.circle === 'third') third++;
    if (c.target) target++;
  });

  const uniquePurposes = Array.from(new Set(donations.map(d => d.purpose).filter(p => !!p)));
  const uniqueMethods = Array.from(new Set(donations.map(d => d.method).filter(m => !!m)));

  const isDonation = (d: any) => (d.amount || 0) > 0;
  const isMeeting  = (d: any) => (d.amount || 0) === 0;

  const filteredDonations = useMemo(() => {
    let list = [...donations] as any[];
    if (donTab === 'donations') list = list.filter(isDonation);
    else if (donTab === 'meetings') list = list.filter(isMeeting);
    if (donSearch) list = list.filter(d => (d.name || '').toLowerCase().includes(donSearch.toLowerCase()));
    if (donMethod) list = list.filter(d => d.method === donMethod);
    if (donPurpose) list = list.filter(d => d.purpose === donPurpose || d.meetPurpose === donPurpose);
    list.sort((a, b) => {
      if (donSort === 'amount') return (b.amount || 0) - (a.amount || 0);
      const dateOf = (d: any) => d.date || d.meetDate || '';
      const toTs = (s: string) => s ? new Date(s.split('/').reverse().join('-')).getTime() : 0;
      return toTs(dateOf(b)) - toTs(dateOf(a));
    });
    return list;
  }, [donations, donTab, donSearch, donMethod, donPurpose, donSort]);

  const pagedDonations = filteredDonations.slice(0, (donPage + 1) * PAGE_SIZE);

  const exportDonationsCSV = (title: string, data: any[]) => {
    downloadCSV(title, ['שם תורם', 'תאריך', 'סכום', 'יעד/נישה', 'אפיק גבייה'], data.map(d => [d.name || '', d.date || '', d.amount || 0, d.purpose || '', d.method || '']));
    setIsExportMenuOpen(false);
  };

  const donationKey = (d: any) => `${d.name}|${d.date}|${d.amount}|${d.method}`;
  const taskKey = (t: ExportableTask) => `${t.category}|${t.source}|${t.text}|${t.dueDate || ''}`;

  const toggleInSet = (set: Set<string>, setSet: (s: Set<string>) => void, val: string) => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val); else next.add(val);
    setSet(next);
  };

  const openExportModal = () => {
    setManualMode(false);
    setManualSelected(new Set());
    setIsExportMenuOpen(true);
  };

  const toggleExportDataType = (type: 'donations' | 'tasks' | 'contacts') => {
    setExportDataTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
    setManualMode(false);
    setManualSelected(new Set());
  };

  const exportFilteredDonations = useMemo(() => {
    let list = donations as any[];
    if (exportMethods.size > 0) list = list.filter(d => d.method && exportMethods.has(d.method));
    if (exportPurposes.size > 0) list = list.filter(d => d.purpose && exportPurposes.has(d.purpose));
    return list;
  }, [donations, exportMethods, exportPurposes]);

  const allExportTasks = useMemo(() => collectAllTasks(holidayExtras, eventsData, homeVisits), [holidayExtras, eventsData, homeVisits]);
  const exportFilteredTasks = useMemo(() => {
    if (exportTaskCats.size === 0) return allExportTasks;
    return allExportTasks.filter(t => exportTaskCats.has(t.category));
  }, [allExportTasks, exportTaskCats]);

  const exportFilteredContacts = useMemo(() => {
    let names = Object.keys(donors);
    if (exportCircles.size > 0) names = names.filter(n => exportCircles.has(crm[n]?.circle || 'none'));
    return names.sort();
  }, [donors, crm, exportCircles]);

  const runExport = () => {
    if (exportDataTypes.has('donations')) {
      const list = manualMode ? exportFilteredDonations.filter(d => manualSelected.has(donationKey(d))) : exportFilteredDonations;
      downloadCSV('תרומות', ['שם תורם', 'תאריך', 'סכום', 'יעד/נישה', 'אפיק גבייה'], list.map(d => [d.name || '', d.date || '', d.amount || 0, d.purpose || '', d.method || '']));
    }
    if (exportDataTypes.has('tasks')) {
      const list = manualMode ? exportFilteredTasks.filter(t => manualSelected.has(taskKey(t))) : exportFilteredTasks;
      downloadCSV('משימות', ['קטגוריה', 'מקור', 'טקסט', 'תאריך יעד', 'הושלם'], list.map(t => [t.categoryLabel, t.source, t.text, t.dueDate || '', t.done ? 'כן' : 'לא']));
    }
    if (exportDataTypes.has('contacts')) {
      const list = manualMode ? exportFilteredContacts.filter(n => manualSelected.has(n)) : exportFilteredContacts;
      downloadCSV('אנשי_קשר', ['שם', 'מעגל קרבה', 'טלפון', 'סה"כ תרומות', 'תרומה אחרונה'], list.map(n => {
        const c = crm[n] || {};
        const d = donors[n];
        return [n, CIRCLE_LABELS[c.circle || 'none'], c.phone || '', d?.total || 0, d?.lastDate || ''];
      }));
    }
    setIsExportMenuOpen(false);
  };

  return (
    <div className="animate-in fade-in pb-24 md:pb-6">
      <div className="bg-[#0D1B2A] px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="w-9 h-9 bg-gradient-to-br from-[#C9A84C] to-[#9B7A2F] rounded-lg flex items-center justify-center shrink-0 md:hidden">
          <PieChart size={18} className="text-white" />
        </div>
        <div className="flex-1 px-3 md:px-0">
          <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#C9A84C]">דוחות</div>
          <div className="text-[11px] text-white/45 mt-[1px]">נתונים חיים</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openExportModal}
            className="flex items-center gap-1.5 px-3 h-9 bg-[#C9A84C] text-[#0D1B2A] rounded-full text-sm font-bold shadow-md transition-transform active:scale-95"
          >
            <Download size={14} />
            <span className="hidden sm:inline">ייצוא נתונים</span>
          </button>
          <button onClick={refresh} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white/80 shrink-0 transition-colors active:bg-white/20">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {/* Summary KPIs — always 4-column row on desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 md:mb-6">
          {([
            { emoji: '💰', label: settings.donationsSinceDate ? `סה"כ מ-${new Date(settings.donationsSinceDate).toLocaleDateString('he-IL')}` : 'סה"כ מתחילת שנה', value: `₪${(effectiveSummary?.total || 0).toLocaleString()}` },
            { emoji: '📅', label: 'החודש', value: `₪${(effectiveSummary?.thisMonthTotal || 0).toLocaleString()}` },
            { emoji: '👥', label: 'תורמים', value: String(effectiveSummary?.donorCount || 0) },
            { emoji: '🔄', label: 'הוראות קבע', value: String(summary.hkActive || 0), onClick: () => setIsHkOpen(true) },
          ] as { emoji: string; label: string; value: string; onClick?: () => void }[]).map((item, i) => (
            <div
              key={i}
              onClick={item.onClick}
              className={`bg-white rounded-xl p-4 shadow-sm text-center ${item.onClick ? 'cursor-pointer active:scale-95 transition-transform hover:shadow-md' : ''}`}
            >
              <div className="text-2xl mb-1">{item.emoji}</div>
              <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">{item.value}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>

        {isHkOpen && <StandingOrdersModal onClose={() => setIsHkOpen(false)} />}

        {/* Two-column grid on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Methods */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="font-['Frank_Ruhl_Libre'] text-base font-bold text-[#0D1B2A] mb-3">💰 לפי אפיק גבייה</div>
            <div className="space-y-2.5">
              {methods.map(([method, amount], i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="text-[11px] text-gray-500 w-20 shrink-0 text-right">{method}</div>
                  <div className="flex-1 h-2.5 bg-[#EDE6D6] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#C9A84C] to-[#9B7A2F] rounded-full"
                      style={{ width: `${Math.round((amount as number) / total * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs font-semibold text-[#0D1B2A] w-[64px] shrink-0 text-left">
                    ₪{(amount as number).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Donors */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="font-['Frank_Ruhl_Libre'] text-base font-bold text-[#0D1B2A] mb-3">🏆 תורמים מובילים</div>
            <div className="space-y-2.5">
              {topDonors.map((d, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="text-[11px] text-gray-500 w-16 shrink-0 text-right truncate">{d.name.split(' ')[0]}</div>
                  <div className="flex-1 h-2.5 bg-[#EDE6D6] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#4A2E8C] to-[#6D28D9] rounded-full"
                      style={{ width: `${Math.round((d.total || 0) / maxD * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs font-semibold text-[#0D1B2A] w-[64px] shrink-0 text-left">
                    ₪{(d.total || 0).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CRM Summary */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="font-['Frank_Ruhl_Libre'] text-base font-bold text-[#0D1B2A] mb-3">👥 מעגלי קשר</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { emoji: '⭐', label: 'קרוב', count: close },
                { emoji: '🔄', label: 'מתקרב', count: approach },
                { emoji: '⭕', label: 'מעגל שלישי', count: third },
                { emoji: '🎯', label: 'להקרב', count: target },
              ].map((item, i) => (
                <div key={i} className="bg-[#FAF6EE] rounded-xl p-3 text-center">
                  <div className="text-xl mb-1">{item.emoji}</div>
                  <div className="font-['Frank_Ruhl_Libre'] text-2xl font-black text-[#0D1B2A]">{item.count}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly trend placeholder / extra stat */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="font-['Frank_Ruhl_Libre'] text-base font-bold text-[#0D1B2A] mb-3">📈 סטטיסטיקות</div>
            <div className="space-y-3">
              {[
                { label: 'ממוצע תרומה', value: donations.length ? `₪${Math.round((summary.total || 0) / donations.length).toLocaleString()}` : '—' },
                { label: 'מספר תרומות', value: String(donations.length) },
                { label: 'שיעור הוק מסך תורמים', value: summary.donorCount ? `${Math.round(((summary.hkActive || 0) / summary.donorCount) * 100)}%` : '—' },
              ].map((row, i) => (
                <div key={i} className="flex justify-between items-center border-b border-[#EDE6D6] pb-2 last:border-0 last:pb-0">
                  <span className="text-sm text-gray-600">{row.label}</span>
                  <span className="font-['Frank_Ruhl_Libre'] text-base font-bold text-[#0D1B2A]">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* All Donations Section */}
        <div className="mt-4 bg-white rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => { setShowAllDonations(v => !v); setDonPage(0); }}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <List size={18} className="text-[#C9A84C]" />
              <span className="font-['Frank_Ruhl_Libre'] font-bold text-[#0D1B2A]">יומן פעילות</span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                💰 {(donations as any[]).filter(isDonation).length} · 📝 {(donations as any[]).filter(isMeeting).length}
              </span>
            </div>
            <ChevronDown size={18} className={`text-gray-400 transition-transform ${showAllDonations ? 'rotate-180' : ''}`} />
          </button>

          {showAllDonations && (
            <div className="border-t border-[#EDE6D6]">
              {/* Tabs */}
              <div className="flex border-b border-[#EDE6D6]">
                {([['donations','💰 תרומות'], ['meetings','📝 מפגשים'], ['all','הכל']] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => { setDonTab(id); setDonPage(0); setDonMethod(''); setDonPurpose(''); }}
                    className={`flex-1 py-2.5 text-sm font-bold transition-colors ${donTab === id ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Filters */}
              <div className="p-3 flex flex-wrap gap-2 bg-[#FAF6EE]">
                <div className="flex items-center gap-2 bg-white border border-[#EDE6D6] rounded-xl px-3 py-1.5 flex-1 min-w-[140px]">
                  <Search size={14} className="text-gray-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="חיפוש שם..."
                    value={donSearch}
                    onChange={e => { setDonSearch(e.target.value); setDonPage(0); }}
                    className="bg-transparent outline-none text-sm w-full"
                  />
                </div>
                {donTab !== 'meetings' && (
                  <select
                    value={donMethod}
                    onChange={e => { setDonMethod(e.target.value); setDonPage(0); }}
                    className="border border-[#EDE6D6] rounded-xl px-2 py-1.5 text-sm bg-white outline-none focus:border-[#C9A84C]"
                  >
                    <option value="">כל האפיקים</option>
                    {uniqueMethods.map(m => <option key={m as string} value={m as string}>{m as string}</option>)}
                  </select>
                )}
                <select
                  value={donPurpose}
                  onChange={e => { setDonPurpose(e.target.value); setDonPage(0); }}
                  className="border border-[#EDE6D6] rounded-xl px-2 py-1.5 text-sm bg-white outline-none focus:border-[#C9A84C]"
                >
                  <option value="">כל הייעודים</option>
                  {uniquePurposes.map(p => <option key={p as string} value={p as string}>{p as string}</option>)}
                </select>
                {donTab !== 'meetings' && (
                  <select
                    value={donSort}
                    onChange={e => setDonSort(e.target.value as 'date' | 'amount')}
                    className="border border-[#EDE6D6] rounded-xl px-2 py-1.5 text-sm bg-white outline-none focus:border-[#C9A84C]"
                  >
                    <option value="date">מיון: תאריך</option>
                    <option value="amount">מיון: סכום</option>
                  </select>
                )}
              </div>

              {/* Table header — desktop only */}
              {donTab !== 'meetings' ? (
                <div className="hidden md:grid grid-cols-[1fr_6rem_6rem_9rem_1fr] gap-0 bg-gray-50 border-b border-[#EDE6D6] text-[11px] font-bold text-gray-500 uppercase tracking-wide px-4 py-2">
                  <div>שם</div><div>תאריך</div><div className="text-left">סכום</div><div>אפיק</div><div>ייעוד</div>
                </div>
              ) : (
                <div className="hidden md:grid grid-cols-[1fr_6rem_6rem_1fr_1fr] gap-0 bg-gray-50 border-b border-[#EDE6D6] text-[11px] font-bold text-gray-500 uppercase tracking-wide px-4 py-2">
                  <div>שם</div><div>תאריך מפגש</div><div>מיקום</div><div>מטרה</div><div>הערות</div>
                </div>
              )}

              {/* Rows */}
              <div className="divide-y divide-[#EDE6D6]">
                {pagedDonations.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">לא נמצאו רשומות</div>
                ) : pagedDonations.map((d: any, i: number) => {
                  const isMeet = (d.amount || 0) === 0;
                  return (
                    <div key={i} className={`px-4 py-2.5 hover:bg-[#FAF6EE] transition-colors ${
                      isMeet ? 'md:grid md:grid-cols-[1fr_6rem_6rem_1fr_1fr] md:items-center'
                              : 'md:grid md:grid-cols-[1fr_6rem_6rem_9rem_1fr] md:items-center'
                    }`}>
                      <div className="flex justify-between items-center md:contents">
                        <div className="md:contents">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{isMeet ? '📝' : '💰'}</span>
                            <span className="text-sm font-semibold text-[#0D1B2A]">{d.name || '—'}</span>
                          </div>
                          <div className="text-[11px] text-gray-400 md:hidden">
                            {isMeet ? (d.meetDate || d.date) : d.date}
                            {isMeet ? (d.location ? ` · ${d.location}` : '') : (d.method ? ` · ${d.method}` : '')}
                          </div>
                        </div>
                        <div className="text-right md:text-left md:contents shrink-0">
                          {isMeet ? (
                            <>
                              <span className="hidden md:block text-[12px] text-gray-500">{d.meetDate || d.date || '—'}</span>
                              <span className="hidden md:block text-[12px] text-gray-500">{d.location || '—'}</span>
                              <span className="hidden md:block text-[12px] text-gray-400 truncate">{d.meetPurpose || d.purpose || '—'}</span>
                              <span className="hidden md:block text-[12px] text-gray-400 truncate">{d.notes || '—'}</span>
                            </>
                          ) : (
                            <>
                              <span className="hidden md:block text-[12px] text-gray-500">{d.date || '—'}</span>
                              <span className="font-['Frank_Ruhl_Libre'] font-bold text-[#9B7A2F] text-sm">₪{(d.amount || 0).toLocaleString()}</span>
                              <span className="hidden md:block text-[12px] text-gray-500">{d.method || '—'}</span>
                              <span className="hidden md:block text-[12px] text-gray-400 truncate">{d.purpose || '—'}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load more */}
              {pagedDonations.length < filteredDonations.length && (
                <button
                  onClick={() => setDonPage(p => p + 1)}
                  className="w-full py-3 text-sm font-bold text-[#9B7A2F] hover:bg-[#FAF6EE] transition-colors border-t border-[#EDE6D6]"
                >
                  הצג עוד ({filteredDonations.length - pagedDonations.length} נותרו)
                </button>
              )}

              {/* Summary footer */}
              <div className="px-4 py-2.5 bg-[#FAF6EE] border-t border-[#EDE6D6] flex justify-between items-center text-sm">
                <span className="text-gray-500">{filteredDonations.length} רשומות</span>
                {donTab !== 'meetings' && (
                  <span className="font-['Frank_Ruhl_Libre'] font-bold text-[#0D1B2A]">
                    סה"כ: ₪{(filteredDonations as any[]).reduce((s, d) => s + (d.amount || 0), 0).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Export modal — centered on desktop */}
      {isExportMenuOpen && (() => {
        const exportCount = exportDataTab === 'donations' ? (manualMode ? manualSelected.size : exportFilteredDonations.length)
          : exportDataTab === 'tasks' ? (manualMode ? manualSelected.size : exportFilteredTasks.length)
          : (manualMode ? manualSelected.size : exportFilteredContacts.length);
        const chip = (active: boolean, label: string, onClick: () => void, key?: React.Key) => (
          <button
            key={key}
            onClick={onClick}
            className={`shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium border-[1.5px] transition-colors ${active ? 'bg-[#0D1B2A] border-[#0D1B2A] text-[#C9A84C]' : 'bg-white border-[#EDE6D6] text-gray-600'}`}
          >
            {active && <Check size={11} />} {label}
          </button>
        );
        return (
        <div
          className="fixed inset-0 bg-black/50 z-[200] flex items-end md:items-center justify-center"
          onClick={e => e.target === e.currentTarget && setIsExportMenuOpen(false)}
        >
          <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl p-5 pb-6 w-full max-w-[430px] md:max-w-lg max-h-[88vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5 md:hidden shrink-0" />
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h2 className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A] flex items-center gap-2">
                <FileText size={20} className="text-[#C9A84C]" /> ייצוא נתונים
              </h2>
              <button onClick={() => setIsExportMenuOpen(false)} className="p-2 bg-white rounded-full shadow-sm">
                <X size={16} />
              </button>
            </div>

            {/* Which data */}
            <div className="flex gap-2 mb-4 shrink-0">
              {([['donations', '💰 תרומות'], ['tasks', '📋 משימות'], ['contacts', '👥 אנשי קשר']] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => switchExportTab(id)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${exportDataTab === id ? 'bg-[#0D1B2A] text-[#C9A84C]' : 'bg-white text-gray-500 border border-[#EDE6D6]'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-4">
              {exportDataTab === 'donations' && (
                <>
                  {uniqueMethods.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold text-gray-500 uppercase mb-1.5">אפיק גבייה (ריק = הכל)</div>
                      <div className="flex flex-wrap gap-1.5">
                        {uniqueMethods.map(m => chip(exportMethods.has(m as string), m as string, () => toggleInSet(exportMethods, setExportMethods, m as string), m as string))}
                      </div>
                    </div>
                  )}
                  {uniquePurposes.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold text-gray-500 uppercase mb-1.5">יעד / נישה (ריק = הכל)</div>
                      <div className="flex flex-wrap gap-1.5">
                        {uniquePurposes.map(p => chip(exportPurposes.has(p as string), p as string, () => toggleInSet(exportPurposes, setExportPurposes, p as string), p as string))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {exportDataTab === 'tasks' && (
                <div>
                  <div className="text-[11px] font-bold text-gray-500 uppercase mb-1.5">קטגוריה (ריק = הכל)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(TASK_CATEGORY_LABELS) as (keyof typeof TASK_CATEGORY_LABELS)[]).map(cat =>
                      chip(exportTaskCats.has(cat), TASK_CATEGORY_LABELS[cat], () => toggleInSet(exportTaskCats, setExportTaskCats, cat), cat)
                    )}
                  </div>
                </div>
              )}

              {exportDataTab === 'contacts' && (
                <div>
                  <div className="text-[11px] font-bold text-gray-500 uppercase mb-1.5">מעגל קרבה (ריק = הכל)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(CIRCLE_LABELS).map(c => chip(exportCircles.has(c), CIRCLE_LABELS[c], () => toggleInSet(exportCircles, setExportCircles, c), c))}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-[#0D1B2A] font-medium cursor-pointer">
                <input type="checkbox" checked={manualMode} onChange={e => { setManualMode(e.target.checked); setManualSelected(new Set()); }} className="w-4 h-4 accent-[#C9A84C]" />
                בחירה ידנית — לבחור רשומות ספציפיות מהרשימה המסוננת
              </label>

              {manualMode && (
                <div className="space-y-1.5 bg-white rounded-xl border border-[#EDE6D6] p-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {exportDataTab === 'donations' && exportFilteredDonations.map((d, i) => {
                    const key = donationKey(d);
                    const checked = manualSelected.has(key);
                    return (
                      <div key={i} onClick={() => toggleInSet(manualSelected, setManualSelected, key)} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm ${checked ? 'bg-[#D1FAE5]' : 'hover:bg-[#FAF6EE]'}`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-[#10B981] border-[#10B981]' : 'border-gray-300'}`}>{checked && <Check size={10} className="text-white" />}</div>
                        <span className="flex-1 truncate">{d.name}</span>
                        <span className="text-gray-400 text-xs shrink-0">₪{(d.amount || 0).toLocaleString()} · {d.date}</span>
                      </div>
                    );
                  })}
                  {exportDataTab === 'tasks' && exportFilteredTasks.map((t, i) => {
                    const key = taskKey(t);
                    const checked = manualSelected.has(key);
                    return (
                      <div key={i} onClick={() => toggleInSet(manualSelected, setManualSelected, key)} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm ${checked ? 'bg-[#D1FAE5]' : 'hover:bg-[#FAF6EE]'}`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-[#10B981] border-[#10B981]' : 'border-gray-300'}`}>{checked && <Check size={10} className="text-white" />}</div>
                        <span className="flex-1 truncate">{t.text}</span>
                        <span className="text-gray-400 text-xs shrink-0">{t.categoryLabel}</span>
                      </div>
                    );
                  })}
                  {exportDataTab === 'contacts' && exportFilteredContacts.map(n => {
                    const checked = manualSelected.has(n);
                    return (
                      <div key={n} onClick={() => toggleInSet(manualSelected, setManualSelected, n)} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm ${checked ? 'bg-[#D1FAE5]' : 'hover:bg-[#FAF6EE]'}`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-[#10B981] border-[#10B981]' : 'border-gray-300'}`}>{checked && <Check size={10} className="text-white" />}</div>
                        <span className="flex-1 truncate">{n}</span>
                        <span className="text-gray-400 text-xs shrink-0">{CIRCLE_LABELS[crm[n]?.circle || 'none']}</span>
                      </div>
                    );
                  })}
                  {((exportDataTab === 'donations' && exportFilteredDonations.length === 0) ||
                    (exportDataTab === 'tasks' && exportFilteredTasks.length === 0) ||
                    (exportDataTab === 'contacts' && exportFilteredContacts.length === 0)) && (
                    <div className="text-center text-gray-400 text-sm py-3">אין רשומות התואמות את הסינון</div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={runExport}
              disabled={exportCount === 0}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-[#0D1B2A] to-[#1A2E45] text-white rounded-xl py-3.5 font-bold shadow-md mt-4 shrink-0 disabled:opacity-40"
            >
              <Download size={16} className="text-[#C9A84C]" /> ייצוא {exportCount} רשומות
            </button>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
