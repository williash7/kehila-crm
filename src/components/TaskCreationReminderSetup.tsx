import React from 'react';
import { BellRing, CalendarDays, Clock, Repeat2, X } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { STANDALONE_TASKS_ID } from '../lib/tasks';
import {
  ReminderPreset,
  ReminderTask,
  TaskRecurrence,
  reminderOffsetForPreset,
  reminderOffsetFromCustom,
} from '../lib/taskReminders';

type SourceKind = 'standalone' | 'holiday' | 'event' | 'project';
type TaskRef = {
  source: SourceKind;
  parentId: string;
  parentLabel: string;
  index: number;
  task: ReminderTask;
  inheritedRecurrence?: TaskRecurrence;
};

type LocalPreset = ReminderPreset | 'none';

const AUTO_KINDS = new Set(['homeVisit', 'thankYou', 'holidayReminder', 'eventReminder']);
const RECURRENCES = new Set<TaskRecurrence>(['weekly', 'biweekly', 'monthly']);

function taskKey(ref: TaskRef): string {
  return ref.task.id || `${ref.source}:${ref.parentId}:${ref.index}:${ref.task.createdAt || ref.task.text}`;
}

function recentEnough(task: ReminderTask): boolean {
  const created = task.createdAt ? new Date(task.createdAt).getTime() : 0;
  return !!created && !Number.isNaN(created) && Date.now() - created < 10 * 60_000;
}

