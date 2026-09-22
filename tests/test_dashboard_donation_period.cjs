const assert = require('assert');
const D = require('/tmp/stub/df.js');

const donations = [
  { name: 'היום', date: '22/09/2026', amount: 100 },
  { name: 'השבוע', date: '20/09/2026', amount: 200 },
  { name: 'החודש', date: '01/09/2026', amount: 300 },
  { name: 'השנה', date: '15/01/2026', amount: 400 },
  { name: 'שנה קודמת', date: '31/12/2025', amount: 500 },
];
const now = new Date(2026, 8, 22, 12, 0, 0);

assert.deepStrictEqual(D.filterDonationsForDashboard(donations, 'today', '', now).map(d => d.name), ['היום']);
assert.deepStrictEqual(D.filterDonationsForDashboard(donations, 'week', '', now).map(d => d.name), ['היום', 'השבוע']);
assert.deepStrictEqual(D.filterDonationsForDashboard(donations, 'month', '', now).map(d => d.name), ['היום', 'השבוע', 'החודש']);
assert.deepStrictEqual(D.filterDonationsForDashboard(donations, 'year', '', now).map(d => d.name), ['היום', 'השבוע', 'החודש', 'השנה']);
assert.deepStrictEqual(D.filterDonationsForDashboard(donations, 'date', '2026-09-01', now).map(d => d.name), ['החודש']);
assert.deepStrictEqual(D.filterDonationsForDashboard(donations, 'date', '', now), []);

const recent = D.recentDonationsFirst([
  { name: 'ישן', date: '01/09/2026' },
  { name: 'חדש ראשון באותו יום', date: '22/09/2026' },
  { name: 'חדש אחרון באותו יום', date: '22/09/2026' },
  { name: 'בלי תאריך', date: '' },
], 3);
assert.deepStrictEqual(recent.map(d => d.name), [
  'חדש אחרון באותו יום',
  'חדש ראשון באותו יום',
  'ישן',
]);

console.log('✓ כרטיס התרומות בדשבורד מסנן את כל הנתונים לפי אותה תקופה');
