import React, { useState } from 'react';
import { EmptyState } from './EmptyState';
import { useAppStore } from '../store/AppContext';
import { Search, RefreshCw, Plus, Users, Map, Navigation, MapPin, X, Link2, PhoneCall } from 'lucide-react';
import { Donor } from '../types';
import { ProfileModal } from './ProfileModal';
import { DonorsMap } from './DonorsMap';
import { MergeContactsModal } from './MergeContactsModal';
import { QuickLogButtons } from './QuickLogButtons';
import { findGregorianBirthday, findHebrewBirthday, findYahrzeitEntries } from '../lib/donorDates';
import { computeOverdueContacts, computeLastContactByName, formatLastContact } from '../lib/contactFocus';
import { withCity } from '../lib/orgConfig';
import { avatarGradient, hasDisplayName } from '../lib/donorDisplay';

const DONOR_SORT_KEY = 'kehila:list-sort:contacts';
type DonorSortState = { field: string; direction: 'asc' | 'desc' };

function readDonorSort(): DonorSortState {
  try {
    const saved = JSON.parse(localStorage.getItem(DONOR_SORT_KEY) || 'null');
    if (['total', 'name', 'circle', 'date'].includes(saved?.field)
      && ['asc', 'desc'].includes(saved?.direction)) {
      return saved;
    }
  } catch { /* הגדרת נוחות בלבד — אינה חוסמת את הרשימה */ }
  return { field: 'total', direction: 'desc' };
}

