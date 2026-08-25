export interface ReminderCounts {
  failures: number;
  dueTasks: number;
  expiringOrders: number;
  total: number;
}

function parseTaskDate(value: unknown): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const il = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const parts = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : il ? [Number(il[3]), Number(il[2]), Number(il[1])] : null;
  if (!parts) return null;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return Number.isNaN(date.getTime()) ? null : date;
}

function allTasks(input: { holidayExtras?: Record<string, any>; eventsData?: any[]; projects?: any[] }) {
  const holiday = Object.values(input.holidayExtras || {}).flatMap((item: any) => Array.isArray(item?.tasks) ? item.tasks : []);
  const events = (input.eventsData || []).flatMap(item => Array.isArray(item?.tasks) ? item.tasks : []);
  const projects = (input.projects || []).flatMap(item => Array.isArray(item?.tasks) ? item.tasks : []);
  return [...holiday, ...events, ...projects];
}

export function computeReminderCounts(input: {
  failures?: any[];
  hk?: any[];
  holidayExtras?: Record<string, any>;
  eventsData?: any[];
  projects?: any[];
  hkExpiringThreshold?: number;
  now?: Date;
}): ReminderCounts {
  const now = input.now || new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  const dueTasks = allTasks(input).filter(task => {
    if (!task || task.done) return false;
    const date = parseTaskDate(task.dueDate || task.date || task.deadline);
    return !!date && date.getTime() <= endOfToday;
  }).length;
  const threshold = Math.max(0, Number(input.hkExpiringThreshold ?? 2));
  const expiringOrders = (input.hk || []).filter(order =>
    order && order.active !== false && !order.unlimited && Number.isFinite(Number(order.remaining))
    && Number(order.remaining) >= 0 && Number(order.remaining) <= threshold
  ).length;
  const failures = (input.failures || []).length;
  return { failures, dueTasks, expiringOrders, total: failures + dueTasks + expiringOrders };
}

export function reminderBody(counts: ReminderCounts) {
  return [
    counts.failures ? `${counts.failures} כשלי חיוב` : '',
    counts.dueTasks ? `${counts.dueTasks} משימות שהמועד שלהן הגיע` : '',
    counts.expiringOrders ? `${counts.expiringOrders} הוראות קבע שמסתיימות` : '',
  ].filter(Boolean).join(' · ');
}

export function shouldSendDailyReminder(now: Date, time: string, lastSentDate: string, counts: ReminderCounts) {
  if (counts.total === 0) return false;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return lastSentDate !== today && current >= (/^\d{2}:\d{2}$/.test(time) ? time : '08:00');
}

export function localDateKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
