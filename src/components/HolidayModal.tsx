import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/AppContext';
import { createHolidayDoc } from '../lib/api';
import { X, Check, MessageSquare, FileText, ExternalLink, Loader2, Download, ClipboardList, Pencil } from 'lucide-react';
import { createInviteTask, inviteRemainingMinutes, toggleInvitePerson, MINUTES_PER_CALL, stampCreated } from '../lib/tasks';
import { logAction } from '../lib/score';
import { AIPlanningAssistant } from './AIPlanningAssistant';
import { TaskDetailsPanel } from './TaskDetailsPanel';
import { findLatestHistoryFor } from '../lib/history';
import { Archive } from 'lucide-react';
import { FullScreenView } from './FullScreenView';
import { CompletionFollowUpModal } from './CompletionFollowUpModal';
import { eventsForHoliday, buildHolidayEvent, eventAttendeeNames, holidayAttendeeNames } from '../lib/holidayEvents';
import { getOrg } from '../lib/orgConfig';

export function HolidayModal({ holiday, onClose, backLabel }: { holiday: any, onClose: () => void, backLabel?: string }) {
  const { holidayExtras, updateHolidayExtras, visibleDonors, crm, hk, failures, refresh, history, archiveOccurrence, importTasksFromHistory, eventsData, updateEventsData } = useAppStore();
  const [inviteCategory, setInviteCategory] = useState('all');

  // אירועים שמשוייכים לחג הזה
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [evName, setEvName] = useState('');
  const [evType, setEvType] = useState('other');
  const [evDate, setEvDate] = useState('');
  const [evTime, setEvTime] = useState('');
  const [evLocation, setEvLocation] = useState('');
  const [evEntryPrice, setEvEntryPrice] = useState('');

  // Use either the real id or fallback to stringified name for custom holidays
  const id = holiday.id || holiday.name;
  const extra = holidayExtras[id] || { insights: {}, lastYear: {}, reminders: [], tasks: [], attendance: {} };

  const linkedEvents = useMemo(() => eventsForHoliday(eventsData, id), [eventsData, id]);
  // כמה אנשים **שונים** — מי שבא לשני אירועים בחג נספר פעם אחת
  const totalAttendees = useMemo(
    () => holidayAttendeeNames(extra, linkedEvents).size,
    [extra, linkedEvents]
  );

  const [isEditingInsights, setIsEditingInsights] = useState(false);
  const [isEditingLastYear, setIsEditingLastYear] = useState(false);
  const [isAddingReminder, setIsAddingReminder] = useState(false);
  const [addTaskText, setAddTaskText] = useState('');
  const [addTaskDate, setAddTaskDate] = useState('');
  const [addTaskTime, setAddTaskTime] = useState('');
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [completionPrompt, setCompletionPrompt] = useState<string | null>(null);

  // נוכחות בחג — אותה טכניקה כמו נוכחות באירועים (EventsTab), נשמר בתוך
  // holidayExtras[id].attendance לפי תאריך.
  const [isAttOpen, setIsAttOpen] = useState(false);
  const [attDateISO, setAttDateISO] = useState(() => new Date().toISOString().split('T')[0]);
  const [pendingAtt, setPendingAtt] = useState<Record<string, boolean>>({});
  const [attSearch, setAttSearch] = useState('');
  const [attCategory, setAttCategory] = useState('all');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hDate = new Date(holiday.dateStr);
  const days = Math.ceil((hDate.getTime() - today.getTime()) / 86400000);
  const dateLabel = isNaN(hDate.getTime()) ? '' : hDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

  const [insightForm, setInsightForm] = useState(extra.insights || { good: '', improve: '', plan: '' });
  const [lastYearForm, setLastYearForm] = useState(extra.lastYear || { donors: '', amount: '' });
  const [reminderForm, setReminderForm] = useState({ title: '', days: '7', wa: false });
  const [budgetForm, setBudgetForm] = useState<{expenses: any[], income: any[]}>(extra.budget || { expenses: [], income: [] });
  const [isEditingBudget, setIsEditingBudget] = useState(false);

  const [isInviting, setIsInviting] = useState(false);
  const [inviteText, setInviteText] = useState(`שלום פרטי,\nרצינו להזמין אותך ל${holiday.name}!\nנשמח מאוד לראותך השנה.\n\nלפרטים נוספים ואישור הגעה:\n`);

  const invitees = useMemo(() => {
    let list = Object.values(visibleDonors);
    if (inviteCategory !== 'all') {
      list = list.filter((d: any) => {
        const c = crm[d.name] || {};
        if (inviteCategory === 'target' && !c.target) return false;
        if (inviteCategory === 'hk') {
          const hasHk = hk.some((h: any) => h.name === d.name && h.active);
          if (!hasHk) return false;
        }
        if (inviteCategory === 'errors') {
          const hasError = failures.some((f: any) => f.name === d.name);
          if (!hasError) return false;
        }
        if (['close', 'approach', 'third', 'far'].includes(inviteCategory) && c.circle !== inviteCategory) return false;
        return true;
      });
    } else {
      list = list.filter((d: any) => {
        const c = crm[d.name] || {};
        return c.target || c.circle === 'close' || c.circle === 'approach' || c.circle === 'third';
      });
    }
    return list.sort((a: any, b: any) => {
      const cA = crm[a.name]?.circle;
      const cB = crm[b.name]?.circle;
      if (cA === 'close' && cB !== 'close') return -1;
      if (cB === 'close' && cA !== 'close') return 1;
      return 0;
    });
  }, [visibleDonors, crm]);

  const saveInsights = () => {
    updateHolidayExtras(id, { insights: insightForm });
    setIsEditingInsights(false);
  };

  const saveBudget = () => {
    updateHolidayExtras(id, { budget: budgetForm });
    setIsEditingBudget(false);
  };

  const saveLastYear = () => {
    updateHolidayExtras(id, { lastYear: lastYearForm });
    setIsEditingLastYear(false);
  };

  const saveReminder = () => {
    if (!reminderForm.title.trim()) return;
    const nextReminders = [...(extra.reminders || []), reminderForm];
    updateHolidayExtras(id, { reminders: nextReminders });
    setIsAddingReminder(false);
    setReminderForm({ title: '', days: '7', wa: false });
  };

  const handleCreateDoc = async () => {
    setIsCreatingDoc(true);
    setDocError(null);
    const dateLabel = hDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
    const result = await createHolidayDoc(holiday.name, dateLabel);
    if (result && result.url) {
      const nextDocs = [...(extra.docs || []), { url: result.url, title: result.title, createdAt: new Date().toISOString() }];
      updateHolidayExtras(id, { docs: nextDocs });
      window.open(result.url, '_blank');
    } else {
      setDocError(result?.error
        ? `שגיאת GAS: ${result.error}`
        : 'לא ניתן ליצור מסמך — ה-GAS לא מכיר את הפעולה. הוסף את הקוד המלא מהמדריך.');
    }
    setIsCreatingDoc(false);
  };

  const deleteDoc = (idx: number) => {
    const nextDocs = [...(extra.docs || [])];
    nextDocs.splice(idx, 1);
    updateHolidayExtras(id, { docs: nextDocs });
  };

  const deleteReminder = (idx: number) => {
    const nextReminders = [...(extra.reminders || [])];
    nextReminders.splice(idx, 1);
    updateHolidayExtras(id, { reminders: nextReminders });
  };

  const toggleTask = (idx: number) => {
    const nextTasks = [...(extra.tasks || [])];
    const wasDone = nextTasks[idx].done;
    nextTasks[idx] = { ...nextTasks[idx], done: !nextTasks[idx].done, ...(wasDone ? {} : { doneAt: new Date().toISOString() }) };
    updateHolidayExtras(id, { tasks: nextTasks });
    if (!wasDone) {
      logAction('task_complete');
      setCompletionPrompt(nextTasks[idx].text);
    }
  };

  const addTask = () => {
    if (!addTaskText.trim()) return;
    const newTask: any = stampCreated({ text: addTaskText.trim(), done: false });
    if (addTaskDate) newTask.dueDate = addTaskDate;
    if (addTaskTime) newTask.time = addTaskTime;
    const nextTasks = [...(extra.tasks || []), newTask];
    updateHolidayExtras(id, { tasks: nextTasks });
    logAction('task_create');
    setAddTaskText('');
    setAddTaskDate('');
    setAddTaskTime('');
  };

  const deleteTask = (idx: number) => {
    const nextTasks = [...(extra.tasks || [])];
    nextTasks.splice(idx, 1);
    updateHolidayExtras(id, { tasks: nextTasks });
  };

  // "לדלג" — סוגר משימת "לעדכן את החג" (kind:'holidayReminder') בלי לספור כביצוע בפועל.
  const skipTask = (idx: number) => {
    const nextTasks = [...(extra.tasks || [])];
    const cur = nextTasks[idx];
    nextTasks[idx] = cur.skipped ? { ...cur, done: false, skipped: false } : { ...cur, done: true, skipped: true };
    updateHolidayExtras(id, { tasks: nextTasks });
  };

  const patchTask = (idx: number, patch: Partial<any>) => {
    const nextTasks = [...(extra.tasks || [])];
    nextTasks[idx] = { ...nextTasks[idx], ...patch };
    updateHolidayExtras(id, { tasks: nextTasks });
  };

  const attDonorNames = Object.keys(visibleDonors).filter(n => {
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

  const openAttModal = () => {
    const dateKey = new Date(attDateISO).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    setPendingAtt({ ...(extra.attendance?.[dateKey] || {}) });
    setAttSearch('');
    setIsAttOpen(true);
  };

  // פותח את מודל הנוכחות ישירות על תאריך קיים לעריכה (במקום תמיד היום) —
  // לשימוש מרשימת "כל המפגשים" למטה.
  const openAttModalForDate = (dateKey: string) => {
    const [d, m, y] = dateKey.split('/');
    setAttDateISO(`${y}-${m}-${d}`);
    setPendingAtt({ ...(extra.attendance?.[dateKey] || {}) });
    setAttSearch('');
    setIsAttOpen(true);
  };

  const changeAttDate = (iso: string) => {
    setAttDateISO(iso);
    const dateKey = new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    setPendingAtt({ ...(extra.attendance?.[dateKey] || {}) });
  };

  const saveHolidayAttendance = async () => {
    const dateKey = new Date(attDateISO).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const prevAtt = extra.attendance?.[dateKey] || {};
    // מי סומן "נוכח" כרגע ולא היה מסומן קודם עבור אותו תאריך — רק עבורם
    // נרשום רשומת "יצירת קשר" חדשה, כדי לא ליצור כפילויות בשמירות חוזרות.
    const newlyPresent = Object.keys(pendingAtt).filter(name => pendingAtt[name] && !prevAtt[name]);

    updateHolidayExtras(id, { attendance: { ...(extra.attendance || {}), [dateKey]: pendingAtt } });
    logAction('attendance');
    setIsAttOpen(false);

    if (newlyPresent.length > 0) {
      try {
        const { apiPost } = await import('../lib/api');
        const results = await Promise.all(newlyPresent.map(name =>
          apiPost('addMeeting', {
            name,
            date: dateKey,
            meetType: 'נוכחות בחג',
            purpose: holiday.name || '',
            notes: `נוכחות בחג: ${holiday.name || ''}`,
            nextMeet: ''
          }).then(res => ({ name, res }))
        ));
        const failed = results.filter(r => r.res?.error);
        if (failed.length > 0) {
          console.error('addMeeting failed for:', failed);
          alert(`הנוכחות נשמרה, אך רישום יצירת קשר נכשל עבור: ${failed.map(f => f.name).join(', ')}`);
        }
        refresh();
      } catch (err) {
        console.error('Error logging holiday attendance as contact:', err);
      }
    }
  };

  const lastAttDates = Object.keys(extra.attendance || {}).sort((a, b) => {
    const [d1, m1, y1] = a.split('/');
    const [d2, m2, y2] = b.split('/');
    return new Date(`${y2}-${m2}-${d2}`).getTime() - new Date(`${y1}-${m1}-${d1}`).getTime();
  });

  const handleExportReport = () => {
    const orgLabel = getOrg().orgName.he || getOrg().shortName;
    const dateLabel = hDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
    const tasks = extra.tasks || [];
    const tasksDone = tasks.filter((t: any) => t.done).length;
    const reminders = extra.reminders || [];
    const docs = extra.docs || [];
    const budget = extra.budget || { expenses: [], income: [] };
    const exps = budget.expenses || [];
    const incs = budget.income || [];
    const totalExpPlan = exps.reduce((s: number, e: any) => s + (Number(e.planned) || 0), 0);
    const totalExpAct  = exps.reduce((s: number, e: any) => s + (Number(e.actual)  || 0), 0);
    const totalIncPlan = incs.reduce((s: number, i: any) => s + (Number(i.planned) || 0), 0);
    const totalIncAct  = incs.reduce((s: number, i: any) => s + (Number(i.actual)  || 0), 0);
    const insights = extra.insights || {};

    const row = (label: string, val: string) =>
      `<tr><td class="label">${label}</td><td>${val || '—'}</td></tr>`;

    const section = (title: string, body: string) =>
      `<div class="section"><h2>${title}</h2>${body}</div>`;

    const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<title>דוח חג — ${holiday.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Heebo', sans-serif; background: #fff; color: #1a1a2e; padding: 32px; direction: rtl; font-size: 13px; }
  .header { background: linear-gradient(135deg,#0D1B2A,#1A2E45); color: white; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 24px; font-weight: 900; color: #C9A84C; }
  .header .sub { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px; }
  .header .days { background: rgba(201,168,76,0.15); border: 1px solid rgba(201,168,76,0.3); border-radius: 10px; padding: 10px 16px; text-align: center; }
  .header .days span { display: block; font-size: 28px; font-weight: 900; color: #C9A84C; line-height: 1; }
  .header .days small { font-size: 10px; color: rgba(255,255,255,0.4); }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .kpi { background: #FAF6EE; border: 1px solid #EDE6D6; border-radius: 10px; padding: 14px 16px; }
  .kpi .val { font-size: 22px; font-weight: 900; color: #0D1B2A; }
  .kpi .lbl { font-size: 10px; color: #9B7A2F; text-transform: uppercase; letter-spacing: .05em; margin-top: 2px; }
  .section { background: #fff; border: 1px solid #EDE6D6; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
  .section h2 { font-size: 14px; font-weight: 900; color: #0D1B2A; border-bottom: 2px solid #EDE6D6; padding-bottom: 8px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #0D1B2A; color: #C9A84C; font-size: 10px; padding: 6px 10px; text-align: right; }
  td { padding: 7px 10px; border-bottom: 1px solid #f0ebe0; vertical-align: top; }
  td.label { font-weight: 700; color: #555; width: 120px; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; border-radius: 4px; padding: 2px 7px; font-size: 10px; font-weight: 700; }
  .done { background: #D1FAE5; color: #065F46; }
  .pending { background: #FEF3C7; color: #92400E; }
  .income { color: #059669; font-weight: 700; }
  .expense { color: #DC2626; font-weight: 700; }
  .balance { font-size: 16px; font-weight: 900; }
  .insight-block { background: #FAF6EE; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; font-size: 12px; }
  .insight-block .lbl { font-size: 10px; font-weight: 700; color: #9B7A2F; text-transform: uppercase; margin-bottom: 4px; }
  .meta { font-size: 10px; color: #999; text-align: center; margin-top: 24px; padding-top: 12px; border-top: 1px solid #EDE6D6; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:4px">${orgLabel} — דוח חג</div>
    <h1>${holiday.emoji || '✡️'} ${holiday.name}</h1>
    <div class="sub">${dateLabel}</div>
  </div>
  <div class="days">
    <span>${days > 0 ? days : '—'}</span>
    <small>${days > 0 ? 'ימים לחג' : 'החג עבר'}</small>
  </div>
</div>

<div class="grid2">
  <div class="kpi">
    <div class="val">${extra.lastYear?.donors || '—'}</div>
    <div class="lbl">👥 תורמים אשתקד</div>
  </div>
  <div class="kpi">
    <div class="val">${extra.lastYear?.amount ? '₪' + Number(extra.lastYear.amount).toLocaleString() : '—'}</div>
    <div class="lbl">💰 גיוס אשתקד</div>
  </div>
  <div class="kpi">
    <div class="val">${tasksDone}/${tasks.length}</div>
    <div class="lbl">📋 משימות הושלמו</div>
  </div>
  <div class="kpi">
    <div class="val">${(totalIncAct - totalExpAct) !== 0 ? '₪' + (totalIncAct - totalExpAct).toLocaleString() : '—'}</div>
    <div class="lbl">📈 מאזן בפועל</div>
  </div>
</div>

${tasks.length > 0 ? section('📋 משימות',
  `<table>
    <tr><th>משימה</th><th style="width:80px">סטטוס</th></tr>
    ${tasks.map((t: any) => `<tr><td>${t.text}</td><td><span class="badge ${t.done ? 'done' : 'pending'}">${t.done ? '✓ הושלם' : '⏳ פתוח'}</span></td></tr>`).join('')}
  </table>`) : ''}

${(exps.length > 0 || incs.length > 0) ? section('💰 תקציב',
  `<table>
    <tr><th>סעיף</th><th>סוג</th><th style="width:80px">מתוכנן</th><th style="width:80px">בפועל</th></tr>
    ${exps.map((e: any) => `<tr><td>${e.name}</td><td>הוצאה</td><td>₪${Number(e.planned||0).toLocaleString()}</td><td class="expense">₪${Number(e.actual||0).toLocaleString()}</td></tr>`).join('')}
    ${incs.map((i: any) => `<tr><td>${i.name}</td><td>הכנסה</td><td>₪${Number(i.planned||0).toLocaleString()}</td><td class="income">₪${Number(i.actual||0).toLocaleString()}</td></tr>`).join('')}
    <tr style="background:#FAF6EE;font-weight:700">
      <td colspan="2">סיכום</td>
      <td>₪${(totalExpPlan + totalIncPlan).toLocaleString()}</td>
      <td class="balance ${(totalIncAct - totalExpAct) >= 0 ? 'income' : 'expense'}">₪${(totalIncAct - totalExpAct).toLocaleString()}</td>
    </tr>
  </table>`) : ''}

${(insights.good || insights.improve || insights.plan) ? section('📝 תובנות וסיכום',
  `${insights.good ? `<div class="insight-block"><div class="lbl">✅ מה עבד טוב</div>${insights.good}</div>` : ''}
   ${insights.improve ? `<div class="insight-block"><div class="lbl">📈 מה לשפר</div>${insights.improve}</div>` : ''}
   ${insights.plan ? `<div class="insight-block"><div class="lbl">🗓️ תוכנית לשנה הבאה</div>${insights.plan}</div>` : ''}`) : ''}

${reminders.length > 0 ? section('🔔 תזכורות',
  `<table>
    <tr><th>תזכורת</th><th style="width:100px">לפני החג</th><th style="width:80px">WhatsApp</th></tr>
    ${reminders.map((r: any) => `<tr><td>${r.title}</td><td>${r.days} ימים</td><td>${r.wa ? '✓' : '—'}</td></tr>`).join('')}
  </table>`) : ''}

${docs.length > 0 ? section('📄 מסמכים מקושרים',
  `<table>
    <tr><th>שם המסמך</th><th style="width:140px">תאריך יצירה</th><th style="width:100px">קישור</th></tr>
    ${docs.map((d: any) => `<tr><td>${d.title}</td><td>${new Date(d.createdAt).toLocaleDateString('he-IL')}</td><td><a href="${d.url}" target="_blank">פתח מסמך</a></td></tr>`).join('')}
  </table>`) : ''}

<div class="meta">נוצר על ידי מערכת ${orgLabel} · ${new Date().toLocaleDateString('he-IL', { day:'numeric', month:'long', year:'numeric' })}</div>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  // Derived relative donors
  const relDonors = Object.values(visibleDonors).filter((d: any) => {
    return d.donations?.some((don: any) => {
      if (!don.date) return false;
      const dDateStr = don.date.split('/').reverse().join('-');
      const dDate = new Date(dDateStr);
      return Math.abs(dDate.getTime() - hDate.getTime()) < 45 * 86400000;
    });
  }).slice(0, 5) as any[];

  return (
    <FullScreenView
      eyebrow={holiday.hebrew || 'אירוע'}
      title={holiday.name}
      backLabel={backLabel || 'חזרה'}
      layout="wide"
      onClose={onClose}
      actions={
        <button
          onClick={handleExportReport}
          title="ייצוא דוח"
          className="flex items-center gap-1.5 h-9 px-3 rounded-full text-white/70 hover:bg-white/10 text-xs font-bold transition-colors"
        >
          <Download size={14} /> <span className="hidden md:inline">ייצוא דוח</span>
        </button>
      }
    >
      <>

        {/* העברה להיסטוריה — שומר תמונת מצב (משימות/נוכחות/תקציב) ומרוקן את
            המשימות החיות כדי שהמופע הבא (השנה הבאה) יתחיל נקי */}
        <button
          onClick={() => {
            if (!confirm(`להעביר את "${holiday.name}" להיסטוריה? המשימות הנוכחיות יישמרו בהיסטוריה ויתאפסו כדי שאפשר יהיה לתכנן מחדש לשנה הבאה (עם אפשרות לייבא אותן בחזרה).`)) return;
            archiveOccurrence({ type: 'holiday', id, name: holiday.name, occurrenceDate: holiday.dateStr });
          }}
          className="w-full flex items-center justify-center gap-1.5 bg-[#0D1B2A]/5 text-[#0D1B2A]/70 text-xs font-bold py-2 rounded-xl mb-4 hover:bg-[#0D1B2A]/10 transition-colors"
        >
          <Archive size={13} /> סמן חג זה כהסתיים והעבר להיסטוריה
        </button>

        <div className="bg-gradient-to-br from-[#2D1B69] to-[#4A2E8C] rounded-2xl p-4 text-white mb-5 flex items-center gap-4 relative overflow-hidden">
          <div className="text-4xl relative z-10">{holiday.emoji || '📅'}</div>
          <div className="flex-1 relative z-10">
            <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold">{holiday.name}</div>
            <div className="text-xs text-white/60 mb-1">{hDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            {holiday.desc && <div className="text-[11px] text-white/50">{holiday.desc}</div>}
          </div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-center shrink-0 relative z-10">
            <span className="font-['Frank_Ruhl_Libre'] text-2xl font-black block leading-none">{days > 0 ? days : 'X'}</span>
            <span className="text-[10px] text-white/50">{days > 0 ? 'ימים' : 'עבר'}</span>
          </div>
          <div className="absolute -left-2 -top-2 text-7xl opacity-5">✡</div>
        </div>

        {/* במסך רחב: מימין מה שצריך לעשות לקראת החג, משמאל המספרים והחומר.
            בנייד זו נשארת עמודה אחת בסדר הקיים. */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
        <div className="min-w-0">

        {/* Reminders section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">🔔 תזכורות</h3>
            <button onClick={() => setIsAddingReminder(!isAddingReminder)} className="text-xs font-bold text-[#9B7A2F] bg-[#C9A84C]/10 px-3 py-1.5 rounded-lg active:scale-95 transition-transform">+ הוסף</button>
          </div>
          
          {isAddingReminder && (
             <div className="bg-white rounded-xl p-4 shadow-sm mb-3 border border-[#EDE6D6]">
               <div className="space-y-3">
                 <div>
                   <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">כותרת התזכורת</label>
                   <input value={reminderForm.title} onChange={e => setReminderForm({...reminderForm, title: e.target.value})} type="text" className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C]" placeholder="שלח הזמנות, הכן עלון..." />
                 </div>
                 <div>
                   <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">כמה לפני החג?</label>
                   <select value={reminderForm.days} onChange={e => setReminderForm({...reminderForm, days: e.target.value})} className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C]">
                     <option value="7">שבוע</option>
                     <option value="14">שבועיים</option>
                     <option value="30">חודש</option>
                   </select>
                 </div>
                 <div className="flex items-center gap-2">
                   <input type="checkbox" checked={reminderForm.wa} onChange={e => setReminderForm({...reminderForm, wa: e.target.checked})} id="remWaCheck" />
                   <label htmlFor="remWaCheck" className="text-xs font-semibold text-[#0D1B2A]">שליחה ב-WhatsApp Business?</label>
                 </div>
                 <button onClick={saveReminder} className="w-full bg-[#0D1B2A] text-[#E8C97A] font-bold rounded-lg py-2 mt-2">שמור תזכורת</button>
               </div>
             </div>
          )}

          <div className="space-y-2">
            {extra.reminders?.length > 0 ? extra.reminders.map((r: any, i: number) => (
              <div key={i} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between border-r-4 border-blue-400">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🔔</span>
                  <div>
                    <div className="text-sm font-bold text-[#0D1B2A]">{r.title}</div>
                    <div className="text-[11px] text-gray-500">{r.days} ימים לפני · {r.wa ? 'WhatsApp' : 'תזכורת בלבד'}</div>
                  </div>
                </div>
                <button onClick={() => deleteReminder(i)} className="text-red-400 hover:text-red-600 bg-red-50 p-2 rounded-lg"><X size={16}/></button>
              </div>
            )) : <div className="text-sm text-gray-400 text-center bg-gray-50 rounded-xl p-3">אין תזכורות למאורע זה</div>}
          </div>
        </div>

        {/* Tasks Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">📋 משימות</h3>
          </div>
          {(!extra.tasks || extra.tasks.length === 0) && findLatestHistoryFor(history, 'holiday', holiday.name) && (
            <button
              onClick={() => importTasksFromHistory({ type: 'holiday', id, name: holiday.name })}
              className="w-full flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700 text-sm font-bold py-2.5 rounded-xl mb-3"
            >
              <ClipboardList size={14} /> ייבא משימות מהפעם הקודמת
            </button>
          )}
          <div className="space-y-2 mb-3">
            {extra.tasks?.length > 0 ? extra.tasks.map((t: any, i: number) => (
              t.kind === 'invite' ? (
                <div key={i} className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-bold ${t.done ? 'text-gray-400 line-through' : 'text-[#0D1B2A]'}`}>{t.text}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-gray-400">נותרו ~{inviteRemainingMinutes(t)} דק'</span>
                      <button onClick={() => deleteTask(i)} className="text-red-300 hover:text-red-500" title="מחק משימה"><X size={14} /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(t.people || []).map((p: string) => {
                      const isDone = (t.doneNames || []).includes(p);
                      return (
                        <button
                          key={p}
                          onClick={async () => {
                            const wasDone = (t.doneNames || []).includes(p);
                            const nextTasks = [...extra.tasks];
                            nextTasks[i] = toggleInvitePerson(t, p);
                            updateHolidayExtras(id, { tasks: nextTasks });
                            if (!wasDone) {
                              logAction('invite_done');
                              try {
                                const { apiPost } = await import('../lib/api');
                                const dateKey = new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                const res = await apiPost('addMeeting', {
                                  name: p,
                                  date: dateKey,
                                  meetType: 'טלפון',
                                  purpose: `הזמנה ל${holiday.name}`,
                                  notes: `הוזמן/ה לחג: ${holiday.name}`,
                                  nextMeet: ''
                                });
                                if (res?.error) {
                                  console.error('addMeeting failed for', p, res);
                                  alert(`רישום יצירת הקשר עבור ${p} נכשל: ${res.error}`);
                                } else {
                                  refresh();
                                }
                              } catch (err) {
                                console.error('Error logging invite as contact:', err);
                              }
                            }
                          }}
                          className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${isDone ? 'bg-[#D1FAE5] border-[#10B981] text-[#065F46] line-through' : 'bg-[#FAF6EE] border-[#EDE6D6] text-[#0D1B2A]'}`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                  <TaskDetailsPanel task={t} onPatch={patch => patchTask(i, patch)} />
                </div>
              ) : (
                <div key={i} className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div onClick={() => toggleTask(i)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 cursor-pointer ${t.done ? 'bg-[#C9A84C] border-[#C9A84C]' : 'border-gray-300'}`}>
                      {t.done && <Check size={12} className="text-white" />}
                    </div>
                    <span onClick={() => toggleTask(i)} className={`text-sm flex-1 cursor-pointer ${t.done ? 'text-gray-400 line-through' : 'text-[#0D1B2A]'}`}>{t.text}</span>
                    {t.kind === 'holidayReminder' && (
                      <button
                        onClick={() => skipTask(i)}
                        className={`text-[10px] px-2 py-1 rounded-full border shrink-0 whitespace-nowrap ${t.skipped ? 'bg-[#FEF3C7] border-[#F59E0B] text-[#92400E]' : 'bg-[#FAF6EE] border-[#EDE6D6] text-gray-500'}`}
                        title={t.skipped ? 'בטל דילוג' : 'לדלג הפעם — לא צריך לעדכן'}
                      >
                        {t.skipped ? '↩️ בוטל' : '⏭️ לדלג'}
                      </button>
                    )}
                    <button onClick={() => deleteTask(i)} className="text-red-300 hover:text-red-500 shrink-0" title="מחק משימה"><X size={14} /></button>
                  </div>
                  <TaskDetailsPanel task={t} onPatch={patch => patchTask(i, patch)} />
                </div>
              )
            )) : null}
          </div>
          <div className="flex gap-2 mb-2">
            <input value={addTaskText} onChange={e => setAddTaskText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} type="text" className="flex-1 bg-white border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C]" placeholder="משימה חדשה..." />
            <button onClick={addTask} className="bg-[#0D1B2A] rounded-xl px-4 text-[#E8C97A] font-bold shadow-sm">הוסף</button>
          </div>
          <div className="flex gap-2 mb-3">
            <input value={addTaskDate} onChange={e => setAddTaskDate(e.target.value)} type="date" className="flex-1 bg-white border border-[#EDE6D6] rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C9A84C]" title="תאריך (לא חובה)" />
            <input value={addTaskTime} onChange={e => setAddTaskTime(e.target.value)} type="time" className="flex-1 bg-white border border-[#EDE6D6] rounded-xl px-3 py-2 text-xs outline-none focus:border-[#C9A84C]" title="שעה (לא חובה)" />
          </div>

          <AIPlanningAssistant
            title={holiday.name}
            includeBudget
            includeReminders
            contextLines={[
              `החג בעוד ${days > 0 ? days : 0} ימים (${dateLabel})`,
              ...(extra.lastYear?.donors || extra.lastYear?.amount ? [`בשנה שעברה: ${extra.lastYear?.donors || '?'} תורמים, ₪${extra.lastYear?.amount || '?'} גיוס`] : []),
              ...(extra.tasks?.length ? [`משימות שכבר קיימות: ${extra.tasks.map((t: any) => t.text).join(', ')}`] : []),
            ]}
            onApply={(result) => {
              let nextTasks = extra.tasks || [];
              if (result.tasks?.length) nextTasks = [...nextTasks, ...result.tasks.map(text => stampCreated({ text, done: false }))];
              let nextBudget = extra.budget || { expenses: [], income: [] };
              if (result.budget?.length) {
                const newExpenses = result.budget.filter(b => b.type === 'expense').map(b => ({ name: b.name, planned: b.amount, actual: '' }));
                const newIncome = result.budget.filter(b => b.type === 'income').map(b => ({ name: b.name, planned: b.amount, actual: '' }));
                nextBudget = { expenses: [...(nextBudget.expenses || []), ...newExpenses], income: [...(nextBudget.income || []), ...newIncome] };
              }
              let nextReminders = extra.reminders || [];
              if (result.reminders?.length) nextReminders = [...nextReminders, ...result.reminders.map(r => ({ title: r.title, days: String(r.days), wa: false }))];
              updateHolidayExtras(id, { tasks: nextTasks, budget: nextBudget, reminders: nextReminders });
              if (result.tasks?.length) logAction('task_create', result.tasks.length);
            }}
          />
        </div>

        {/* Invitations Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">✉️ שליחת הזמנות ב-WhatsApp</h3>
            <button onClick={() => setIsInviting(!isInviting)} className="text-xs font-bold text-[#9B7A2F] bg-[#C9A84C]/10 px-3 py-1.5 rounded-lg active:scale-95 transition-transform">{isInviting ? 'סגור' : 'הזמן מתפללים'}</button>
          </div>

          {isInviting && (
            <div className="bg-white rounded-xl p-4 shadow-sm mb-3 border border-[#EDE6D6]">
              <label className="block text-[11px] font-bold text-[#0D1B2A] uppercase mb-2">נוסח ההזמנה</label>
              <textarea 
                value={inviteText} 
                onChange={e => setInviteText(e.target.value)} 
                rows={4} 
                className="w-full bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C] resize-none mb-4" 
                placeholder="הכנס כאן את נוסח ההזמנה..."
              />
              
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-bold text-gray-500 uppercase">שלח ל ({invitees.length}):</div>
                <button
                  onClick={() => {
                    const nextTasks = [...(extra.tasks || []), createInviteTask(holiday.name, invitees.map((d: any) => d.name))];
                    updateHolidayExtras(id, { tasks: nextTasks });
                    logAction('task_create');
                    alert(`נוספה משימה: הזמנת ${invitees.length} אנשים (≈ ${invitees.length * MINUTES_PER_CALL} דקות שיחות טלפון). אפשר לעקוב אחריה בכרטיסיית "משימות" ⬅ "משימות חג".`);
                  }}
                  disabled={invitees.length === 0}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-[#9B7A2F] bg-[#C9A84C]/10 px-2.5 py-1 rounded-lg hover:bg-[#C9A84C]/20 transition-colors disabled:opacity-40"
                >
                  <ClipboardList size={12} /> שמור כמשימת הזמנה
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar shrink-0">
                {[
                  { id: 'all', label: 'שורשי מוקדי' },
                  { id: 'close', label: '⭐ קרוב' },
                  { id: 'approach', label: '🔄 מתקרב' },
                  { id: 'third', label: '⭕ מ. שלישי' },
                  { id: 'target', label: '🎯 להקרב' },
                  { id: 'hk', label: 'הוק' },
                  { id: 'errors', label: 'שגיאות' }
                ].map(c => (
                  <button
                    key={c.id}
                    onClick={() => setInviteCategory(c.id)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium border-[1.5px] transition-colors ${
                      inviteCategory === c.id
                        ? 'bg-[#0D1B2A] border-[#0D1B2A] text-[#C9A84C]'
                        : 'bg-white border-[#EDE6D6] text-gray-500'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {invitees.map((d: any, i: number) => {
                  const circle = crm[d.name]?.circle;
                  const isTarget = crm[d.name]?.target;
                  return (
                    <div key={i} className="flex justify-between items-center bg-[#FAF6EE] rounded-lg p-2 border border-[#EDE6D6]">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-[#0D1B2A] truncate max-w-[150px]">{d.name}</div>
                        <div className="flex gap-1">
                          {circle === 'close' && <span className="text-[10px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded-md">⭐</span>}
                          {circle === 'approach' && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md">🔄</span>}
                          {circle === 'third' && <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-md">⭕</span>}
                          {isTarget && <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-md">🎯</span>}
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          let p = (crm[d.name]?.phone || '').replace(/\D/g, '');
                          if (p && p.startsWith('0')) p = '972' + p.substring(1);
                          const fn = d.name.trim().split(' ')[0] || d.name;
                          const msg = inviteText.replace('פרטי', fn);
                          const url = p ? `https://wa.me/${p}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                          window.open(url, '_blank');
                        }}
                        className="bg-[#25D366]/10 text-[#25D366] p-2 rounded-lg hover:bg-[#25D366]/20 transition-colors flex items-center gap-1 font-bold text-[10px]"
                      >
                        <MessageSquare size={14} /> WhatsApp
                      </button>
                    </div>
                  );
                })}
                {invitees.length === 0 && (
                  <div className="text-center text-gray-500 text-xs py-4">אין מתפללים במעגלי הקרבה. תוכל להוסיף אותם בכרטיסיה אנשי קשר.</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* פעילויות בחג — חג יכול להחזיק כמה התכנסויות נפרדות */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">🎪 הפעילויות בחג</h3>
            <button
              onClick={() => { setIsAddingEvent(!isAddingEvent); setEvDate(holiday.dateStr || holiday.date?.split('T')[0] || ''); }}
              className="bg-[#C9A84C]/10 text-[#9B7A2F] text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
            >
              {isAddingEvent ? 'בטל' : '+ הוסף פעילות'}
            </button>
          </div>

          {isAddingEvent && (
            <div className="bg-white rounded-xl shadow-sm border border-[#EDE6D6] p-3 mb-3 space-y-2">
              <input
                value={evName} onChange={e => setEvName(e.target.value)}
                placeholder="שם הפעילות — למשל: סעודת ליל החג"
                className="w-full border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C]"
              />
              <div className="grid grid-cols-3 gap-2">
                <select value={evType} onChange={e => setEvType(e.target.value)}
                        className="border border-[#EDE6D6] rounded-lg px-2 py-2 text-sm outline-none focus:border-[#C9A84C]">
                  <option value="shabbat">סעודה</option>
                  <option value="minyan">מניין</option>
                  <option value="class">שיעור</option>
                  <option value="other">אחר</option>
                </select>
                <input type="date" value={evDate} onChange={e => setEvDate(e.target.value)}
                       className="border border-[#EDE6D6] rounded-lg px-2 py-2 text-sm outline-none focus:border-[#C9A84C]" />
                <input type="time" value={evTime} onChange={e => setEvTime(e.target.value)}
                       className="border border-[#EDE6D6] rounded-lg px-2 py-2 text-sm outline-none focus:border-[#C9A84C]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={evLocation} onChange={e => setEvLocation(e.target.value)} placeholder="מקום — אופציונלי" className="border border-[#EDE6D6] rounded-lg px-2 py-2 text-sm outline-none focus:border-[#C9A84C]" />
                <input type="number" min="0" value={evEntryPrice} onChange={e => setEvEntryPrice(e.target.value)} placeholder="מחיר כניסה — אופציונלי" className="border border-[#EDE6D6] rounded-lg px-2 py-2 text-sm outline-none focus:border-[#C9A84C]" />
              </div>
              <button
                onClick={() => {
                  if (!evName.trim() || !evDate) return;
                  updateEventsData([...eventsData, buildHolidayEvent(id, { name: evName, type: evType, date: evDate, time: evTime, location: evLocation, entryPrice: Number(evEntryPrice) || 0 })]);
                  logAction('event_create');
                  setEvName(''); setEvTime(''); setEvLocation(''); setEvEntryPrice(''); setIsAddingEvent(false);
                }}
                disabled={!evName.trim() || !evDate}
                className="w-full bg-[#0D1B2A] text-white py-2 rounded-lg text-sm font-bold disabled:opacity-40"
              >
                צור פעילות
              </button>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                הפעילות תנוהל במסך הפעילויות — שם תסמן נוכחות, תשלום, משימות ותקציב.
                הנוכחות שלו תיספר גם בחג.
              </p>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-[#EDE6D6] overflow-hidden">
            {linkedEvents.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-4">
                אין פעילויות בחג הזה. אפשר להוסיף, או לנהל את מעטפת החג כמו שהיא.
              </div>
            ) : (
              <div className="divide-y divide-[#EDE6D6]">
                {linkedEvents.map(ev => {
                  const attCount = eventAttendeeNames(ev).size;
                  const openTasks = (ev.tasks || []).filter((t: any) => !t.done).length;
                  return (
                    <div key={ev.id} className="px-4 py-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#0D1B2A]">{ev.name}</span>
                        <span className="text-[#9B7A2F] text-xs">{ev.date}{ev.time ? ` · ${ev.time}` : ''}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 flex gap-3">
                        <span>{attCount} נוכחים</span>
                        {openTasks > 0 && <span>{openTasks} משימות פתוחות</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        </div>
        <div className="min-w-0">

        {/* Attendance Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">🙋 נוכחות בחג</h3>
            <button onClick={openAttModal} className="bg-[#C9A84C]/10 text-[#9B7A2F] text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform flex items-center gap-1.5">
              <Check size={14}/> סמן נוכחות
            </button>
          </div>
          {/* איחוד: כמה אנשים שונים היו איתך בחג, כולל דרך האירועים */}
          {totalAttendees > 0 && (
            <div className="bg-[#0D1B2A] text-white rounded-xl px-4 py-3 mb-2 flex items-baseline justify-between">
              <span className="text-sm text-white/70">סה״כ אנשים שונים בחג</span>
              <span className="font-['Frank_Ruhl_Libre'] text-2xl font-bold text-[#C9A84C]">{totalAttendees}</span>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-[#EDE6D6] overflow-hidden">
            {lastAttDates.length === 0 && linkedEvents.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-4">עדיין לא נרשמה נוכחות לחג זה</div>
            ) : (
              <div className="divide-y divide-[#EDE6D6]">
                {lastAttDates.map(dateKey => {
                  const count = Object.values(extra.attendance[dateKey]).filter(Boolean).length;
                  return (
                    <button
                      key={dateKey}
                      onClick={() => openAttModalForDate(dateKey)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-[#FAF6EE] transition-colors"
                    >
                      <span className="text-[#0D1B2A]"><span className="font-bold">{count}</span> נוכחים</span>
                      <span className="flex items-center gap-1.5 text-[#9B7A2F] font-medium">{dateKey} <Pencil size={11} /></span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Budget Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">💰 תכנון תקציב</h3>
            <button onClick={() => setIsEditingBudget(!isEditingBudget)} className="text-xs font-bold text-[#9B7A2F] bg-[#C9A84C]/10 px-3 py-1.5 rounded-lg active:scale-95 transition-transform">{isEditingBudget ? 'בטל' : 'עריכה ✏️'}</button>
          </div>

          {isEditingBudget ? (
            <div className="bg-white rounded-xl p-4 shadow-sm mb-3 border border-[#EDE6D6]">
              <div className="space-y-4">
                {/* Expenses */}
                <div>
                  <h4 className="text-xs font-bold text-[#0D1B2A] mb-2 border-b pb-1">הוצאות</h4>
                  {budgetForm.expenses.map((exp: any, i: number) => (
                    <div key={i} className="flex gap-2 mb-2 items-center">
                      <input value={exp.name} onChange={e => { const newE = [...budgetForm.expenses]; newE[i].name = e.target.value; setBudgetForm({...budgetForm, expenses: newE}) }} className="flex-1 bg-white border border-[#EDE6D6] rounded-md px-2 py-1 text-xs" placeholder="שם הוצאה" />
                      <input value={exp.planned} onChange={e => { const newE = [...budgetForm.expenses]; newE[i].planned = e.target.value; setBudgetForm({...budgetForm, expenses: newE}) }} className="w-16 bg-white border border-[#EDE6D6] rounded-md px-2 py-1 text-xs" type="number" placeholder="מתוכנן" />
                      <input value={exp.actual} onChange={e => { const newE = [...budgetForm.expenses]; newE[i].actual = e.target.value; setBudgetForm({...budgetForm, expenses: newE}) }} className="w-16 bg-white border border-[#EDE6D6] rounded-md px-2 py-1 text-xs" type="number" placeholder="בפועל" />
                      <button onClick={() => { const newE = [...budgetForm.expenses]; newE.splice(i, 1); setBudgetForm({...budgetForm, expenses: newE}) }} className="text-red-400"><X size={14} /></button>
                    </div>
                  ))}
                  <button onClick={() => setBudgetForm({...budgetForm, expenses: [...budgetForm.expenses, {name:'', planned:'', actual:''}]})} className="text-xs text-[#9B7A2F] font-bold">+ הוסף הוצאה</button>
                </div>

                {/* Income */}
                <div>
                  <h4 className="text-xs font-bold text-[#0D1B2A] mb-2 border-b pb-1">הכנסות מיועדות</h4>
                  {budgetForm.income.map((inc: any, i: number) => (
                    <div key={i} className="flex gap-2 mb-2 items-center">
                      <input value={inc.name} onChange={e => { const newI = [...budgetForm.income]; newI[i].name = e.target.value; setBudgetForm({...budgetForm, income: newI}) }} className="flex-1 bg-white border border-[#EDE6D6] rounded-md px-2 py-1 text-xs" placeholder="שם הכנסה" />
                      <input value={inc.planned} onChange={e => { const newI = [...budgetForm.income]; newI[i].planned = e.target.value; setBudgetForm({...budgetForm, income: newI}) }} className="w-16 bg-white border border-[#EDE6D6] rounded-md px-2 py-1 text-xs" type="number" placeholder="מתוכנן" />
                      <input value={inc.actual} onChange={e => { const newI = [...budgetForm.income]; newI[i].actual = e.target.value; setBudgetForm({...budgetForm, income: newI}) }} className="w-16 bg-white border border-[#EDE6D6] rounded-md px-2 py-1 text-xs" type="number" placeholder="בפועל" />
                      <button onClick={() => { const newI = [...budgetForm.income]; newI.splice(i, 1); setBudgetForm({...budgetForm, income: newI}) }} className="text-red-400"><X size={14} /></button>
                    </div>
                  ))}
                  <button onClick={() => setBudgetForm({...budgetForm, income: [...budgetForm.income, {name:'', planned:'', actual:''}]})} className="text-xs text-[#9B7A2F] font-bold">+ הוסף הכנסה</button>
                </div>
                
                <button onClick={saveBudget} className="w-full bg-[#0D1B2A] text-[#E8C97A] font-bold rounded-lg py-2 mt-2">שמור תקציב</button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-4 border border-[#EDE6D6]">
              {(() => {
                const exps = extra.budget?.expenses || [];
                const incs = extra.budget?.income || [];
                if (exps.length === 0 && incs.length === 0) {
                  return <div className="text-sm text-gray-400 text-center py-2">אין נתוני תקציב. לחץ על עריכה להוספה.</div>;
                }
                
                const totalExpPlan = exps.reduce((sum: number, e: any) => sum + (Number(e.planned) || 0), 0);
                const totalExpAct = exps.reduce((sum: number, e: any) => sum + (Number(e.actual) || 0), 0);
                const totalIncAct = incs.reduce((sum: number, i: any) => sum + (Number(i.actual) || 0), 0);
                
                return (
                  <div className="space-y-4">
                    {/* Summary row */}
                    <div className="grid grid-cols-3 gap-2 text-center border-b border-[#EDE6D6] pb-3">
                      <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">הוצאות (בפועל)</div>
                        <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-red-600">₪{totalExpAct.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">הכנסות (בפועל)</div>
                        <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-green-600">₪{totalIncAct.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">מאזן</div>
                        <div className={`font-['Frank_Ruhl_Libre'] text-lg font-bold ${totalIncAct - totalExpAct >= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">₪{(totalIncAct - totalExpAct).toLocaleString()}</div>
                      </div>
                    </div>
                    
                    {/* Detailed list if not too many, or just a small summary */}
                    <div className="space-y-3">
                      {exps.length > 0 && (
                        <div>
                          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">פירוט הוצאות</div>
                          {exps.map((e: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                              <span className="font-medium text-[#0D1B2A]">{e.name}</span>
                              <span className="text-gray-600">תכנון: ₪{e.planned || 0} | <span className="font-bold text-red-600">בפועל: ₪{e.actual || 0}</span></span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {incs.length > 0 && (
                        <div>
                          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">פירוט הכנסות</div>
                          {incs.map((inc: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                              <span className="font-medium text-[#0D1B2A]">{inc.name}</span>
                              <span className="text-gray-600">תכנון: ₪{inc.planned || 0} | <span className="font-bold text-green-600">בפועל: ₪{inc.actual || 0}</span></span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Last Year Stats Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">📈 שנה שעברה</h3>
            <button onClick={() => setIsEditingLastYear(!isEditingLastYear)} className="text-xs font-bold text-[#9B7A2F] bg-[#C9A84C]/10 px-3 py-1.5 rounded-lg active:scale-95 transition-transform">{isEditingLastYear ? 'בטל' : 'עדכון ✏️'}</button>
          </div>
          {isEditingLastYear ? (
             <div className="bg-white rounded-xl p-4 shadow-sm mb-3 border border-[#EDE6D6]">
               <div className="space-y-3">
                 <div>
                   <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">מספר תורמים</label>
                   <input value={lastYearForm.donors} onChange={e => setLastYearForm({...lastYearForm, donors: e.target.value})} type="number" className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C]" placeholder="0" />
                 </div>
                 <div>
                   <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">סכום כולל (₪)</label>
                   <input value={lastYearForm.amount} onChange={e => setLastYearForm({...lastYearForm, amount: e.target.value})} type="number" className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C]" placeholder="0" />
                 </div>
                 <button onClick={saveLastYear} className="w-full bg-[#0D1B2A] text-[#E8C97A] font-bold rounded-lg py-2 mt-2">שמור נתונים</button>
               </div>
             </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden flex divide-x divide-x-reverse divide-[#EDE6D6] border border-[#EDE6D6]">
              <div className="flex-1 p-3 flex items-center gap-3">
                <span className="text-2xl opacity-80">👥</span>
                <div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">תורמים שתרמו</div>
                  <div className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A]">{extra.lastYear?.donors || '—'}</div>
                </div>
              </div>
              <div className="flex-1 p-3 flex items-center gap-3">
                <span className="text-2xl opacity-80">💰</span>
                <div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">סכום כולל (₪)</div>
                  <div className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A]">{extra.lastYear?.amount ? Number(extra.lastYear.amount).toLocaleString() : '—'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Insights Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">📝 תובנות וסיכום</h3>
            <button onClick={() => setIsEditingInsights(!isEditingInsights)} className="text-xs font-bold text-[#9B7A2F] bg-[#C9A84C]/10 px-3 py-1.5 rounded-lg active:scale-95 transition-transform">{isEditingInsights ? 'בטל' : 'עריכה ✏️'}</button>
          </div>
          {isEditingInsights ? (
             <div className="bg-white rounded-xl p-4 shadow-sm mb-3 border border-[#EDE6D6]">
               <div className="space-y-3">
                 <div>
                   <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1.5">✅ מה עבד טוב?</label>
                   <textarea value={insightForm.good} onChange={e => setInsightForm({...insightForm, good: e.target.value})} rows={2} className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C] resize-none" placeholder="מה הצליח..."></textarea>
                 </div>
                 <div>
                   <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1.5">📈 מה לשפר?</label>
                   <textarea value={insightForm.improve} onChange={e => setInsightForm({...insightForm, improve: e.target.value})} rows={2} className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C] resize-none" placeholder="מה אפשר לעשות טוב יותר..."></textarea>
                 </div>
                 <div>
                   <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1.5">🗓️ תוכנית לשנה הבאה</label>
                   <textarea value={insightForm.plan} onChange={e => setInsightForm({...insightForm, plan: e.target.value})} rows={2} className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C] resize-none" placeholder="רעיונות, תוכניות..."></textarea>
                 </div>
                 <button onClick={saveInsights} className="w-full bg-[#0D1B2A] text-[#E8C97A] font-bold rounded-lg py-2 mt-2">שמור תובנות</button>
               </div>
             </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-4 border border-[#EDE6D6] space-y-3">
              {extra.insights?.good || extra.insights?.improve || extra.insights?.plan ? (
                <>
                  {extra.insights?.good && (
                    <div className="flex gap-3">
                      <span className="text-lg">✅</span>
                      <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">מה עבד טוב </div>
                        <div className="text-sm font-medium text-[#0D1B2A] mt-0.5">{extra.insights.good}</div>
                      </div>
                    </div>
                  )}
                  {extra.insights?.improve && (
                    <div className="flex gap-3 pt-3 border-t border-[#EDE6D6]">
                      <span className="text-lg">📈</span>
                      <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">מה לשפר</div>
                        <div className="text-sm font-medium text-[#0D1B2A] mt-0.5">{extra.insights.improve}</div>
                      </div>
                    </div>
                  )}
                  {extra.insights?.plan && (
                    <div className="flex gap-3 pt-3 border-t border-[#EDE6D6]">
                      <span className="text-lg">🗓️</span>
                      <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">תוכנית לשנה הבאה</div>
                        <div className="text-sm font-medium text-[#0D1B2A] mt-0.5">{extra.insights.plan}</div>
                      </div>
                    </div>
                  )}
                </>
              ) : <div className="text-sm text-gray-400 text-center py-2">לחץ עריכה להוספת תובנות</div>}
            </div>
          )}
        </div>

        {/* Documents Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">📄 מסמכים</h3>
            <button
              onClick={handleCreateDoc}
              disabled={isCreatingDoc}
              className="text-xs font-bold text-[#9B7A2F] bg-[#C9A84C]/10 px-3 py-1.5 rounded-lg active:scale-95 transition-transform flex items-center gap-1.5 disabled:opacity-50"
            >
              {isCreatingDoc ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
              {isCreatingDoc ? 'יוצר...' : 'צור מסמך Google'}
            </button>
          </div>

          {docError && (
            <div className="bg-red-50 text-red-600 text-xs rounded-xl p-3 mb-3 border border-red-200">{docError}</div>
          )}

          <div className="space-y-2">
            {(extra.docs || []).length > 0 ? (extra.docs || []).map((doc: any, i: number) => (
              <div key={i} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between border border-[#EDE6D6]">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={18} className="text-[#4285F4] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#0D1B2A] truncate">{doc.title}</div>
                    <div className="text-[10px] text-gray-400">{new Date(doc.createdAt).toLocaleDateString('he-IL')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-[#4285F4] bg-blue-50 p-2 rounded-lg hover:bg-blue-100">
                    <ExternalLink size={14} />
                  </a>
                  <button onClick={() => deleteDoc(i)} className="text-red-400 bg-red-50 p-2 rounded-lg hover:bg-red-100">
                    <X size={14} />
                  </button>
                </div>
              </div>
            )) : (
              <div className="text-sm text-gray-400 text-center bg-gray-50 rounded-xl p-3">
                לחץ "צור מסמך Google" ליצירת מסמך תכנון מקושר לחג
              </div>
            )}
          </div>
        </div>

        {/* Related Donors */}
        {relDonors.length > 0 && (
          <div>
            <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] mb-3">👥 תורמים קשורים מאזור התאריך</h3>
            <div className="space-y-2">
              {relDonors.map((d, i) => (
                <div key={i} className="bg-white rounded-xl p-3 border border-[#EDE6D6] flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0D1B2A] to-[#1A2E45] text-white flex items-center justify-center font-bold text-xs">
                      {d.name?.charAt(0)}
                    </div>
                    <div className="text-sm font-bold text-[#0D1B2A]">{d.name}</div>
                  </div>
                  <div className="text-xs font-semibold text-[#9B7A2F]">₪{d.total?.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
        </div>
      </>

      {/* Attendance Modal */}
      {isAttOpen && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-end justify-center p-0 md:p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setIsAttOpen(false)}>
          <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl p-5 pb-8 w-full max-w-[430px] max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h2 className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A] flex items-center gap-2">✅ נוכחות — {holiday.name}</h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <label className="text-xs text-gray-500 shrink-0">תאריך:</label>
                  <input
                    type="date"
                    value={attDateISO}
                    onChange={e => changeAttDate(e.target.value)}
                    className="bg-white border border-[#EDE6D6] rounded-lg px-2 py-1 text-xs outline-none focus:border-[#C9A84C]"
                  />
                </div>
              </div>
              <button onClick={() => setIsAttOpen(false)} className="bg-gray-200/50 p-2 rounded-full text-gray-500 hover:bg-gray-200 shrink-0"><X size={16}/></button>
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

            <div className="flex-1 overflow-y-auto pr-1 space-y-2 mb-4 custom-scrollbar">
              {attDonorNames.map(n => {
                const isChecked = pendingAtt[n];
                return (
                  <div key={n} onClick={() => setPendingAtt({...pendingAtt, [n]: !isChecked})} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer shadow-sm transition-colors border ${isChecked ? 'bg-[#D1FAE5] border-[#10B981]/50' : 'bg-white border-[#EDE6D6]'}`}>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0D1B2A] to-[#1A2E45] text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {n.charAt(0)}
                    </div>
                    <div className="flex-1 font-bold text-[#0D1B2A]">{n}</div>
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isChecked ? 'bg-[#10B981] border-[#10B981] text-white' : 'bg-white border-[#EDE6D6]'}`}>
                      {isChecked && <Check size={14} />}
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={saveHolidayAttendance} className="w-full bg-gradient-to-br from-[#0D1B2A] to-[#1A2E45] text-white rounded-xl py-3.5 font-bold shadow-md shrink-0">
              שמור נוכחות ({Object.values(pendingAtt).filter(Boolean).length})
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
            updateHolidayExtras(id, { tasks: [...(extra.tasks || []), newTask] });
            logAction('task_create');
            setCompletionPrompt(null);
          }}
        />
      )}
    </FullScreenView>
  );
}
