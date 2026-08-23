const assert = require('assert');
const fs = require('fs');

const donations = fs.readFileSync('src/components/DonationsTab.tsx', 'utf8');
const modal = fs.readFileSync('src/components/StandingOrdersModal.tsx', 'utf8');

console.log('א. שני מסכי הוראות הקבע נפתחים על המסנן הפעיל:');
assert.ok(/setHkFilter\] = useState<[^>]+>\('active'\)/.test(donations));
assert.ok(/setFilter\] = useState<[^>]+>\('active'\)/.test(modal));

console.log('ב. המסנן הפעיל מוצג ראשון, ושאר המצבים נשארים זמינים:');
for (const source of [donations, modal]) {
  assert.ok(/\{ id: 'active', label: 'פעילות'[\s\S]{0,150}\{ id: 'all'/.test(source), 'המסנן הפעיל צריך להופיע ראשון');
  assert.ok(/id: 'expiring'/.test(source) && /id: 'expired'/.test(source) && /id: 'cancelled'/.test(source));
}

console.log('✓ הוראות קבע פעילות הן תצוגת ברירת המחדל');
