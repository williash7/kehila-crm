import React, { useState } from 'react';
import { useAppStore } from '../store/AppContext';
import { Check, ClipboardList, Calendar, CalendarCheck, Cake, X, ChevronLeft, Plus, Clock, ListTodo, SlidersHorizontal, ChevronDown, Home, Bot, Target } from 'lucide-react';
import { FullScreenView } from './FullScreenView';
import { GlobalAIImportModal } from './GlobalAIImportModal';
import { ProfileModal } from './ProfileModal';
import { HolidayModal } from './HolidayModal';
import { TaskDetailsPanel } from './TaskDetailsPanel';
import { TaskCalendarView } from './TaskCalendarView';
import { QuickLogButtons } from './QuickLogButtons';
import { CompletionFollowUpModal } from './CompletionFollowUpModal';
import { AIPlanningAssistant } from './AIPlanningAssistant';
import { computePersonalDateEvents } from '../lib/personalDates';
import { inviteRemainingMinutes, toggleInvitePerson, STANDALONE_TASKS_ID, PERSONAL_DATE_EXTRAS_ID, nextEventOccurrence, formatRemaining, stampCreated } from '../lib/tasks';
import { effectiveDate, compareTasks, priorityWeight, applyTaskTime, TaskSortKey } from '../lib/taskSort';
import { getCustomHols } from '../lib/api';
import { logAction } from '../lib/score';
import { OpenTargetProps, useRevealEntity } from '../lib/openTarget';
import { ExportButton } from './ExportButton';
import { TASK_COLUMNS } from '../lib/exportRows';

