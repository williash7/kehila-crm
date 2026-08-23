import React, { useState } from 'react';
import { EmptyState } from './EmptyState';
import { useAppStore } from '../store/AppContext';
import { Plus, Check, X, ClipboardList, Trash2, Pencil, Clock, Archive, ChevronDown, Mic2, Star, Wallet } from 'lucide-react';
import { FullScreenView } from './FullScreenView';
import { format } from 'date-fns';
import { createInviteTask, toggleInvitePerson, inviteRemainingMinutes, MINUTES_PER_CALL, nextEventOccurrence, formatRemaining, createEventMediaTasks, stampCreated } from '../lib/tasks';
import { logAction } from '../lib/score';
import { slashDateToDotDate } from '../lib/dateUtils';
import { findLatestHistoryFor } from '../lib/history';
import { AIPlanningAssistant } from './AIPlanningAssistant';
import { FacebookPostAssistant } from './FacebookPostAssistant';
import { TaskDetailsPanel } from './TaskDetailsPanel';
import { CompletionFollowUpModal } from './CompletionFollowUpModal';
import { emptyPerformer, Performer } from '../lib/events';
import { BudgetEditor, emptyBudget } from './BudgetEditor';
import { ACTIVITY_KIND_LABEL, ActivityKind, ActivityParticipant, activityDonations, activityPurposeTags, activityReadiness, normalizeActivity, normalizePurposeTags } from '../lib/activities';
import { projectPurposeTags } from '../lib/projects';
import { PurposeTagsEditor } from './PurposeTagsEditor';

