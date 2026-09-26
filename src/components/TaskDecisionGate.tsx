import React from 'react';
import { Ban, Bot, Check, Clock3, Copy, CalendarClock } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { STANDALONE_TASKS_ID } from '../lib/tasks';
import {
  ReminderTask,
  TaskRecurrence,
  isTaskReminderDue,
  nextFridayOnOrAfter,
  normalizeRecurringTask,
  parseLocalDate,
  taskDecisionPrompt,
  taskReminderDateTime,
} from '../lib/taskReminders';

type SourceKind = 'standalone' | 'holiday' | 'event' | 'project';

type DueTaskRef = {
  source: SourceKind;
  parentId: string;
  parentLabel: string;
  index: number;
  task: ReminderTask;
};

const RECURRENCES = new Set<TaskRecurrence>(['weekly', 'biweekly', 'monthly']);

function sameTasks(a: any[] | undefined, b: any[]): boolean {
  return JSON.stringify(a || []) === JSON.stringify(b);
}

function isPastDate(iso: string | undefined, now: Date): boolean {
  const d = parseLocalDate(iso);
  if (!d) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d.getTime() < today.getTime();
}

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  el.remove();
  return Promise.resolve();
}

function normalizeStandaloneTask(task: ReminderTask, now: Date): ReminderTask {
  // מעבר חד-פעמי למשימה שהייתה קיימת כחד-פעמית למרות שבפועל היא שבועית.
  if (task.text?.trim() === 'לפרסם את זמני השבת' && !task.recurrence) {
    const friday = nextFridayOnOrAfter(now);
    return {
      ...task,
      dueDate: friday,
      recurrence: 'weekly',
      recurrenceAnchorDate: friday,
      reminderPreset: task.reminderPreset || 'at_time',
      reminderOffsetMinutes: task.reminderOffsetMinutes ?? 0,
      done: false,
      skipped: false,
      doneAt: undefined,
      snoozedUntil: undefined,
    };
  }
  const recurrence = RECURRENCES.has(task.recurrence as TaskRecurrence)
    ? task.recurrence as TaskRecurrence
    : undefined;
  return normalizeRecurringTask(task, recurrence, task.dueDate, now);
}

