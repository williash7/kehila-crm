// עריכת הוראת קבע — והמקרה של "שולמו 1" על הוראה שטרם חויבה
const fs=require('fs');
eval(fs.readFileSync('/tmp/base.js','utf8').split("console.log('1.")[0]);
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}
const get = id => getHK_().find(h => h.id === id);
// היום בסביבת הבדיקה: 12/08/2026

console.log('א. המקרה מהמסך — חידוש שנפתח בתאריך שכבר עבר:');
addStandingOrder_({ name:'אברהם מרקוב', amount:200, startDate:'2026-08-07', payments:12, id:'9100' });
let h = get('9100');
console.log('   ', JSON.stringify({ paid:h.paid, remaining:h.remaining, start:h.startDate }));
ok(h.paid === 1, 'המנוע ספר חיוב אחד — כי 07/08 כבר עבר');
ok(h.remaining === 11, 'ונותרו 11');

console.log('\nב. תצוגה מקדימה לפני התיקון:');
let prev = previewStandingOrderUpdate_({ id:'9100' });
console.log('   ', JSON.stringify(prev));
ok(prev.existing === 12 && prev.collected === 1, '12 חיובים, מתוכם אחד נספר ככסף');

console.log('\nג. מתקנים את תאריך ההתחלה ל-07/09 — החיוב הרפאים נמחק:');
let res = updateStandingOrder_({ id:'9100', startDate:'2026-09-07' });
console.log('   ', JSON.stringify({ changed:res.changed, rebuilt:res.rebuilt, removed:res.removed, created:res.created }));
ok(res.rebuilt === true, 'לוח הזמנים נבנה מחדש');
ok(res.removed === 12 && res.created === 12, '12 נמחקו ו-12 נוצרו מחדש');
h = get('9100');
console.log('   ', JSON.stringify({ paid:h.paid, remaining:h.remaining, next:h.nextCharge }));
ok(h.paid === 0, 'עכשיו שולמו 0 — כי באמת עוד לא חויב');
ok(h.remaining === 12, 'ונותרו כל 12');
ok(h.paid + h.remaining === 12, 'ואין יותר סתירה');

console.log('\nד. שינוי סכום וקמפיין — בלי לגעת בלוח הזמנים:');
res = updateStandingOrder_({ id:'9100', amount:250, campaign:'קמפיין לוחות שנה' });
console.log('   ', JSON.stringify({ changed:res.changed, rebuilt:res.rebuilt }));
ok(res.rebuilt === false, 'לוח הזמנים לא נגע');
ok(res.removed === 0, 'ושום חיוב לא נמחק');
h = get('9100');
ok(h.amount === 250, 'הסכום עודכן');

console.log('\nה. חיוב שנכשל שורד בנייה מחדש:');
addStandingOrder_({ name:'תורם עם כשל', amount:100, startDate:'2026-01-10', payments:12, id:'9200' });
markChargeFailed_('9200', new Date(2026, 2, 10), 'כרטיס פג תוקף', 100, 'תורם עם כשל');
flushWrites_(); _logIds = null;
prev = previewStandingOrderUpdate_({ id:'9200' });
console.log('   לפני:', JSON.stringify(prev));
ok(prev.failed === 1, 'יש חיוב אחד שנכשל');

res = updateStandingOrder_({ id:'9200', payments: 6 });
prev = previewStandingOrderUpdate_({ id:'9200' });
console.log('   אחרי:', JSON.stringify(prev), '· נמחקו', res.removed);
ok(prev.failed === 1, 'הכשל נשאר — הוא אירוע אמיתי עם סיבה רשומה');
h = get('9200');
ok(h.payments === 6, 'ומספר התשלומים עודכן ל-6');

console.log('\nו. הוראה שלא קיימת, ובקשה ריקה:');
ok(updateStandingOrder_({ id:'zzz', amount:100 }).success === false, 'מזהה שגוי נדחה');
ok(updateStandingOrder_({ id:'9100' }).success === false, 'בקשה בלי שינויים נדחית');
ok(updateStandingOrder_({ id:'9100', startDate:'שטות' }).success === false, 'תאריך לא תקין נדחה');

console.log('\nז. הפיכת הוראה לללא הגבלת זמן:');
res = updateStandingOrder_({ id:'9100', unlimited:true, payments:'' });
h = get('9100');
console.log('   ', JSON.stringify({ unlimited:h.unlimited, remaining:h.remaining, active:h.active }));
ok(h.unlimited === true, 'ההוראה ללא הגבלה');
ok(h.remaining === 0, 'ואין לה "נותרו"');
ok(h.active === true, 'אבל היא פעילה');