export function DonorsTab({ addTrigger }: { addTrigger?: { tab: string; count: number } } = {}) {
  const { donors, visibleDonors, hk, failures, crm, donations, refresh, updateCrm, nameMerges } = useAppStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [initialSort] = useState(readDonorSort);
  const [sort, setSort] = useState(initialSort.field);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialSort.direction);
  const [detailFilter, setDetailFilter] = useState('all');
  const [selectedDonor, setSelectedDonor] = useState<string | null>(null);

  // כיוון ברירת מחדל הגיוני לכל סוג מיון (כמו שהיה נהוג עד כה): תרומה
  // ומעגל — מהגבוה/הקרוב ביותר קודם; שם ותאריך — א'-ב'/הקרוב ביותר קודם.
  const defaultDirFor = (mode: string): 'asc' | 'desc' => (mode === 'name' || mode === 'date') ? 'asc' : 'desc';
  const changeSort = (mode: string) => {
    if (mode === sort) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return; }
    setSort(mode);
    setSortDir(defaultDirFor(mode));
  };

  React.useEffect(() => {
    try { localStorage.setItem(DONOR_SORT_KEY, JSON.stringify({ field: sort, direction: sortDir })); }
    catch { /* הגדרת נוחות בלבד */ }
  }, [sort, sortDir]);

  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [isContactFocusOpen, setIsContactFocusOpen] = useState(false);

  // כפתור "+" הגלובלי (FAB/סיידבר) — כשמדובר במסך הזה, פותח "הוספת איש קשר"
  React.useEffect(() => {
    if (addTrigger?.tab === 'donors' && addTrigger.count) setIsAddContactOpen(true);
  }, [addTrigger]);

  // מי לא יצרנו איתו קשר לאחרונה, לפי מעגל קרבה + זמן שחלף מהמפגש האחרון
  // (הועבר מהדשבורד לכאן — זה המקום הטבעי לרשימת "למי ליצור קשר")
  const overdueContacts = React.useMemo(
    () => computeOverdueContacts(visibleDonors, crm, donations, new Date()),
    [visibleDonors, crm, donations]
  );
  const lastContactByName = React.useMemo(() => computeLastContactByName(donations), [donations]);

  const submitNewContact = async () => {
    const name = newContactName.trim();
    if (!name) return;
    if (donors[name]) {
      alert('איש קשר בשם זה כבר קיים');
      return;
    }
    const { updateDonorFieldQueued } = await import('../lib/api');
    // קודם נוצר עותק מקומי; כך גם במצב ללא רשת הכרטיס קיים מיד.
    updateCrm(name, { circle: 'far' });
    const outcome = await updateDonorFieldQueued({ name, field: 'מקור', value: 'אפליקציה' });
    if (outcome.status === 'failed') {
      alert('איש הקשר נשמר בכרטיס המקומי, אך לא נשמר בגיליון: ' + outcome.error);
      return;
    }
    setIsAddContactOpen(false);
    setNewContactName('');
    setSelectedDonor(name);
  };

  const hkNames = new Set(hk.filter(h => h.active).map(h => h.name));
  const errNames = new Set(failures.map(f => f.name));

  let list: Donor[] = Object.values(visibleDonors || {}).filter(hasDisplayName) as Donor[];
  if (filter === 'close') list = list.filter(d => crm[d.name]?.circle === 'close');
  else if (filter === 'approach') list = list.filter(d => crm[d.name]?.circle === 'approach');
  else if (filter === 'third') list = list.filter(d => crm[d.name]?.circle === 'third');
  else if (filter === 'target') list = list.filter(d => crm[d.name]?.target);
  else if (filter === 'hk') list = list.filter(d => hkNames.has(d.name));
  else if (filter === 'errors') list = list.filter(d => errNames.has(d.name));

  const normalizedSearch = search.trim().toLocaleLowerCase('he');
  if (normalizedSearch) {
    list = list.filter(d => d.name.toLocaleLowerCase('he').includes(normalizedSearch));
  }

  // סינון לפי פרטים קיימים/חסרים (טלפון, יום הולדת, יארצייט) — משתמש
  // באותם פונקציות מציאה שכבר קיימות בשאר האפליקציה (כרטיס איש קשר, תזכורות).
  const hasPhone = (d: Donor) => !!(crm[d.name]?.phone || (d as any)['טלפון']);
  const hasBirthday = (d: Donor) => !!(findGregorianBirthday(d as any) || findHebrewBirthday(d as any));
  const hasYahrzeit = (d: Donor) => findYahrzeitEntries(d as any).length > 0;
  if (detailFilter === 'hasPhone') list = list.filter(hasPhone);
  else if (detailFilter === 'noPhone') list = list.filter(d => !hasPhone(d));
  else if (detailFilter === 'hasBirthday') list = list.filter(hasBirthday);
  else if (detailFilter === 'noBirthday') list = list.filter(d => !hasBirthday(d));
  else if (detailFilter === 'hasYahrzeit') list = list.filter(hasYahrzeit);
  else if (detailFilter === 'noYahrzeit') list = list.filter(d => !hasYahrzeit(d));

  const getNearestDateDays = (d: Donor) => {
    let minDays = 365;
    const today = new Date();
    const gBday = findGregorianBirthday(d as any);
    if (gBday) {
      let day = 0, m = 0;
      const gStr = String(gBday);
      const isoMatch = gStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (isoMatch) { m = parseInt(isoMatch[2]); day = parseInt(isoMatch[3]); }
      else {
        const match = gStr.match(/(\d{1,2})[\/\.-](\d{1,2})/);
        if (match) { day = parseInt(match[1]); m = parseInt(match[2]); }
      }
      if (day > 0 && m > 0 && day <= 31 && m <= 12) {
        const dateThisYear = new Date(today.getFullYear(), m - 1, day);
        if (dateThisYear < today) dateThisYear.setFullYear(today.getFullYear() + 1);
        const dist = Math.ceil((dateThisYear.getTime() - today.getTime()) / 86400000);
        if (dist < minDays) minDays = dist;
      }
    }
    const hBday = findHebrewBirthday(d as any) || '';
    const yahrzeitEntries = findYahrzeitEntries(d as any);
    if (minDays === 365 && (hBday || yahrzeitEntries.length > 0)) return 364;
    return minDays;
  };

  list.sort((a, b) => {
    let cmp = 0;
    if (sort === 'total') cmp = (a.total || 0) - (b.total || 0);
    else if (sort === 'name') cmp = a.name.localeCompare(b.name, 'he');
    else if (sort === 'circle') {
      const w = { target: 1, third: 2, approach: 3, close: 4 };
      const wA = w[(crm[a.name] || {}).circle as keyof typeof w] || 0;
      const wB = w[(crm[b.name] || {}).circle as keyof typeof w] || 0;
      cmp = wA - wB || (a.total || 0) - (b.total || 0);
    }
    else if (sort === 'date') cmp = getNearestDateDays(a) - getNearestDateDays(b);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // במכשירי Android מסוימים, במיוחד בזמן הקלדה בעברית, הדפדפן עלול להשאיר
  // את הכרטיסים הקודמים מצוירים אף שהמונה כבר חושב לפי הרשימה החדשה. המפתח
  // כולל גם את התוצאות וגם את סדרן, ולכן כל שינוי חיפוש/סינון/מיון מחליף את
  // המכולה כיחידה אחת ושומר את המונה והכרטיסים מסונכרנים.
  const listRenderKey = list.map(d => d.name).join('\u001f');

  const circleLabel: Record<string, string> = { close: '⭐ קרוב', approach: '🔄 מתקרב', third: '⭕ שלישי', far: '' };

  const filterTabs = [
    { id: 'all', label: 'הכל' },
    { id: 'close', label: '⭐ קרוב' },
    { id: 'approach', label: '🔄 מתקרב' },
    { id: 'third', label: '⭕ מ. שלישי' },
    { id: 'target', label: '🎯 להקרב' },
    { id: 'hk', label: 'הוק' },
    { id: 'errors', label: 'שגיאות' },
  ];

  return (
    <div className="animate-in fade-in pb-24 md:pb-6">
      {/* Topbar */}
      <div className="bg-[#0D1B2A] px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="w-9 h-9 bg-gradient-to-br from-[#C9A84C] to-[#9B7A2F] rounded-lg flex items-center justify-center shrink-0 md:hidden">
          <Users size={20} className="text-white" />
        </div>
        <div className="flex-1 px-3 md:px-0">
          <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#C9A84C]">אנשי קשר</div>
          <div className="text-[11px] text-white/45 mt-[1px]">{list.length} רשומות</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsContactFocusOpen(true)}
            className="relative w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white/80 shrink-0 hover:bg-white/20 transition-colors"
            title="למי ליצור קשר"
          >
            <PhoneCall size={16} />
            {overdueContacts.length > 0 && (
              <span className="absolute -top-0.5 -left-0.5 w-4 h-4 bg-[#C9A84C] text-[#0D1B2A] rounded-full text-[9px] font-bold flex items-center justify-center">
                {overdueContacts.length > 9 ? '9+' : overdueContacts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setIsMapOpen(true)}
            className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white/80 shrink-0 hover:bg-white/20 transition-colors"
            title="מסלול ביקורים"
          >
            <Map size={17} />
          </button>
          <button
            onClick={() => setIsMergeOpen(true)}
            className="relative w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white/80 shrink-0 hover:bg-white/20 transition-colors"
            title="חיבור אנשי קשר כפולים"
          >
            <Link2 size={16} />
            {Object.keys(nameMerges).length > 0 && (
              <span className="absolute -top-0.5 -left-0.5 w-4 h-4 bg-[#C9A84C] text-[#0D1B2A] rounded-full text-[9px] font-bold flex items-center justify-center">
                {Object.keys(nameMerges).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setIsAddContactOpen(true)}
            className="flex items-center gap-1.5 px-3 h-9 bg-[#C9A84C] text-[#0D1B2A] rounded-full text-sm font-bold shadow-md transition-transform active:scale-95"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">הוסף</span>
          </button>
          <button
            onClick={refresh}
            className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white/80 shrink-0 transition-transform active:rotate-180 duration-500"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Search + filters — full width on all screens */}
      <div className="p-4 pb-2 md:px-6 md:py-4">
        <div className="md:flex md:flex-wrap md:items-center md:gap-4">
          <div className="bg-white rounded-xl py-2.5 px-3.5 flex items-center gap-2.5 shadow-sm border-[1.5px] border-transparent focus-within:border-[#C9A84C] transition-colors mb-3 md:mb-0 md:w-72 md:shrink-0">
            <Search size={18} className="text-gray-400 shrink-0" />
            <input
              type="text"
              className="flex-1 bg-transparent border-none outline-none text-sm text-[#0D1B2A]"
              placeholder="חיפוש לפי שם..."
              value={search}
              onInput={e => setSearch(e.currentTarget.value)}
            />
          </div>

          <div className="mb-3 flex gap-2 md:mb-0 md:shrink-0">
            <select
              className="flex-1 md:w-40 bg-white border border-[#EDE6D6] text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#C9A84C] text-[#0D1B2A] font-medium shadow-sm"
              value={sort}
              onChange={e => changeSort(e.target.value)}
            >
              <option value="total">מיון: לפי תרומה</option>
              <option value="name">מיון: לפי שם</option>
              <option value="circle">מיון: לפי מעגל</option>
              <option value="date">מיון: לפי תאריכים</option>
            </select>
            <button
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="shrink-0 bg-white border border-[#EDE6D6] rounded-xl px-3 py-1.5 text-sm font-bold text-[#0D1B2A] shadow-sm"
              title={sortDir === 'asc' ? 'סדר עולה' : 'סדר יורד'}
            >
              {sortDir === 'asc' ? '↑ עולה' : '↓ יורד'}
            </button>
          </div>

          <div className="md:hidden mb-3">
            <select
              className="w-full bg-white border border-[#EDE6D6] text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#C9A84C] text-[#0D1B2A] font-medium shadow-sm"
              value={detailFilter}
              onChange={e => setDetailFilter(e.target.value)}
            >
              <option value="all">כל אנשי הקשר (ללא סינון פרטים)</option>
              <option value="hasPhone">יש טלפון</option>
              <option value="noPhone">אין טלפון</option>
              <option value="hasBirthday">יש יום הולדת</option>
              <option value="noBirthday">אין יום הולדת</option>
              <option value="hasYahrzeit">יש יארצייט</option>
              <option value="noYahrzeit">אין יארצייט</option>
            </select>
          </div>

          <div className="hidden md:block md:shrink-0 md:ml-2">
            <select
              className="bg-white border border-[#EDE6D6] text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#C9A84C] text-[#0D1B2A] font-medium shadow-sm"
              value={detailFilter}
              onChange={e => setDetailFilter(e.target.value)}
            >
              <option value="all">כל אנשי הקשר (ללא סינון פרטים)</option>
              <option value="hasPhone">יש טלפון</option>
              <option value="noPhone">אין טלפון</option>
              <option value="hasBirthday">יש יום הולדת</option>
              <option value="noBirthday">אין יום הולדת</option>
              <option value="hasYahrzeit">יש יארצייט</option>
              <option value="noYahrzeit">אין יארצייט</option>
            </select>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {filterTabs.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium border-[1.5px] transition-colors ${
                  filter === f.id
                    ? 'bg-[#0D1B2A] border-[#0D1B2A] text-[#C9A84C]'
                    : 'bg-white border-[#EDE6D6] text-gray-500 hover:border-[#C9A84C]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="לא נמצאו אנשי קשר מתאימים"
          hint="החיפוש והמסננים מצטברים. נסה לנקות את החיפוש, או להדליק עוד מעגלי קרבה בהגדרות."
        />
      ) : (
        <>
          {/* Mobile card list */}
          <div key={`mobile:${listRenderKey}`} className="px-4 space-y-2 md:hidden">
            {list.map(d => {
              const crmData = crm[d.name] || {};
              const isHk = hkNames.has(d.name);
              const isErr = errNames.has(d.name);
              return (
                <div
                  key={d.name}
                  className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm active:scale-95 transition-transform cursor-pointer"
                  onClick={() => setSelectedDonor(d.name)}
                >
                  <div
                    className="w-[42px] h-[42px] rounded-full flex justify-center items-center text-white font-['Frank_Ruhl_Libre'] font-bold text-lg shrink-0"
                    style={{ background: avatarGradient(d.name) }}
                  >
                    {d.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#0D1B2A] truncate">{d.name}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                      {isHk && <span className="text-[#0D1B2A] font-medium mr-1">🔄 הוק</span>}
                      {isErr && <span className="text-red-500 font-medium mr-1">⚠️ שגיאה</span>}
                      {d.lastDate && <span>תרומה: {d.lastDate}</span>}
                      <span className="mr-1">🕐 קשר: {formatLastContact(lastContactByName.get(d.name), new Date())}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {crmData.circle === 'close' && <span className="text-sm">⭐</span>}
                    {crmData.circle === 'approach' && <span className="text-sm">🔄</span>}
                    {crmData.circle === 'third' && <span className="text-sm">⭕</span>}
                    {crmData.target && <span className="text-sm">🎯</span>}
                  </div>
                  <div className="text-left shrink-0 mr-2">
                    <div className="font-['Frank_Ruhl_Libre'] text-base font-bold text-[#9B7A2F]">₪{(d.total || 0).toLocaleString()}</div>
                    <div className="text-[10px] text-gray-500">סהכ</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div key={`desktop:${listRenderKey}`} className="hidden md:block px-6 pb-6">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-[#EDE6D6]">
              {/* Table header */}
              <div className="grid grid-cols-[2.5rem_1fr_8rem_7rem_7rem_5rem] gap-0 bg-[#0D1B2A]/5 border-b border-[#EDE6D6] text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                <div className="px-4 py-3" />
                <button
                  className="px-4 py-3 text-right hover:text-[#C9A84C] transition-colors"
                  onClick={() => changeSort('name')}
                >
                  שם {sort === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  className="px-4 py-3 text-right hover:text-[#C9A84C] transition-colors"
                  onClick={() => changeSort('circle')}
                >
                  מעגל {sort === 'circle' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  className="px-4 py-3 text-right hover:text-[#C9A84C] transition-colors"
                  onClick={() => changeSort('total')}
                >
                  סה"כ תרומות {sort === 'total' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  className="px-4 py-3 text-right hover:text-[#C9A84C] transition-colors"
                  onClick={() => changeSort('date')}
                >
                  תאריך אחרון {sort === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
                <div className="px-4 py-3 text-center">סטטוס</div>
              </div>

              {/* Rows */}
              {list.map((d, i) => {
                const crmData = crm[d.name] || {};
                const isHk = hkNames.has(d.name);
                const isErr = errNames.has(d.name);
                return (
                  <div
                    key={d.name}
                    onClick={() => setSelectedDonor(d.name)}
                    className={`grid grid-cols-[2.5rem_1fr_8rem_7rem_7rem_5rem] gap-0 items-center cursor-pointer transition-colors hover:bg-[#FAF6EE] ${
                      i > 0 ? 'border-t border-[#EDE6D6]' : ''
                    }`}
                  >
                    <div className="px-3 py-3">
                      <div
                        className="w-8 h-8 rounded-full flex justify-center items-center text-white font-['Frank_Ruhl_Libre'] font-bold text-sm"
                        style={{ background: avatarGradient(d.name) }}
                      >
                        {d.name.charAt(0)}
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <div className="text-sm font-semibold text-[#0D1B2A]">{d.name}</div>
                      {(d as any)['טלפון'] && (
                        <div className="text-[11px] text-gray-400 mt-0.5">{(d as any)['טלפון']}</div>
                      )}
                    </div>
                    <div className="px-4 py-3">
                      {crmData.circle && crmData.circle !== 'far' ? (
                        <span className="text-xs font-medium">{circleLabel[crmData.circle]}</span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                      {crmData.target && <span className="mr-1 text-xs">🎯</span>}
                    </div>
                    <div className="px-4 py-3">
                      <span className="font-['Frank_Ruhl_Libre'] text-sm font-bold text-[#9B7A2F]">
                        ₪{(d.total || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="px-4 py-3 text-xs text-gray-500">
                      <div>{d.lastDate || '—'}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">🕐 {formatLastContact(lastContactByName.get(d.name), new Date())}</div>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-center gap-1">
                      {isHk && <span title="הוראת קבע" className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] flex items-center justify-center font-bold">הק</span>}
                      {isErr && <span title="שגיאה" className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-[10px] flex items-center justify-center">⚠</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-gray-400 mt-2 text-right">
              מציג {list.length} אנשי קשר
            </div>
          </div>
        </>
      )}

      {/* הרשימה המסוננת שממנה נפתח הכרטיס נשלחת כ"אחים": אחרי שסיננת
          למעגל מסוים אתה עובר עליהם אחד-אחד, ולחזור לרשימה בכל פעם רק כדי
          ללחוץ על השם הבא זה חיכוך מיותר. */}
      {selectedDonor && (
        <ProfileModal
          name={selectedDonor}
          onClose={() => setSelectedDonor(null)}
          backLabel="אנשי קשר"
          siblings={list.map(d => ({
            id: d.name,
            label: d.name,
            sub: d.total ? `₪${Number(d.total).toLocaleString()}` : undefined,
          }))}
          onSelectSibling={setSelectedDonor}
        />
      )}

      {/* Map / Route modal */}
      {isMapOpen && (() => {
        const withAddress = list
          .map(d => ({
            name: d.name,
            address: (d as any)['כתובת'] || crm[d.name]?.customFields?.['כתובת'] || '',
          }))
          .filter(d => d.address);

        const openRoute = (addrs: string[]) => {
          if (addrs.length === 0) return;
          const encoded = addrs.map(a => encodeURIComponent(withCity(a)));
          const url = addrs.length === 1
            ? `https://www.google.com/maps/search/?api=1&query=${encoded[0]}`
            : `https://www.google.com/maps/dir/${encoded.join('/')}`;
          window.open(url, '_blank');
        };

        return (
          <div className="fixed inset-0 bg-black/50 z-[200] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm"
            onClick={e => e.target === e.currentTarget && setIsMapOpen(false)}>
            <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl w-full max-w-[430px] md:max-w-xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
              {/* Header */}
              <div className="sticky top-0 bg-[#0D1B2A] px-5 py-4 flex items-center justify-between rounded-t-3xl md:rounded-t-3xl">
                <div className="flex items-center gap-3">
                  <Map size={20} className="text-[#C9A84C]" />
                  <div>
                    <div className="font-['Frank_Ruhl_Libre'] text-base font-bold text-[#C9A84C]">מסלול ביקורים</div>
                    <div className="text-[11px] text-white/40">{withAddress.length} אנשי קשר עם כתובת</div>
                  </div>
                </div>
                <button onClick={() => setIsMapOpen(false)} className="p-2 bg-white/10 rounded-full text-white/70">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5">
                {withAddress.length === 0 ? (
                  <div className="text-center py-10">
                    <MapPin size={36} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-sm text-gray-500">אין אנשי קשר עם כתובת ברשימה הנוכחית.</p>
                    <p className="text-xs text-gray-400 mt-1">הוסף כתובות בכרטיס האיש ← ערוך הכל ← שדה "כתובת"</p>
                  </div>
                ) : (
                  <>
                    {/* Embedded map */}
                    <div className="mb-5">
                      <DonorsMap donors={withAddress} />
                    </div>

                    {/* Quick actions */}
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <button
                        onClick={() => openRoute(withAddress.slice(0, 10).map(d => d.address))}
                        className="flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform shadow-md"
                      >
                        <Navigation size={16} />
                        מסלול כל הרשימה
                      </button>
                      <button
                        onClick={() => {
                          const close = withAddress.filter(d => crm[d.name]?.circle === 'close').slice(0, 10);
                          if (close.length) openRoute(close.map(d => d.address));
                          else alert('אין אנשי קשר קרובים עם כתובת ברשימה הנוכחית');
                        }}
                        className="flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform shadow-md"
                      >
                        <Navigation size={16} />
                        ⭐ מסלול קרובים
                      </button>
                    </div>
                    <div className="text-[11px] text-gray-400 mb-3 text-center">לחץ על כתובת לפתיחה במפה, או בחר עד 10 עצירות למסלול</div>

                    {/* Address list */}
                    <div className="space-y-2">
                      {withAddress.map((d, i) => (
                        <div key={i} className="bg-white rounded-xl p-3 border border-[#EDE6D6] flex items-center gap-3 shadow-sm">
                          <div
                            className="w-9 h-9 rounded-full flex justify-center items-center text-white font-['Frank_Ruhl_Libre'] font-bold text-sm shrink-0"
                            style={{ background: avatarGradient(d.name) }}
                          >
                            {d.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-[#0D1B2A]">{d.name}</div>
                            <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                              <MapPin size={10} className="shrink-0" />
                              <span className="truncate">{d.address}</span>
                            </div>
                          </div>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(withCity(d.address))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-100 transition-colors"
                            title="פתח במפה"
                          >
                            <Navigation size={16} />
                          </a>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {isAddContactOpen && (
        <div className="fixed inset-0 bg-[#0D1B2A]/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4" dir="rtl">
          <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl w-full max-w-sm shadow-2xl flex flex-col pt-5 pb-24 md:pb-0">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 md:hidden" />
            <h2 className="px-5 font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A] mb-3">הוספת איש קשר חדש</h2>
            <div className="px-5 pb-5">
              <input
                type="text"
                autoFocus
                value={newContactName}
                onChange={e => setNewContactName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitNewContact(); }}
                placeholder="שם איש הקשר"
                className="w-full bg-white border border-[#EDE6D6] rounded-xl p-3 text-sm outline-none focus:border-[#C9A84C] mb-4 shadow-sm"
              />
              <div className="flex gap-2">
                <button onClick={() => setIsAddContactOpen(false)} className="flex-1 py-2.5 text-gray-600 font-bold rounded-xl bg-gray-200 hover:bg-gray-300 transition-colors">ביטול</button>
                <button
                  onClick={submitNewContact}
                  className="flex-1 py-2.5 bg-gradient-to-br from-[#C9A84C] to-[#9B7A2F] text-white font-bold rounded-xl shadow-md active:scale-95 transition-transform"
                >
                  הוספה
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isMergeOpen && <MergeContactsModal onClose={() => setIsMergeOpen(false)} />}

      {isContactFocusOpen && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setIsContactFocusOpen(false)}>
          <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl w-full max-w-[430px] md:max-w-xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="sticky top-0 bg-[#0D1B2A] px-5 py-4 flex items-center justify-between rounded-t-3xl">
              <div className="flex items-center gap-3">
                <PhoneCall size={20} className="text-[#C9A84C]" />
                <div>
                  <div className="font-['Frank_Ruhl_Libre'] text-base font-bold text-[#C9A84C]">למי ליצור קשר</div>
                  <div className="text-[11px] text-white/40">לפי מעגל קרבה וזמן שחלף מהמפגש האחרון</div>
                </div>
              </div>
              <button onClick={() => setIsContactFocusOpen(false)} className="p-2 bg-white/10 rounded-full text-white/70">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              {overdueContacts.length === 0 ? (
                <div className="bg-white rounded-xl p-6 text-center text-gray-500 shadow-sm text-sm border border-[#EDE6D6]">
                  ✅ אין כרגע אנשי קשר שממתינים ליצירת קשר. עבודה מצוינת!
                </div>
              ) : (
                <div className="space-y-2">
                  {overdueContacts.map((c, i) => (
                    <div key={i} className="bg-white border border-[#EDE6D6] rounded-xl p-3 shadow-sm">
                      <div className="flex items-center gap-3 mb-2.5 cursor-pointer" onClick={() => { setSelectedDonor(c.name); setIsContactFocusOpen(false); }}>
                        <span className="text-xl shrink-0">{c.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-[#0D1B2A] truncate">{c.name}</div>
                          <div className="text-xs text-gray-600 mt-0.5">{c.msg}</div>
                        </div>
                      </div>
                      <QuickLogButtons donorName={c.name} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