export function TasksTab({ setTab, addTrigger, openTarget, onOpenTargetConsumed }: {
  setTab: (t: string) => void;
  addTrigger?: { tab: string; count: number };
} & OpenTargetProps) {
  const { holidayExtras, updateHolidayExtras, eventsData, updateEventsData, projects, updateProjects, visibleDonors, crm, holidays, markHomeVisitDone, settings, homeVisits, updateHomeVisitRoundMeta } = useAppStore();
  const [selectedDonor, setSelectedDonor] = useState<string | null>(null);
  const [selectedHoliday, setSelectedHoliday] = useState<any | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<{ kind: 'holiday' | 'event' | 'campaign'; id: string } | null>(null);
  const [addText, setAddText] = useState('');
  const [addDate, setAddDate] = useState('');
  const [addTime, setAddTime] = useState('');
  const [standaloneText, setStandaloneText] = useState('');
  const [standaloneDue, setStandaloneDue] = useState('');
  const [standaloneTime, setStandaloneTime] = useState('');
  const [sortKey, setSortKey] = useState<TaskSortKey>('date');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat' | 'calendar'>(settings.defaultTaskView);
  const [calendarSelectedKey, setCalendarSelectedKey] = useState<string | null>(null);
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [isAIImportOpen, setIsAIImportOpen] = useState(false);
  type CompletionTarget = { kind: 'standalone' } | { kind: 'holiday'; id: string } | { kind: 'event'; id: string } | { kind: 'campaign'; id: string } | { kind: 'personal'; key: string };
  const [completionPrompt, setCompletionPrompt] = useState<{ label: string; target: CompletionTarget } | null>(null);
  // כיווץ קבוצות משימות (לפי חג/אירוע) בתצוגה "לפי קטגוריה" — פתוח כברירת
  // מחדל, נשמר רק ב-state המקומי (לא בין רענונים) כדי לא לסבך את מודל הנתונים.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  /**
   * המשימה שהגיעו אליה מהחיפוש.
   *
   * כל הרשימות מסננות `!t.done`, ולכן **משימה שכבר בוצעה אינה נבנית כלל** —
   * לא היא ולא הקבוצה שלה. חיפוש שלה היה מגיע למסך ריק ממנה, וההדגשה הייתה
   * מוותרת בשקט. המיקוד הוא חריג נקודתי: משימה אחת מוצגת גם אם בוצעה.
   */
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  /** האם פריט הוא היעד — ולכן מוצג גם כשהוא מסומן כבוצע. */
  const isFocused = (t: any) => !!focusTaskId && t?.id === focusTaskId;
  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  React.useEffect(() => {
    if (addTrigger?.tab === 'tasks' && addTrigger.count) setIsAddOpen(true);
  }, [addTrigger]);

  // ── הגעה מהחיפוש אל משימה מסוימת ──
  //
  // שני צעדים לפני הגלילה, ושניהם נחוצים:
  //
  // 1. **תצוגה מקובצת.** התצוגה השטוחה מציגה משימות פתוחות בלבד, ולכן חיפוש
  //    של משימה שכבר בוצעה היה מגיע למסך שבו היא כלל אינה מופיעה.
  // 2. **פתיחת הקבוצה.** קבוצה מכווצת מסתירה את המשימה מה-DOM, וההדגשה
  //    הייתה מוותרת בשקט — בדיוק אותה תקלה שתיקנּו בפעילויות עם המסנן.
  //
  // `parentId` אינו יודע אם ההורה הוא חג, פעילות או קמפיין, ולכן פותחים את
  // שלושת המפתחות האפשריים. פתיחת קבוצה שאינה רלוונטית אינה מזיקה.
  React.useEffect(() => {
    if (!openTarget?.id) return;
    setViewMode('grouped');

    // **המיקוד נשמר מקומית ולא נגזר מ-`openTarget`.**
    //
    // זו נקודה עדינה: היעד נצרך ברגע שההדגשה מסתיימת. אילו החריג „הצג גם
    // אם בוצעה” היה תלוי ישירות ב-`openTarget`, המשימה הייתה נעלמת מהמסך
    // באותו רגע — כלומר ההדגשה הייתה מהבהבת ונעלמת. המיקוד נשאר עד
    // שמגיע יעד אחר או שעוזבים את המסך.
    setFocusTaskId(openTarget.id);

    const parent = openTarget.parentId;
    if (parent) {
      setCollapsedGroups(prev => {
        const next = new Set(prev);
        // `parentId` אינו מסגיר אם ההורה הוא חג, פעילות או קמפיין, ולכן
        // פותחים את שלושת המפתחות. `hv-tasks` נוסף כי משימות ביקור בית
        // נשמרות תחת המזהה החד-פעמי ואינן תואמות לאף אחד מהשלושה.
        [`h-${parent}`, `e-${parent}`, `c-${parent}`, 'hv-tasks'].forEach(k => next.delete(k));
        return next;
      });
    }
  }, [openTarget?.id, openTarget?.count]);

  useRevealEntity(openTarget, !!openTarget?.id, onOpenTargetConsumed);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // פרטים נוספים (שעה/מקום/הערות/תתי-משימות/דחיפות) לתזכורות תאריכים אישיים —
  // keyed לפי PersonalDateEvent.key היציב, נשמר באותה טכניקת piggyback כמו
  // STANDALONE_TASKS_ID. dismissedFor (ISO של המופע שסומן "טופל") משמש
  // להעלים תזכורת מהרשימה עד המופע הבא (שנה הבאה), בלי לאבד את ה"פרטים
  // נוספים" הקיימים שלה.
  const personalDateExtras: Record<string, any> = holidayExtras[PERSONAL_DATE_EXTRAS_ID] || {};
  const patchPersonalDate = (key: string, patch: Partial<any>) => {
    updateHolidayExtras(PERSONAL_DATE_EXTRAS_ID, { [key]: { ...(personalDateExtras[key] || {}), ...patch } });
  };

  // "סוגר" תזכורת תאריך אישי למופע הנוכחי (dismissedFor) ופותח את דיאלוג
  // משימת ההמשך — ראה QuickLogButtons.personalDateContext.
  const dismissPersonalDate = (c: { key: string; name: string; msg: string; dist: number }) => {
    const occurrenceIso = new Date(today.getTime() + c.dist * 86400000).toISOString().split('T')[0];
    patchPersonalDate(c.key, { dismissedFor: occurrenceIso });
    setCompletionPrompt({ label: `${c.name} — ${c.msg}`, target: { kind: 'personal', key: c.key } });
  };

  const personalDates = React.useMemo(() => {
    const all = computePersonalDateEvents(visibleDonors, crm, today).filter(e => e.dist <= 30);
    return all.filter(e => {
      const dismissedFor = personalDateExtras[e.key]?.dismissedFor;
      if (!dismissedFor) return true;
      const occurrenceIso = new Date(today.getTime() + e.dist * 86400000).toISOString().split('T')[0];
      return dismissedFor !== occurrenceIso;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleDonors, crm, personalDateExtras]);
  const sortedPersonalDates = sortKey === 'priority'
    ? [...personalDates].sort((a, b) => priorityWeight(personalDateExtras[a.key] || {}) - priorityWeight(personalDateExtras[b.key] || {}))
    : personalDates;

  // מיפוי שם-חג → פרטי התאריך שלו (מה-API ומחגים מותאמים), כדי שאפשר יהיה
  // לפתוח את כרטיס החג המלא (HolidayModal) בלחיצה — אותה בנייה כמו בדשבורד.
  const holidayLookup = React.useMemo(() => {
    const map: Record<string, { name: string; dateStr: string; emoji: string }> = {};
    // ה-API מחזיר חגים על פני שנתיים, אז אותו שם חג עלול להופיע פעמיים
    // (השנה + השנה הבאה) — שומרים את המופע הקרוב ביותר להיום, לא האחרון שנסרק.
    holidays.forEach(h => {
      const dateStr = h.date?.split('T')[0];
      const name = h.hebrew || h.title;
      if (!dateStr || !name) return;
      const existing = map[name];
      if (!existing || Math.abs(new Date(dateStr).getTime() - today.getTime()) < Math.abs(new Date(existing.dateStr).getTime() - today.getTime())) {
        map[name] = { name, dateStr, emoji: '✡️' };
      }
    });
    getCustomHols().forEach((c: any) => { map[c.name] = { name: c.name, dateStr: c.date, emoji: '📅' }; });
    return map;
  }, [holidays]);

  // מציגים רק משימות פתוחות (לא בוצעו) — משימה שסומנה כבוצעה נעלמת מהמסך.
  // שומרים את האינדקס המקורי במערך (idx) לכל משימה, כדי שהכפתורים (סימון/מחיקה)
  // עדיין יפנו לפריט הנכון במערך המקורי גם אחרי הסינון.
  // מיון קבוצות (חג/אירוע) לפי התאריך שלהן (הקרוב קודם), ומיון המשימות בתוך כל
  // קבוצה לפי sortKey — 'date' (התאריך האפקטיבי) או 'priority' (רמת דחיפות).
  const sortByContextDate = <T extends { contextDate: Date | null }>(groups: T[]) =>
    [...groups].sort((a, b) => {
      if (a.contextDate && b.contextDate) return a.contextDate.getTime() - b.contextDate.getTime();
      if (a.contextDate) return -1;
      if (b.contextDate) return 1;
      return 0;
    });

  const holidayGroups = sortByContextDate(
    Object.keys(holidayExtras)
      .filter(id => id !== STANDALONE_TASKS_ID && id !== PERSONAL_DATE_EXTRAS_ID)
      .map(id => {
        const info = holidayLookup[id];
        const contextDate = info?.dateStr ? new Date(info.dateStr) : null;
        const allTasks = holidayExtras[id]?.tasks || [];
        const tasks = allTasks
          .map((t: any, idx: number) => ({ t, idx, date: effectiveDate(t, contextDate) }))
          .filter((x: any) => !x.t.done || isFocused(x.t))
          .sort((a: any, b: any) => compareTasks(a.t, b.t, sortKey, a.date, b.date));
        return { id, tasks, contextDate };
      })
  ).filter(g => g.tasks.length > 0);

  const eventGroups = sortByContextDate(
    (eventsData as any[]).map(e => {
      const contextDate = nextEventOccurrence(e, new Date());
      const allTasks = e.tasks || [];
      const tasks = allTasks
        .map((t: any, idx: number) => ({ t, idx, date: effectiveDate(t, contextDate) }))
        .filter((x: any) => !x.t.done || isFocused(x.t))
        .sort((a: any, b: any) => compareTasks(a.t, b.t, sortKey, a.date, b.date));
      return { id: e.id, name: e.name, tasks, contextDate };
    })
  ).filter(g => g.tasks.length > 0);

  const campaignGroups = sortByContextDate<{ id: string; name: string; tasks: any[]; contextDate: Date | null }>(
    projects.map(project => {
      const parsed = project.deadline ? new Date(`${project.deadline}T00:00`) : null;
      const contextDate = parsed && !isNaN(parsed.getTime()) ? parsed : null;
      const tasks = (project.tasks || [])
        .map((t: any, idx: number) => ({ t, idx, date: effectiveDate(t, contextDate) }))
        .filter((x: any) => !x.t.done || isFocused(x.t))
        .sort((a: any, b: any) => compareTasks(a.t, b.t, sortKey, a.date, b.date));
      return { id: project.id, name: project.name, tasks, contextDate };
    })
  ).filter(group => group.tasks.length > 0);

  // "משימות ביקורי בית" (kind:'homeVisit') חיות באותו מערך אחסון כמו המשימות
  // החד-פעמיות (STANDALONE_TASKS_ID) — רק מוצגות כאן בקבוצה נפרדת מבחינה
  // ויזואלית. ה-idx נשאר אינדקס במערך המקורי allStandaloneTasks בשני
  // המקרים, כדי שהכפתורים ימשיכו להצביע על הפריט הנכון.
  const allStandaloneTasks: any[] = holidayExtras[STANDALONE_TASKS_ID]?.tasks || [];
  const openStandaloneAll = allStandaloneTasks
    .map((t: any, idx: number) => ({ t, idx, date: effectiveDate(t, null) }))
    .filter((x: any) => !x.t.done || isFocused(x.t))
    .sort((a, b) => compareTasks(a.t, b.t, sortKey, a.date, b.date));
  // משימות ההכנה (prepTasks) של מערך ביקורים חיות ברשומת המערך עצמו
  // (homeVisits.rounds), לא במערך המשימות הרגיל — לכן בונים אותן כאן בנפרד
  // כדי שיופיעו יחד עם שאר המשימות. כל עוד למערך יש משימת-הכנה פתוחה,
  // משימות "ביקור בית" שלו (kind:'homeVisit') מוסתרות מרשימת המשימות — הן
  // אמורות להופיע רק אחרי שסיימו להכין (ר' roundPrepDone).
  const openPrepTasks = homeVisits.rounds
    .filter(r => r.status === 'active')
    .flatMap(r => (r.prepTasks || [])
      .map((pt, idx) => ({ roundId: r.id, idx, text: pt.text, done: pt.done, purpose: r.purpose }))
      .filter(pt => !pt.done));

  const roundPrepDone = (roundId?: string) => {
    if (!roundId) return true;
    const round = homeVisits.rounds.find(r => r.id === roundId);
    return !round?.prepTasks?.some(pt => !pt.done);
  };

  const togglePrepTask = (roundId: string, idx: number) => {
    const round = homeVisits.rounds.find(r => r.id === roundId);
    if (!round) return;
    const tasks = [...(round.prepTasks || [])];
    tasks[idx] = { ...tasks[idx], done: !tasks[idx].done };
    updateHomeVisitRoundMeta(roundId, { prepTasks: tasks });
  };

  // משימת היעד מוצגת גם אם ההכנות של המערך טרם הסתיימו. אחרת חיפוש של
  // ביקור בית ספציפי היה מגיע למסך שבו הוא מוסתר עד שיסמנו את ההכנות.
  const homeVisitTasks = openStandaloneAll.filter(x => x.t.kind === 'homeVisit' && (roundPrepDone(x.t.roundId) || isFocused(x.t)));
  const standaloneTasks = openStandaloneAll.filter(x => x.t.kind !== 'homeVisit');

  // ── מה שיירד לקובץ ──
  //
  // `flatRows` מחזיק **צמתי React** ולא נתונים, ולכן אי אפשר לייצא ממנו.
  // כאן נבנית רשימה שטוחה מארבעת המקורות — חג, פעילות, קמפיין וחד-פעמית —
  // עם השם של ההורה, כי „להתקשר למאיר” בלי לדעת לאיזה חג הוא שייך אינו
  // אומר כלום בקובץ.
  const taskExportRows = React.useMemo(() => {
    const rows: any[] = [];
    holidayGroups.forEach(g => g.tasks.forEach(({ t }: any) =>
      rows.push({ ...t, parentName: g.id })));
    eventGroups.forEach(g => g.tasks.forEach(({ t }: any) =>
      rows.push({ ...t, parentName: g.name || g.id })));
    campaignGroups.forEach(g => g.tasks.forEach(({ t }: any) =>
      rows.push({ ...t, parentName: g.name || g.id })));
    standaloneTasks.forEach(({ t }: any) => rows.push({ ...t, parentName: 'משימה חד-פעמית' }));
    homeVisitTasks.forEach(({ t }: any) => rows.push({ ...t, parentName: 'ביקורי בית' }));
    return rows;
  }, [holidayGroups, eventGroups, campaignGroups, standaloneTasks, homeVisitTasks]);

  const openHolidayCount = holidayGroups.reduce((s, g) => s + g.tasks.length, 0);
  const openEventCount = eventGroups.reduce((s, g) => s + g.tasks.length, 0);
  const openCampaignCount = campaignGroups.reduce((s, g) => s + g.tasks.length, 0);
  const openHomeVisitCount = homeVisitTasks.length + openPrepTasks.length;
  const openStandaloneCount = standaloneTasks.length;

  const toggleStandaloneTask = (idx: number) => {
    const wasDone = allStandaloneTasks[idx]?.done;
    const tasks = [...allStandaloneTasks];
    tasks[idx] = { ...tasks[idx], done: !tasks[idx].done, ...(wasDone ? {} : { doneAt: new Date().toISOString() }) };
    updateHolidayExtras(STANDALONE_TASKS_ID, { tasks });
    if (!wasDone) {
      logAction('task_complete');
      setCompletionPrompt({ label: tasks[idx].text, target: { kind: 'standalone' } });
    }
  };

  // markHomeVisitDone (מ-AppContext) הוא כפתור "פעולה" חד-כיווני (לא checkbox
  // הפיך כמו שאר המשימות) — כל קריאה אליו היא תמיד "הושלם", לכן פותח את
  // דיאלוג משימת ההמשך בלי בדיקת wasDone.
  const handleMarkHomeVisitDone = (roundId: string, personName: string, label: string) => {
    markHomeVisitDone(roundId, personName);
    setCompletionPrompt({ label, target: { kind: 'standalone' } });
  };

  const deleteStandaloneTask = (idx: number) => {
    const tasks = [...allStandaloneTasks];
    tasks.splice(idx, 1);
    updateHolidayExtras(STANDALONE_TASKS_ID, { tasks });
  };

  const patchStandaloneTask = (idx: number, patch: Partial<any>) => {
    const tasks = [...allStandaloneTasks];
    tasks[idx] = { ...tasks[idx], ...patch };
    updateHolidayExtras(STANDALONE_TASKS_ID, { tasks });
  };

  const toggleStandaloneInvitePerson = (idx: number, person: string) => {
    const wasDone = (allStandaloneTasks[idx]?.doneNames || []).includes(person);
    const tasks = [...allStandaloneTasks];
    tasks[idx] = toggleInvitePerson(tasks[idx], person);
    updateHolidayExtras(STANDALONE_TASKS_ID, { tasks });
    if (!wasDone) logAction('invite_done');
  };

  const addStandaloneTask = () => {
    if (!standaloneText.trim()) return;
    const newTask: any = stampCreated({ text: standaloneText.trim(), done: false });
    if (standaloneDue) newTask.dueDate = standaloneDue;
    if (standaloneTime) newTask.time = standaloneTime;
    updateHolidayExtras(STANDALONE_TASKS_ID, { tasks: [...allStandaloneTasks, newTask] });
    logAction('task_create');
    setStandaloneText('');
    setStandaloneDue('');
    setStandaloneTime('');
  };

  const openHolidayFull = (holidayId: string) => {
    const found = holidayLookup[holidayId];
    setSelectedHoliday(found ? { ...found, id: holidayId } : { name: holidayId, dateStr: '', emoji: '📅', id: holidayId });
  };

  const toggleHolidayTask = (holidayId: string, idx: number) => {
    const tasks = [...(holidayExtras[holidayId]?.tasks || [])];
    const wasDone = tasks[idx]?.done;
    tasks[idx] = { ...tasks[idx], done: !tasks[idx].done, ...(wasDone ? {} : { doneAt: new Date().toISOString() }) };
    updateHolidayExtras(holidayId, { tasks });
    if (!wasDone) {
      logAction('task_complete');
      setCompletionPrompt({ label: tasks[idx].text, target: { kind: 'holiday', id: holidayId } });
    }
  };

  const deleteHolidayTask = (holidayId: string, idx: number) => {
    const tasks = [...(holidayExtras[holidayId]?.tasks || [])];
    tasks.splice(idx, 1);
    updateHolidayExtras(holidayId, { tasks });
  };

  const patchHolidayTask = (holidayId: string, idx: number, patch: Partial<any>) => {
    const tasks = [...(holidayExtras[holidayId]?.tasks || [])];
    tasks[idx] = { ...tasks[idx], ...patch };
    updateHolidayExtras(holidayId, { tasks });
  };

  // "לדלג" — סוגר את משימת "לעדכן את החג" בלי לספור אותה כביצוע בפועל (לא מנוקד).
  // לחיצה חוזרת כשהיא מסומנת כ"דילוג" מבטלת את הדילוג ומחזירה אותה לפתוחה.
  const skipHolidayTask = (holidayId: string, idx: number) => {
    const tasks = [...(holidayExtras[holidayId]?.tasks || [])];
    const cur = tasks[idx];
    tasks[idx] = cur.skipped ? { ...cur, done: false, skipped: false } : { ...cur, done: true, skipped: true };
    updateHolidayExtras(holidayId, { tasks });
  };

  const toggleHolidayInvitePerson = (holidayId: string, idx: number, person: string) => {
    const tasks = [...(holidayExtras[holidayId]?.tasks || [])];
    const wasDone = (tasks[idx]?.doneNames || []).includes(person);
    tasks[idx] = toggleInvitePerson(tasks[idx], person);
    updateHolidayExtras(holidayId, { tasks });
    if (!wasDone) logAction('invite_done');
  };

  const toggleEventTask = (eventId: string, idx: number) => {
    const ev = (eventsData as any[]).find((e: any) => e.id === eventId);
    const wasDone = ev?.tasks?.[idx]?.done;
    const label = ev?.tasks?.[idx]?.text;
    updateEventsData((eventsData as any[]).map((e: any) => {
      if (e.id !== eventId) return e;
      const tasks = [...(e.tasks || [])];
      tasks[idx] = { ...tasks[idx], done: !tasks[idx].done, ...(wasDone ? {} : { doneAt: new Date().toISOString() }) };
      return { ...e, tasks };
    }));
    if (!wasDone) {
      logAction('task_complete');
      setCompletionPrompt({ label, target: { kind: 'event', id: eventId } });
    }
  };

  const deleteEventTask = (eventId: string, idx: number) => {
    updateEventsData((eventsData as any[]).map((e: any) => {
      if (e.id !== eventId) return e;
      const tasks = [...(e.tasks || [])];
      tasks.splice(idx, 1);
      return { ...e, tasks };
    }));
  };

  const patchEventTask = (eventId: string, idx: number, patch: Partial<any>) => {
    updateEventsData((eventsData as any[]).map((e: any) => {
      if (e.id !== eventId) return e;
      const tasks = [...(e.tasks || [])];
      tasks[idx] = { ...tasks[idx], ...patch };
      return { ...e, tasks };
    }));
  };

  const toggleEventInvitePerson = (eventId: string, idx: number, person: string) => {
    const ev = (eventsData as any[]).find((e: any) => e.id === eventId);
    const wasDone = (ev?.tasks?.[idx]?.doneNames || []).includes(person);
    updateEventsData((eventsData as any[]).map((e: any) => {
      if (e.id !== eventId) return e;
      const tasks = [...(e.tasks || [])];
      tasks[idx] = toggleInvitePerson(tasks[idx], person);
      return { ...e, tasks };
    }));
    if (!wasDone) logAction('invite_done');
  };

  const patchCampaignTasks = (campaignId: string, mutate: (tasks: any[]) => any[]) => {
    updateProjects(projects.map(project => project.id === campaignId
      ? { ...project, tasks: mutate([...(project.tasks || [])]) }
      : project));
  };

  const toggleCampaignTask = (campaignId: string, idx: number) => {
    const project = projects.find(item => item.id === campaignId);
    const task = project?.tasks?.[idx];
    if (!task) return;
    patchCampaignTasks(campaignId, tasks => {
      tasks[idx] = { ...tasks[idx], done: !tasks[idx].done, ...(!tasks[idx].done ? { doneAt: new Date().toISOString() } : {}) };
      return tasks;
    });
    if (!task.done) {
      logAction('task_complete');
      setCompletionPrompt({ label: task.text, target: { kind: 'campaign', id: campaignId } });
    }
  };

  const deleteCampaignTask = (campaignId: string, idx: number) =>
    patchCampaignTasks(campaignId, tasks => { tasks.splice(idx, 1); return tasks; });

  const patchCampaignTask = (campaignId: string, idx: number, patch: Partial<any>) =>
    patchCampaignTasks(campaignId, tasks => { tasks[idx] = { ...tasks[idx], ...patch }; return tasks; });

  const submitAddTask = () => {
    if (!addTarget || !addText.trim()) return;
    const newTask: any = stampCreated({ text: addText.trim(), done: false });
    if (addDate) newTask.dueDate = addDate;
    if (addTime) newTask.time = addTime;
    if (addTarget.kind === 'holiday') {
      const tasks = [...(holidayExtras[addTarget.id]?.tasks || []), newTask];
      updateHolidayExtras(addTarget.id, { tasks });
    } else if (addTarget.kind === 'event') {
      updateEventsData((eventsData as any[]).map((e: any) => e.id === addTarget.id ? { ...e, tasks: [...(e.tasks || []), newTask] } : e));
    } else {
      patchCampaignTasks(addTarget.id, tasks => [...tasks, newTask]);
    }
    logAction('task_create');
    setAddText('');
    setAddDate('');
    setAddTime('');
    setAddTarget(null);
    setIsAddOpen(false);
  };

  // כל משימה מסמנת את עצמה במזהה שלה, כדי שהחיפוש יוכל למצוא אותה.
  //
  // המזהה נוסף ליחידת הנתונים של יוסי, ורק בזכותו אפשר לסמן **את המשימה
  // הנכונה**. קודם הזיהוי היה לפי המיקום ברשימה, והמיקום משתנה בכל סינון —
  // כלומר הסימון היה נופל על משימה אחרת.
  //
  // משימה בלי מזהה (מסונתזת — תאריך אישי, הכנה לביקור) אינה מסומנת כלל,
  // וגם אינה נכנסת לחיפוש.
  const renderTaskItem = (t: any, onToggle: () => void, onDelete: () => void, onTogglePerson: (person: string) => void, onPatch: (patch: Partial<any>) => void, extra?: React.ReactNode) => (
    <div data-entity-id={t.id || undefined}>{
    t.kind === 'invite' ? (
      <div className="bg-white rounded-xl p-3 shadow-sm border border-[#EDE6D6]">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-bold ${t.done ? 'text-gray-400 line-through' : 'text-[#0D1B2A]'}`}>{t.text}</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-gray-400">נותרו ~{inviteRemainingMinutes(t)} דק'</span>
            <button onClick={onDelete} className="text-red-300 hover:text-red-500" title="מחק משימה"><X size={14} /></button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(t.people || []).map((p: string) => {
            const isDone = (t.doneNames || []).includes(p);
            return (
              <button
                key={p}
                onClick={() => onTogglePerson(p)}
                className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${isDone ? 'bg-[#D1FAE5] border-[#10B981] text-[#065F46] line-through' : 'bg-[#FAF6EE] border-[#EDE6D6] text-[#0D1B2A]'}`}
              >
                {p}
              </button>
            );
          })}
        </div>
        <TaskDetailsPanel task={t} onPatch={onPatch} />
      </div>
    ) : (
      <div className="bg-white rounded-xl p-3 shadow-sm border border-[#EDE6D6]">
        <div className="flex items-center gap-3">
          <div onClick={onToggle} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 cursor-pointer ${t.done ? 'bg-[#C9A84C] border-[#C9A84C]' : 'border-gray-300'}`}>
            {t.done && <Check size={12} className="text-white" />}
          </div>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
            <span className={`text-sm ${t.done ? 'text-gray-400 line-through' : 'text-[#0D1B2A]'}`}>{t.text}</span>
            {t.dueDate && !t.done && (
              <div className="text-[10px] text-[#9B7A2F] flex items-center gap-1 mt-0.5"><Clock size={10} /> {formatRemaining(effectiveDate(t, null) as Date, new Date())}</div>
            )}
          </div>
          {extra}
          <button onClick={onDelete} className="text-red-300 hover:text-red-500 shrink-0" title="מחק משימה"><X size={14} /></button>
        </div>
        <TaskDetailsPanel task={t} onPatch={onPatch} />
      </div>
    )
  }</div>
  );

  // כפתורים ייחודיים לפי kind — מוצאים לכפתור משותף כדי לשמש גם בתצוגה
  // המקובצת וגם בתצוגה השטוחה (viewMode==='flat') בלי לשכפל JSX.
  const holidayExtraFor = (holidayId: string, idx: number, t: any) => t.kind === 'holidayReminder' ? (
    <button
      onClick={() => skipHolidayTask(holidayId, idx)}
      className={`text-[10px] px-2 py-1 rounded-full border shrink-0 whitespace-nowrap ${t.skipped ? 'bg-[#FEF3C7] border-[#F59E0B] text-[#92400E]' : 'bg-[#FAF6EE] border-[#EDE6D6] text-gray-500'}`}
      title={t.skipped ? 'בטל דילוג' : 'לדלג הפעם — לא צריך לעדכן'}
    >
      {t.skipped ? '↩️ בוטל' : '⏭️ לדלג'}
    </button>
  ) : undefined;

  const standaloneExtraFor = (t: any) => t.kind === 'homeVisit' ? (
    <button
      onClick={() => setTab('homevisits')}
      className="text-[10px] px-2 py-1 rounded-full border border-[#EDE6D6] bg-[#FAF6EE] text-[#9B7A2F] shrink-0 whitespace-nowrap"
      title="פתח את מערך הביקורים"
    >
      🏠 מערך
    </button>
  ) : undefined;

  // תצוגה שטוחה — כל המשימות (כולל תאריכים אישיים) יחד, ממוינות רק לפי
  // sortKey, בלי חלוקה לקטגוריות (חג/אירוע/חד-פעמי). כל שורה שומרת "פירור לחם"
  // קטן שמזכיר מאיפה היא הגיעה, כדי לא לאבד לגמרי את ההקשר.
  const flatRows: { key: string; date: Date | null; priorityObj: any; node: React.ReactNode }[] = [];

  sortedPersonalDates.forEach(c => {
    const extra = personalDateExtras[c.key] || {};
    const syntheticTask: any = { text: c.msg, done: false, ...extra };
    const date = new Date(today.getTime() + c.dist * 86400000);
    flatRows.push({
      key: `pd-${c.key}`,
      date,
      priorityObj: extra,
      node: (
        <div key={`pd-${c.key}`} className="bg-white border border-[#EDE6D6] rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-[#9B7A2F] font-bold mb-1.5">{c.icon} תאריך אישי</div>
          <div className="flex items-center gap-3 mb-2.5 cursor-pointer" onClick={() => setSelectedDonor(c.name)}>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-[#0D1B2A] truncate">{c.name}</div>
              <div className="text-xs text-gray-600 mt-0.5">{c.msg}</div>
            </div>
          </div>
          <QuickLogButtons donorName={c.name} compact personalDateContext={{ onComplete: () => dismissPersonalDate(c) }} />
          <TaskDetailsPanel task={syntheticTask} onPatch={patch => patchPersonalDate(c.key, patch)} />
        </div>
      ),
    });
  });

  holidayGroups.forEach(g => {
    g.tasks.forEach(({ t, idx, date }: any) => {
      flatRows.push({
        key: `h-${g.id}-${idx}`,
        date,
        priorityObj: t,
        node: (
          <div key={`h-${g.id}-${idx}`}>
            <button onClick={() => openHolidayFull(g.id)} className="text-[10px] text-[#9B7A2F] font-bold mb-1 hover:underline flex items-center gap-1">
              🗓️ {g.id} <ChevronLeft size={10} />
            </button>
            {renderTaskItem(t, () => toggleHolidayTask(g.id, idx), () => deleteHolidayTask(g.id, idx), p => toggleHolidayInvitePerson(g.id, idx, p), patch => patchHolidayTask(g.id, idx, patch), holidayExtraFor(g.id, idx, t))}
          </div>
        ),
      });
    });
  });

  eventGroups.forEach(g => {
    g.tasks.forEach(({ t, idx, date }: any) => {
      flatRows.push({
        key: `e-${g.id}-${idx}`,
        date,
        priorityObj: t,
        node: (
          <div key={`e-${g.id}-${idx}`}>
            <button onClick={() => setTab('events')} className="text-[10px] text-[#9B7A2F] font-bold mb-1 hover:underline flex items-center gap-1">
              📅 {g.name} <ChevronLeft size={10} />
            </button>
            {renderTaskItem(t, () => toggleEventTask(g.id, idx), () => deleteEventTask(g.id, idx), p => toggleEventInvitePerson(g.id, idx, p), patch => patchEventTask(g.id, idx, patch))}
          </div>
        ),
      });
    });
  });

  campaignGroups.forEach(group => {
    group.tasks.forEach(({ t, idx, date }: any) => {
      flatRows.push({
        key: `c-${group.id}-${idx}`,
        date,
        priorityObj: t,
        node: (
          <div key={`c-${group.id}-${idx}`}>
            <button onClick={() => setTab('projects')} className="text-[10px] text-[#9B7A2F] font-bold mb-1 hover:underline flex items-center gap-1">
              🎯 {group.name} <ChevronLeft size={10} />
            </button>
            {renderTaskItem(t, () => toggleCampaignTask(group.id, idx), () => deleteCampaignTask(group.id, idx), () => {}, patch => patchCampaignTask(group.id, idx, patch))}
          </div>
        ),
      });
    });
  });

  openPrepTasks.forEach(pt => {
    flatRows.push({
      key: `prep-${pt.roundId}-${pt.idx}`,
      date: null,
      priorityObj: {},
      node: (
        <div key={`prep-${pt.roundId}-${pt.idx}`}>
          <div className="text-[10px] text-[#9B7A2F] font-bold mb-1">🏠 הכנה לביקורי בית{pt.purpose ? ` — ${pt.purpose}` : ''}</div>
          <div className="bg-[#FAF6EE] rounded-xl p-3 shadow-sm border border-[#EDE6D6] flex items-center gap-3">
            <div onClick={() => togglePrepTask(pt.roundId, pt.idx)} className="w-5 h-5 rounded-md border-2 border-gray-300 flex items-center justify-center shrink-0 cursor-pointer">
            </div>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => togglePrepTask(pt.roundId, pt.idx)}>
              <span className="text-sm text-[#0D1B2A]">{pt.text}</span>
            </div>
          </div>
        </div>
      ),
    });
  });

  [...homeVisitTasks, ...standaloneTasks].forEach(({ t, idx, date }: any) => {
    flatRows.push({
      key: `s-${idx}`,
      date,
      priorityObj: t,
      node: (
        <div key={`s-${idx}`}>
          <div className="text-[10px] text-[#9B7A2F] font-bold mb-1">{t.kind === 'homeVisit' ? '🏠 ביקור בית' : '📌 חד-פעמית'}</div>
          {renderTaskItem(
            t,
            t.kind === 'homeVisit' ? () => handleMarkHomeVisitDone(t.roundId, t.personName, t.text) : () => toggleStandaloneTask(idx),
            () => deleteStandaloneTask(idx),
            p => toggleStandaloneInvitePerson(idx, p),
            patch => patchStandaloneTask(idx, patch),
            standaloneExtraFor(t)
          )}
        </div>
      ),
    });
  });

  flatRows.sort((a, b) => compareTasks(a.priorityObj, b.priorityObj, sortKey, a.date, b.date));

  // תצוגת לוח שנה — כמו flatRows, אבל התאריך כאן הוא תאריך "אמיתי" בלבד
  // (dueDate מפורש, או תאריך ההקשר של חג/אירוע) בלי נפילה חזרה ל-createdAt,
  // כדי שמשימות בלי תאריך אמיתי יופיעו במגירת "ללא תאריך" ולא "יתפסו" תא אקראי.
  interface CalItem {
    key: string; date: Date | null; label: string; done: boolean; t: any;
    source: 'personal' | 'holiday' | 'event' | 'campaign' | 'standalone' | 'homeVisit';
    onToggle: () => void; onDelete: () => void; onTogglePerson: (p: string) => void; onPatch: (patch: any) => void; extra?: React.ReactNode;
    customCard?: React.ReactNode;
  }
  const calendarItems: CalItem[] = [];

  sortedPersonalDates.forEach(c => {
    const extra = personalDateExtras[c.key] || {};
    const syntheticTask: any = { text: c.msg, done: false, ...extra };
    const date = new Date(today.getTime() + c.dist * 86400000);
    calendarItems.push({
      key: `pd-${c.key}`, date, label: `${c.icon} ${c.name}`, done: false, t: syntheticTask, source: 'personal',
      onToggle: () => {}, onDelete: () => {}, onTogglePerson: () => {}, onPatch: patch => patchPersonalDate(c.key, patch),
      customCard: (
        <div className="bg-white border border-[#EDE6D6] rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-[#9B7A2F] font-bold mb-1.5">{c.icon} תאריך אישי</div>
          <div className="flex items-center gap-3 mb-2.5 cursor-pointer" onClick={() => { setSelectedDonor(c.name); setCalendarSelectedKey(null); }}>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-[#0D1B2A] truncate">{c.name}</div>
              <div className="text-xs text-gray-600 mt-0.5">{c.msg}</div>
            </div>
          </div>
          <QuickLogButtons donorName={c.name} compact personalDateContext={{ onComplete: () => dismissPersonalDate(c) }} />
          <TaskDetailsPanel task={syntheticTask} onPatch={patch => patchPersonalDate(c.key, patch)} />
        </div>
      ),
    });
  });

  holidayGroups.forEach(g => {
    g.tasks.forEach(({ t, idx }: any) => {
      calendarItems.push({
        key: `h-${g.id}-${idx}`, date: g.contextDate ? applyTaskTime(g.contextDate, t) : null, label: `🗓️ ${t.text}`, done: !!t.done, t, source: 'holiday',
        onToggle: () => toggleHolidayTask(g.id, idx), onDelete: () => deleteHolidayTask(g.id, idx),
        onTogglePerson: p => toggleHolidayInvitePerson(g.id, idx, p), onPatch: patch => patchHolidayTask(g.id, idx, patch),
        extra: holidayExtraFor(g.id, idx, t),
      });
    });
  });

  eventGroups.forEach(g => {
    g.tasks.forEach(({ t, idx }: any) => {
      calendarItems.push({
        key: `e-${g.id}-${idx}`, date: g.contextDate ? applyTaskTime(g.contextDate, t) : null, label: `📅 ${t.text}`, done: !!t.done, t, source: 'event',
        onToggle: () => toggleEventTask(g.id, idx), onDelete: () => deleteEventTask(g.id, idx),
        onTogglePerson: p => toggleEventInvitePerson(g.id, idx, p), onPatch: patch => patchEventTask(g.id, idx, patch),
      });
    });
  });

  campaignGroups.forEach(group => {
    group.tasks.forEach(({ t, idx }: any) => {
      calendarItems.push({
        key: `c-${group.id}-${idx}`,
        date: group.contextDate ? applyTaskTime(group.contextDate, t) : (t.dueDate ? applyTaskTime(new Date(`${t.dueDate}T00:00`), t) : null),
        label: `🎯 ${t.text}`, done: !!t.done, t, source: 'campaign',
        onToggle: () => toggleCampaignTask(group.id, idx), onDelete: () => deleteCampaignTask(group.id, idx),
        onTogglePerson: () => {}, onPatch: patch => patchCampaignTask(group.id, idx, patch),
      });
    });
  });

  [...homeVisitTasks, ...standaloneTasks].forEach(({ t, idx }: any) => {
    calendarItems.push({
      key: `s-${idx}`, date: t.dueDate ? applyTaskTime(new Date(`${t.dueDate}T00:00`), t) : null,
      label: t.kind === 'homeVisit' ? `🏠 ${t.text}` : `📌 ${t.text}`, done: !!t.done, t,
      source: t.kind === 'homeVisit' ? 'homeVisit' : 'standalone',
      onToggle: t.kind === 'homeVisit' ? () => handleMarkHomeVisitDone(t.roundId, t.personName, t.text) : () => toggleStandaloneTask(idx),
      onDelete: () => deleteStandaloneTask(idx), onTogglePerson: p => toggleStandaloneInvitePerson(idx, p),
      onPatch: patch => patchStandaloneTask(idx, patch), extra: standaloneExtraFor(t),
    });
  });

  const calendarSelected = calendarItems.find(i => i.key === calendarSelectedKey) || null;

  const addTargetOptions = [
    ...holidayGroups.map(g => ({ kind: 'holiday' as const, id: g.id, label: g.id })),
    ...Object.keys(holidayLookup).filter(id => !holidayGroups.some(g => g.id === id)).map(id => ({ kind: 'holiday' as const, id, label: id })),
    ...(eventsData as any[]).map(e => ({ kind: 'event' as const, id: e.id, label: e.name })),
    ...projects.filter(project => project.status !== 'closed').map(project => ({ kind: 'campaign' as const, id: project.id, label: project.name })),
  ];

  return (
    <div className="animate-in fade-in pb-24 md:pb-6">
      {/* Topbar */}
      <div className="bg-[#0D1B2A] px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="w-9 h-9 bg-gradient-to-br from-[#C9A84C] to-[#9B7A2F] rounded-lg flex items-center justify-center shrink-0 md:hidden">
          <ClipboardList size={20} className="text-white" />
        </div>
        <div className="flex-1 px-3 md:px-0">
          <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#C9A84C]">משימות</div>
          <div className="text-[11px] text-white/45 mt-[1px]">{openHolidayCount + openEventCount + openCampaignCount + openHomeVisitCount + openStandaloneCount} משימות פתוחות · {personalDates.length} תאריכים ב-30 הימים הקרובים</div>
        </div>
        <button
          onClick={() => setIsControlsOpen(o => !o)}
          title="מיון ותצוגה"
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${isControlsOpen ? 'bg-[#C9A84C] text-[#0D1B2A]' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
        >
          <SlidersHorizontal size={16} />
        </button>
        <button onClick={() => setIsAIImportOpen(true)} title="יבוא משימות מבינה מלאכותית" className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-white/10 text-white/80 hover:bg-white/20 transition-colors mr-1.5">
          <Bot size={16} />
        </button>
        <button onClick={() => setIsAddOpen(true)} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white/80 shrink-0 hover:bg-white/20 transition-colors mr-1.5">
          <Plus size={18} />
        </button>
      </div>

      {isAIImportOpen && <GlobalAIImportModal onClose={() => setIsAIImportOpen(false)} />}

      {/* מיון + תצוגה — מכווץ כברירת מחדל, נפתח דרך כפתור הפילטר בטופבר */}
      {isControlsOpen && (
        <div className="px-4 md:px-6 pt-3 pb-1 space-y-2 bg-[#FAF6EE] border-b border-[#EDE6D6] animate-in fade-in duration-150">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-gray-400">מיין לפי:</span>
            <button
              onClick={() => setSortKey('date')}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${sortKey === 'date' ? 'bg-[#0D1B2A] text-[#E8C97A] border-[#0D1B2A]' : 'bg-white text-gray-500 border-[#EDE6D6]'}`}
            >
              📅 תאריך / זמן שנותר
            </button>
            <button
              onClick={() => setSortKey('priority')}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${sortKey === 'priority' ? 'bg-[#0D1B2A] text-[#E8C97A] border-[#0D1B2A]' : 'bg-white text-gray-500 border-[#EDE6D6]'}`}
            >
              🔥 דחיפות
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap pb-2">
            <span className="text-[11px] text-gray-400">תצוגה:</span>
            <button
              onClick={() => setViewMode('grouped')}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${viewMode === 'grouped' ? 'bg-[#0D1B2A] text-[#E8C97A] border-[#0D1B2A]' : 'bg-white text-gray-500 border-[#EDE6D6]'}`}
            >
              📁 לפי קטגוריה
            </button>
            <button
              onClick={() => setViewMode('flat')}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${viewMode === 'flat' ? 'bg-[#0D1B2A] text-[#E8C97A] border-[#0D1B2A]' : 'bg-white text-gray-500 border-[#EDE6D6]'}`}
            >
              📋 רשימה אחת
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${viewMode === 'calendar' ? 'bg-[#0D1B2A] text-[#E8C97A] border-[#0D1B2A]' : 'bg-white text-gray-500 border-[#EDE6D6]'}`}
            >
              📆 לוח שנה
            </button>
            {/* ההורדה מכסה את כל המשימות מארבעת המקורות, לא רק את התצוגה
                הנוכחית — התצוגה היא דרך הצגה, לא סינון תוכן. */}
            <span className="mr-auto">
              <ExportButton rows={taskExportRows} columns={TASK_COLUMNS} fileName="משימות" />
            </span>
          </div>
        </div>
      )}

      {viewMode === 'flat' ? (
        <div className="p-4 md:p-6 max-w-2xl">
          {flatRows.length === 0 ? (
            <div className="bg-white rounded-xl p-4 text-center text-gray-500 shadow-sm text-sm border border-[#EDE6D6]">אין משימות פתוחות</div>
          ) : (
            <div className="space-y-3">{flatRows.map(r => r.node)}</div>
          )}
        </div>
      ) : viewMode === 'calendar' ? (
        <div className="p-4 md:p-6 max-w-3xl">
          <TaskCalendarView
            items={calendarItems.map(i => ({ key: i.key, date: i.date, label: i.label, done: i.done, source: i.source }))}
            onSelect={setCalendarSelectedKey}
          />
        </div>
      ) : (
      <div className="p-4 md:p-6 max-w-2xl space-y-6">
        {/* תאריכים אישיים */}
        <div>
          <h2 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] mb-3 flex items-center gap-2">
            <Cake size={18} className="text-[#C9A84C]" /> תאריכים אישיים
          </h2>
          {personalDates.length === 0 ? (
            <div className="bg-white rounded-xl p-4 text-center text-gray-500 shadow-sm text-sm border border-[#EDE6D6]">אין ימי הולדת או יארצייט ב-30 הימים הקרובים</div>
          ) : (
            <div className="space-y-2">
              {sortedPersonalDates.map(c => {
                const extra = personalDateExtras[c.key] || {};
                const syntheticTask: any = { text: c.msg, done: false, ...extra };
                return (
                  <div key={c.key} className="bg-white border border-[#EDE6D6] rounded-xl p-3 shadow-sm">
                    <div className="flex items-center gap-3 mb-2.5 cursor-pointer" onClick={() => setSelectedDonor(c.name)}>
                      <span className="text-xl shrink-0">{c.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-[#0D1B2A] truncate">{c.name}</div>
                        <div className="text-xs text-gray-600 mt-0.5">{c.msg}</div>
                      </div>
                    </div>
                    <QuickLogButtons donorName={c.name} compact personalDateContext={{ onComplete: () => dismissPersonalDate(c) }} />
                    <TaskDetailsPanel task={syntheticTask} onPatch={patch => patchPersonalDate(c.key, patch)} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* משימות חגים */}
        <div>
          <h2 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] mb-3 flex items-center gap-2">
            <Calendar size={18} className="text-[#C9A84C]" /> משימות חגים
          </h2>
          {holidayGroups.length === 0 ? (
            <div className="bg-white rounded-xl p-4 text-center text-gray-500 shadow-sm text-sm border border-[#EDE6D6]">
              אין עדיין משימות חג. אפשר להוסיף בכפתור ה-+ למעלה, או מכרטיס החג בלוח השנה.
            </div>
          ) : (
            <div className="space-y-4">
              {holidayGroups.map(g => {
                const groupKey = `h-${g.id}`;
                const collapsed = collapsedGroups.has(groupKey);
                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between mb-1">
                      <button onClick={() => openHolidayFull(g.id)} className="flex items-center gap-1 text-xs font-bold text-[#9B7A2F] hover:underline">
                        {g.id} <ChevronLeft size={12} />
                      </button>
                      <button onClick={() => toggleGroupCollapse(groupKey)} className="flex items-center gap-1 text-[10px] text-gray-400 px-1.5 py-0.5 rounded hover:bg-[#FAF6EE] transition-colors">
                        {g.tasks.length} משימות <ChevronDown size={12} className={`transition-transform ${collapsed ? '' : 'rotate-180'}`} />
                      </button>
                    </div>
                    {!collapsed && (
                      <>
                        {g.contextDate && (
                          <div className="text-[10px] text-gray-400 flex items-center gap-1 mb-2"><Clock size={10} /> {formatRemaining(g.contextDate, new Date())}</div>
                        )}
                        <div className="space-y-2">
                          {g.tasks.map(({ t, idx }: any) => (
                            <div key={idx}>
                              {renderTaskItem(
                                t,
                                () => toggleHolidayTask(g.id, idx),
                                () => deleteHolidayTask(g.id, idx),
                                p => toggleHolidayInvitePerson(g.id, idx, p),
                                patch => patchHolidayTask(g.id, idx, patch),
                                holidayExtraFor(g.id, idx, t)
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* משימות אירועים */}
        <div>
          <h2 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] mb-3 flex items-center gap-2">
            <CalendarCheck size={18} className="text-[#C9A84C]" /> משימות פעילויות
          </h2>
          {eventGroups.length === 0 ? (
            <div className="bg-white rounded-xl p-4 text-center text-gray-500 shadow-sm text-sm border border-[#EDE6D6]">
              אין עדיין משימות פעילות. אפשר להוסיף בכפתור ה-+ למעלה, או מתוך מסך הפעילויות.
            </div>
          ) : (
            <div className="space-y-4">
              {eventGroups.map(g => {
                const groupKey = `e-${g.id}`;
                const collapsed = collapsedGroups.has(groupKey);
                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between mb-1">
                      <button onClick={() => setTab('events')} className="flex items-center gap-1 text-xs font-bold text-[#9B7A2F] hover:underline">
                        {g.name} <ChevronLeft size={12} />
                      </button>
                      <button onClick={() => toggleGroupCollapse(groupKey)} className="flex items-center gap-1 text-[10px] text-gray-400 px-1.5 py-0.5 rounded hover:bg-[#FAF6EE] transition-colors">
                        {g.tasks.length} משימות <ChevronDown size={12} className={`transition-transform ${collapsed ? '' : 'rotate-180'}`} />
                      </button>
                    </div>
                    {!collapsed && (
                      <>
                        {g.contextDate && (
                          <div className="text-[10px] text-gray-400 flex items-center gap-1 mb-2"><Clock size={10} /> {formatRemaining(g.contextDate, new Date())} עד המפגש הבא</div>
                        )}
                        <div className="space-y-2">
                          {g.tasks.map(({ t, idx }: any) => (
                            <div key={idx}>
                              {renderTaskItem(t, () => toggleEventTask(g.id, idx), () => deleteEventTask(g.id, idx), p => toggleEventInvitePerson(g.id, idx, p), patch => patchEventTask(g.id, idx, patch))}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* משימות קמפיינים */}
        <div>
          <h2 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] mb-3 flex items-center gap-2">
            <Target size={18} className="text-[#C9A84C]" /> משימות קמפיינים
          </h2>
          {campaignGroups.length === 0 ? (
            <div className="bg-white rounded-xl p-4 text-center text-gray-500 shadow-sm text-sm border border-[#EDE6D6]">
              אין משימות קמפיין פתוחות. אפשר להוסיף בכפתור ה־+ ולבחור קמפיין.
            </div>
          ) : (
            <div className="space-y-4">
              {campaignGroups.map(group => {
                const groupKey = `c-${group.id}`;
                const collapsed = collapsedGroups.has(groupKey);
                return (
                  <div key={group.id}>
                    <div className="flex items-center justify-between mb-1">
                      <button onClick={() => setTab('projects')} className="flex items-center gap-1 text-xs font-bold text-[#9B7A2F] hover:underline">{group.name} <ChevronLeft size={12} /></button>
                      <button onClick={() => toggleGroupCollapse(groupKey)} className="flex items-center gap-1 text-[10px] text-gray-400 px-1.5 py-0.5 rounded hover:bg-[#FAF6EE] transition-colors">
                        {group.tasks.length} משימות <ChevronDown size={12} className={`transition-transform ${collapsed ? '' : 'rotate-180'}`} />
                      </button>
                    </div>
                    {!collapsed && <>
                      {group.contextDate && <div className="text-[10px] text-gray-400 flex items-center gap-1 mb-2"><Clock size={10} /> {formatRemaining(group.contextDate, new Date())} עד יעד הקמפיין</div>}
                      <div className="space-y-2">{group.tasks.map(({ t, idx }: any) => (
                        <div key={idx}>{renderTaskItem(t, () => toggleCampaignTask(group.id, idx), () => deleteCampaignTask(group.id, idx), () => {}, patch => patchCampaignTask(group.id, idx, patch))}</div>
                      ))}</div>
                    </>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* משימות ביקורי בית — נפרד ממשימות חד-פעמיות, ניתן לכווץ/להרחיב כמו קבוצות חג/אירוע */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setTab('homevisits')} className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] flex items-center gap-2 hover:underline">
              <Home size={18} className="text-[#C9A84C]" /> משימות ביקורי בית
            </button>
            <button onClick={() => toggleGroupCollapse('hv-tasks')} className="flex items-center gap-1 text-[10px] text-gray-400 px-1.5 py-0.5 rounded hover:bg-[#FAF6EE] transition-colors">
              {homeVisitTasks.length + openPrepTasks.length} משימות <ChevronDown size={12} className={`transition-transform ${collapsedGroups.has('hv-tasks') ? '' : 'rotate-180'}`} />
            </button>
          </div>
          {!collapsedGroups.has('hv-tasks') && (
            homeVisitTasks.length === 0 && openPrepTasks.length === 0 ? (
              <div className="bg-white rounded-xl p-4 text-center text-gray-500 shadow-sm text-sm border border-[#EDE6D6]">
                אין משימות ביקורי בית פתוחות כרגע. נוצרות אוטומטית ממערך ביקורי הבית.
              </div>
            ) : (
              <div className="space-y-2">
                {openPrepTasks.map(pt => (
                  <div key={`prep-${pt.roundId}-${pt.idx}`} className="bg-[#FAF6EE] rounded-xl p-3 shadow-sm border border-[#EDE6D6] flex items-center gap-3">
                    <div onClick={() => togglePrepTask(pt.roundId, pt.idx)} className="w-5 h-5 rounded-md border-2 border-gray-300 flex items-center justify-center shrink-0 cursor-pointer">
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => togglePrepTask(pt.roundId, pt.idx)}>
                      <span className="text-sm text-[#0D1B2A]">{pt.text}</span>
                      <div className="text-[10px] text-[#9B7A2F] flex items-center gap-1 mt-0.5"><ClipboardList size={10} /> הכנה{pt.purpose ? ` — ${pt.purpose}` : ''} · לפני תחילת הביקורים</div>
                    </div>
                  </div>
                ))}
                {homeVisitTasks.map(({ t, idx }: any) => (
                  <div key={idx}>
                    {renderTaskItem(
                      t,
                      () => handleMarkHomeVisitDone(t.roundId, t.personName, t.text),
                      () => deleteStandaloneTask(idx),
                      p => toggleStandaloneInvitePerson(idx, p),
                      patch => patchStandaloneTask(idx, patch),
                      standaloneExtraFor(t)
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* משימות חד-פעמיות */}
        <div>
          <h2 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] mb-3 flex items-center gap-2">
            <ListTodo size={18} className="text-[#C9A84C]" /> משימות חד-פעמיות
          </h2>
          {standaloneTasks.length === 0 ? (
            <div className="bg-white rounded-xl p-4 text-center text-gray-500 shadow-sm text-sm border border-[#EDE6D6]">
              אין עדיין משימות חד-פעמיות. למשל: "לעדכן לכל אנשי הקשר ימי הולדת ויארצייט".
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {standaloneTasks.map(({ t, idx }: any) => (
                <div key={idx}>
                  {renderTaskItem(
                    t,
                    t.kind === 'homeVisit' ? () => handleMarkHomeVisitDone(t.roundId, t.personName, t.text) : () => toggleStandaloneTask(idx),
                    () => deleteStandaloneTask(idx),
                    p => toggleStandaloneInvitePerson(idx, p),
                    patch => patchStandaloneTask(idx, patch),
                    standaloneExtraFor(t)
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="bg-white rounded-xl p-3 border border-dashed border-[#EDE6D6] space-y-2 mt-3">
            <input
              value={standaloneText}
              onChange={e => setStandaloneText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addStandaloneTask()}
              type="text"
              className="w-full bg-[#FAF6EE] border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C]"
              placeholder="משימה חדשה... (למשל: לעדכן ימי הולדת ויארצייט)"
            />
            <div className="flex gap-2">
              <input
                value={standaloneDue}
                onChange={e => setStandaloneDue(e.target.value)}
                type="date"
                className="flex-1 bg-[#FAF6EE] border border-[#EDE6D6] rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C9A84C]"
                title="תאריך (לא חובה)"
              />
              <input
                value={standaloneTime}
                onChange={e => setStandaloneTime(e.target.value)}
                type="time"
                className="flex-1 bg-[#FAF6EE] border border-[#EDE6D6] rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C9A84C]"
                title="שעה (לא חובה)"
              />
              <button onClick={addStandaloneTask} disabled={!standaloneText.trim()} className="bg-[#0D1B2A] rounded-xl px-4 text-[#E8C97A] font-bold text-sm shadow-sm disabled:opacity-40 shrink-0">
                הוסף
              </button>
            </div>
          </div>

          <div className="mt-3">
            <AIPlanningAssistant
              title="משימות חד-פעמיות"
              contextLines={standaloneTasks.length ? [`משימות פתוחות שכבר קיימות: ${standaloneTasks.map(({ t }: any) => t.text).join(', ')}`] : []}
              onApply={(result) => {
                if (!result.tasks?.length) return;
                const newTasks = result.tasks.map(text => stampCreated({ text, done: false }));
                updateHolidayExtras(STANDALONE_TASKS_ID, { tasks: [...allStandaloneTasks, ...newTasks] });
                logAction('task_create', newTasks.length);
              }}
            />
          </div>
        </div>
      </div>
      )}

      {/* הוספת משימה */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/60 z-[220] flex items-center justify-center p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setIsAddOpen(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-xl text-[#0D1B2A]">הוספת משימה</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-gray-400 p-1 hover:text-gray-600"><X size={20} /></button>
            </div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">לאיזה חג, פעילות או קמפיין</label>
            <select
              value={addTarget ? `${addTarget.kind}:${addTarget.id}` : ''}
              onChange={e => {
                const [kind, id] = e.target.value.split(':');
                if (!id) { setAddTarget(null); return; }
                setAddTarget({ kind: kind as 'holiday' | 'event' | 'campaign', id });
                // משימת אירוע מקבלת אוטומטית את תאריך האירוע הקרוב, אלא אם המשתמש
                // כבר בחר תאריך ידנית בעצמו — לא דורסים בחירה מפורשת.
                if (kind === 'event' && !addDate) {
                  const ev = (eventsData as any[]).find((e2: any) => e2.id === id);
                  const occ = ev ? nextEventOccurrence(ev, new Date()) : null;
                  if (occ) setAddDate(occ.toISOString().split('T')[0]);
                }
              }}
              className="w-full border-2 border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C] bg-white mb-4"
            >
              <option value="">בחר...</option>
              <optgroup label="חגים">
                {addTargetOptions.filter(o => o.kind === 'holiday').map(o => <option key={o.id} value={`${o.kind}:${o.id}`}>{o.label}</option>)}
              </optgroup>
              <optgroup label="פעילויות">
                {addTargetOptions.filter(o => o.kind === 'event').map(o => <option key={o.id} value={`${o.kind}:${o.id}`}>{o.label}</option>)}
              </optgroup>
              <optgroup label="קמפיינים">
                {addTargetOptions.filter(o => o.kind === 'campaign').map(o => <option key={o.id} value={`${o.kind}:${o.id}`}>{o.label}</option>)}
              </optgroup>
            </select>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">תיאור המשימה</label>
            <input
              value={addText}
              onChange={e => setAddText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitAddTask()}
              type="text"
              className="w-full border-2 border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C] mb-4"
              placeholder="למשל: להזמין דוברת, לקנות פרחים..."
            />
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">תאריך ושעה (לא חובה)</label>
            <div className="flex gap-2 mb-4">
              <input
                value={addDate}
                onChange={e => setAddDate(e.target.value)}
                type="date"
                className="flex-1 border-2 border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C]"
              />
              <input
                value={addTime}
                onChange={e => setAddTime(e.target.value)}
                type="time"
                className="flex-1 border-2 border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C]"
              />
            </div>
            <button
              onClick={submitAddTask}
              disabled={!addTarget || !addText.trim()}
              className="w-full bg-[#0D1B2A] text-[#E8C97A] py-3 rounded-xl font-bold text-sm shadow-lg disabled:opacity-40"
            >
              הוסף משימה
            </button>
          </div>
        </div>
      )}

      {selectedDonor && <ProfileModal name={selectedDonor} onClose={() => setSelectedDonor(null)} backLabel="משימות" />}
      {selectedHoliday && <HolidayModal holiday={selectedHoliday} onClose={() => setSelectedHoliday(null)} backLabel="משימות" />}

      {/* פרטי משימה מלוח השנה */}
      {calendarSelected && (
        <FullScreenView
          eyebrow="משימה"
          title={calendarSelected.t?.text || 'משימה'}
          backLabel="יומן"
          onClose={() => setCalendarSelectedKey(null)}
        >
          {calendarSelected.customCard || renderTaskItem(
            calendarSelected.t,
            calendarSelected.onToggle,
            () => { calendarSelected.onDelete(); setCalendarSelectedKey(null); },
            calendarSelected.onTogglePerson,
            calendarSelected.onPatch,
            calendarSelected.extra
          )}
        </FullScreenView>
      )}

      {completionPrompt && (
        <CompletionFollowUpModal
          sourceLabel={completionPrompt.label}
          onSkip={() => setCompletionPrompt(null)}
          onCreateFollowUp={(text, dueDate) => {
            const newTask: any = stampCreated({ text, done: false });
            if (dueDate) newTask.dueDate = dueDate;
            const target = completionPrompt.target;
            if (target.kind === 'holiday') {
              updateHolidayExtras(target.id, { tasks: [...(holidayExtras[target.id]?.tasks || []), newTask] });
            } else if (target.kind === 'event') {
              updateEventsData((eventsData as any[]).map((e: any) => e.id === target.id ? { ...e, tasks: [...(e.tasks || []), newTask] } : e));
            } else if (target.kind === 'campaign') {
              patchCampaignTasks(target.id, tasks => [...tasks, newTask]);
            } else {
              // 'standalone' וגם 'personal' (תזכורת תאריך אישי) — משימת המשך
              // חופשית ברשימת המשימות החד-פעמיות.
              updateHolidayExtras(STANDALONE_TASKS_ID, { tasks: [...allStandaloneTasks, newTask] });
            }
            logAction('task_create');
            setCompletionPrompt(null);
          }}
        />
      )}
    </div>
  );
}
