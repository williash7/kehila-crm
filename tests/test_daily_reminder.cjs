const fs = require('fs');
const path = require('path');
const assert = require('assert');
const reminder = require('/tmp/stub/dailyReminder.js');

const engine = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'dailyReminder.ts'), 'utf8');
const card = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'DailyReminderCard.tsx'), 'utf8');
const agent = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'DailyReminderAgent.tsx'), 'utf8');
const settings = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'settings.ts'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');

assert.ok(/dailyReminderEnabled: false/.test(settings), 'התזכורת כבויה כברירת מחדל');
assert.ok(/counts\.total === 0/.test(engine), 'לא נשלחת התראה כשאין משהו לטיפול');
assert.ok(/lastSentDate !== today/.test(engine), 'נשלחת לכל היותר התראה אחת ביום');
assert.ok(/Notification\.requestPermission/.test(card), 'הרשאה מתבקשת רק בלחיצה מפורשת');
assert.ok(/אינו מבטיח להעיר אפליקציה/.test(card), 'המגבלה של אפליקציה סגורה מוסברת');
assert.ok(/showNotification/.test(agent), 'הסיכום מוצג כהתראת מערכת');
assert.ok(/notificationclick/.test(sw), 'לחיצה על ההתראה מחזירה לאפליקציה');

const now = new Date(2026, 7, 25, 9, 0, 0);
const counts = reminder.computeReminderCounts({
  failures: [{ id: 'failed' }],
  hk: [
    { active: true, remaining: 2 },
    { active: true, remaining: 10 },
    { active: true, unlimited: true, remaining: 0 },
  ],
  eventsData: [{ tasks: [
    { text: 'הגיע', dueDate: '2026-08-25', done: false },
    { text: 'עתידי', dueDate: '2026-08-26', done: false },
    { text: 'בוצע', dueDate: '2026-08-20', done: true },
  ] }],
  holidayExtras: { חג: { tasks: [{ text: 'עבר', date: '24/08/2026', done: false }] } },
  hkExpiringThreshold: 2,
  now,
});
assert.deepStrictEqual(counts, { failures: 1, dueTasks: 2, expiringOrders: 1, total: 4 });
assert.strictEqual(reminder.shouldSendDailyReminder(now, '08:00', '', counts), true, 'אחרי השעה וביום חדש נשלחת התראה');
assert.strictEqual(reminder.shouldSendDailyReminder(now, '10:00', '', counts), false, 'לפני השעה לא נשלחת התראה');
assert.strictEqual(reminder.shouldSendDailyReminder(now, '08:00', '2026-08-25', counts), false, 'אין התראה שנייה באותו יום');
assert.strictEqual(reminder.shouldSendDailyReminder(now, '08:00', '', { ...counts, total: 0 }), false, 'אין רעש כשאין מה לטפל');

console.log('✓ תזכורת יומית כבויה כברירת מחדל, מרוכזת ושקופה לגבי מגבלות הרקע');