export function TaskDecisionGate() {
  const {
    loading,
    holidayExtras,
    updateHolidayExtras,
    eventsData,
    updateEventsData,
    projects,
    updateProjects,
  } = useAppStore();

  const [normalizationReady, setNormalizationReady] = React.useState(false);
  const [now, setNow] = React.useState(() => new Date());
  const [customSnooze, setCustomSnooze] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  // השעון ממשיך להתקדם גם אם האפליקציה נשארה פתוחה על אותו מסך.
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // מנרמל מחזורים לפני שמציגים חלון חוסם. כך משימות מאוגוסט לא קופצות
  // כמטלה של היום; הן נשמרות occurrenceHistory והמופע הנוכחי מקבל תאריך חדש.
  // now נמצא בתלויות כדי שגם אפליקציה שנשארה פתוחה תתקדם למחזור הבא בדיוק
  // כשמגיע זמן התזכורת שלו, בלי לדרוש רענון או שינוי נתונים אחר.
  React.useEffect(() => {
    if (loading) return;
    const current = now;
    let changed = false;

    Object.entries(holidayExtras || {}).forEach(([id, extra]: [string, any]) => {
      const tasks: ReminderTask[] = Array.isArray(extra?.tasks) ? extra.tasks : [];
      if (!tasks.length) return;
      const normalized = tasks.map(t => id === STANDALONE_TASKS_ID
        ? normalizeStandaloneTask(t, current)
        : normalizeRecurringTask(
            t,
            RECURRENCES.has(t.recurrence as TaskRecurrence) ? t.recurrence as TaskRecurrence : undefined,
            t.dueDate,
            current,
          ));
      if (!sameTasks(tasks, normalized)) {
        changed = true;
        updateHolidayExtras(id, { tasks: normalized });
      }
    });

    const normalizedEvents = (eventsData as any[]).map(ev => {
      const parentRecurrence = RECURRENCES.has(ev.freq) ? ev.freq as TaskRecurrence : undefined;
      if (!Array.isArray(ev.tasks) || ev.tasks.length === 0) return ev;
      const tasks = (ev.tasks as ReminderTask[]).map(task => {
        // תזכורת "מחר — אירוע" נוצרת מחדש לכל מופע במנגנון הישן.
        // ישנות נסגרות בשקט; נוכחיות מקבלות התראה יום לפני תאריך האירוע.
        if (task.kind === 'eventReminder') {
          if (isPastDate(task.dueDate, current)) {
            return { ...task, done: true, skipped: true, doneAt: task.doneAt || current.toISOString() };
          }
          return {
            ...task,
            reminderPreset: task.reminderPreset || 'day_before',
            reminderOffsetMinutes: task.reminderOffsetMinutes ?? 24 * 60,
          };
        }
        const recurrence = RECURRENCES.has(task.recurrence as TaskRecurrence)
          ? task.recurrence as TaskRecurrence
          : parentRecurrence;
        return normalizeRecurringTask(task, recurrence, task.dueDate || ev.date, current);
      });
      return sameTasks(ev.tasks, tasks) ? ev : { ...ev, tasks };
    });
    if (JSON.stringify(normalizedEvents) !== JSON.stringify(eventsData)) {
      changed = true;
      updateEventsData(normalizedEvents);
    }

    const normalizedProjects = projects.map((project: any) => {
      if (!Array.isArray(project.tasks) || project.tasks.length === 0) return project;
      const tasks = (project.tasks as ReminderTask[]).map(task => normalizeRecurringTask(
        task,
        RECURRENCES.has(task.recurrence as TaskRecurrence) ? task.recurrence as TaskRecurrence : undefined,
        task.dueDate,
        current,
      ));
      return sameTasks(project.tasks, tasks) ? project : { ...project, tasks };
    });
    if (JSON.stringify(normalizedProjects) !== JSON.stringify(projects)) {
      changed = true;
      updateProjects(normalizedProjects as any);
    }

    // גם כשבוצעו כתיבות React יצרף אותן לרינדור הבא; הדגל נועד רק למנוע
    // מהמצב הישן להציג חלון חוסם לפני שהנרמול קיבל הזדמנות לרוץ.
    setNormalizationReady(true);
    if (changed) setNow(new Date());
  // update* הן פונקציות יציבות מספיק לצורך האפקט; הכנסתן לתלויות תגרום
  // לריצה בכל render כי הן נוצרות מחדש ב-AppProvider.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, holidayExtras, eventsData, projects, now]);

  const dueTasks = React.useMemo<DueTaskRef[]>(() => {
    if (loading || !normalizationReady) return [];
    const rows: DueTaskRef[] = [];

    Object.entries(holidayExtras || {}).forEach(([id, extra]: [string, any]) => {
      (extra?.tasks || []).forEach((task: ReminderTask, index: number) => {
        if (!isTaskReminderDue(task, now)) return;
        rows.push({
          source: id === STANDALONE_TASKS_ID ? 'standalone' : 'holiday',
          parentId: id,
          parentLabel: id === STANDALONE_TASKS_ID ? 'משימה עצמאית' : id,
          index,
          task,
        });
      });
    });

    (eventsData as any[]).forEach(ev => (ev.tasks || []).forEach((task: ReminderTask, index: number) => {
      if (!isTaskReminderDue(task, now)) return;
      rows.push({ source: 'event', parentId: ev.id, parentLabel: ev.name || 'פעילות', index, task });
    }));

    projects.forEach((project: any) => (project.tasks || []).forEach((task: ReminderTask, index: number) => {
      if (!isTaskReminderDue(task, now)) return;
      rows.push({ source: 'project', parentId: project.id, parentLabel: project.name || 'קמפיין', index, task });
    }));

    return rows.sort((a, b) => {
      const ad = taskReminderDateTime(a.task)?.getTime() || 0;
      const bd = taskReminderDateTime(b.task)?.getTime() || 0;
      return ad - bd;
    });
  }, [loading, normalizationReady, holidayExtras, eventsData, projects, now]);

  const current = dueTasks[0];

  React.useEffect(() => {
    setCustomSnooze('');
    setCopied(false);
  }, [current?.task.id, current?.task.dueDate, current?.parentId]);

  const patchCurrent = (patch: Partial<ReminderTask>) => {
    if (!current) return;
    const matches = (task: ReminderTask, index: number) => current.task.id
      ? task.id === current.task.id
      : index === current.index;

    if (current.source === 'standalone' || current.source === 'holiday') {
      const extra = holidayExtras[current.parentId] || {};
      const tasks = [...(extra.tasks || [])];
      const idx = tasks.findIndex((task: ReminderTask, index: number) => matches(task, index));
      if (idx < 0) return;
      tasks[idx] = { ...tasks[idx], ...patch };
      updateHolidayExtras(current.parentId, { tasks });
      return;
    }

    if (current.source === 'event') {
      updateEventsData((eventsData as any[]).map(ev => {
        if (ev.id !== current.parentId) return ev;
        const tasks = [...(ev.tasks || [])];
        const idx = tasks.findIndex((task: ReminderTask, index: number) => matches(task, index));
        if (idx >= 0) tasks[idx] = { ...tasks[idx], ...patch };
        return { ...ev, tasks };
      }));
      return;
    }

    updateProjects(projects.map((project: any) => {
      if (project.id !== current.parentId) return project;
      const tasks = [...(project.tasks || [])];
      const idx = tasks.findIndex((task: ReminderTask, index: number) => matches(task, index));
      if (idx >= 0) tasks[idx] = { ...tasks[idx], ...patch };
      return { ...project, tasks };
    }) as any);
  };

  const finish = (skipped: boolean) => patchCurrent({
    done: true,
    skipped,
    doneAt: new Date().toISOString(),
    snoozedUntil: undefined,
  });

  const snoozeHours = (hours: number) => {
    const d = new Date();
    d.setHours(d.getHours() + hours);
    patchCurrent({ snoozedUntil: d.toISOString() });
  };

  const snoozeTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    patchCurrent({ snoozedUntil: d.toISOString() });
  };

  const applyCustomSnooze = () => {
    if (!customSnooze) return;
    const d = new Date(customSnooze);
    if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) return;
    patchCurrent({ snoozedUntil: d.toISOString() });
  };

  if (!current) return null;

  const reminderAt = taskReminderDateTime(current.task);
  const dueLabel = [current.task.dueDate, current.task.time].filter(Boolean).join(' · ');

  return (
    <div className="fixed inset-0 z-[1000] bg-[#0D1B2A]/80 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="task-decision-title">
      <div className="w-full max-w-lg bg-[#FAF6EE] rounded-3xl shadow-2xl border border-[#E8C97A]/40 overflow-hidden">
        <div className="bg-[#0D1B2A] px-5 py-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] text-[#E8C97A] font-bold">הגיע הזמן להחליט</div>
              <h2 id="task-decision-title" className="font-['Frank_Ruhl_Libre'] text-2xl font-bold mt-0.5">{current.task.text}</h2>
            </div>
            <div className="shrink-0 text-[11px] bg-white/10 px-2.5 py-1.5 rounded-full">{dueTasks.length > 1 ? `1 מתוך ${dueTasks.length}` : 'משימה אחת'}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/70">
            <span className="bg-white/10 rounded-full px-2 py-1">{current.parentLabel}</span>
            {dueLabel && <span className="bg-white/10 rounded-full px-2 py-1 flex items-center gap-1"><CalendarClock size={12} /> {dueLabel}</span>}
            {reminderAt && <span className="bg-white/10 rounded-full px-2 py-1">תזכורת: {reminderAt.toLocaleString('he-IL')}</span>}
          </div>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed">כדי להמשיך להשתמש באפליקציה צריך להחליט מה עושים עם המשימה הזאת. דחייה תפתח את האפליקציה ותעלה שוב את החלון בזמן החדש.</p>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => finish(false)} className="rounded-2xl bg-emerald-600 text-white py-3 px-3 font-bold text-sm flex items-center justify-center gap-2 shadow-sm">
              <Check size={18} /> בוצע
            </button>
            <button onClick={() => finish(true)} className="rounded-2xl bg-white border border-red-200 text-red-600 py-3 px-3 font-bold text-sm flex items-center justify-center gap-2 shadow-sm">
              <Ban size={18} /> לא יבוצע
            </button>
          </div>

          <div className="bg-white border border-[#EDE6D6] rounded-2xl p-3">
            <div className="text-xs font-bold text-[#0D1B2A] flex items-center gap-1.5 mb-2"><Clock3 size={14} /> הזכר לי מאוחר יותר</div>
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={() => snoozeHours(1)} className="py-2 rounded-xl bg-[#FAF6EE] border border-[#EDE6D6] text-xs font-medium">בעוד שעה</button>
              <button onClick={() => snoozeHours(3)} className="py-2 rounded-xl bg-[#FAF6EE] border border-[#EDE6D6] text-xs font-medium">בעוד 3 שעות</button>
              <button onClick={snoozeTomorrow} className="py-2 rounded-xl bg-[#FAF6EE] border border-[#EDE6D6] text-xs font-medium">מחר 09:00</button>
            </div>
            <div className="flex gap-2 mt-2">
              <input type="datetime-local" value={customSnooze} onChange={e => setCustomSnooze(e.target.value)} className="flex-1 min-w-0 border border-[#EDE6D6] rounded-xl px-2 py-2 text-xs outline-none focus:border-[#C9A84C]" />
              <button onClick={applyCustomSnooze} disabled={!customSnooze} className="px-3 rounded-xl bg-[#0D1B2A] text-[#E8C97A] text-xs font-bold disabled:opacity-40">קבע</button>
            </div>
          </div>

          <button
            onClick={async () => {
              await copyText(taskDecisionPrompt(current.task, current.parentLabel));
              setCopied(true);
            }}
            className="w-full rounded-2xl bg-[#FFF8E6] border border-[#E8C97A] text-[#6F5520] py-3 px-4 font-bold text-sm flex items-center justify-center gap-2"
          >
            {copied ? <Copy size={17} /> : <Bot size={17} />}
            {copied ? 'הפרומפט הועתק — החלון נשאר פתוח עד שתחליט' : 'עזור לי להחליט עם בינה מלאכותית'}
          </button>

          <div className="text-[10px] text-gray-400 text-center">אין כפתור סגירה בכוונה. במשימה חוזרת „לא יבוצע” סוגר רק את המופע הנוכחי; המחזור הבא ייווצר כרגיל.</div>
        </div>
      </div>
    </div>
  );
}
