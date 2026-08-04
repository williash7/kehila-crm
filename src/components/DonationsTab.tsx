import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/AppContext';
import { RefreshCw, Search, HandCoins, AlertTriangle, ChevronDown, X, Mail, MessageSquare, Pencil, Check, User } from 'lucide-react';
import { getHkStatus, sortHkList, countHkByStatus, HK_STATUS_LABEL, HK_STATUS_COLOR, HkStatus } from '../lib/standingOrders';
import { parseDdMmYyyy } from '../lib/dateUtils';
import { ProfileModal } from './ProfileModal';
import { ThankYouLetterModal } from './ThankYouLetterModal';

type MainTab = 'donations' | 'hk' | 'errors';

export function DonationsTab() {
  const { donations, hk, failures, settings, refresh, crm } = useAppStore();
  const [mainTab, setMainTab] = useState<MainTab>('donations');
  const [selectedDonor, setSelectedDonor] = useState<string | null>(null);
  const [selectedDonation, setSelectedDonation] = useState<any | null>(null);
  const [showThankYou, setShowThankYou] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, any>>({});

  // ── תרומות ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(settings.donationsSinceDate || '');
  const [dateTo, setDateTo] = useState('');
  const [method, setMethod] = useState('');
  const [purpose, setPurpose] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  const uniqueMethods = useMemo(() => Array.from(new Set(donations.map(d => d.method).filter(Boolean))), [donations]);
  const uniquePurposes = useMemo(() => Array.from(new Set(donations.map(d => d.purpose).filter(Boolean))), [donations]);

  const donationRecords = useMemo(() => donations.filter(d => (d.amount || 0) > 0), [donations]);

  const filteredDonations = useMemo(() => {
    let list = [...donationRecords];
    if (search) list = list.filter(d => (d.name || '').toLowerCase().includes(search.toLowerCase()));
    if (method) list = list.filter(d => d.method === method);
    if (purpose) list = list.filter(d => d.purpose === purpose);
    if (dateFrom) {
      const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
      list = list.filter(d => { const dt = parseDdMmYyyy(d.date); return !dt || dt.getTime() >= from.getTime(); });
    }
    if (dateTo) {
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999);
      list = list.filter(d => { const dt = parseDdMmYyyy(d.date); return !dt || dt.getTime() <= to.getTime(); });
    }
    list.sort((a, b) => {
      if (sortBy === 'amount') return (b.amount || 0) - (a.amount || 0);
      const ta = parseDdMmYyyy(a.date)?.getTime() || 0;
      const tb = parseDdMmYyyy(b.date)?.getTime() || 0;
      return tb - ta;
    });
    return list;
  }, [donationRecords, search, method, purpose, dateFrom, dateTo, sortBy]);

  const pagedDonations = filteredDonations.slice(0, (page + 1) * PAGE_SIZE);
  const filteredTotal = filteredDonations.reduce((s, d) => s + (d.amount || 0), 0);

  const clearFilters = () => { setSearch(''); setDateFrom(''); setDateTo(''); setMethod(''); setPurpose(''); setSortBy('date'); };
  const hasActiveFilters = !!(search || dateFrom || dateTo || method || purpose);

  // ── הוראות קבע ──────────────────────────────────────────────────────────
  const [hkFilter, setHkFilter] = useState<'all' | HkStatus | 'errors'>('all');
  const [hkSearch, setHkSearch] = useState('');
  const threshold = settings.hkExpiringThreshold ?? 2;
  const failNames = useMemo(() => new Set(failures.map((f: any) => f.name)), [failures]);
  const failByName = useMemo(() => {
    const m: Record<string, any> = {};
    failures.forEach((f: any) => { m[f.name] = f; });
    return m;
  }, [failures]);
  const hkCounts = useMemo(() => countHkByStatus(hk, threshold), [hk, threshold]);
  let hkList = useMemo(() => sortHkList(hk, failNames, threshold), [hk, failNames, threshold]);
  if (hkFilter === 'errors') hkList = hkList.filter(h => failNames.has(h.name));
  else if (hkFilter !== 'all') hkList = hkList.filter(h => getHkStatus(h, threshold) === hkFilter);
  if (hkSearch) hkList = hkList.filter(h => h.name?.toLowerCase().includes(hkSearch.toLowerCase()));

  const mainTabs: { id: MainTab; label: string; count: number }[] = [
    { id: 'donations', label: 'תרומות', count: donationRecords.length },
    { id: 'hk', label: 'הוראות קבע', count: hk.length },
    { id: 'errors', label: 'שגיאות', count: failures.length },
  ];

  return (
    <div className="animate-in fade-in pb-24 md:pb-6">
      {/* Topbar */}
      <div className="bg-[#0D1B2A] px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="w-9 h-9 bg-gradient-to-br from-[#C9A84C] to-[#9B7A2F] rounded-lg flex items-center justify-center shrink-0 md:hidden">
          <HandCoins size={18} className="text-white" />
        </div>
        <div className="flex-1 px-3 md:px-0">
          <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#C9A84C]">תרומות</div>
          <div className="text-[11px] text-white/45 mt-[1px]">כל התרומות, הוראות קבע ושגיאות במקום אחד</div>
        </div>
        <button onClick={refresh} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white/80 shrink-0">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="p-4 md:p-6">
        {/* Main segmented tabs */}
        <div className="flex gap-1.5 mb-4 bg-white rounded-xl p-1 border border-[#EDE6D6] shadow-sm">
          {mainTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setMainTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                mainTab === t.id ? 'bg-[#0D1B2A] text-[#C9A84C]' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {mainTab === 'donations' && (
          <>
            {/* Search + filter toggle */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="חיפוש לפי איש קשר..."
                  className="w-full bg-white border border-[#EDE6D6] rounded-xl py-2.5 pr-9 pl-3 text-sm outline-none focus:border-[#C9A84C]"
                />
              </div>
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 rounded-xl text-sm font-bold border transition-colors ${
                  showFilters || hasActiveFilters ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]' : 'bg-white text-gray-500 border-[#EDE6D6]'
                }`}
              >
                סינון <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {showFilters && (
              <div className="bg-white rounded-xl p-3.5 border border-[#EDE6D6] shadow-sm mb-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">מתאריך</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full bg-gray-50 border border-[#EDE6D6] rounded-lg px-2 py-2 text-xs outline-none focus:border-[#C9A84C]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">עד תאריך</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full bg-gray-50 border border-[#EDE6D6] rounded-lg px-2 py-2 text-xs outline-none focus:border-[#C9A84C]" />
                  </div>
                </div>
                {uniqueMethods.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">אפיק גבייה</label>
                    <select value={method} onChange={e => setMethod(e.target.value)} className="w-full bg-gray-50 border border-[#EDE6D6] rounded-lg px-2 py-2 text-xs outline-none focus:border-[#C9A84C]">
                      <option value="">הכל</option>
                      {uniqueMethods.map(m => <option key={m as string} value={m as string}>{m as string}</option>)}
                    </select>
                  </div>
                )}
                {uniquePurposes.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">ייעוד</label>
                    <select value={purpose} onChange={e => setPurpose(e.target.value)} className="w-full bg-gray-50 border border-[#EDE6D6] rounded-lg px-2 py-2 text-xs outline-none focus:border-[#C9A84C]">
                      <option value="">הכל</option>
                      {uniquePurposes.map(p => <option key={p as string} value={p as string}>{p as string}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">מיון</label>
                  <div className="flex gap-2">
                    <button onClick={() => setSortBy('date')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${sortBy === 'date' ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]' : 'bg-gray-50 text-gray-500 border-[#EDE6D6]'}`}>לפי תאריך</button>
                    <button onClick={() => setSortBy('amount')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${sortBy === 'amount' ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]' : 'bg-gray-50 text-gray-500 border-[#EDE6D6]'}`}>לפי סכום</button>
                  </div>
                </div>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-red-500 py-1.5">
                    <X size={12} /> נקה סינונים
                  </button>
                )}
              </div>
            )}

            {/* List */}
            <div className="bg-white rounded-xl border border-[#EDE6D6] shadow-sm overflow-hidden">
              <div className="hidden md:grid grid-cols-[1fr_6rem_6rem_9rem_1fr] gap-0 bg-gray-50 border-b border-[#EDE6D6] text-[11px] font-bold text-gray-500 uppercase tracking-wide px-4 py-2">
                <div>שם</div><div>תאריך</div><div className="text-left">סכום</div><div>אפיק</div><div>ייעוד</div>
              </div>
              <div className="divide-y divide-[#EDE6D6]">
                {pagedDonations.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">לא נמצאו תרומות התואמות לסינון</div>
                ) : pagedDonations.map((d: any, i: number) => (
                  <div key={i} onClick={() => { setSelectedDonation(d); setIsEditing(false); }} className="px-4 py-2.5 hover:bg-[#FAF6EE] transition-colors cursor-pointer md:grid md:grid-cols-[1fr_6rem_6rem_9rem_1fr] md:items-center">
                    <div className="flex justify-between items-center md:contents">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">💰</span>
                        <span className="text-sm font-semibold text-[#0D1B2A]">{d.name || '—'}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 md:hidden">{d.date}{d.method ? ` · ${d.method}` : ''}</div>
                      <div className="text-right md:text-left md:contents shrink-0">
                        <span className="hidden md:block text-[12px] text-gray-500">{d.date || '—'}</span>
                        <span className="font-['Frank_Ruhl_Libre'] font-bold text-[#9B7A2F] text-sm">₪{(d.amount || 0).toLocaleString()}</span>
                        <span className="hidden md:block text-[12px] text-gray-500">{d.method || '—'}</span>
                        <span className="hidden md:block text-[12px] text-gray-400 truncate">{d.purpose || '—'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {pagedDonations.length < filteredDonations.length && (
                <button onClick={() => setPage(p => p + 1)} className="w-full py-3 text-sm font-bold text-[#9B7A2F] hover:bg-[#FAF6EE] transition-colors border-t border-[#EDE6D6]">
                  הצג עוד ({filteredDonations.length - pagedDonations.length} נותרו)
                </button>
              )}
              <div className="px-4 py-2.5 bg-[#FAF6EE] border-t border-[#EDE6D6] flex justify-between items-center text-sm">
                <span className="text-gray-500">{filteredDonations.length} רשומות</span>
                <span className="font-['Frank_Ruhl_Libre'] font-bold text-[#0D1B2A]">סה"כ: ₪{filteredTotal.toLocaleString()}</span>
              </div>
            </div>
          </>
        )}

        {mainTab === 'hk' && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-white rounded-xl p-2.5 text-center border border-[#EDE6D6] shadow-sm">
                <div className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-emerald-600">{hkCounts.active}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">פעילות</div>
              </div>
              <div className="bg-white rounded-xl p-2.5 text-center border border-amber-200 shadow-sm">
                <div className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-amber-600">{hkCounts.expiring}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">מסתיימות בקרוב</div>
              </div>
              <div className="bg-white rounded-xl p-2.5 text-center border border-[#EDE6D6] shadow-sm">
                <div className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-gray-400">{hkCounts.expired}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">הסתיימו</div>
              </div>
            </div>
            <div className="relative mb-2">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={hkSearch} onChange={e => setHkSearch(e.target.value)} placeholder="חיפוש לפי שם..." className="w-full bg-white border border-[#EDE6D6] rounded-xl py-2.5 pr-9 pl-3 text-sm outline-none focus:border-[#C9A84C]" />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-3 no-scrollbar">
              {([
                { id: 'all', label: 'הכל', count: hkList.length },
                { id: 'expiring', label: 'מסתיימות בקרוב', count: hkCounts.expiring },
                { id: 'expired', label: 'הסתיימו', count: hkCounts.expired },
                { id: 'active', label: 'פעילות', count: hkCounts.active },
                { id: 'errors', label: 'כשלי חיוב', count: failures.length },
              ] as { id: 'all' | HkStatus | 'errors'; label: string; count: number }[]).map(t => (
                <button key={t.id} onClick={() => setHkFilter(t.id)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${hkFilter === t.id ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]' : 'bg-white text-gray-500 border-[#EDE6D6]'}`}>
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {hkList.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">אין הוראות קבע להצגה</div>
              ) : hkList.map((h, i) => {
                const status = getHkStatus(h, threshold);
                const fail = failByName[h.name];
                return (
                  <div key={i} onClick={() => setSelectedDonor(h.name)} className={`bg-white rounded-xl p-3 border shadow-sm cursor-pointer hover:border-[#C9A84C] transition-colors ${fail ? 'border-red-200' : 'border-[#EDE6D6]'}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#0D1B2A] truncate">{h.name}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">חיוב אחרון: {h.lastBilled || '—'}</div>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="font-['Frank_Ruhl_Libre'] text-base font-bold text-[#9B7A2F]">₪{(Number(h.amount) || 0).toLocaleString()}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">לחודש</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${HK_STATUS_COLOR[status]}`}>
                        {HK_STATUS_LABEL[status]}{status !== 'expired' ? ` · נותרו ${h.remaining ?? '—'}` : ''}
                      </span>
                      {fail && (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 flex items-center gap-1">
                          <AlertTriangle size={11} /> {fail.reason || 'כשל חיוב'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {mainTab === 'errors' && (
          <div className="space-y-2">
            {failures.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">אין שגיאות חיוב כרגע — עבודה מצוינת!</div>
            ) : failures.map((f: any, i: number) => (
              <div key={i} onClick={() => setSelectedDonor(f.name)} className="bg-red-50 rounded-xl p-3 shadow-sm border border-red-100 flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-bold text-red-900 text-sm">{f.name}</div>
                  <div className="text-xs text-red-600 mt-0.5">{f.date} · {f.reason}</div>
                </div>
                <div className="font-['Frank_Ruhl_Libre'] font-bold text-lg text-red-600 shrink-0 mr-3">₪{f.amount}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedDonor && <ProfileModal name={selectedDonor} onClose={() => setSelectedDonor(null)} />}

      {/* Donation Detail Modal */}
      {selectedDonation && !showThankYou && (
        <div className="fixed inset-0 z-[55] flex flex-col justify-end" dir="rtl">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedDonation(null)} />
          <div className="relative bg-white rounded-t-2xl max-h-[88vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#EDE6D6] sticky top-0 bg-white z-10">
              <h2 className="font-['Frank_Ruhl_Libre'] font-bold text-[#0D1B2A] text-lg">פרטי תרומה</h2>
              <button onClick={() => setSelectedDonation(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <X size={16} />
              </button>
            </div>

            {!isEditing ? (
              <div className="p-4 space-y-3">
                {/* Donor name + profile link */}
                <div className="flex items-center justify-between bg-[#FAF6EE] rounded-xl p-3.5">
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">תורם</div>
                    <div className="text-lg font-['Frank_Ruhl_Libre'] font-bold text-[#0D1B2A]">{selectedDonation.name || '—'}</div>
                  </div>
                  <button
                    onClick={() => { setSelectedDonor(selectedDonation.name); setSelectedDonation(null); }}
                    className="flex items-center gap-1.5 text-xs text-[#9B7A2F] font-bold border border-[#C9A84C] rounded-lg px-2.5 py-1.5 bg-white"
                  >
                    <User size={12} /> פרופיל
                  </button>
                </div>

                {/* Amount + Date */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white border border-[#EDE6D6] rounded-xl p-3 shadow-sm">
                    <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">סכום</div>
                    <div className="font-['Frank_Ruhl_Libre'] font-bold text-2xl text-[#9B7A2F]">
                      ₪{(selectedDonation.amount || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-white border border-[#EDE6D6] rounded-xl p-3 shadow-sm">
                    <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">תאריך</div>
                    <div className="font-bold text-[#0D1B2A] text-sm">{selectedDonation.date || '—'}</div>
                  </div>
                </div>

                {selectedDonation.method && (
                  <div className="bg-white border border-[#EDE6D6] rounded-xl p-3 shadow-sm">
                    <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">אפיק גבייה</div>
                    <div className="text-sm text-[#0D1B2A]">{selectedDonation.method}</div>
                  </div>
                )}

                {selectedDonation.purpose && (
                  <div className="bg-white border border-[#EDE6D6] rounded-xl p-3 shadow-sm">
                    <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">ייעוד</div>
                    <div className="text-sm text-[#0D1B2A]">{selectedDonation.purpose}</div>
                  </div>
                )}

                {selectedDonation.notes && (
                  <div className="bg-white border border-[#EDE6D6] rounded-xl p-3 shadow-sm">
                    <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">הערות</div>
                    <div className="text-sm text-[#0D1B2A] whitespace-pre-wrap">{selectedDonation.notes}</div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1 pb-2">
                  <button
                    onClick={() => setShowThankYou(true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#0D1B2A] text-[#C9A84C] font-bold py-3 rounded-xl text-sm"
                  >
                    <Mail size={16} /> מכתב תודה
                  </button>
                  <button
                    onClick={() => { setIsEditing(true); setEditFields({ ...selectedDonation }); }}
                    className="flex items-center justify-center gap-2 bg-gray-100 text-gray-600 font-bold py-3 px-4 rounded-xl"
                    title="עריכה"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              </div>
            ) : (
              /* Edit mode */
              <div className="p-4 space-y-3">
                <div className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  תרומות מגוגל שיטס לא ניתנות לשינוי מכאן — ניתן לעדכן הערות בלבד
                </div>

                <div>
                  <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1.5">הערות</label>
                  <textarea
                    value={editFields.notes || ''}
                    onChange={e => setEditFields((f: any) => ({ ...f, notes: e.target.value }))}
                    rows={4}
                    className="w-full bg-gray-50 border border-[#EDE6D6] rounded-xl p-3 text-sm outline-none focus:border-[#C9A84C] resize-none"
                    placeholder="הוסף הערה..."
                  />
                </div>

                <div className="flex gap-2 pb-2">
                  <button
                    onClick={() => {
                      setSelectedDonation((prev: any) => ({ ...prev, notes: editFields.notes }));
                      setIsEditing(false);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#0D1B2A] text-[#C9A84C] font-bold py-3 rounded-xl text-sm"
                  >
                    <Check size={16} /> שמור
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex items-center justify-center gap-2 bg-gray-100 text-gray-600 font-bold py-3 px-4 rounded-xl"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Thank You Letter — shown on top of donation detail */}
      {showThankYou && selectedDonation && (
        <ThankYouLetterModal
          donorName={selectedDonation.name}
          amount={selectedDonation.amount}
          date={selectedDonation.date}
          phone={crm[selectedDonation.name]?.phone}
          email={crm[selectedDonation.name]?.email}
          onClose={() => setShowThankYou(false)}
        />
      )}
    </div>
  );
}