export function EventsTab({ addTrigger }: { addTrigger?: { tab: string; count: number } } = {}) {
  const { eventsData, updateEventsData, visibleDonors, crm, hk, failures, settings, refresh, history, archiveOccurrence, importTasksFromHistory, donations, projects } = useAppStore();
  const [filter, setFilter] = useState('all');
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [attEventId, setAttEventId] = useState<string | null>(null);
  const [tasksEventId, setTasksEventId] = useState<string | null>(null);
  // תקציב האירוע: הוצאות והכנסות של ההתכנסות הזו בלבד. גיוס מאורגן מול יעד
  // ורשימת התרמה הוא פרויקט — ראה lib/holidayEvents.ts.
  const [budgetEventId, setBudgetEventId] = useState<string | null>(null);
  const [taskText, setTaskText] = useState('');
  const [taskDate, setTaskDate] = useState('');
  const [taskTime, setTaskTime] = useState('');
  const [performersEventId, setPerformersEventId] = useState<string | null>(null);
  const [perfDraft, setPerfDraft] = useState<Performer>(emptyPerformer());
  const [editingPerformerId, setEditingPerformerId] = useState<string | null>(null);
  const [completionPrompt, setCompletionPrompt] = useState<{ label: string; eventId: string } | null>(null);
  const [attListOpenId, setAttListOpenId] = useState<string | null>(null);

  const [evName, setEvName] = useState('');
  const [evType, setEvType] = useState('shabbat');
  const [evFreq, setEvFreq] = useState('weekly');
  const [evDate, setEvDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [evTime, setEvTime] = useState('');
  const [evActivityKind, setEvActivityKind] = useState<ActivityKind>('recurring');
  const [evLocation, setEvLocation] = useState('');
  const [evPurposeTags, setEvPurposeTags] = useState<string[]>([]);
  const [evEntryPrice, setEvEntryPrice] = useState('');

  React.useEffect(() => {
    if (addTrigger?.tab === 'events' && addTrigger.count) {
      resetEventForm();
      setEditingEventId(null);
      setIsAddingMode(true);
    }
  }, [addTrigger]);

  const [attSearch, setAttSearch] = useState('');
  const [attCategory, setAttCategory] = useState('all');
  const [pendingParticipants, setPendingParticipants] = useState<Record<string, ActivityParticipant>>({});
  const [attDateISO, setAttDateISO] = useState(() => new Date().toISOString().split('T')[0]);

  const typeIcons: Record<string, string> = { shabbat: '🕯️', minyan: '🙏', class: '📚', other: '📌' };
  const typeLabels: Record<string, string> = { shabbat: 'שבת', minyan: 'מניין', class: 'שיעור', other: 'אחר' };
  const freqLabels: Record<string, string> = { weekly: 'שבועי', biweekly: 'דו-שבועי', monthly: 'חודשי', oneoff: 'חד-פעמי' };

  const activeEvents = filter === 'all' ? eventsData : eventsData.filter((e: any) => e.activityKind === filter);

  const resetEventForm = () => {
    setEvName('');
    setEvType('shabbat');
    setEvFreq('weekly');
    setEvDate(new Date().toISOString().split('T')[0]);
    setEvTime('');
    setEvActivityKind('recurring');
    setEvLocation('');
    setEvPurposeTags([]);
    setEvEntryPrice('');
  };

  const openAddModal = () => {
    resetEventForm();
    setEditingEventId(null);
    setIsAddingMode(true);
  };

  const openEditModal = (ev: any) => {
    setEvName(ev.name || '');
    setEvType(ev.type || 'shabbat');
    setEvFreq(ev.freq || 'weekly');
    setEvDate(ev.date || new Date().toISOString().split('T')[0]);
    setEvTime(ev.time || '');
    setEvActivityKind(ev.activityKind || (ev.holidayId ? 'holiday' : ev.freq === 'oneoff' ? 'special' : 'recurring'));
    setEvLocation(ev.location || '');
    setEvPurposeTags(activityPurposeTags(ev));
    setEvEntryPrice(ev.entryPrice ? String(ev.entryPrice) : '');
    setEditingEventId(ev.id);
    setIsAddingMode(true);
  };

  const saveEvent = () => {
    if (!evName.trim()) return;
    const purposeTags = normalizePurposeTags(evPurposeTags, evName.trim());
    if (editingEventId) {
      updateEventsData(eventsData.map((e: any) => e.id === editingEventId ? {
        ...e,
        name: evName.trim(),
        type: evType,
        activityKind: evActivityKind,
        freq: evActivityKind === 'recurring' ? evFreq : 'oneoff',
        date: evDate,
        time: evTime,
        location: evLocation.trim(),
        purposeTag: purposeTags[0],
        purposeTags,
        entryPrice: Number(evEntryPrice) || 0,
      } : e));
      logAction('event_edit');
    } else {
      const effectiveFreq = evActivityKind === 'recurring' ? evFreq : 'oneoff';
      const occ = nextEventOccurrence({ date: evDate, freq: effectiveFreq, time: evTime }, new Date());
      const newEv = normalizeActivity({
        id: `ev_${Date.now()}`,
        name: evName.trim(),
        type: evType,
        activityKind: evActivityKind,
        freq: effectiveFreq,
        date: evDate,
        time: evTime,
        attendance: {},
        tasks: createEventMediaTasks(occ ? occ.toISOString().split('T')[0] : undefined),
        performers: [],
        budget: emptyBudget(),
        location: evLocation.trim(),
        purposeTag: purposeTags[0],
        purposeTags,
        entryPrice: Number(evEntryPrice) || 0,
      });
      updateEventsData([...eventsData, newEv]);
      logAction('event_create');
      logAction('task_create', createEventMediaTasks().length);
    }
    setIsAddingMode(false);
    setEditingEventId(null);
    resetEventForm();
  };

  const deleteEvent = (ev: any) => {
    if (!confirm(`למחוק את "${ev.name}"? כל היסטוריית הנוכחות והמשימות של הפעילות תימחק לצמיתות.`)) return;
    updateEventsData(eventsData.filter((e: any) => e.id !== ev.id));
  };

  const loadParticipantsForDate = (ev: any, dateKey: string) => {
    const attendance = { ...(ev?.attendance?.[dateKey] || {}) };
    const detailed: Record<string, ActivityParticipant> = { ...(ev?.participants?.[dateKey] || {}) };
    Object.entries(attendance).forEach(([name, present]) => {
      if (present && !detailed[name]) detailed[name] = { attended: true };
    });
    setPendingParticipants(detailed);
  };

  const openAttModal = (ev: any) => {
    const iso = new Date().toISOString().split('T')[0];
    setAttDateISO(iso);
    const dateKey = format(new Date(iso), 'dd/MM/yyyy');
    loadParticipantsForDate(ev, dateKey);
    setAttEventId(ev.id);
    setAttSearch('');
  };

  // פותח את מודל הנוכחות ישירות על תאריך קיים לעריכה (במקום תמיד היום) —
  // לשימוש מרשימת "כל המפגשים" בכרטיס האירוע.
  const openAttModalForDate = (ev: any, dateKey: string) => {
    const [d, m, y] = dateKey.split('/');
    setAttDateISO(`${y}-${m}-${d}`);
    loadParticipantsForDate(ev, dateKey);
    setAttEventId(ev.id);
    setAttSearch('');
  };

  const changeAttDate = (iso: string) => {
    setAttDateISO(iso);
    const dateKey = format(new Date(iso), 'dd/MM/yyyy');
    loadParticipantsForDate(currentAttEvent, dateKey);
  };

  const patchParticipant = (name: string, patch: Partial<ActivityParticipant>) => {
    setPendingParticipants(prev => ({
      ...prev,
      [name]: { ...(prev[name] || {}), ...patch },
    }));
  };

  const saveAttendance = async () => {
    if (!attEventId) return;
    const ev = eventsData.find((e: any) => e.id === attEventId);
    const dateKey = format(new Date(attDateISO), 'dd/MM/yyyy');
    const prevAtt = ev?.attendance?.[dateKey] || {};
    // מי סומן "נוכח" כרגע ולא היה מסומן קודם עבור אותו תאריך — רק עבורם
    // נרשום רשומת "יצירת קשר" חדשה, כדי לא ליצור כפילויות בשמירות חוזרות.
    const attendanceNow = Object.fromEntries(
      Object.entries(pendingParticipants).map(([name, row]) => [name, !!(row as ActivityParticipant).attended])
    );
    const newlyPresent = Object.keys(attendanceNow).filter(name => attendanceNow[name] && !prevAtt[name]);

    const updated = eventsData.map((e: any) => {
      if (e.id === attEventId) {
        return {
          ...e,
          attendance: {
            ...e.attendance,
            [dateKey]: attendanceNow
          },
          participants: {
            ...e.participants,
            [dateKey]: pendingParticipants,
          }
        };
      }
      return e;
    });
    updateEventsData(updated);
    logAction('attendance');
    setAttEventId(null);

    if (newlyPresent.length > 0 && ev) {
      try {
        const { apiPost } = await import('../lib/api');
        const results = await Promise.all(newlyPresent.map(name =>
          apiPost('addMeeting', {
            name,
            date: slashDateToDotDate(dateKey),
            meetType: 'נוכחות בפעילות',
            purpose: ev.name || '',
            notes: `נוכחות בפעילות: ${ev.name || ''}`,
            nextMeet: ''
          }).then(res => ({ name, res }))
        ));
        // apiPost תמיד "מצליח" מבחינת ה-Promise (הוא בולע שגיאות רשת
        // בעצמו) — לכן חובה לבדוק את res.error בפועל, אחרת כשל בשמירה
        // בשרת פשוט לא נראה בכלל.
        const failed = results.filter(r => r.res?.error);
        if (failed.length > 0) {
          console.error('addMeeting failed for:', failed);
          alert(`הנוכחות נשמרה, אך רישום יצירת קשר נכשל עבור: ${failed.map(f => f.name).join(', ')}`);
        }
        refresh();
      } catch (err) {
        console.error('Error logging attendance as contact:', err);
      }
    }
  };

  const currentAttEvent = eventsData.find((e: any) => e.id === attEventId);
  const currentTasksEvent = eventsData.find((e: any) => e.id === tasksEventId);
  const currentBudgetEvent = eventsData.find((e: any) => e.id === budgetEventId);

  const toggleEventTask = (idx: number) => {
    if (!currentTasksEvent) return;
    const nextTasks = [...(currentTasksEvent.tasks || [])];
    const wasDone = nextTasks[idx].done;
    nextTasks[idx] = { ...nextTasks[idx], done: !nextTasks[idx].done, ...(wasDone ? {} : { doneAt: new Date().toISOString() }) };
    updateEventsData(eventsData.map((e: any) => e.id === tasksEventId ? { ...e, tasks: nextTasks } : e));
    if (!wasDone) {
      logAction('task_complete');
      setCompletionPrompt({ label: nextTasks[idx].text, eventId: tasksEventId! });
    }
  };

  const addEventTask = () => {
    if (!taskText.trim() || !currentTasksEvent) return;
    const newTask: any = stampCreated({ text: taskText.trim(), done: false });
    if (taskDate) newTask.dueDate = taskDate;
    if (taskTime) newTask.time = taskTime;
    const nextTasks = [...(currentTasksEvent.tasks || []), newTask];
    updateEventsData(eventsData.map((e: any) => e.id === tasksEventId ? { ...e, tasks: nextTasks } : e));
    logAction('task_create');
    setTaskText('');
    setTaskDate('');
    setTaskTime('');
  };

  const deleteEventTask = (idx: number) => {
    if (!currentTasksEvent) return;
    const nextTasks = [...(currentTasksEvent.tasks || [])];
    nextTasks.splice(idx, 1);
    updateEventsData(eventsData.map((e: any) => e.id === tasksEventId ? { ...e, tasks: nextTasks } : e));
  };

  const patchEventTask = (idx: number, patch: Partial<any>) => {
    if (!currentTasksEvent) return;
    const nextTasks = [...(currentTasksEvent.tasks || [])];
    nextTasks[idx] = { ...nextTasks[idx], ...patch };
    updateEventsData(eventsData.map((e: any) => e.id === tasksEventId ? { ...e, tasks: nextTasks } : e));
  };

  const toggleEventInvitePerson = (idx: number, person: string) => {
    if (!currentTasksEvent) return;
    const wasDone = (currentTasksEvent.tasks?.[idx]?.doneNames || []).includes(person);
    const nextTasks = [...(currentTasksEvent.tasks || [])];
    nextTasks[idx] = toggleInvitePerson(nextTasks[idx], person);
    updateEventsData(eventsData.map((e: any) => e.id === tasksEventId ? { ...e, tasks: nextTasks } : e));
    if (!wasDone) logAction('invite_done');
  };

  const addEventInviteTask = () => {
    if (!currentTasksEvent || donorNames.length === 0) return;
    const nextTasks = [...(currentTasksEvent.tasks || []), createInviteTask(currentTasksEvent.name, donorNames)];
    updateEventsData(eventsData.map((e: any) => e.id === tasksEventId ? { ...e, tasks: nextTasks } : e));
    logAction('task_create');
  };

  const hasMediaTasks = (ev: any) => {
    const mediaTexts = createEventMediaTasks().map(t => t.text);
    return (ev?.tasks || []).some((t: any) => mediaTexts.includes(t.text));
  };

  const addEventMediaTasks = () => {
    if (!currentTasksEvent || hasMediaTasks(currentTasksEvent)) return;
    const occ = nextEventOccurrence(currentTasksEvent, new Date());
    const newTasks = createEventMediaTasks(occ ? occ.toISOString().split('T')[0] : undefined);
    const nextTasks = [...(currentTasksEvent.tasks || []), ...newTasks];
    updateEventsData(eventsData.map((e: any) => e.id === tasksEventId ? { ...e, tasks: nextTasks } : e));
    logAction('task_create', newTasks.length);
  };

  const currentPerformersEvent = eventsData.find((e: any) => e.id === performersEventId);

  const openPerformersModal = (ev: any) => {
    setPerformersEventId(ev.id);
    setEditingPerformerId(null);
    setPerfDraft(emptyPerformer());
  };

  const savePerformerDraft = () => {
    if (!perfDraft.name.trim() || !currentPerformersEvent) return;
    const cleaned: Performer = { ...perfDraft, name: perfDraft.name.trim() };
    const existing: Performer[] = currentPerformersEvent.performers || [];
    const nextPerformers = editingPerformerId
      ? existing.map(p => p.id === editingPerformerId ? cleaned : p)
      : [...existing, cleaned];
    updateEventsData(eventsData.map((e: any) => e.id === performersEventId ? { ...e, performers: nextPerformers } : e));
    setEditingPerformerId(null);
    setPerfDraft(emptyPerformer());
  };

  const editPerformer = (p: Performer) => {
    setEditingPerformerId(p.id);
    setPerfDraft(p);
  };

  const deletePerformer = (id: string) => {
    if (!currentPerformersEvent) return;
    const nextPerformers = (currentPerformersEvent.performers || []).filter((p: Performer) => p.id !== id);
    updateEventsData(eventsData.map((e: any) => e.id === performersEventId ? { ...e, performers: nextPerformers } : e));
    if (editingPerformerId === id) {
      setEditingPerformerId(null);
      setPerfDraft(emptyPerformer());
    }
  };

  const donorNames = Object.keys(visibleDonors).filter(n => {
    if (attSearch && !n.includes(attSearch)) return false;
    if (attCategory !== 'all') {
      const cData = crm[n] || {};
      if (attCategory === 'target' && !cData.target) return false;
      if (attCategory === 'hk') {
        const hasHk = hk.some((h: any) => h.name === n && h.active);
        if (!hasHk) return false;
      }
      if (attCategory === 'errors') {
        const hasError = failures.some((f: any) => f.name === n);
        if (!hasError) return false;
      }
      if (['close', 'approach', 'third', 'far'].includes(attCategory) && cData.circle !== attCategory) return false;
    }
    return true;
  }).sort();

  return (
    <div className="animate-in fade-in pb-24">
      <div className="bg-[#0D1B2A] px-4 py-3 pb-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="w-9 h-9 bg-gradient-to-br from-[#C9A84C] to-[#9B7A2F] rounded-lg flex items-center justify-center font-['Frank_Ruhl_Libre'] text-xl text-white font-black shrink-0">ח</div>
        <div className="flex-1 px-3">
          <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#C9A84C]">פעילויות</div>
          <div className="text-[11px] text-white/45 mt-[1px]">קבועות, מיוחדות ופעילויות חג · {activeEvents.length}</div>
        </div>
        <button onClick={openAddModal} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white/80 shrink-0">
          <Plus size={20} />
        </button>
      </div>

      <div className="p-4">
        {/* Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 custom-scrollbar">
           <button onClick={() => setFilter('all')} className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === 'all' ? 'bg-[#0D1B2A] text-[#C9A84C]' : 'bg-white text-gray-500 border border-[#EDE6D6]'}`}>הכל</button>
           <button onClick={() => setFilter('recurring')} className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === 'recurring' ? 'bg-[#0D1B2A] text-[#C9A84C]' : 'bg-white text-gray-500 border border-[#EDE6D6]'}`}>🔁 קבועות</button>
           <button onClick={() => setFilter('special')} className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === 'special' ? 'bg-[#0D1B2A] text-[#C9A84C]' : 'bg-white text-gray-500 border border-[#EDE6D6]'}`}>✨ מיוחדות</button>
           <button onClick={() => setFilter('holiday')} className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === 'holiday' ? 'bg-[#0D1B2A] text-[#C9A84C]' : 'bg-white text-gray-500 border border-[#EDE6D6]'}`}>🕯️ חגים</button>
        </div>

        <div className="space-y-3">
          {activeEvents.map((ev: any) => {
            const attDates = Object.keys(ev.attendance || {}).sort((a,b) => {
              const [d1,m1,y1] = a.split('/');
              const [d2,m2,y2] = b.split('/');
              return new Date(`${y2}-${m2}-${d2}`).getTime() - new Date(`${y1}-${m1}-${d1}`).getTime();
            });
            const lastDate = attDates[0];
            const lastCount = lastDate ? Object.values(ev.attendance[lastDate]).filter(Boolean).length : 0;
            const lastNames = lastDate ? Object.entries(ev.attendance[lastDate]).filter(e => e[1]).slice(0, 8).map(e => e[0].split(' ')[0]) : [];
            const nextOcc = nextEventOccurrence(ev, new Date());
            const linkedCampaigns = projects.filter(p => (p.activityIds || []).includes(ev.id));
            const linkedIncome = activityDonations(ev, donations, linkedCampaigns.flatMap(projectPurposeTags)).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
            const readiness = activityReadiness(ev);

            return (
              <div key={ev.id} className="bg-white rounded-xl shadow-sm border border-[#EDE6D6] overflow-hidden">
                 <div className="p-3.5 border-b border-[#EDE6D6] sm:flex sm:items-start sm:justify-between sm:gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-11 h-11 bg-gray-50 rounded-full flex items-center justify-center text-xl shrink-0 opacity-80">{typeIcons[ev.type] || '📌'}</div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[#0D1B2A] text-[15px] leading-snug break-words">{ev.name}</div>
                        <div className="text-[11px] text-gray-500">{ACTIVITY_KIND_LABEL[ev.activityKind as ActivityKind]} · {freqLabels[ev.freq] || ev.freq} {ev.time && `· ${ev.time}`}</div>
                        {(ev.location || ev.holidayId) && <div className="text-[10px] text-gray-400 mt-0.5">{ev.holidayId ? `חג: ${ev.holidayId}` : ''}{ev.holidayId && ev.location ? ' · ' : ''}{ev.location ? `📍 ${ev.location}` : ''}</div>}
                        {nextOcc && (
                          <div className="text-[10px] text-[#9B7A2F] flex items-center gap-1 mt-0.5"><Clock size={10}/> {formatRemaining(nextOcc, new Date())} למפגש הבא</div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-0 sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:max-w-[65%] shrink-0">
                      <button
                        onClick={() => setBudgetEventId(ev.id)}
                        className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-2 rounded-lg active:scale-95 transition-transform flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <Wallet size={14} /> תקציב
                      </button>
                      <button
                        onClick={() => {
                          setTasksEventId(ev.id);
                          setAttCategory('all');
                          setAttSearch('');
                          // משימת אירוע מקבלת אוטומטית את תאריך המפגש הקרוב של האירוע,
                          // אלא אם המשתמש יבחר תאריך אחר בעצמו בטופס.
                          setTaskDate(nextOcc ? nextOcc.toISOString().split('T')[0] : '');
                          setTaskTime('');
                        }}
                        className="relative bg-purple-50 text-purple-700 text-xs font-bold px-3 py-2 rounded-lg active:scale-95 transition-transform flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <ClipboardList size={14}/> משימות
                        {(ev.tasks || []).some((t: any) => !t.done) && (
                          <span className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-[#C9A84C] text-[#0D1B2A] rounded-full text-[9px] font-bold flex items-center justify-center">
                            {(ev.tasks || []).filter((t: any) => !t.done).length}
                          </span>
                        )}
                      </button>
                      <button onClick={() => openAttModal(ev)} className="bg-[#C9A84C]/10 text-[#9B7A2F] text-xs font-bold px-3 py-2 rounded-lg active:scale-95 transition-transform flex items-center justify-center gap-1.5 whitespace-nowrap">
                         <Check size={14}/> נוכחות
                      </button>
                      <button onClick={() => openPerformersModal(ev)} className="relative bg-pink-50 text-pink-700 text-xs font-bold px-3 py-2 rounded-lg active:scale-95 transition-transform flex items-center justify-center gap-1.5 whitespace-nowrap">
                         <Mic2 size={14}/> אמנים
                         {(ev.performers || []).length > 0 && (
                           <span className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-[#C9A84C] text-[#0D1B2A] rounded-full text-[9px] font-bold flex items-center justify-center">
                             {ev.performers.length}
                           </span>
                         )}
                      </button>
                      <div className="col-span-2 flex justify-end gap-1.5 sm:contents">
                        <button onClick={() => openEditModal(ev)} title="עריכת פעילות" aria-label={`עריכת ${ev.name}`} className="bg-gray-50 text-gray-500 p-2 rounded-lg active:scale-95 transition-transform shrink-0">
                           <Pencil size={14}/>
                        </button>
                        <button onClick={() => deleteEvent(ev)} title="מחיקת פעילות" aria-label={`מחיקת ${ev.name}`} className="bg-red-50 text-red-400 p-2 rounded-lg active:scale-95 transition-transform shrink-0">
                           <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>
                 </div>

                 <div className="bg-[#FAF6EE] p-2.5 flex justify-around">
                   <div className="text-center">
                     <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] leading-tight">{attDates.length}</div>
                     <div className="text-[10px] text-gray-500 uppercase tracking-wide">מפגשים</div>
                   </div>
                   <div className="w-px bg-[#EDE6D6]"></div>
                   <div className="text-center">
                     <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] leading-tight">{lastCount || '—'}</div>
                     <div className="text-[10px] text-gray-500 uppercase tracking-wide">אחרון</div>
                   </div>
                   <div className="w-px bg-[#EDE6D6]"></div>
                   <div className="text-center">
                     <div className="text-[13px] font-bold text-[#0D1B2A] leading-tight mt-1">{readiness.percent}%</div>
                     <div className="text-[10px] text-gray-500 uppercase tracking-wide">מוכנות</div>
                   </div>
                   <div className="w-px bg-[#EDE6D6]"></div>
                   <div className="text-center">
                     <div className="text-[13px] font-bold text-[#0D1B2A] leading-tight mt-1">{linkedIncome ? `₪${linkedIncome.toLocaleString()}` : '—'}</div>
                     <div className="text-[10px] text-gray-500 uppercase tracking-wide">הכנסות מקושרות</div>
                   </div>
                 </div>

                 {lastNames.length > 0 && (
                   <div className="p-3 border-t border-[#EDE6D6]">
                     <div className="text-[10px] text-gray-500 mb-1.5">נוכחים אחרונים ({lastDate}):</div>
                     <div className="flex flex-wrap gap-1.5">
                       {lastNames.map((n, i) => <span key={i} className="bg-[#0D1B2A] text-[#E8C97A] text-[10px] font-bold px-2.5 py-0.5 rounded-full">{n}</span>)}
                     </div>
                   </div>
                 )}

                 {attDates.length > 0 && (
                   <div className="border-t border-[#EDE6D6]">
                     <button
                       onClick={() => setAttListOpenId(attListOpenId === ev.id ? null : ev.id)}
                       className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold text-[#9B7A2F]"
                     >
                       <span>כל המפגשים ({attDates.length}) — לעריכת נוכחות</span>
                       <ChevronDown size={13} className={`transition-transform ${attListOpenId === ev.id ? 'rotate-180' : ''}`} />
                     </button>
                     {attListOpenId === ev.id && (
                       <div className="divide-y divide-[#EDE6D6] border-t border-[#EDE6D6]">
                         {attDates.map(dateKey => {
                           const count = Object.values(ev.attendance[dateKey]).filter(Boolean).length;
                           return (
                             <button
                               key={dateKey}
                               onClick={() => openAttModalForDate(ev, dateKey)}
                               className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-[#FAF6EE] transition-colors"
                             >
                               <span className="text-[#0D1B2A]"><span className="font-bold">{count}</span> נוכחים</span>
                               <span className="flex items-center gap-1.5 text-[#9B7A2F] font-medium">{dateKey} <Pencil size={11} /></span>
                             </button>
                           );
                         })}
                       </div>
                     )}
                   </div>
                 )}
              </div>
            );
          })}
          {activeEvents.length === 0 && (
            <EmptyState
              icon="📌"
              title="עוד אין פעילויות"
              hint="כאן מנהלים שיעור קבוע, אירוע מיוחד או פעילות ששייכת לחג."
              action={
                <button
                  onClick={() => setIsAddingMode(true)}
                  className="bg-[#0D1B2A] text-[#E8C97A] text-sm font-bold px-4 py-2 rounded-xl"
                >
                  + הוסף פעילות ראשונה
                </button>
              }
            />
          )}
        </div>
      </div>

      {/* Add/Edit Event Modal */}
      {isAddingMode && (
        <FullScreenView
          eyebrow="פעילות"
          title={editingEventId ? 'עריכת פעילות' : 'הוספת פעילות'}
          backLabel="פעילויות"
          onClose={() => setIsAddingMode(false)}
        >
           <>
             
             <div className="space-y-4">
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">שם הפעילות</label>
                 <input value={evName} onChange={e => setEvName(e.target.value)} type="text" className="w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C]" placeholder="למשל: שיעור תניא או סיור סליחות" />
               </div>
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">מסגרת הפעילות</label>
                 <div className={`grid gap-2 ${evActivityKind === 'holiday' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                   {(evActivityKind === 'holiday' ? ['holiday' as ActivityKind] : ['recurring', 'special'] as ActivityKind[]).map(kind => (
                     <button key={kind} type="button" onClick={() => setEvActivityKind(kind)} className={`py-2 text-xs font-bold rounded-xl border ${evActivityKind === kind ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]' : 'bg-white text-gray-500 border-[#EDE6D6]'}`}>
                       {ACTIVITY_KIND_LABEL[kind]}
                     </button>
                   ))}
                 </div>
                 <div className="text-[10px] text-gray-400 mt-1.5">פעילות חג חדשה מוסיפים מתוך החג עצמו, וכך היא נשמרת במעטפת הנכונה.</div>
               </div>
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">תוכן הפעילות</label>
                 <div className="grid grid-cols-2 gap-2">
                   {Object.keys(typeLabels).map(t => (
                     <button key={t} onClick={() => setEvType(t)} className={`py-2 text-sm font-bold rounded-xl border ${evType === t ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]' : 'bg-white text-gray-500 border-[#EDE6D6]'}`}>
                       {typeIcons[t]} {typeLabels[t]}
                     </button>
                   ))}
                 </div>
               </div>
               {evActivityKind === 'recurring' && <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">תדירות</label>
                 <select value={evFreq} onChange={e => setEvFreq(e.target.value)} className="w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm font-bold text-gray-700 outline-none focus:border-[#C9A84C]">
                   {Object.keys(freqLabels).filter(f => f !== 'oneoff').map(f => <option key={f} value={f}>{freqLabels[f]}</option>)}
                 </select>
               </div>}
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">תאריך בסיס</label>
                   <input value={evDate} onChange={e => setEvDate(e.target.value)} type="date" className="w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C]" />
                 </div>
                 <div>
                   <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">שעה</label>
                   <input value={evTime} onChange={e => setEvTime(e.target.value)} type="time" className="w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C]" />
                 </div>
               </div>
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">מקום</label>
                 <input value={evLocation} onChange={e => setEvLocation(e.target.value)} type="text" className="w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C]" placeholder="בית חב״ד, אולם, כתובת..." />
               </div>
               <details className="bg-white border border-[#EDE6D6] rounded-xl p-3">
                 <summary className="text-sm font-bold text-[#0D1B2A] cursor-pointer">כסף והרשמה — אופציונלי</summary>
                 <div className="mt-3 space-y-3">
                   <div>
                     <label className="block text-[10px] font-bold text-gray-500 mb-1">מחיר כניסה לאדם</label>
                     <input value={evEntryPrice} onChange={e => setEvEntryPrice(e.target.value)} type="number" min="0" className="w-full border border-[#EDE6D6] rounded-lg px-2.5 py-2 text-sm" placeholder="0" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-bold text-gray-500 mb-1.5">ייעודי תרומות אוטומטיים</label>
                     <PurposeTagsEditor values={evPurposeTags} onChange={setEvPurposeTags} placeholder={evName ? `למשל: ${evName}` : 'למשל: פסח'} />
                   </div>
                 </div>
                 <p className="text-[10px] text-gray-400 mt-2">תרומה נשארת רשומה פעם אחת ביומן הרגיל, גם אם הייעוד שלה מקשר אותה לפעילות.</p>
               </details>
               
               <button onClick={saveEvent} className="w-full bg-gradient-to-br from-[#0D1B2A] to-[#1A2E45] text-white rounded-xl py-3.5 font-bold shadow-md mt-2">
                 {editingEventId ? 'שמור שינויים' : 'שמור פעילות'}
               </button>
             </div>
           </>
        </FullScreenView>
      )}

      {/* Attendance Modal */}
      {attEventId && (
        <FullScreenView
          eyebrow="נוכחות"
          title={currentAttEvent?.name || 'נוכחות'}
          backLabel="פעילויות"
          onClose={() => setAttEventId(null)}
          footer={
            <button onClick={saveAttendance} className="w-full bg-gradient-to-br from-[#0D1B2A] to-[#1A2E45] text-white rounded-xl py-3.5 font-bold shadow-md">
              שמור מפגש ({Object.values(pendingParticipants).filter(row => (row as ActivityParticipant).attended).length} הגיעו)
            </button>
          }
        >
           <>
             <div className="bg-white rounded-xl border border-[#EDE6D6] p-3 mb-3">
               <div className="flex items-center gap-2">
                 <label className="text-xs text-gray-500 shrink-0">תאריך המפגש:</label>
                 <input
                   type="date"
                   value={attDateISO}
                   onChange={e => changeAttDate(e.target.value)}
                   className="bg-white border border-[#EDE6D6] rounded-lg px-2 py-1 text-xs outline-none focus:border-[#C9A84C]"
                 />
               </div>
               <div className="text-[10px] text-gray-400 mt-1">אפשר לבחור תאריך מהעבר כדי לעדכן נוכחות למפגש שכבר התקיים (למשל שיעור שבועי משבוע שעבר).</div>
             </div>

             <input
               type="text" 
               placeholder="חיפוש לפי שם..." 
               value={attSearch}
               onChange={e => setAttSearch(e.target.value)}
               className="w-full bg-white border border-[#EDE6D6] rounded-xl px-3.5 py-3 text-sm outline-none focus:border-[#C9A84C] mb-3 shadow-sm shrink-0"
             />

             <div className="flex gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar shrink-0">
               {[
                 { id: 'all', label: 'הכל' },
                 { id: 'close', label: '⭐ קרוב' },
                 { id: 'approach', label: '🔄 מתקרב' },
                 { id: 'third', label: '⭕ מ. שלישי' },
                 { id: 'target', label: '🎯 להקרב' },
                 { id: 'hk', label: 'הוק' },
                 { id: 'errors', label: 'שגיאות' }
               ].map(c => (
                 <button
                   key={c.id}
                   onClick={() => setAttCategory(c.id)}
                   className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium border-[1.5px] transition-colors ${
                     attCategory === c.id
                       ? 'bg-[#0D1B2A] border-[#0D1B2A] text-[#C9A84C]'
                       : 'bg-white border-[#EDE6D6] text-gray-500'
                   }`}
                 >
                   {c.label}
                 </button>
               ))}
             </div>

             <div className="space-y-2">
                {donorNames.map(n => {
                  const row = pendingParticipants[n] || {};
                  const isChecked = !!row.attended;
                  const isPaidActivity = Number(currentAttEvent?.entryPrice) > 0;
                  return (
                    <div key={n} className={`p-3 rounded-xl shadow-sm transition-colors border ${isChecked ? 'bg-[#D1FAE5] border-[#10B981]/50' : 'bg-white border-[#EDE6D6]'}`}>
                       <button type="button" onClick={() => patchParticipant(n, { attended: !isChecked })} className="w-full flex items-center gap-3 text-right">
                         <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0D1B2A] to-[#1A2E45] text-white flex items-center justify-center font-bold text-sm shrink-0">{n.charAt(0)}</div>
                         <div className="flex-1 font-bold text-[#0D1B2A]">{n}</div>
                         <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isChecked ? 'bg-[#10B981] border-[#10B981] text-white' : 'bg-white border-[#EDE6D6]'}`}>
                           {isChecked && <Check size={14} />}
                         </div>
                       </button>
                       {isPaidActivity && (
                         <div className="grid grid-cols-3 gap-1.5 mt-2 pt-2 border-t border-black/5">
                           {([
                             ['registered', 'נרשם'],
                             ['paid', 'שילם'],
                             ['owed', 'חייב'],
                           ] as const).map(([key, label]) => (
                             <button key={key} type="button" onClick={() => patchParticipant(n, { [key]: !row[key] })} className={`text-[10px] font-bold rounded-lg py-1.5 border ${row[key] ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]' : 'bg-white text-gray-500 border-[#EDE6D6]'}`}>
                               {label}
                             </button>
                           ))}
                         </div>
                       )}
                    </div>
                  );
                })}
             </div>

           </>
        </FullScreenView>
      )}

      {/* Tasks Modal */}
      {tasksEventId && currentTasksEvent && (
        <FullScreenView
          eyebrow="משימות"
          title={currentTasksEvent.name}
          backLabel="פעילויות"
          onClose={() => setTasksEventId(null)}
        >
           <>
             {(() => {
               const nextOcc = nextEventOccurrence(currentTasksEvent, new Date());
               return nextOcc ? (
                 <div className="text-[11px] text-[#9B7A2F] flex items-center gap-1 mb-3"><Clock size={11}/> {formatRemaining(nextOcc, new Date())} עד המפגש הבא — כדאי לסיים עד אז</div>
               ) : null;
             })()}

             <button
               onClick={() => {
                 if (!confirm(`להעביר את "${currentTasksEvent.name}" להיסטוריה? הנוכחות והמשימות הנוכחיות יישמרו בהיסטוריה ויתאפסו כדי להתחיל נקי בפעם הבאה (עם אפשרות לייבא משימות בחזרה).`)) return;
                 archiveOccurrence({ type: 'event', id: currentTasksEvent.id, name: currentTasksEvent.name });
               }}
               className="w-full flex items-center justify-center gap-1.5 bg-[#0D1B2A]/5 text-[#0D1B2A]/70 text-xs font-bold py-2 rounded-xl mb-3 shrink-0 hover:bg-[#0D1B2A]/10 transition-colors"
             >
               <Archive size={13} /> סמן מופע זה כהסתיים והעבר להיסטוריה
             </button>

             <div className="space-y-3">
             {(!currentTasksEvent.tasks || currentTasksEvent.tasks.length === 0) && findLatestHistoryFor(history, 'event', currentTasksEvent.name) && (
               <button
                 onClick={() => importTasksFromHistory({ type: 'event', id: currentTasksEvent.id, name: currentTasksEvent.name })}
                 className="w-full flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700 text-sm font-bold py-2.5 rounded-xl"
               >
                 <ClipboardList size={14} /> ייבא משימות מהפעם הקודמת
               </button>
             )}
             <div className="space-y-2">
               {(currentTasksEvent.tasks || []).length === 0 && (
                 <div className="text-sm text-gray-400 text-center bg-white rounded-xl p-4 border border-[#EDE6D6]">אין עדיין משימות לפעילות הזאת</div>
               )}
               {(currentTasksEvent.tasks || []).map((t: any, i: number) => (
                 t.kind === 'invite' ? (
                   <div key={i} className="bg-white rounded-xl p-3 shadow-sm">
                     <div className="flex items-center justify-between mb-2">
                       <span className={`text-sm font-bold ${t.done ? 'text-gray-400 line-through' : 'text-[#0D1B2A]'}`}>{t.text}</span>
                       <div className="flex items-center gap-2 shrink-0">
                         <span className="text-[10px] text-gray-400">נותרו ~{inviteRemainingMinutes(t)} דק'</span>
                         <button onClick={() => deleteEventTask(i)} className="text-red-300 hover:text-red-500" title="מחק משימה"><X size={14} /></button>
                       </div>
                     </div>
                     <div className="flex flex-wrap gap-1.5">
                       {(t.people || []).map((p: string) => {
                         const isDone = (t.doneNames || []).includes(p);
                         return (
                           <button
                             key={p}
                             onClick={() => toggleEventInvitePerson(i, p)}
                             className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${isDone ? 'bg-[#D1FAE5] border-[#10B981] text-[#065F46] line-through' : 'bg-[#FAF6EE] border-[#EDE6D6] text-[#0D1B2A]'}`}
                           >
                             {p}
                           </button>
                         );
                       })}
                     </div>
                     <TaskDetailsPanel task={t} onPatch={patch => patchEventTask(i, patch)} />
                   </div>
                 ) : (
                   <div key={i} className="bg-white rounded-xl p-3 shadow-sm">
                     <div className="flex items-center gap-3">
                       <div onClick={() => toggleEventTask(i)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 cursor-pointer ${t.done ? 'bg-[#C9A84C] border-[#C9A84C]' : 'border-gray-300'}`}>
                         {t.done && <Check size={12} className="text-white" />}
                       </div>
                       <span onClick={() => toggleEventTask(i)} className={`text-sm flex-1 cursor-pointer ${t.done ? 'text-gray-400 line-through' : 'text-[#0D1B2A]'}`}>{t.text}</span>
                       <button onClick={() => deleteEventTask(i)} className="text-red-300 hover:text-red-500 shrink-0" title="מחק משימה"><X size={14} /></button>
                     </div>
                     <TaskDetailsPanel task={t} onPatch={patch => patchEventTask(i, patch)} />
                   </div>
                 )
               ))}
             </div>

             <div className="flex gap-2 mb-2">
               <input value={taskText} onChange={e => setTaskText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEventTask()} type="text" className="flex-1 bg-white border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C]" placeholder="משימה חדשה..." />
               <button onClick={addEventTask} className="bg-[#0D1B2A] rounded-xl px-4 text-[#E8C97A] font-bold shadow-sm shrink-0">הוסף</button>
             </div>
             <div className="flex gap-2">
               <input value={taskDate} onChange={e => setTaskDate(e.target.value)} type="date" className="flex-1 bg-white border border-[#EDE6D6] rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C9A84C]" title="תאריך (לא חובה)" />
               <input value={taskTime} onChange={e => setTaskTime(e.target.value)} type="time" className="flex-1 bg-white border border-[#EDE6D6] rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C9A84C]" title="שעה (לא חובה)" />
             </div>

             {!hasMediaTasks(currentTasksEvent) && (
               <button
                 onClick={addEventMediaTasks}
                 className="w-full flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700 text-sm font-bold py-2.5 rounded-xl"
               >
                 📸 הוסף משימות צילום ופרסום (סטטוס + פייסבוק)
               </button>
             )}

             <div>
               <AIPlanningAssistant
                 title={currentTasksEvent.name}
                 contextLines={[
                   `מסגרת: ${ACTIVITY_KIND_LABEL[currentTasksEvent.activityKind as ActivityKind]}, תוכן: ${typeLabels[currentTasksEvent.type] || currentTasksEvent.type}, תדירות: ${freqLabels[currentTasksEvent.freq] || currentTasksEvent.freq}`,
                   currentTasksEvent.location ? `מקום: ${currentTasksEvent.location}` : '',
                   Number(currentTasksEvent.entryPrice) > 0 ? `מחיר כניסה: ₪${currentTasksEvent.entryPrice}` : '',
                   ...(currentTasksEvent.tasks?.length ? [`משימות שכבר קיימות: ${currentTasksEvent.tasks.map((t: any) => t.text).join(', ')}`] : []),
                 ]}
                 onApply={(result) => {
                   if (!result.tasks?.length) return;
                   const nextTasks = [...(currentTasksEvent.tasks || []), ...result.tasks.map(text => stampCreated({ text, done: false }))];
                   updateEventsData(eventsData.map((e: any) => e.id === tasksEventId ? { ...e, tasks: nextTasks } : e));
                   logAction('task_create', result.tasks.length);
                 }}
               />
               <FacebookPostAssistant
                 event={{
                   name: currentTasksEvent.name,
                   type: currentTasksEvent.type,
                   date: currentTasksEvent.date,
                   time: currentTasksEvent.time || '',
                   freq: currentTasksEvent.freq,
                 }}
                 fbPageId={settings.fbPageId}
                 fbAccessToken={settings.fbAccessToken}
               />
             </div>

             <div className="border-t border-dashed border-[#EDE6D6] pt-3">
               <div className="text-[11px] font-bold text-gray-500 uppercase mb-2">או צור משימת הזמנה (📞 {MINUTES_PER_CALL} דק׳ לאדם) לפי מעגל קרבה:</div>
               <div className="flex gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
                 {[
                   { id: 'all', label: 'הכל' },
                   { id: 'close', label: '⭐ קרוב' },
                   { id: 'approach', label: '🔄 מתקרב' },
                   { id: 'third', label: '⭕ מ. שלישי' },
                   { id: 'target', label: '🎯 להקרב' },
                 ].map(c => (
                   <button
                     key={c.id}
                     onClick={() => setAttCategory(c.id)}
                     className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium border-[1.5px] transition-colors ${
                       attCategory === c.id
                         ? 'bg-[#0D1B2A] border-[#0D1B2A] text-[#C9A84C]'
                         : 'bg-white border-[#EDE6D6] text-gray-500'
                     }`}
                   >
                     {c.label}
                   </button>
                 ))}
               </div>
               <button
                 onClick={addEventInviteTask}
                 disabled={donorNames.length === 0}
                 className="w-full flex items-center justify-center gap-1.5 bg-purple-50 text-purple-700 text-sm font-bold py-2.5 rounded-xl disabled:opacity-40"
               >
                 <ClipboardList size={14} /> הוסף משימת הזמנה ל-{donorNames.length} אנשים (≈{donorNames.length * MINUTES_PER_CALL} דק׳)
               </button>
             </div>
             </div>
           </>
        </FullScreenView>
      )}

      {/* Budget Modal */}
      {budgetEventId && currentBudgetEvent && (
        <FullScreenView
          eyebrow="תקציב הפעילות"
          title={currentBudgetEvent.name}
          backLabel="פעילויות"
          onClose={() => setBudgetEventId(null)}
        >
          <>
            <div>
              <BudgetEditor
                budget={currentBudgetEvent.budget || emptyBudget()}
                onChange={next => updateEventsData(eventsData.map((e: any) =>
                  e.id === budgetEventId ? { ...e, budget: next } : e))}
              />
            </div>
          </>
        </FullScreenView>
      )}

      {/* Performers Modal */}
      {performersEventId && currentPerformersEvent && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-end justify-center p-0 md:p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setPerformersEventId(null)}>
           <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl p-5 pb-8 w-full max-w-[430px] max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300">
             <div className="flex justify-between items-start mb-4">
               <h2 className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A] flex items-center gap-2">🎤 אמנים — {currentPerformersEvent.name}</h2>
               <button onClick={() => setPerformersEventId(null)} className="bg-gray-200/50 p-2 rounded-full text-gray-500 hover:bg-gray-200 shrink-0"><X size={16}/></button>
             </div>

             <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2 mb-4">
               {(currentPerformersEvent.performers || []).length === 0 && (
                 <div className="text-sm text-gray-400 text-center bg-white rounded-xl p-4 border border-[#EDE6D6]">אין עדיין אמנים לפעילות הזאת. אם לא הוזמן אמן, אפשר להשאיר ריק.</div>
               )}
               {(currentPerformersEvent.performers || []).map((p: Performer) => (
                 <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm border border-[#EDE6D6]">
                   <div className="flex items-center justify-between gap-2">
                     <div className="flex-1 min-w-0">
                       <div className="font-bold text-[#0D1B2A] text-sm">{p.name}</div>
                       <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500 mt-0.5">
                         {!!p.rating && (
                           <span className="flex items-center gap-0.5 text-[#C9A84C]">
                             {Array.from({ length: 5 }).map((_, i) => (
                               <Star key={i} size={11} fill={i < (p.rating || 0) ? 'currentColor' : 'none'} />
                             ))}
                           </span>
                         )}
                         {p.phone && <span>📞 {p.phone}</span>}
                         {p.price != null && <span>💰 {p.price}₪</span>}
                         {p.address && <span>📍 {p.address}</span>}
                       </div>
                       {p.notes && <div className="text-[11px] text-gray-500 mt-1">{p.notes}</div>}
                     </div>
                     <div className="flex items-center gap-1 shrink-0">
                       <button onClick={() => editPerformer(p)} className="text-gray-400 hover:text-[#0D1B2A] p-1"><Pencil size={13}/></button>
                       <button onClick={() => deletePerformer(p.id)} className="text-red-300 hover:text-red-500 p-1"><Trash2 size={13}/></button>
                     </div>
                   </div>
                 </div>
               ))}
             </div>

             <div className="border-t border-dashed border-[#EDE6D6] pt-3 space-y-2 shrink-0">
               <div className="text-[11px] font-bold text-gray-500 uppercase">{editingPerformerId ? 'עריכת אמן' : 'הוספת אמן'}</div>
               <input value={perfDraft.name} onChange={e => setPerfDraft({ ...perfDraft, name: e.target.value })} type="text" className="w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C]" placeholder="שם האמן" />
               <div className="flex items-center gap-1">
                 {Array.from({ length: 5 }).map((_, i) => (
                   <button key={i} onClick={() => setPerfDraft({ ...perfDraft, rating: perfDraft.rating === i + 1 ? undefined : i + 1 })} className="text-[#C9A84C]">
                     <Star size={20} fill={i < (perfDraft.rating || 0) ? 'currentColor' : 'none'} />
                   </button>
                 ))}
               </div>
               <div className="grid grid-cols-2 gap-2">
                 <input value={perfDraft.phone || ''} onChange={e => setPerfDraft({ ...perfDraft, phone: e.target.value })} type="text" className="w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C]" placeholder="טלפון" />
                 <input value={perfDraft.price ?? ''} onChange={e => setPerfDraft({ ...perfDraft, price: e.target.value ? Number(e.target.value) : undefined })} type="number" className="w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C]" placeholder="מחיר ₪" />
               </div>
               <input value={perfDraft.address || ''} onChange={e => setPerfDraft({ ...perfDraft, address: e.target.value })} type="text" className="w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C]" placeholder="כתובת" />
               <textarea value={perfDraft.notes || ''} onChange={e => setPerfDraft({ ...perfDraft, notes: e.target.value })} className="w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C] resize-none" rows={2} placeholder="הערות" />
               <div className="flex gap-2">
                 <button onClick={savePerformerDraft} className="flex-1 bg-[#0D1B2A] rounded-xl py-2.5 text-[#E8C97A] font-bold shadow-sm">{editingPerformerId ? 'שמור שינויים' : 'הוסף אמן'}</button>
                 {editingPerformerId && (
                   <button onClick={() => { setEditingPerformerId(null); setPerfDraft(emptyPerformer()); }} className="px-4 bg-gray-100 rounded-xl text-gray-500 font-bold">ביטול</button>
                 )}
               </div>
             </div>
           </div>
        </div>
      )}

      {completionPrompt && (
        <CompletionFollowUpModal
          sourceLabel={completionPrompt.label}
          onSkip={() => setCompletionPrompt(null)}
          onCreateFollowUp={(text, dueDate) => {
            const newTask: any = stampCreated({ text, done: false });
            if (dueDate) newTask.dueDate = dueDate;
            updateEventsData(eventsData.map((e: any) => e.id === completionPrompt.eventId ? { ...e, tasks: [...(e.tasks || []), newTask] } : e));
            logAction('task_create');
            setCompletionPrompt(null);
          }}
        />
      )}
    </div>
  );
}
