const assert = require('assert');
const C = require('/tmp/stub/cycleTemplate.js');

const source = {
  id: 'hist_pesach_2025', type: 'holiday', name: 'ליל הסדר',
  occurrenceDate: '2025-04-12', archivedAt: '2025-04-13T10:00:00Z',
  tasks: [
    {
      text: 'להזמין משפחות', kind: 'invite', people: ['א', 'ב'],
      doneNames: ['א'], done: true, doneAt: '2025-04-10T12:00:00Z',
      createdAt: '2025-03-01T10:00:00Z', dueDate: '2025-04-05',
      subtasks: [{ text: 'להכין רשימה', done: true }],
    },
    { text: 'לסגור אולם', done: true, dueDate: '2025-04-14' },
  ],
  attendance: { '2025-04-12': { א: true, ב: true } },
  budget: {
    expenses: [
      { name: 'קייטרינג', planned: 8000, actual: 9200, supplier: 'משה', phone: '050' },
      { name: 'נגינה', planned: '', actual: 1500, supplier: 'דוד' },
    ],
    income: [{ name: 'כרטיסים', planned: 4000, actual: 3700 }],
  },
  insights: { summary: 'הגיעו 80', good: 'אוכל', improve: 'פרסום', plan: 'מוקדם יותר' },
};

console.log('א. מועדי המשימות נשמרים ביחס למועד החדש:');
const cloned = C.createCycleTemplate(source, '2026-04-02', '2026-01-01T10:00:00Z');
assert.strictEqual(cloned.tasks[0].dueDate, '2026-03-26', 'שבעה ימים לפני נשאר שבעה ימים לפני');
assert.strictEqual(cloned.tasks[1].dueDate, '2026-04-04', 'יומיים אחרי נשאר יומיים אחרי');

console.log('ב. ביצועי המחזור הקודם אינם משוכפלים:');
assert.strictEqual(cloned.tasks[0].done, false);
assert.deepStrictEqual(cloned.tasks[0].doneNames, []);
assert.strictEqual(cloned.tasks[0].subtasks[0].done, false);
assert.strictEqual(cloned.tasks[0].doneAt, undefined);
assert.strictEqual(cloned.tasks[0].createdAt, '2026-01-01T10:00:00Z');
assert.strictEqual(cloned.attendance, undefined, 'נוכחות כלל אינה חלק מהתבנית');
assert.strictEqual(cloned.insights, undefined, 'גם הסיכום והתובנות אינם מועתקים');

console.log('ג. התקציב הופך לתכנון, והספק נשמר:');
assert.strictEqual(cloned.budget.expenses[0].planned, 8000, 'התכנון המקורי נשמר');
assert.strictEqual(cloned.budget.expenses[0].actual, '', 'הביצוע מתאפס');
assert.strictEqual(cloned.budget.expenses[0].supplier, 'משה', 'פרטי ספק שימושיים נשמרים');
assert.strictEqual(cloned.budget.expenses[1].planned, 1500, 'כשלא היה תכנון, הביצוע הקודם מוצע כתכנון');
assert.strictEqual(cloned.budget.income[0].actual, '', 'גם הכנסה בפועל מתאפסת');

console.log('ד. תאריך לא בטוח אינו משאיר בטעות דדליין ישן:');
const unknownDate = C.createCycleTemplate({ ...source, occurrenceDate: undefined }, '2026-04-02');
assert.strictEqual(unknownDate.tasks[0].dueDate, undefined);
assert.strictEqual(C.shiftRelativeDate('31/02/2025', '2025-04-12', '2026-04-02'), undefined);

console.log('✓ שכפול מחזור מעתיק תבנית עבודה בלבד');
