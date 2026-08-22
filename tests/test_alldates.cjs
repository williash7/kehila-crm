const A = require('/tmp/stub/alldates.js');
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}
const today = new Date(2026, 7, 18);          // 18/08/2026

const input = {
  holidays: [
    { name: 'ראש השנה', dateStr: '2026-09-12' },
    { name: 'פסח', dateStr: '2027-04-22' },     // מחוץ לטווח 90 יום
    { name: 'תאריך שבור', dateStr: 'לא-תאריך' },
    { name: 'אתמול', dateStr: '2026-08-17' },   // עבר
  ],
  events: [
    { id: 'e1', name: 'מניין שחרית', next: new Date(2026, 7, 19) },
    { id: 'e2', name: 'שיעור', next: null },     // בלי מופע הבא
  ],
  personal: [
    { name: 'משה', msg: 'יארצייט פנחס בן לייב (אבא) בעוד 3 ימים', icon: '🕯️', dist: 3, key: 'משה::fam-yahrzeit::f1' },
    { name: 'שרה', msg: 'יום הולדת עברי היום', icon: '🎂', dist: 0, key: 'שרה::hbday' },
    { name: 'דוד', msg: 'יום הולדת בעוד 200 ימים', icon: '🎈', dist: 200, key: 'דוד::gbday' },
  ],
};

console.log('א. בנייה וסינון טווח (90 יום):');
const items = A.buildAllDates(input, today, 90);
console.log('   ', JSON.stringify(items.map(i => [i.kind, i.title, i.dist])));
ok(items.length === 4, '4 פריטים בטווח, התקבל ' + items.length);
ok(!items.some(i => i.title === 'פסח'), 'מחוץ לטווח — לא נכנס');
ok(!items.some(i => i.title === 'אתמול'), 'תאריך שעבר — לא נכנס');
ok(!items.some(i => i.title === 'תאריך שבור'), 'תאריך לא תקין — נזרק בשקט');
ok(!items.some(i => i.title === 'שיעור'), 'אירוע בלי מופע הבא — לא נכנס');

console.log('\nב. מיון וסוגים:');
ok(items[0].dist === 0 && items[0].title === 'יום הולדת עברי', 'הקרוב ביותר ראשון');
ok(items.find(i => i.title.indexOf('יארצייט') === 0).kind === 'yahrzeit', 'יארצייט זוהה לפי הנר');
ok(items.find(i => i.person === 'שרה').kind === 'birthday', 'יום הולדת עברי → birthday');
ok(items.find(i => i.title === 'מניין שחרית').kind === 'event', 'אירוע');
ok(items.every(i => !/בעוד|היום$/.test(i.title)), 'זנב "בעוד X ימים" נוקה מהכותרת');

console.log('\nג. סינון לפי סוג — "רק חגים וימי הולדת":');
const wanted = ['holiday','birthday'];
const filtered = items.filter(i => wanted.includes(i.kind));
console.log('   ', JSON.stringify(filtered.map(i => i.title)));
ok(filtered.length === 2, 'שני פריטים, בלי היארצייט ובלי האירוע');

console.log('\nד. ספירה:');
const counts = A.countByKind(A.buildAllDates(input, today, 366));
console.log('   ', JSON.stringify(counts));
ok(counts.holiday === 2 && counts.event === 1 && counts.birthday === 2 && counts.yahrzeit === 1, 'הספירה תואמת לשנה שלמה');

console.log('\nה. קיבוץ לחודשים:');
const months = A.groupByMonth(A.buildAllDates(input, today, 366));
console.log('   ', JSON.stringify(months.map(m => [m.label, m.days.length])));
ok(months.length === 4, '4 חודשים שונים');
ok(months[0].days[0].items.length >= 1, 'לכל יום יש פריטים');
const flat = months.flatMap(m => m.days.flatMap(d => d.items));
ok(flat.length === A.buildAllDates(input, today, 366).length, 'שום פריט לא נעלם בקיבוץ');

console.log('\nו. שני פריטים באותו יום:');
const same = A.buildAllDates({
  holidays: [{ name: 'ל״ג בעומר', dateStr: '2026-08-21' }],
  events: [],
  personal: [{ name: 'יוסי', msg: 'יום הולדת בעוד 3 ימים', icon: '🎂', dist: 3, key: 'k' }],
}, today, 30);
ok(same.length === 2 && same[0].kind === 'holiday', 'באותו יום החג מוצג מעל האדם');
const g = A.groupByMonth(same);
ok(g[0].days.length === 1 && g[0].days[0].items.length === 2, 'שניהם באותו יום בלוח');
