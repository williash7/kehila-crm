import { HistoryEntry } from './history';
import { createTaskId } from './taskIdentity';

export interface CycleTemplate {
  sourceHistoryId: string;
  sourceOccurrenceDate?: string;
  targetOccurrenceDate?: string;
  tasks: any[];
  budget: { expenses: any[]; income: any[] };
}

function parseDateOnly(value: unknown): Date | null {
  const text = String(value || '').trim();
  let year: number, month: number, day: number;
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    [, year, month, day] = match.map(Number);
  } else {
    match = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    if (!match) return null;
    day = Number(match[1]); month = Number(match[2]); year = Number(match[3]);
  }
  const result = new Date(Date.UTC(year, month - 1, day));
  return result.getUTCFullYear() === year
    && result.getUTCMonth() === month - 1
    && result.getUTCDate() === day ? result : null;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** מזיז מועד משימה באותו מספר ימים ביחס למופע הישן. */
export function shiftRelativeDate(
  dueDate: unknown,
  sourceOccurrenceDate: unknown,
  targetOccurrenceDate: unknown,
): string | undefined {
  if (!dueDate) return undefined;
  const due = parseDateOnly(dueDate);
  const source = parseDateOnly(sourceOccurrenceDate);
  const target = parseDateOnly(targetOccurrenceDate);
  if (!due || !source || !target) return undefined;
  const dayMs = 24 * 60 * 60 * 1000;
  const offsetDays = Math.round((due.getTime() - source.getTime()) / dayMs);
  return isoDate(new Date(target.getTime() + offsetDays * dayMs));
}

function resetTask(task: any, sourceDate: unknown, targetDate: unknown, createdAt: string): any {
  const {
    doneAt: _doneAt,
    completedAt: _completedAt,
    createdAt: _createdAt,
    id: _id,
    dueDate: oldDueDate,
    ...rest
  } = task || {};
  const shiftedDueDate = shiftRelativeDate(oldDueDate, sourceDate, targetDate);
  return {
    ...rest,
    done: false,
    skipped: false,
    ...(rest.kind === 'invite' || Array.isArray(rest.doneNames) ? { doneNames: [] } : {}),
    ...(Array.isArray(rest.subtasks)
      ? { subtasks: rest.subtasks.map((subtask: any) => ({ ...subtask, done: false })) }
      : {}),
    ...(shiftedDueDate ? { dueDate: shiftedDueDate } : {}),
    id: createTaskId(),
    createdAt,
  };
}

function resetBudgetRow(row: any): any {
  const planned = row?.planned !== '' && row?.planned != null
    ? row.planned
    : row?.actual !== '' && row?.actual != null ? row.actual : '';
  // שדות כגון ספק, טלפון, הערה וקישור נשמרים; רק תוצאת המחזור מתאפסת.
  return { ...(row || {}), planned, actual: '' };
}

/**
 * יוצר תבנית עבודה ממופע היסטורי. בכוונה אינו מחזיר נוכחות, סיכום,
 * תובנות או תוצאות בפועל — המופע הישן נשאר היסטוריה, והחדש מתחיל נקי.
 */
export function createCycleTemplate(
  entry: HistoryEntry,
  targetOccurrenceDate?: string,
  createdAt = new Date().toISOString(),
): CycleTemplate {
  return {
    sourceHistoryId: entry.id,
    sourceOccurrenceDate: entry.occurrenceDate,
    ...(targetOccurrenceDate ? { targetOccurrenceDate } : {}),
    tasks: (entry.tasks || []).map(task => resetTask(
      task,
      entry.occurrenceDate,
      targetOccurrenceDate,
      createdAt,
    )),
    budget: {
      expenses: (entry.budget?.expenses || []).map(resetBudgetRow),
      income: (entry.budget?.income || []).map(resetBudgetRow),
    },
  };
}
