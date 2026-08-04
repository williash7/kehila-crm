import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/AppContext';
import { RefreshCw, Download, FileText, X, PieChart, List, Search, ChevronDown } from 'lucide-react';
import { Donor } from '../types';
import { StandingOrdersModal } from './StandingOrdersModal';

export function ReportsTab() {
  const { summary, effectiveSummary, donations, visibleDonors, crm, refresh, settings } = useAppStore();
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
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

  const downloadCSV = (title: string, data: any[]) => {
    if (data.length === 0) return alert('אין נתונים לדוח זה');
    const headers = ['שם תורם', 'תאריך', 'סכום', 'יעד/נישה', 'אפיק גבייה'];
    let csvContent = '﻿';
    csvContent += headers.join(',') + '\n';
    data.forEach(d => {
      const row = [
        `"${(d.name || '').replace(/"/g, '""')}"`,
        `"${d.date || ''}"`,
        d.amount || 0,
        `"${(d.purpose || '').replace(/"/g, '""')}"`,
        `"${(d.method || '').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(',') + '\n';
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${title}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            onClick={() => setIsExportMenuOpen(true)}
            className="flex items-center gap-1.5 px-3 h-9 bg-[#C9A84C] text-[#0D1B2A] rounded-full text-sm font-bold shadow-md transition-transform active:scale-95"
          >
            <Download size={14} />
            <span className="hidden sm:inline">הנפק דוח</span>
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
      {isExportMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[200] flex items-end md:items-center justify-center"
          onClick={e => e.target === e.currentTarget && setIsExportMenuOpen(false)}
        >
          <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl p-5 pb-10 md:pb-6 w-full max-w-[430px] md:max-w-lg max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5 md:hidden" />
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A] flex items-center gap-2">
                <FileText size={20} className="text-[#C9A84C]" /> הנפקת דוחות
              </h2>
              <button onClick={() => setIsExportMenuOpen(false)} className="p-2 bg-white rounded-full shadow-sm">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <h3 className="text-[#0D1B2A] font-bold mb-2">דוח כללי</h3>
                <button
                  onClick={() => downloadCSV('דוח_כולל', donations)}
                  className="w-full flex items-center justify-between bg-[#0D1B2A] text-white p-3 rounded-lg hover:bg-[#1A2E45] transition-colors"
                >
                  <span className="text-sm">הנפק דוח כולל (כל התרומות)</span>
                  <Download size={16} className="text-[#C9A84C]" />
                </button>
              </div>

              {uniquePurposes.length > 0 && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <h3 className="text-[#0D1B2A] font-bold mb-2">דוחות לפי יעדים / נישות</h3>
                  <div className="space-y-2">
                    {uniquePurposes.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => downloadCSV(`דוח_${(p as string).replace(/\s+/g, '_')}`, donations.filter(d => d.purpose === p))}
                        className="w-full flex items-center justify-between text-[#0D1B2A] bg-gray-50 p-2.5 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-sm truncate pl-2">{p as string}</span>
                        <Download size={14} className="text-gray-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {uniqueMethods.length > 0 && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <h3 className="text-[#0D1B2A] font-bold mb-2">דוחות לפי אפיק גבייה</h3>
                  <div className="space-y-2">
                    {uniqueMethods.map((m, i) => (
                      <button
                        key={i}
                        onClick={() => downloadCSV(`דוח_${(m as string).replace(/\s+/g, '_')}`, donations.filter(d => d.method === m))}
                        className="w-full flex items-center justify-between text-[#0D1B2A] bg-gray-50 p-2.5 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-sm truncate pl-2">{m as string}</span>
                        <Download size={14} className="text-gray-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
