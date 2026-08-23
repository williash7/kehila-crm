const assert = require('assert');
const A = require('/tmp/stub/activities.js');
const P = require('/tmp/stub/proj.js');
const fs = require('fs');

console.log('א. מעבר אירועים ישנים למבנה פעילויות:');
const migrated = A.normalizeActivities([
  { id: 'weekly', name: 'שיעור תניא', freq: 'weekly', date: '2026-08-01' },
  { id: 'special', name: 'סיור סליחות', freq: 'oneoff', date: '2026-09-01' },
  { id: 'holiday', name: 'סעודת ראש השנה', holidayId: 'ראש השנה', freq: 'oneoff', date: '2026-09-12' },
]);
assert.deepStrictEqual(migrated.map(x => x.activityKind), ['recurring', 'special', 'holiday']);
assert.strictEqual(migrated[0].purposeTag, 'שיעור תניא');
assert.deepStrictEqual(migrated[1].budget, { expenses: [], income: [] });

console.log('ב. מופע נוצר לפי צורך ומעקב תשלום נשאר לפי תאריך:');
const paid = A.normalizeActivity({
  id: 'paid', name: 'ערב נשים', freq: 'oneoff', date: '2026-09-01', entryPrice: 50,
  participants: { '01/09/2026': {
    רבקה: { registered: true, paid: true, attended: true },
    שרה: { registered: true, owed: true },
  } },
});
assert.strictEqual(A.participantCount(paid, '01/09/2026', 'registered'), 2);
assert.strictEqual(A.participantCount(paid, '01/09/2026', 'paid'), 1);
assert.strictEqual(A.participantCount(paid, '01/09/2026', 'attended'), 1);
assert.strictEqual(A.participantCount(paid, '01/09/2026', 'owed'), 1);

console.log('ג. תרומה נשמרת פעם אחת ומוצגת דרך תג פעילות או קמפיין מקושר:');
const linked = A.activityDonations(paid, [
  { id: 'a', purpose: 'ערב נשים', amount: 100 },
  { id: 'b', purpose: 'קמפיין שנתי', amount: 200 },
  { id: 'c', purpose: 'אחר', amount: 300 },
], ['קמפיין שנתי']);
assert.deepStrictEqual(linked.map(x => x.id), ['a', 'b']);

console.log('ד. פרויקטים ישנים הופכים לקמפיינים ושומרים קישורים ישנים:');
const projects = P.normalizeProjects([{ id: 'p', name: 'לוח שנה', kind: 'project', eventId: 'weekly' }]);
assert.strictEqual(projects[0].kind, 'campaign');
assert.deepStrictEqual(projects[0].activityIds, ['weekly']);

console.log('ה. משימות קמפיין מחוברות לכל תצוגות המשימות:');
const tasksUi = fs.readFileSync(__dirname + '/../src/components/TasksTab.tsx', 'utf8');
assert.ok(/campaignGroups/.test(tasksUi), 'קמפיינים חייבים להיכלל בקבוצות המשימות');
assert.ok(/source: 'campaign'/.test(tasksUi), 'משימות קמפיין חייבות להיכלל בלוח השנה');
assert.ok(/optgroup label="קמפיינים"/.test(tasksUi), 'חייבת להיות אפשרות להוסיף משימה ישירות לקמפיין');
assert.ok(/target\.kind === 'campaign'/.test(tasksUi), 'משימת המשך של קמפיין חייבת לחזור לקמפיין');

console.log('✓ פעילויות, תשלומים וקמפיינים תואמים לאחור');
