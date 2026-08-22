// ─────────────────────────────────────────────────────────────────────────────
// "מה דורש טיפול" — חישוב טהור לכרטיס הדשבורד.
//
// הקובץ הזה אינו כותב נתונים, אינו משנה סטטוסים ואינו מחליט איך לנווט.
// הוא רק מאחד את חומרי הגלם שכבר קיימים באפליקציה לרשימה קצרה ועקבית.
// ─────────────────────────────────────────────────────────────────────────────

import type { OverdueContact } from './contactFocus';
import { parseDdMmYyyy } from './dateUtils';
import type { PersonalDateEvent } from './personalDates';
import { getHkStatus } from './standingOrders';
import type { HkEntry } from './standingOrders';
import type { TaskItem } from './tasks';

export type FocusGroupKind = 'failures' | 'tasks' | 'thanks' | 'hk' | 'dates' | 'contacts';

export type FocusTarget =
  | { kind: 'contact'; id: string }
  | { kind: 'task'; id: string }
  | { kind: 'hk'; id: string }
  | { kind: 'donation'; id: string };

export interface FocusItem {
  /** מזהה יציב למפתח React; אינו חייב להיות מזהה שרת. */
  id: string;
  label: string;
  sub?: string;
  target: FocusTarget;
}

export interface FocusGroup {
  kind: FocusGroupKind;
  label: string;
  /** המספר המלא, גם כאשר items קוצץ לתצוגה. */
  count: number;
  items: FocusItem[];
}

export interface TodayFocusResult {
  groups: FocusGroup[];
  /** סכום ה-count המלא של כל הקבוצות. */
  total: number;
}

export interface FocusTaskBucket {
  scope: 'standalone' | 'holiday' | 'event';
  contextId: string;
  /** תאריך החג/האירוע. משמש רק כשאין למשימה dueDate מפורש. */
  contextDate?: Date | string | null;
  tasks: TaskItem[];
}

export interface TodayFocusInput {
  today: Date;
  taskBuckets?: FocusTaskBucket[];
  failures?: any[];
  standingOrders?: HkEntry[];
  hkExpiringThreshold?: number;
  personalDates?: PersonalDateEvent[];
  overdueContacts?: OverdueContact[];
  limitPerGroup?: number;
}

const DAY_MS = 86400000;
const FAILURE_WINDOW_DAYS = 30;

function dayStart(value: Date): Date {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseFocusDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : new Date(value);
  const raw = String(value).trim();
  if (!raw) return null;
  // מחרוזת ISO בלי שעה מפוענחת ב-JS כ-UTC ועלולה לזוז יום באזור ישראל.
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    const local = new Date(y, m - 1, d);
    return isNaN(local.getTime()) ? null : local;
  }
  return parseDdMmYyyy(raw.split(' ')[0]);
}

function clip(items: FocusItem[], limit: number): FocusItem[] {
  return items.slice(0, limit);
}

function amountPart(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? ` · ₪${n.toLocaleString('he-IL')}` : '';
}

function taskDue(task: TaskItem, bucket: FocusTaskBucket): Date | null {
  return parseFocusDate(task.dueDate || bucket.contextDate || null);
}

function taskSub(task: TaskItem, due: Date | null, today: Date): string | undefined {
  const bits: string[] = [];
  if (task.urgent) bits.push('מסומן דחוף');
  if (due) {
    const diff = Math.round((dayStart(due).getTime() - today.getTime()) / DAY_MS);
    if (diff < 0) bits.push(`המועד עבר לפני ${Math.abs(diff)} ימים`);
    else bits.push('המועד היום');
  }
  return bits.length ? bits.join(' · ') : undefined;
}

/**
 * בונה את תוכן הכרטיס לפי סדר עדיפות קבוע.
 *
 * חשוב: `createdAt` אינו דדליין. משימה שנוצרה היום אך אין לה dueDate,
 * תאריך הקשר או סימון urgent אינה פעולה שנדרשת היום.
 */
