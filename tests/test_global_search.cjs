const assert = require('assert');
const G = require('/tmp/stub/globalSearch.js');

const index = G.buildGlobalSearchIndex({
  donors: {
    'מאור כהן': { phone: '050-1111111', total: 300 },
    'אסתר לאה': { email: 'ester@example.com' },
  },
  crm: { 'מאור כהן': { city: 'עפולה', notes: 'מעוניין בשיעור' } },
  donations: [
    { id: 'd1', name: 'מאור כהן', amount: 300, date: '25/08/2026', purpose: 'פסח', method: 'העברה' },
  ],
  activities: [{
    id: 'ev1', name: 'ליל הסדר', date: '2027-04-21', location: 'בית חב״ד', purposeTags: ['פסח'],
    tasks: [{ id: 't1', title: 'להזמין מצות', dueDate: '2027-04-01' }],
  }],
  projects: [{
    id: 'p1', title: 'קמפיין פסח', startDate: '2027-03-01', purposeTags: ['קמחא דפסחא'],
    solicitations: [{ name: 'אסתר לאה' }], tasks: [{ id: 't2', text: 'להתקשר לתורמים' }],
  }],
  holidayExtras: { purim: { title: 'פורים', tasks: [{ id: 't3', title: 'לקנות מגילות' }] } },
});

assert.strictEqual(index.filter(row => row.kind === 'contact').length, 2);
assert.strictEqual(index.filter(row => row.kind === 'donation').length, 1);
assert.strictEqual(index.filter(row => row.kind === 'task').length, 3,
  'משימות מפעילות, קמפיינים וחגים נכנסות לאותו אינדקס');

console.log('א. חיפוש שם מחזיר קודם את איש הקשר:');
const maor = G.searchGlobalIndex(index, 'מאור כהן');
assert.strictEqual(maor[0].kind, 'contact');
assert.ok(maor.some(row => row.kind === 'donation'), 'אותו חיפוש מוצא גם את התרומה של האדם');
assert.deepStrictEqual(maor[0].target, { tab: 'contacts', entityId: 'מאור כהן' });

console.log('ב. ניקוד וגרשיים אינם משנים את החיפוש:');
assert.strictEqual(G.normalizeSearchText('  בֵּית–חב״ד  '), 'בית חב"ד');
const seder = G.searchGlobalIndex(index, 'בית חב"ד');
assert.strictEqual(seder[0].title, 'ליל הסדר');
assert.strictEqual(seder[0].target.tab, 'activities');

console.log('ג. ייעוד מאתר גם תרומה וגם פעילות:');
const pesach = G.searchGlobalIndex(index, 'פסח');
assert.ok(pesach.some(row => row.kind === 'donation' && row.target.entityId === 'd1'));
assert.ok(pesach.some(row => row.kind === 'activity' && row.target.entityId === 'ev1'));
assert.ok(pesach.some(row => row.kind === 'project' && row.target.entityId === 'p1'));

console.log('ד. משימה מחזירה את ההקשר ואת היעד:');
const matzot = G.searchGlobalIndex(index, 'מצות');
assert.strictEqual(matzot[0].kind, 'task');
assert.strictEqual(matzot[0].target.parentId, 'ev1');
assert.ok(matzot[0].subtitle.includes('ליל הסדר'));

console.log('ה. כמה מילים חייבות כולן להופיע:');
assert.strictEqual(G.searchGlobalIndex(index, 'מאור עפולה')[0].kind, 'contact');
assert.strictEqual(G.searchGlobalIndex(index, 'מאור ירושלים').length, 0);
assert.deepStrictEqual(G.searchGlobalIndex(index, '   '), []);

console.log('✓ חיפוש כללי');
