import React, { useState } from 'react';
import { EmptyState } from './EmptyState';
import { useAppStore } from '../store/AppContext';
import { Search, RefreshCw, Plus, Users, Map, Navigation, MapPin, X, Link2, PhoneCall, CheckSquare, Square, House, UserCheck, AlertTriangle, Trash2 } from 'lucide-react';
import { Donor } from '../types';
import { ProfileModal } from './ProfileModal';
import { DonorsMap } from './DonorsMap';
import { MergeContactsModal } from './MergeContactsModal';
import { QuickLogButtons } from './QuickLogButtons';
import { findGregorianBirthday, findHebrewBirthday, findYahrzeitEntries } from '../lib/donorDates';
import { computeOverdueContacts, computeLastContactByName, formatLastContact } from '../lib/contactFocus';
import { withCity } from '../lib/orgConfig';
import { avatarGradient, hasDisplayName } from '../lib/donorDisplay';
import { ExportButton } from './ExportButton';
import { CONTACT_COLUMNS } from '../lib/exportRows';
import { emptyHomeVisitEntry, liveCategoryFor } from '../lib/homeVisits';

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
  const {
    donors, visibleDonors, hk, failures, resolveChargeFailure, crm, donations, refresh, updateCrm, nameMerges,
    mergeContactsMany, homeVisits, addHomeVisitEntries, startHomeVisitRound,
    eventsData, updateEventsData,
  } = useAppStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [initialSort] = useState(readDonorSort);
  const [sort, setSort] = useState(initialSort.field);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialSort.direction);
  const [detailFilter, setDetailFilter] = useState('all');
  const [selectedDonor, setSelectedDonor] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'merge' | 'home' | 'attendance' | null>(null);
  const [bulkTarget, setBulkTarget] = useState('');
  const [bulkSearch, setBulkSearch] = useState('');
  const [newRoundPurpose, setNewRoundPurpose] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [failureContact, setFailureContact] = useState<string | null>(null);
  const [resolvingFailure, setResolvingFailure] = useState<string | null>(null);

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

  const toggleSelected = (name: string) => {
    setSelectedNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const leaveSelectionMode = () => {
    setSelectionMode(false);
    setSelectedNames(new Set());
    setBulkAction(null);
    setBulkTarget('');
    setBulkSearch('');
  };

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

  // ── מה שיירד לקובץ ──
  //
  // הרשימה מועשרת בשדות שהמסך מציג בצורה חזותית בלבד — מעגל הקרבה כאייקון,
  // הוראת קבע כסמל, קשר אחרון כטקסט מקוצר. **קובץ שמכיל רק את מה שכתוב
  // בשורה יאבד בדיוק את המידע שבגללו נכנסים לכרטיס.**
  const CIRCLE_LABEL: Record<string, string> = {
    close: 'קרוב', approach: 'בהתקרבות', third: 'מעגל שלישי', far: 'רחוק',
  };
  const exportRows = React.useMemo(() => list.map(d => {
    const c = (crm as any)[d.name] || {};
    return {
      name: d.name,
      phone: c.phone || '',
      address: c.address || '',
      circleLabel: CIRCLE_LABEL[c.circle] || '',
      total: d.total || 0,
      donationCount: (d.donations || []).filter((x: any) => (x.amount || 0) > 0).length,
      lastDate: d.lastDate || '',
      lastContact: formatLastContact(lastContactByName.get(d.name), new Date()),
      hasHk: hkNames.has(d.name),
      target: !!c.target,
      notes: c.notes || '',
    };
  }), [list, crm, hkNames, lastContactByName]);

  const contactFilterHint = [filter !== 'all' ? filter : '', detailFilter !== 'all' ? detailFilter : '', search]
    .filter(Boolean).join('_');

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

  const selectedList = [...selectedNames];
  const activeRounds = (homeVisits.rounds || []).filter(r => r.status === 'active');
  const closeBulkDialog = () => {
    setBulkAction(null);
    setBulkTarget('');
    setBulkSearch('');
    setNewRoundPurpose('');
  };

  const runBulkAction = async () => {
    if (!bulkAction || selectedList.length === 0 || bulkSaving) return;
    setBulkSaving(true);
    try {
      if (bulkAction === 'merge') {
        if (!bulkTarget || !selectedNames.has(bulkTarget)) {
          alert('בחר מי יהיה איש הקשר הראשי');
          return;
        }
        const ok = await mergeContactsMany(selectedList.filter(n => n !== bulkTarget), bulkTarget);
        if (!ok) { alert('המיזוג לא נשמר. נסה שוב.'); return; }
      } else if (bulkAction === 'home') {
        const entries = selectedList.map(name => emptyHomeVisitEntry(name, liveCategoryFor(name, crm)));
        if (bulkTarget === '__new') {
          startHomeVisitRound(entries, { purpose: newRoundPurpose.trim() || 'מערך ביקורי בית' });
        } else {
          const round = activeRounds.find(r => r.id === bulkTarget);
          if (!round) { alert('בחר מערך ביקורי בית'); return; }
          const existing = new Set(round.entries.map(e => e.name));
          const fresh = entries.filter(e => !existing.has(e.name));
          if (fresh.length) addHomeVisitEntries(round.id, fresh);
        }
      } else if (bulkAction === 'attendance') {
        const activity = eventsData.find(e => e.id === bulkTarget);
        if (!activity) { alert('בחר פעילות'); return; }
        const [year, month, day] = attendanceDate.split('-');
        const dateKey = `${day}/${month}/${year}`;
        const currentAttendance = activity.attendance?.[dateKey] || {};
        const currentParticipants = activity.participants?.[dateKey] || {};
        updateEventsData(eventsData.map(e => e.id === activity.id ? {
          ...e,
          attendance: {
            ...(e.attendance || {}),
            [dateKey]: { ...currentAttendance, ...Object.fromEntries(selectedList.map(name => [name, true])) },
          },
          participants: {
            ...(e.participants || {}),
            [dateKey]: {
              ...currentParticipants,
              ...Object.fromEntries(selectedList.map(name => [name, { ...(currentParticipants[name] || {}), attended: true }]))
            },
          },
        } : e));

        // הנוכחות מופיעה גם בכרטיס האדם כרשומת יצירת קשר, כמו בשמירה
        // הרגילה מתוך מסך הפעילות. מי שכבר היה מסומן אינו נרשם שוב.
        const newlyPresent = selectedList.filter(name => !currentAttendance[name]);
        if (newlyPresent.length) {
          const { addMeetingQueued } = await import('../lib/api');
          await Promise.all(newlyPresent.map(name => addMeetingQueued({
            name,
            date: `${day}.${month}.${year}`,
            meetType: 'נוכחות בפעילות',
            purpose: activity.name || '',
            notes: `נוכחות בפעילות: ${activity.name || ''}`,
            nextMeet: '',
          })));
        }
      }
      leaveSelectionMode();
    } finally {
      setBulkSaving(false);
    }
  };

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
            onClick={() => selectionMode ? leaveSelectionMode() : setSelectionMode(true)}
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${selectionMode ? 'bg-[#C9A84C] text-[#0D1B2A]' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
            title={selectionMode ? 'סיום בחירה' : 'בחירת כמה אנשי קשר'}
          >
            <CheckSquare size={17} />
          </button>
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

          <div className="flex items-center gap-2">
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar flex-1 min-w-0">
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
            {/* ההורדה צמודה למסננים, כי הם שקובעים מה יירד. */}
            <ExportButton
              rows={exportRows}
              columns={CONTACT_COLUMNS}
              fileName="אנשי-קשר"
              filterHint={contactFilterHint}
            />
          </div>
        </div>
      </div>

      {selectionMode && (
        <div className="mx-4 md:mx-6 mb-3 bg-[#0D1B2A] text-white rounded-2xl p-3 shadow-lg flex flex-wrap items-center gap-2 sticky top-[68px] z-40">
          <div className="font-bold text-sm ml-auto">נבחרו {selectedNames.size}</div>
          <button
            onClick={() => {
              const visibleNames = list.map(d => d.name);
              const allSelected = visibleNames.length > 0 && visibleNames.every(name => selectedNames.has(name));
              setSelectedNames(allSelected ? new Set() : new Set(visibleNames));
            }}
            className="px-3 py-2 rounded-xl bg-white/10 text-xs font-bold"
          >
            {list.length > 0 && list.every(d => selectedNames.has(d.name)) ? 'נקה בחירה' : 'בחר את המוצגים'}
          </button>
          <button disabled={selectedNames.size < 2} onClick={() => { setBulkAction('merge'); setBulkTarget(selectedList[0] || ''); }} className="px-3 py-2 rounded-xl bg-[#C9A84C] text-[#0D1B2A] text-xs font-bold disabled:opacity-40 flex items-center gap-1">
            <Link2 size={14} /> מיזוג
          </button>
          <button disabled={!selectedNames.size} onClick={() => { setBulkAction('home'); setBulkTarget(activeRounds[0]?.id || '__new'); }} className="px-3 py-2 rounded-xl bg-white text-[#0D1B2A] text-xs font-bold disabled:opacity-40 flex items-center gap-1">
            <House size={14} /> ביקורי בית
          </button>
          <button disabled={!selectedNames.size || !eventsData.length} onClick={() => { setBulkAction('attendance'); setBulkTarget(eventsData[0]?.id || ''); }} className="px-3 py-2 rounded-xl bg-white text-[#0D1B2A] text-xs font-bold disabled:opacity-40 flex items-center gap-1">
            <UserCheck size={14} /> נוכחות
          </button>
        </div>
      )}

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
                  className={`bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm active:scale-95 transition-transform cursor-pointer ${selectedNames.has(d.name) ? 'ring-2 ring-[#C9A84C] bg-[#FFF9E8]' : ''}`}
                  onClick={() => selectionMode ? toggleSelected(d.name) : setSelectedDonor(d.name)}
                >
                  {selectionMode && (
                    <span className={selectedNames.has(d.name) ? 'text-[#9B7A2F]' : 'text-gray-300'}>
                      {selectedNames.has(d.name) ? <CheckSquare size={22} /> : <Square size={22} />}
                    </span>
                  )}
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
                      {isErr && <button type="button" onClick={e => { e.stopPropagation(); setFailureContact(d.name); }} className="text-red-600 font-bold mr-1 underline decoration-dotted">⚠️ שגיאה — לפרטים</button>}
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
                    onClick={() => selectionMode ? toggleSelected(d.name) : setSelectedDonor(d.name)}
                    className={`grid grid-cols-[2.5rem_1fr_8rem_7rem_7rem_5rem] gap-0 items-center cursor-pointer transition-colors hover:bg-[#FAF6EE] ${selectedNames.has(d.name) ? 'bg-[#FFF9E8]' : ''} ${
                      i > 0 ? 'border-t border-[#EDE6D6]' : ''
                    }`}
                  >
                    <div className="px-3 py-3">
                      {selectionMode ? (
                        <span className={selectedNames.has(d.name) ? 'text-[#9B7A2F]' : 'text-gray-300'}>
                          {selectedNames.has(d.name) ? <CheckSquare size={22} /> : <Square size={22} />}
                        </span>
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex justify-center items-center text-white font-['Frank_Ruhl_Libre'] font-bold text-sm"
                          style={{ background: avatarGradient(d.name) }}
                        >
                          {d.name.charAt(0)}
                        </div>
                      )}
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
                      {isErr && <button type="button" onClick={e => { e.stopPropagation(); setFailureContact(d.name); }} title="הצג את פרטי השגיאה" className="w-6 h-6 rounded-full bg-red-100 text-red-600 text-[11px] flex items-center justify-center hover:bg-red-200">⚠</button>}
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

      {failureContact && (() => {
        const contactFailures = failures.filter(f => f.name === failureContact);
        return (
          <div className="fixed inset-0 bg-black/50 z-[260] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm" dir="rtl" onClick={e => e.target === e.currentTarget && setFailureContact(null)}>
            <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl w-full max-w-lg max-h-[88vh] flex flex-col shadow-2xl">
              <div className="bg-[#0D1B2A] px-5 py-4 flex items-center justify-between rounded-t-3xl shrink-0">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={21} className="text-red-400" />
                  <div>
                    <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#C9A84C]">שגיאות חיוב</div>
                    <div className="text-[11px] text-white/50">{failureContact}</div>
                  </div>
                </div>
                <button onClick={() => setFailureContact(null)} className="p-2 bg-white/10 rounded-full text-white/70"><X size={18} /></button>
              </div>

              <div className="p-5 overflow-y-auto space-y-3">
                {contactFailures.length === 0 ? (
                  <div className="bg-white rounded-xl p-6 text-center text-sm text-gray-500">אין כרגע שגיאות פתוחות לאיש קשר זה.</div>
                ) : contactFailures.map((failure, index) => {
                  const key = `${failure.order || ''}:${failure.date}:${failure.amount}:${index}`;
                  return (
                    <div key={key} className="bg-white border border-red-200 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="text-[11px] text-gray-400 font-bold mb-1">מה קרה?</div>
                          <div className="text-sm font-bold text-red-800">{failure.reason || 'הספק דיווח שהחיוב נכשל, ללא סיבה מפורטת'}</div>
                        </div>
                        <div className="text-lg font-bold text-red-600 shrink-0">₪{failure.amount || '—'}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                        <div className="bg-[#FAF6EE] rounded-lg p-2"><span className="block text-gray-400 text-[10px]">תאריך</span><b>{failure.date || 'לא ידוע'}</b></div>
                        <div className="bg-[#FAF6EE] rounded-lg p-2"><span className="block text-gray-400 text-[10px]">מספר הוראה</span><b dir="ltr">{failure.order || 'לא מופיע'}</b></div>
                      </div>
                      <button
                        disabled={resolvingFailure === key}
                        onClick={async () => {
                          if (!window.confirm('לסמן שהשגיאה כבר אינה רלוונטית? היא תיעלם מהאזהרות אך תישמר בגיליון כהיסטוריה שטופלה.')) return;
                          setResolvingFailure(key);
                          const ok = await resolveChargeFailure(failure);
                          setResolvingFailure(null);
                          if (!ok) { alert('לא הצלחנו להסיר את השגיאה. רענן ונסה שוב.'); return; }
                          if (contactFailures.length === 1) setFailureContact(null);
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-700 border border-red-200 rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
                      >
                        <Trash2 size={15} /> {resolvingFailure === key ? 'מסיר...' : 'השגיאה כבר לא רלוונטית — הסר מהאזהרות'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {bulkAction && (
        <div className="fixed inset-0 bg-black/50 z-[250] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm" dir="rtl" onClick={e => e.target === e.currentTarget && closeBulkDialog()}>
          <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl w-full max-w-lg max-h-[88vh] flex flex-col shadow-2xl">
            <div className="bg-[#0D1B2A] px-5 py-4 flex items-center justify-between rounded-t-3xl shrink-0">
              <div>
                <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#C9A84C]">
                  {bulkAction === 'merge' ? 'מיזוג אנשי קשר' : bulkAction === 'home' ? 'הוספה למערך ביקורי בית' : 'רישום נוכחות בפעילות'}
                </div>
                <div className="text-[11px] text-white/50">{selectedNames.size} אנשי קשר מסומנים</div>
              </div>
              <button onClick={closeBulkDialog} className="p-2 bg-white/10 rounded-full text-white/70"><X size={18} /></button>
            </div>

            <div className="p-5 overflow-y-auto">
              <div className="relative mb-3">
                <Search size={16} className="absolute right-3 top-3 text-gray-400" />
                <input value={bulkSearch} onChange={e => setBulkSearch(e.target.value)} placeholder="חיפוש בחלון הזה..." className="w-full bg-white border border-[#EDE6D6] rounded-xl py-2.5 pr-9 pl-3 text-sm outline-none focus:border-[#C9A84C]" />
              </div>

              {bulkAction === 'merge' && (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 mb-3">
                    בחר את הכרטיס הראשי שיישאר. התרומות והפרטים של כל שאר השמות יחוברו אליו.
                  </div>
                  <div className="space-y-2">
                    {selectedList.filter(name => name.includes(bulkSearch.trim())).map(name => (
                      <label key={name} className={`flex items-center gap-3 bg-white border rounded-xl p-3 cursor-pointer ${bulkTarget === name ? 'border-[#C9A84C] ring-1 ring-[#C9A84C]' : 'border-[#EDE6D6]'}`}>
                        <input type="radio" name="merge-primary" checked={bulkTarget === name} onChange={() => setBulkTarget(name)} />
                        <span className="font-bold text-sm text-[#0D1B2A]">{name}</span>
                        <span className="mr-auto text-[11px] text-gray-400">{bulkTarget === name ? 'יישאר כשם הראשי' : 'יתמזג'}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              {bulkAction === 'home' && (
                <div className="space-y-2">
                  <label className={`block bg-white border rounded-xl p-3 cursor-pointer ${bulkTarget === '__new' ? 'border-[#C9A84C] ring-1 ring-[#C9A84C]' : 'border-[#EDE6D6]'}`}>
                    <div className="flex items-center gap-3">
                      <input type="radio" name="home-round" checked={bulkTarget === '__new'} onChange={() => setBulkTarget('__new')} />
                      <span className="font-bold text-sm">מערך חדש</span>
                    </div>
                    {bulkTarget === '__new' && <input value={newRoundPurpose} onChange={e => setNewRoundPurpose(e.target.value)} placeholder="שם או מטרת המערך" className="mt-3 w-full bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg p-2 text-sm outline-none" />}
                  </label>
                  {activeRounds.filter(r => (r.purpose || 'מערך ביקורי בית').includes(bulkSearch.trim())).map(round => (
                    <label key={round.id} className={`flex items-center gap-3 bg-white border rounded-xl p-3 cursor-pointer ${bulkTarget === round.id ? 'border-[#C9A84C] ring-1 ring-[#C9A84C]' : 'border-[#EDE6D6]'}`}>
                      <input type="radio" name="home-round" checked={bulkTarget === round.id} onChange={() => setBulkTarget(round.id)} />
                      <div>
                        <div className="font-bold text-sm">{round.purpose || 'מערך ביקורי בית'}</div>
                        <div className="text-[11px] text-gray-400">{round.entries.length} אנשים במערך</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {bulkAction === 'attendance' && (
                <>
                  <label className="block text-xs font-bold text-gray-600 mb-2">תאריך הנוכחות</label>
                  <input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="w-full bg-white border border-[#EDE6D6] rounded-xl p-2.5 text-sm mb-3" />
                  <div className="space-y-2">
                    {eventsData.filter(e => e.name.includes(bulkSearch.trim())).map(activity => (
                      <label key={activity.id} className={`flex items-center gap-3 bg-white border rounded-xl p-3 cursor-pointer ${bulkTarget === activity.id ? 'border-[#C9A84C] ring-1 ring-[#C9A84C]' : 'border-[#EDE6D6]'}`}>
                        <input type="radio" name="attendance-activity" checked={bulkTarget === activity.id} onChange={() => setBulkTarget(activity.id)} />
                        <div>
                          <div className="font-bold text-sm">{activity.name}</div>
                          <div className="text-[11px] text-gray-400">{activity.activityKind === 'recurring' ? 'פעילות קבועה' : 'פעילות מיוחדת'}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-[#EDE6D6] bg-white rounded-b-3xl flex gap-2 shrink-0">
              <button onClick={closeBulkDialog} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold">ביטול</button>
              <button disabled={bulkSaving || !bulkTarget} onClick={runBulkAction} className="flex-[2] py-3 rounded-xl bg-[#C9A84C] text-[#0D1B2A] font-bold disabled:opacity-40">
                {bulkSaving ? 'שומר...' : bulkAction === 'merge' ? `מזג ${selectedNames.size} אנשי קשר` : bulkAction === 'home' ? 'הוסף למערך' : 'שמור נוכחות'}
              </button>
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
