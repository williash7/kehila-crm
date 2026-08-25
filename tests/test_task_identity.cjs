const assert = require('assert');
const fs = require('fs');
const path = require('path');
const I = require('/tmp/stub/taskIdentity.js');
const G = require('/tmp/stub/globalSearch.js');
const C = require('/tmp/stub/cycleTemplate.js');

console.log('א. משימות ישנות מקבלות אותו מזהה בכל מכשיר:');
const old = [
  { text: 'להתקשר למשפחה', createdAt: '2026-08-20T10:00:00Z' },
  { text: 'להזמין כיבוד', dueDate: '2026-09-01' },
];
const first = I.ensureTaskListIds(old, 'holiday:ראש השנה');
const second = I.ensureTaskListIds(old, 'holiday:ראש השנה');
assert.strictEqual(first.changed, true);
assert.strictEqual(first.added, 2);
assert.deepStrictEqual(first.tasks.map(t => t.id), second.tasks.map(t => t.id),
  'ההשלמה דטרמיניסטית ואינה תלויה במכשיר');
assert.deepStrictEqual(first.tasks.map(t => t.text), old.map(t => t.text), 'הסדר והתוכן נשמרים');
assert.ok(first.tasks.every(t => /^tsk_legacy_/.test(t.id)));

console.log('ב. מזהים קיימים נשמרים וכפילויות מתוקנות:');
const duplicate = I.ensureTaskListIds([
  { id: 'tsk_keep', text: 'ראשונה' },
  { id: 'tsk_keep', text: 'שנייה' },
], 'activity:a1');
assert.strictEqual(duplicate.tasks[0].id, 'tsk_keep');
assert.notStrictEqual(duplicate.tasks[1].id, 'tsk_keep');
assert.strictEqual(new Set(duplicate.tasks.map(t => t.id)).size, 2);
const alreadyDone = I.ensureTaskListIds(first.tasks, 'holiday:ראש השנה');
assert.strictEqual(alreadyDone.changed, false, 'טעינה שנייה אינה כותבת שוב');
assert.strictEqual(alreadyDone.tasks, first.tasks, 'מערך תקין נשמר באותה זהות');

console.log('ג. כל שלושת מאגרי המשימות עוברים יחד:');
const collections = I.ensureTaskIdsInCollections({
  holidayExtras: { h1: { tasks: [{ text: 'חג' }] }, meta: { notes: 'ללא משימות' } },
  events: [{ id: 'e1', tasks: [{ text: 'אירוע' }] }],
  projects: [{ id: 'p1', tasks: [{ text: 'קמפיין' }] }],
});
assert.strictEqual(collections.added, 3);
assert.ok(collections.changedHolidayExtras && collections.changedEvents && collections.changedProjects);
assert.strictEqual(collections.holidayExtras.meta.notes, 'ללא משימות');

const legacyParentsFirst = I.ensureTaskIdsInCollections({
  events: [{ name: 'אירוע ישן ללא מזהה', tasks: [{ text: 'הכנה' }] }],
  projects: [{ name: 'קמפיין ישן ללא מזהה', tasks: [{ text: 'טלפונים' }] }],
});
const legacyParentsSecond = I.ensureTaskIdsInCollections({
  events: [{ name: 'אירוע ישן ללא מזהה', tasks: [{ text: 'הכנה' }] }],
  projects: [{ name: 'קמפיין ישן ללא מזהה', tasks: [{ text: 'טלפונים' }] }],
});
assert.strictEqual(legacyParentsFirst.events[0].tasks[0].id, legacyParentsSecond.events[0].tasks[0].id,
  'גם רשומה ישנה בלי מזהה הורה מקבלת מזהה משימה קבוע');
assert.strictEqual(legacyParentsFirst.projects[0].tasks[0].id, legacyParentsSecond.projects[0].tasks[0].id);

console.log('ד. החיפוש משתמש רק במזהה הקבוע:');
const index = G.buildGlobalSearchIndex({
  activities: [{ id: 'e1', name: 'אירוע', tasks: [
    { id: 'tsk_exact', text: 'משימה מדויקת' },
    { text: 'משימה לא מהוגרת' },
  ] }],
});
const tasks = index.filter(row => row.kind === 'task');
assert.strictEqual(tasks.length, 1, 'אין נפילה מסוכנת למיקום ברשימה');
assert.deepStrictEqual(tasks[0].target, { tab: 'tasks', entityId: 'tsk_exact', parentId: 'e1' });

console.log('ה. שכפול מחזור יוצר משימה חדשה ולא ממחזר מזהה ישן:');
const template = C.createCycleTemplate({
  id: 'hist', type: 'event', name: 'אירוע', archivedAt: '2026-08-01',
  tasks: [{ id: 'tsk_old', text: 'הכנה', done: true }], budget: { expenses: [], income: [] },
}, '2026-09-01');
assert.ok(template.tasks[0].id);
assert.notStrictEqual(template.tasks[0].id, 'tsk_old');

console.log('ו. מסלול הטעינה משלים ושומר רק מאגרים שהשתנו:');
const root = path.join(__dirname, '..');
const context = fs.readFileSync(path.join(root, 'src', 'store', 'AppContext.tsx'), 'utf8');
assert.match(context, /ensureTaskIdsInCollections/);
assert.match(context, /if \(identified\.changedEvents\) saveEventsDataCloud/);
assert.match(context, /if \(identified\.changedHolidayExtras\) saveHolidayExtrasCloud/);
assert.match(context, /if \(identified\.changedProjects\) saveProjectsCloud/);

console.log('✓ לכל משימה מזהה קבוע, כולל נתונים ישנים ושכפול מחזור');
