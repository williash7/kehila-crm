// משימות שסומנו "בוצע" קפצו שוב בפתיחה הבאה. שלושה מקורות לכך נבדקים כאן.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const R = require('/tmp/stub/taskReminders.js');

const src = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');

console.log('א. החלון והסוכנים מחכים לנתוני הגיליון, לא לתמונת המצב:');
const store = src('store/AppContext.tsx');
assert.ok(/tasksReady = !loading && cloudReady/.test(store), 'יש דגל נפרד לנתונים אמיתיים');
assert.ok(/hasLocal\('events_data'\) \? getEventsData\(\)/.test(store), 'תמונת המצב מעדיפה את העותק המקומי העדכני');
assert.ok(/hasUnsavedBlock\('saveEvents'\) \? getEventsData\(\)/.test(store), 'שמירה שעוד לא נחתה אינה נדרסת בטעינה');
for (const f of ['TaskDecisionGate.tsx', 'EventInfoReminderAgent.tsx', 'WebsiteEventSyncAgent.tsx', 'TaskCreationReminderSetup.tsx']) {
  const code = src('components/' + f);
  assert.ok(/tasksReady/.test(code), `${f} ממתין ל-tasksReady`);
  assert.ok(!/useAppStore\(\)[\s\S]*\bloading\b[\s\S]*return/.test(code.replace(/\/\/.*$/gm, '')) || !/\bloading\b/.test(code.replace(/\/\/.*$/gm, '')), `${f} לא נשען על loading בלבד`);
}
console.log('  ✓');

console.log('ב. אחרי הכרעה על מופע ישן — קופצים להיום, לא למופע החסר הבא:');
const now = new Date(2026, 9, 18, 14, 0); // ראשון 18.10.2026
const task = {
  id: 't1', text: 'לפרסם את זמני השבת', recurrence: 'weekly',
  recurrenceAnchorDate: '2026-09-18', dueDate: '2026-09-25',
  done: true, doneAt: now.toISOString(), reminderOffsetMinutes: 0,
};
const next = R.normalizeRecurringTask(task, 'weekly', task.dueDate, now);
// בלי התיקון: המופע של 02/10 נפתח מיד והחלון קפץ שוב, וכך גם 09/10 ו-16/10.
assert.notStrictEqual(next.dueDate, '2026-10-02', 'לא נפתח המופע החסר של השבוע שאחרי');
assert.strictEqual(R.isTaskReminderDue(next, now), false, 'החלון לא קופץ שוב מיד');
const friday = new Date(2026, 9, 23, 0, 1);
const onFriday = R.normalizeRecurringTask(next, 'weekly', next.dueDate, friday);
assert.strictEqual(onFriday.dueDate, '2026-10-23', 'ביום שישי הקרוב נפתח המופע הבא');
assert.strictEqual(onFriday.done, false);
console.log('  ✓');

console.log('ג. מופע של אתמול שהוכרע — הבא נפתח כרגיל ("שבוע לפני" עדיין עובד):');
const weekBefore = {
  id: 't2', text: 'הזמנת כיבוד', recurrence: 'weekly', recurrenceAnchorDate: '2026-10-16',
  dueDate: '2026-10-16', done: true, reminderOffsetMinutes: 7 * 24 * 60,
};
const n2 = R.normalizeRecurringTask(weekBefore, 'weekly', weekBefore.dueDate, new Date(2026, 9, 17, 9));
assert.strictEqual(n2.dueDate, '2026-10-23');
console.log('  ✓');

console.log('ד. מופע פתוח לא נעלם מעצמו:');
const open = { ...task, done: false, doneAt: undefined };
assert.strictEqual(R.normalizeRecurringTask(open, 'weekly', open.dueDate, now).dueDate, '2026-09-25');
console.log('  ✓');