export function buildTodayFocus(input: TodayFocusInput): TodayFocusResult {
  const today = dayStart(input.today);
  const requestedLimit = Number(input.limitPerGroup ?? 5);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.floor(requestedLimit)) : 5;
  const groups: FocusGroup[] = [];

  // ── כשלי חיוב ────────────────────────────────────────────────────────────
  const cutoff = today.getTime() - FAILURE_WINDOW_DAYS * DAY_MS;
  const failures = (input.failures || [])
    .map((failure, index) => ({ failure, index, date: parseFocusDate(failure?.date) }))
    .filter(x => !x.date || x.date.getTime() >= cutoff)
    .sort((a, b) => (b.date?.getTime() ?? -Infinity) - (a.date?.getTime() ?? -Infinity));
  if (failures.length) {
    const items = failures.map(({ failure: f, index, date }) => {
      const name = String(f?.name || '').trim();
      const order = String(f?.order || '').trim();
      const reason = String(f?.reason || 'חיוב שנכשל').trim();
      const when = date ? String(f?.date || '').split(' ')[0] : 'ללא תאריך';
      return {
        id: `failure:${order || name || index}:${when}`,
        label: name || `הוראה ${order || 'לא מזוהה'}`,
        sub: `${reason}${amountPart(f?.amount)} · ${when}`,
        target: name
          ? ({ kind: 'contact', id: name } as const)
          : ({ kind: 'hk', id: order } as const),
      };
    });
    groups.push({ kind: 'failures', label: 'כשלי חיוב', count: items.length, items: clip(items, limit) });
  }

  // ── משימות ותודות ────────────────────────────────────────────────────────
  const taskRows: { item: FocusItem; due: Date | null; urgent: boolean }[] = [];
  const thankRows: FocusItem[] = [];
  (input.taskBuckets || []).forEach(bucket => {
    (bucket.tasks || []).forEach((task, index) => {
      if (!task || task.done) return;
      const id = `${bucket.scope}:${bucket.contextId}:${index}`;
      if (task.kind === 'thankYou') {
        thankRows.push({
          id: `thanks:${id}`,
          label: task.text || `לשלוח תודה${task.personName ? ` — ${task.personName}` : ''}`,
          sub: task.donationDate ? `תרומה מ־${task.donationDate}` : undefined,
          target: { kind: 'task', id },
        });
        return;
      }

      const due = taskDue(task, bucket);
      if (!task.urgent && (!due || dayStart(due).getTime() > today.getTime())) return;
      taskRows.push({
        due,
        urgent: !!task.urgent,
        item: {
          id: `task:${id}`,
          label: task.text || 'משימה ללא כותרת',
          sub: taskSub(task, due, today),
          target: { kind: 'task', id },
        },
      });
    });
  });
  taskRows.sort((a, b) => {
    if (a.due && b.due) return a.due.getTime() - b.due.getTime();
    if (a.due) return -1;
    if (b.due) return 1;
    return Number(b.urgent) - Number(a.urgent);
  });
  if (taskRows.length) {
    const items = taskRows.map(x => x.item);
    groups.push({ kind: 'tasks', label: 'משימות להיום', count: items.length, items: clip(items, limit) });
  }
  if (thankRows.length) {
    groups.push({ kind: 'thanks', label: 'תודות לשליחה', count: thankRows.length, items: clip(thankRows, limit) });
  }

  // ── הוראות קבע ──────────────────────────────────────────────────────────
  const threshold = Number.isFinite(Number(input.hkExpiringThreshold))
    ? Math.max(0, Number(input.hkExpiringThreshold)) : 2;
  const hkRows = (input.standingOrders || [])
    .map((hk, index) => ({ hk, index, status: getHkStatus(hk, threshold) }))
    .filter(x => x.status === 'expiring' || x.status === 'expired')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'expiring' ? -1 : 1;
      return (Number(a.hk.remaining) || 0) - (Number(b.hk.remaining) || 0) || a.hk.name.localeCompare(b.hk.name, 'he');
    });
  if (hkRows.length) {
    const items = hkRows.map(({ hk, index, status }) => {
      const id = String(hk.id || hk.name || index);
      const sub = status === 'expiring'
        ? `נותרו ${Math.max(0, Number(hk.remaining) || 0)} חיובים${amountPart(hk.amount)}`
        : `ההוראה הסתיימה${amountPart(hk.amount)}`;
      return { id: `hk:${id}`, label: hk.name || `הוראה ${id}`, sub, target: { kind: 'hk', id } as const };
    });
    groups.push({ kind: 'hk', label: 'הוראות קבע לטיפול', count: items.length, items: clip(items, limit) });
  }

  // ── תאריכים אישיים ──────────────────────────────────────────────────────
  const dates = (input.personalDates || [])
    .filter(x => Number.isFinite(x.dist) && x.dist >= 0 && x.dist <= 7)
    .sort((a, b) => a.dist - b.dist || a.name.localeCompare(b.name, 'he'));
  if (dates.length) {
    const items: FocusItem[] = dates.map(x => ({
      id: `date:${x.key}`,
      label: `${x.icon || '📅'} ${x.name}`,
      sub: x.msg,
      target: { kind: 'contact', id: x.name },
    }));
    groups.push({ kind: 'dates', label: 'תאריכים קרובים', count: items.length, items: clip(items, limit) });
  }

  // ── קשרים שהתקררו ──────────────────────────────────────────────────────
  const contacts = input.overdueContacts || [];
  if (contacts.length) {
    const items: FocusItem[] = contacts.map((x, index) => ({
      id: `contact:${x.name || index}`,
      label: `${x.icon || '👤'} ${x.name}`,
      sub: x.msg,
      target: { kind: 'contact', id: x.name },
    }));
    groups.push({ kind: 'contacts', label: 'כדאי ליצור קשר', count: items.length, items: clip(items, limit) });
  }

  return { groups, total: groups.reduce((sum, group) => sum + group.count, 0) };
}
