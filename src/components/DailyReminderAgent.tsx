import React from 'react';
import { useAppStore } from '../store/AppContext';
import { computeReminderCounts, localDateKey, reminderBody, shouldSendDailyReminder } from '../lib/dailyReminder';

const LAST_SENT_KEY = 'daily_reminder_last_sent_v1';

export function DailyReminderAgent() {
  const { settings, failures, hk, holidayExtras, eventsData, projects } = useAppStore();

  React.useEffect(() => {
    if (!settings.dailyReminderEnabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const check = async () => {
      const now = new Date();
      let last = '';
      try { last = localStorage.getItem(LAST_SENT_KEY) || ''; } catch { /* אין אחסון */ }
      const counts = computeReminderCounts({ failures, hk, holidayExtras, eventsData, projects, hkExpiringThreshold: settings.hkExpiringThreshold, now });
      if (!shouldSendDailyReminder(now, settings.dailyReminderTime, last, counts)) return;

      try {
        const registration = await navigator.serviceWorker?.ready;
        if (registration) {
          await registration.showNotification('מה דורש טיפול היום', {
            body: reminderBody(counts), icon: 'icon-192.png', badge: 'icon-192.png',
            tag: 'kehila-daily-reminder', data: { url: './' },
          });
        } else {
          new Notification('מה דורש טיפול היום', { body: reminderBody(counts), icon: 'icon-192.png', tag: 'kehila-daily-reminder' });
        }
        localStorage.setItem(LAST_SENT_KEY, localDateKey(now));
      } catch { /* התראה שאינה נתמכת לא תפיל את האפליקציה */ }
    };

    void check();
    const timer = window.setInterval(() => void check(), 60_000);
    return () => window.clearInterval(timer);
  }, [settings.dailyReminderEnabled, settings.dailyReminderTime, settings.hkExpiringThreshold, failures, hk, holidayExtras, eventsData, projects]);

  return null;
}
