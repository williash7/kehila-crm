// מתי ייגבה החיוב הראשון של חידוש — הכלל של מנהל החשבונות
const fs=require('fs');
eval(fs.readFileSync('/tmp/base.js','utf8').split("console.log('1.")[0]);
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}
const fmt = d => d ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` : '—';

// ההוראה הישנה: נפתחה 15/08/2025, 12 תשלומים → חיוב אחרון 15/07/2026
const oldStart = new Date(2025, 7, 15);
const today    = new Date(2026, 7, 19);   // 19/08/2026 — יום החידוש

console.log('א. התרחיש מההתכתבות — יום החיוב אצל הספק הוא ה-28:');
let d = hkNextSlot_(oldStart, 12, false, null, today, 28);
console.log('   החיוב הראשון:', fmt(d));
ok(fmt(d) === '28/08/2026', 'ה-28 הקרוב, החודש');

console.log('\nב. ואם יום החיוב היה ה-15 — "הפסדתי חודש":');
d = hkNextSlot_(oldStart, 12, false, null, today, 15);
console.log('   החיוב הראשון:', fmt(d));
ok(fmt(d) === '15/09/2026', 'ה-15 כבר עבר החודש, אז החודש הבא');

console.log('\nג. בלי לציין יום — נלקח מתאריך הפתיחה הישן (15):');
d = hkNextSlot_(oldStart, 12, false, null, today, 0);
ok(fmt(d) === '15/09/2026', 'אותה תוצאה');

console.log('\nד. הבאג שזה מתקן — תאריך בעבר:');
// המשבצת הטבעית היא 15/08/2026, שכבר עברה ביום החידוש
const naturalOld = new Date(oldStart.getFullYear(), oldStart.getMonth() + 12, 15);
console.log('   המשבצת הטבעית:', fmt(naturalOld), '· היום:', fmt(today));
ok(naturalOld < today, 'היא בעבר');
ok(hkNextSlot_(oldStart, 12, false, null, today, 0) >= today,
   'החישוב החדש לא מחזיר תאריך שעבר — אחרת נוצר מיד חיוב "שנגבה" שלא נגבה');

console.log('\nה. חידוש מוקדם, לפני שההוראה הישנה נגמרה:');
const early = new Date(2026, 2, 10);   // 10/03/2026, ההוראה עוד רצה
d = hkNextSlot_(oldStart, 12, false, null, early, 0);
console.log('   ', fmt(d));
ok(fmt(d) === '15/08/2026', 'המשבצת שאחרי הישנה — כי היא עוד בעתיד');

console.log('\nו. הוראה שבוטלה:');
d = hkNextSlot_(oldStart, 12, false, new Date(2026, 4, 1), today, 28);
console.log('   ', fmt(d));
ok(fmt(d) === '28/08/2026', 'מתגלגל מתאריך הביטול קדימה עד ליום החיוב הקרוב');

console.log('\nז. חודש קצר — יום 31:');
d = hkNextSlot_(new Date(2025, 0, 31), 12, false, null, new Date(2026, 1, 1), 31);
console.log('   ', fmt(d));
ok(fmt(d) === '28/02/2026', 'נופל ליום האחרון בפברואר ולא גולש למרץ');

console.log('\nח. הפעולה מקצה לקצה:');
addStandingOrder_({ name:'בונדרוב', amount:200, startDate:'2025-08-15', payments:12, id:'7001' });
const prev = previewRenewalDate_({ id:'7001', billingDay:28 });
console.log('   תצוגה מקדימה:', JSON.stringify(prev));
ok(prev.success && prev.billingDay === 28, 'התצוגה המקדימה מחזירה את התאריך בלי לשנות כלום');
ok(getHK_().length === 1, 'ובאמת לא נוצרה שום הוראה חדשה');

const r = renewStandingOrder_({ id:'7001', payments:12, billingDay:28 });
console.log('   החידוש:', JSON.stringify({ id:r.id, startDate:r.startDate, billingDay:r.billingDay }));
ok(r.startDate === prev.startDate, 'החידוש נפתח בדיוק בתאריך שהוצג מראש');
ok(r.billingDay === 28, 'יום החיוב נשמר');
