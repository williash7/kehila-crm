import React from 'react';
import { Bell, Clock3 } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { taskDueDateTime, taskReminderDateTime } from '../lib/taskReminders';

const STORAGE_KEY = 'event_info_notices_v1';

type EventNotice = {
  key: string;
  eventId: string;
  taskId?: string;
  eventName: string;
  dueDate?: string;
  time?: string;
};

function readNotices(): EventNotice[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNotices(notices: EventNotice[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notices)); } catch { /* אחסון לא זמין */ }
}

function noticeKey(eventId: string, task: any): string {
  return task.id || `${eventId}:${task.dueDate || ''}:${task.time || ''}`;
}

function whenLabel(notice: EventNotice, now: Date): string {
  const due = taskDueDateTime({ dueDate: notice.dueDate, time: notice.time });
  if (!due) return notice.dueDate || '';

  const diffMinutes = Math.round((due.getTime() - now.getTime()) / 60_000);
  if (diffMinutes > 0 && diffMinutes <= 90) {
    if (diffMinutes >= 45 && diffMinutes <= 75) return 'בעוד כשעה';
    return `בעוד ${diffMinutes} דקות`;
  }

  const sameDay = due.getFullYear() === now.getFullYear()
    && due.getMonth() === now.getMonth()
    && due.getDate() === now.getDate();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const isTomorrow = due.getFullYear() === tomorrow.getFullYear()
    && due.getMonth() === tomorrow.getMonth()
    && due.getDate() === tomorrow.getDate();
  const time = notice.time ? ` ב-${notice.time}` : '';
  if (sameDay) return `היום${time}`;
  if (isTomorrow) return `מחר${time}`;
  return `${due.toLocaleDateString('he-IL')}${time}`;
}

async function showNativeNotification(notice: EventNotice, now: Date) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const body = `${whenLabel(notice, now)} — ${notice.eventName}`;
  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration) {
      await registration.showNotification('תזכורת לאירוע', {
        body,
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        tag: `event-info-${notice.key}`,
        data: { url: './' },
      });
    } else {
      new Notification('תזכורת לאירוע', { body, icon: 'icon-192.png', tag: `event-info-${notice.key}` });
    }
  } catch { /* התראה מערכתית היא תוספת בלבד */ }
}

/**
 * תזכורת מידע לאירוע אינה משימה לביצוע.
 *
 * משימות אמיתיות (פרסום, טלפונים, החלטה אם האירוע מתקיים וכו') נשארות
 * ב-TaskDecisionGate ויכולות לדרוש הכרעה. eventReminder, לעומת זאת, רק אומר
 * "מחר/היום/בעוד שעה יש אירוע". לכן כשהוא מגיע לזמן שלו אנחנו מסמנים את
 * רשומת המשימה כטופלה מיד, ושומרים הודעת מידע נפרדת שאינה חוסמת את האפליקציה.
 */
export function EventInfoReminderAgent() {
  const { loading, eventsData, updateEventsData } = useAppStore();
  const [now, setNow] = React.useState(() => new Date());
  const [notices, setNotices] = React.useState<EventNotice[]>(() => readNotices());

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => { writeNotices(notices); }, [notices]);

  // layout effect בכוונה: תזכורת מידע שמגיעה עכשיו מסולקת ממסלול המשימות
  // החוסמות לפני שהדפדפן מצייר את הפריים הבא.
  React.useLayoutEffect(() => {
    if (loading || eventsData.length === 0) return;

    const newlyDue: EventNotice[] = [];
    let changed = false;
    const resolvedAt = now.toISOString();

    const nextEvents = (eventsData as any[]).map(ev => {
      let eventChanged = false;
      const tasks = (ev.tasks || []).map((task: any) => {
        if (task.kind !== 'eventReminder' || task.done || task.skipped) return task;
        const reminderAt = taskReminderDateTime(task);
        if (!reminderAt || reminderAt.getTime() > now.getTime()) return task;

        const notice: EventNotice = {
          key: noticeKey(ev.id, task),
          eventId: ev.id,
          taskId: task.id,
          eventName: ev.name || 'אירוע',
          dueDate: task.dueDate,
          time: task.time || ev.time,
        };
        newlyDue.push(notice);
        changed = true;
        eventChanged = true;
        return { ...task, done: true, skipped: false, doneAt: resolvedAt, snoozedUntil: undefined };
      });
      return eventChanged ? { ...ev, tasks } : ev;
    });

    if (newlyDue.length) {
      setNotices(prev => {
        const known = new Set(prev.map(item => item.key));
        return [...prev, ...newlyDue.filter(item => !known.has(item.key))];
      });
      newlyDue.forEach(notice => { void showNativeNotification(notice, now); });
    }
    if (changed) updateEventsData(nextEvents);
  // updateEventsData נוצר מחדש ב-provider; הוספתו לתלויות תגרום לריצות מיותרות.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, eventsData, now]);

  const current = notices[0];
  if (!current) return null;

  const acknowledge = () => setNotices(prev => prev.filter(item => item.key !== current.key));

  const snoozeHour = () => {
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const next = (eventsData as any[]).map(ev => {
      if (ev.id !== current.eventId) return ev;
      const tasks = (ev.tasks || []).map((task: any) => {
        const matches = current.taskId ? task.id === current.taskId : noticeKey(ev.id, task) === current.key;
        if (!matches) return task;
        return { ...task, done: false, skipped: false, doneAt: undefined, snoozedUntil: until };
      });
      return { ...ev, tasks };
    });
    updateEventsData(next);
    acknowledge();
  };

  return (
    <div className="fixed z-[900] bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-md" dir="rtl" role="status" aria-live="polite">
      <div className="bg-white border border-[#E8C97A]/60 rounded-2xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-[#FFF6D8] flex items-center justify-center text-[#9B7A2F]">
            <Bell size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-[#9B7A2F]">תזכורת בלבד — אין מה לבצע</div>
            <div className="font-bold text-[#0D1B2A] mt-0.5">{current.eventName}</div>
            <div className="text-sm text-gray-600 mt-1">{whenLabel(current, now)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={acknowledge} className="rounded-xl bg-[#0D1B2A] text-white py-2.5 text-sm font-bold">הבנתי</button>
          <button onClick={snoozeHour} className="rounded-xl bg-[#FAF6EE] text-[#0D1B2A] py-2.5 text-sm font-bold flex items-center justify-center gap-1.5">
            <Clock3 size={16} /> הזכר בעוד שעה
          </button>
        </div>
        {notices.length > 1 && <div className="text-[10px] text-gray-400 text-center mt-2">עוד {notices.length - 1} תזכורות מידע ממתינות</div>}
      </div>
    </div>
  );
}
