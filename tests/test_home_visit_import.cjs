const assert = require('assert');
const H = require('/tmp/stub/homeVisits.js');

console.log('א. ייבוא מערך ביקורים מנקה שמות ומונע כפילות:');
const entries = H.homeVisitEntriesFromImport([
  { name: ' ישראל ישראלי ', topic: 'ראש השנה', emphasis: 'לבדוק מזוזות' },
  { name: 'ישראל   ישראלי', category: '📌 אחר' },
  { name: 'דוד כהן', category: '⭐ קרוב', scheduledDate: '2026-09-02', scheduledTime: '19:00' },
  { name: 'שרה לוי', visited: true },
  '  ',
], {
  'ישראל ישראלי': { circle: 'approach' },
});

assert.strictEqual(entries.length, 3);
assert.strictEqual(entries[0].name, 'ישראל ישראלי');
assert.strictEqual(entries[0].category, '🔄 מתקרב');
assert.strictEqual(entries[0].categoryIsCustom, false);
assert.strictEqual(entries[0].topic, 'ראש השנה');
assert.strictEqual(entries[1].category, '⭐ קרוב');
assert.strictEqual(entries[1].categoryIsCustom, true);
assert.strictEqual(entries[1].scheduled, true);
assert.strictEqual(entries[1].scheduledTime, '19:00');
assert.strictEqual(entries[2].visited, true);

console.log('ב. גם מערך של שמות פשוטים מקבל קטגוריות חיות מה-CRM:');
const simple = H.homeVisitEntriesFromImport(['משה', 'רחל'], {
  משה: { circle: 'close' },
  רחל: { target: true },
});
assert.deepStrictEqual(simple.map(x => x.category), ['⭐ קרוב', '🎯 מסומן להקרב']);

console.log('✓ מערכי ביקורי בית נקלטים מ-JSON במבנה תקין');
