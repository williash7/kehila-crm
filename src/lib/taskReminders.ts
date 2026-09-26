import { TaskItem } from './tasks';

export type TaskRecurrence = 'weekly' | 'biweekly' | 'monthly';
export type ReminderPreset = 'at_time' | 'day_before' | 'week_before' | 'custom';

export interface TaskOccurrenceHistoryEntry {
  dueDate?: string;
  time?: string;
  outcome: 'done' | 'skipped' | 'open';
  resolvedAt?: string;
  archivedAt: string;
}

export type ReminderTask = TaskItem & {
  recurrence?: TaskRecurrence;
  recurrenceAnchorDate?: string;
  reminderPreset?: ReminderPreset;
  reminderOffsetMinutes?: number;
  snoozedUntil?: string;
  occurrenceHistory?: TaskOccurrenceHistoryEntry[];
};

export const REMINDER_PRESET_MINUTES: Record<Exclude<ReminderPreset, 'custom'>, number> = {
  at_time: 0,
  day_before: 24 * 60,
  week_before: 7 * 24 * 60,
};

export function localIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDate(iso: string | undefined): Date | null {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonthsClamped(date: Date, months: number): Date {
  const originalDay = date.getDate();
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

export function nextRecurringDateOnOrAfter(
  anchorIso: string | undefined,
  recurrence: TaskRecurrence | undefined,
  from: Date,
): string | null {
  const anchor = parseLocalDate(anchorIso);
  if (!anchor || !recurrence) return anchorIso || null;

  const target = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let cursor = new Date(anchor);
  if (recurrence === 'weekly' || recurrence === 'biweekly') {
    const step = recurrence === 'weekly' ? 7 : 14;
    while (cursor.getTime() < target.getTime()) cursor.setDate(cursor.getDate() + step);
  } else {
    while (cursor.getTime() < target.getTime()) cursor = addMonthsClamped(cursor, 1);
  }
  return localIsoDate(cursor);
}

export function nextFridayOnOrAfter(from: Date): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const delta = (5 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return localIsoDate(d);
}

export function taskDueDateTime(task: Pick<TaskItem, 'dueDate' | 'time'>): Date | null {
  const date = parseLocalDate(task.dueDate);
  if (!date) return null;
  if (task.time && /^\d{2}:\d{2}$/.test(task.time)) {
    const [h, m] = task.time.split(':').map(Number);
    date.setHours(h, m, 0, 0);
  } else {
    // משימה ללא שעה מגיעה לזמנה בפתיחה הראשונה של אותו יום.
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

export function taskReminderDateTime(task: ReminderTask): Date | null {
  if (task.snoozedUntil) {
    const snoozed = new Date(task.snoozedUntil);
    if (!Number.isNaN(snoozed.getTime())) return snoozed;
  }
  const due = taskDueDateTime(task);
  if (!due) return null;
  const offset = Math.max(0, Number(task.reminderOffsetMinutes || 0));
  return new Date(due.getTime() - offset * 60_000);
}

export function isTaskReminderDue(task: ReminderTask, now = new Date()): boolean {
  if (!task || task.done || task.skipped) return false;
  const reminderAt = taskReminderDateTime(task);
  return !!reminderAt && reminderAt.getTime() <= now.getTime();
}

export function reminderOffsetForPreset(preset: ReminderPreset): number | undefined {
  return preset === 'custom' ? undefined : REMINDER_PRESET_MINUTES[preset];
}

export function reminderOffsetFromCustom(task: ReminderTask, localDateTime: string): number | null {
  const due = taskDueDateTime(task);
  const custom = new Date(localDateTime);
  if (!due || Number.isNaN(custom.getTime())) return null;
  return Math.max(0, Math.round((due.getTime() - custom.getTime()) / 60_000));
}

export function customReminderLocalValue(task: ReminderTask): string {
  const reminder = taskReminderDateTime({ ...task, snoozedUntil: undefined });
  if (!reminder) return '';
  const y = reminder.getFullYear();
  const m = String(reminder.getMonth() + 1).padStart(2, '0');
  const d = String(reminder.getDate()).padStart(2, '0');
  const h = String(reminder.getHours()).padStart(2, '0');
  const min = String(reminder.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

function historyEntryFor(task: ReminderTask, now: Date): TaskOccurrenceHistoryEntry | null {
  if (!task.dueDate) return null;
  const outcome: TaskOccurrenceHistoryEntry['outcome'] = task.skipped ? 'skipped' : task.done ? 'done' : 'open';
  return {
    dueDate: task.dueDate,
    time: task.time,
    outcome,
    resolvedAt: task.doneAt,
    archivedAt: now.toISOString(),
  };
}

export function normalizeRecurringTask(
  task: ReminderTask,
  recurrence: TaskRecurrence | undefined,
  fallbackAnchorDate: string | undefined,
  now = new Date(),
): ReminderTask {
  if (!recurrence) return task;

  const anchor = task.recurrenceAnchorDate || task.dueDate || fallbackAnchorDate;
  if (!anchor) return { ...task, recurrence };
  const targetDue = nextRecurringDateOnOrAfter(anchor, recurrence, now);
  if (!targetDue) return { ...task, recurrence, recurrenceAnchorDate: anchor };

  const base: ReminderTask = {
    ...task,
    recurrence,
    recurrenceAnchorDate: anchor,
  };

  if (!task.dueDate) {
    return { ...base, dueDate: targetDue };
  }

  const current = parseLocalDate(task.dueDate);
  const target = parseLocalDate(targetDue);
  if (!current || !target || current.getTime() >= target.getTime()) return base;

  const historyEntry = historyEntryFor(task, now);
  return {
    ...base,
    dueDate: targetDue,
    done: false,
    skipped: false,
    doneAt: undefined,
    snoozedUntil: undefined,
    occurrenceHistory: historyEntry
      ? [...(task.occurrenceHistory || []), historyEntry].slice(-52)
      : (task.occurrenceHistory || []),
  };
}

export function taskDecisionPrompt(task: ReminderTask, contextLabel?: string): string {
  const dueBits = [task.dueDate, task.time].filter(Boolean).join(' ');
  const context = contextLabel ? `\nהקשר: ${contextLabel}.` : '';
  return `יש לי משימה שדורשת החלטה עכשיו: "${task.text}".${context}${dueBits ? `\nמועד המשימה: ${dueBits}.` : ''}\nעזור לי להחליט עכשיו בין שלוש אפשרויות: לבצע עכשיו, לדחות לזמן מוגדר, או לוותר על המופע הנוכחי. שאל רק שאלה אחת אם היא באמת הכרחית; אחרת תן לי המלצה מעשית וצעד אחד לביצוע.`;
}