export function TaskCreationReminderSetup() {
  const {
    loading,
    holidayExtras,
    updateHolidayExtras,
    eventsData,
    updateEventsData,
    projects,
    updateProjects,
  } = useAppStore();

  const known = React.useRef<Set<string>>(new Set());
  const initialized = React.useRef(false);
  const [queue, setQueue] = React.useState<TaskRef[]>([]);
  const current = queue[0] || null;

  const [dueDate, setDueDate] = React.useState('');
  const [time, setTime] = React.useState('');
  const [recurrence, setRecurrence] = React.useState<TaskRecurrence | ''>('');
  const [preset, setPreset] = React.useState<LocalPreset>('at_time');
  const [customReminder, setCustomReminder] = React.useState('');
  const [error, setError] = React.useState('');

  const refs = React.useMemo<TaskRef[]>(() => {
    const out: TaskRef[] = [];
    Object.entries(holidayExtras || {}).forEach(([id, extra]: [string, any]) => {
      (extra?.tasks || []).forEach((task: ReminderTask, index: number) => out.push({
        source: id === STANDALONE_TASKS_ID ? 'standalone' : 'holiday',
        parentId: id,
        parentLabel: id === STANDALONE_TASKS_ID ? 'משימה עצמאית' : id,
        index,
        task,
      }));
    });
    (eventsData as any[]).forEach(ev => {
      const inheritedRecurrence = RECURRENCES.has(ev.freq) ? ev.freq as TaskRecurrence : undefined;
      (ev.tasks || []).forEach((task: ReminderTask, index: number) => out.push({
        source: 'event', parentId: ev.id, parentLabel: ev.name || 'פעילות', index, task, inheritedRecurrence,
      }));
    });
    projects.forEach((project: any) => (project.tasks || []).forEach((task: ReminderTask, index: number) => out.push({
      source: 'project', parentId: project.id, parentLabel: project.name || 'קמפיין', index, task,
    })));
    return out;
  }, [holidayExtras, eventsData, projects]);

  React.useEffect(() => {
    if (loading) return;
    if (!initialized.current) {
      refs.forEach(ref => known.current.add(taskKey(ref)));
      initialized.current = true;
      return;
    }

    const newlyCreated: TaskRef[] = [];
    refs.forEach(ref => {
      const key = taskKey(ref);
      if (known.current.has(key)) return;
      known.current.add(key);
      if (AUTO_KINDS.has(String(ref.task.kind || ''))) return;
      if (!recentEnough(ref.task)) return;
      newlyCreated.push(ref);
    });
    if (newlyCreated.length) {
      setQueue(prev => {
        const existing = new Set(prev.map(taskKey));
        return [...prev, ...newlyCreated.filter(ref => !existing.has(taskKey(ref)))];
      });
    }
  }, [loading, refs]);

  React.useEffect(() => {
    if (!current) return;
    setDueDate(current.task.dueDate || '');
    setTime(current.task.time || '');
    setRecurrence(current.task.recurrence || current.inheritedRecurrence || '');
    if (current.task.reminderPreset) setPreset(current.task.reminderPreset);
    else if (current.task.reminderOffsetMinutes === 7 * 24 * 60) setPreset('week_before');
    else if (current.task.reminderOffsetMinutes === 24 * 60) setPreset('day_before');
    else setPreset('at_time');
    setCustomReminder('');
    setError('');
  }, [current && taskKey(current)]);

  const patchRef = (ref: TaskRef, patch: Partial<ReminderTask>) => {
    const matches = (task: ReminderTask, index: number) => ref.task.id ? task.id === ref.task.id : index === ref.index;
    if (ref.source === 'standalone' || ref.source === 'holiday') {
      const extra = holidayExtras[ref.parentId] || {};
      const tasks = [...(extra.tasks || [])];
      const idx = tasks.findIndex((task: ReminderTask, index: number) => matches(task, index));
      if (idx < 0) return;
      tasks[idx] = { ...tasks[idx], ...patch };
      updateHolidayExtras(ref.parentId, { tasks });
      return;
    }
    if (ref.source === 'event') {
      updateEventsData((eventsData as any[]).map(ev => {
        if (ev.id !== ref.parentId) return ev;
        const tasks = [...(ev.tasks || [])];
        const idx = tasks.findIndex((task: ReminderTask, index: number) => matches(task, index));
        if (idx >= 0) tasks[idx] = { ...tasks[idx], ...patch };
        return { ...ev, tasks };
      }));
      return;
    }
    updateProjects(projects.map((project: any) => {
      if (project.id !== ref.parentId) return project;
      const tasks = [...(project.tasks || [])];
      const idx = tasks.findIndex((task: ReminderTask, index: number) => matches(task, index));
      if (idx >= 0) tasks[idx] = { ...tasks[idx], ...patch };
      return { ...project, tasks };
    }) as any);
  };

  const next = () => setQueue(prev => prev.slice(1));

  const save = () => {
    if (!current) return;
    if (preset !== 'none' && !dueDate) {
      setError('כדי לקבוע תזכורת צריך לבחור תאריך למשימה.');
      return;
    }

    const patch: Partial<ReminderTask> = {
      dueDate: dueDate || undefined,
      time: time || undefined,
      recurrence: recurrence || undefined,
      recurrenceAnchorDate: recurrence && dueDate ? dueDate : undefined,
      snoozedUntil: undefined,
    };

    if (preset === 'none') {
      patch.reminderPreset = undefined;
      patch.reminderOffsetMinutes = undefined;
    } else if (preset === 'custom') {
      if (!customReminder) {
        setError('בחר תאריך ושעה לתזכורת האישית.');
        return;
      }
      const offset = reminderOffsetFromCustom({ ...current.task, dueDate, time } as ReminderTask, customReminder);
      if (offset === null) {
        setError('לא הצלחתי לחשב את זמן התזכורת.');
        return;
      }
      patch.reminderPreset = 'custom';
      patch.reminderOffsetMinutes = offset;
    } else {
      patch.reminderPreset = preset;
      patch.reminderOffsetMinutes = reminderOffsetForPreset(preset);
    }

    patchRef(current, patch);
    next();
  };

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[1100] bg-[#0D1B2A]/75 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#EDE6D6]">
        <div className="bg-[#FAF6EE] px-5 py-4 border-b border-[#EDE6D6]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold text-[#9B7A2F]">השלמת יצירת המשימה</div>
              <h2 className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A] mt-0.5">{current.task.text}</h2>
              <div className="text-[11px] text-gray-400 mt-1">{current.parentLabel}</div>
            </div>
            <button onClick={next} className="p-1.5 text-gray-400 hover:text-gray-600" title="דלג על הגדרת תזכורת כרגע"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-gray-500 flex flex-col gap-1">
              <span className="flex items-center gap-1"><CalendarDays size={12} /> מועד המשימה</span>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="border border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C]" />
            </label>
            <label className="text-[11px] text-gray-500 flex flex-col gap-1">
              <span className="flex items-center gap-1"><Clock size={12} /> שעה</span>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="border border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C]" />
            </label>
          </div>

          <label className="text-[11px] text-gray-500 flex flex-col gap-1">
            <span className="flex items-center gap-1"><Repeat2 size={12} /> חזרה</span>
            <select value={recurrence} onChange={e => setRecurrence(e.target.value as TaskRecurrence | '')} className="border border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C] bg-white">
              <option value="">חד-פעמית</option>
              <option value="weekly">כל שבוע</option>
              <option value="biweekly">כל שבועיים</option>
              <option value="monthly">כל חודש</option>
            </select>
            {current.inheritedRecurrence && <span className="text-[9px] text-gray-400">ברירת המחדל נלקחה מהפעילות החוזרת.</span>}
          </label>

          <label className="text-[11px] text-gray-500 flex flex-col gap-1">
            <span className="flex items-center gap-1"><BellRing size={12} /> מתי התזכורת תקפוץ</span>
            <select value={preset} onChange={e => { setPreset(e.target.value as LocalPreset); setError(''); }} className="border border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C] bg-white">
              <option value="at_time">בזמן המשימה</option>
              <option value="day_before">יום לפני</option>
              <option value="week_before">שבוע לפני</option>
              <option value="custom">בחירה אישית</option>
              <option value="none">בלי תזכורת</option>
            </select>
          </label>

          {preset === 'custom' && (
            <label className="text-[11px] text-gray-500 flex flex-col gap-1">
              <span>תאריך ושעה אישיים</span>
              <input type="datetime-local" value={customReminder} onChange={e => setCustomReminder(e.target.value)} className="border border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C]" />
              {recurrence && <span className="text-[9px] text-gray-400">במחזורים הבאים יישמר אותו מרווח בין התזכורת למועד המשימה.</span>}
            </label>
          )}

          {error && <div className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}

          <button onClick={save} className="w-full bg-[#0D1B2A] text-[#E8C97A] rounded-2xl py-3 font-bold text-sm shadow-sm">שמור והמשך</button>
          <button onClick={next} className="w-full text-xs text-gray-400 py-1">דלג כרגע — אפשר לערוך אחר כך בפרטי המשימה</button>
        </div>
      </div>
    </div>
  );
}
