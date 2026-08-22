const D = require('/tmp/stub/dash.js');
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}

console.log('א. ברירת מחדל:');
ok(D.resolveCards([]).join() === D.DEFAULT_ORDER.join(), 'מי שלא נגע רואה בדיוק את הסדר הקודם');
ok(D.resolveCards(null).length === 10, 'null');
ok(D.resolveCards(undefined).length === 10, 'undefined');
ok(D.hiddenCards([]).length === 0, 'ואף כרטיס לא מוסתר');

console.log('\nב. בחירה חלקית:');
const mine = ['hero','tasks','recent'];
ok(D.resolveCards(mine).join() === 'hero,tasks,recent', 'הסדר נשמר בדיוק');
console.log('   מוסתרים:', D.hiddenCards(mine).join(', '));
ok(D.hiddenCards(mine).length === 7, 'השאר מוסתרים');

console.log('\nג. כרטיס חדש שנוסף לאפליקציה אחרי שסידרת:');
// המשתמש שמר רשימה ישנה שאינה מכילה כרטיס שנוסף מאוחר יותר
ok(D.resolveCards(mine).indexOf('failures') < 0, 'הוא לא נדחף בכוח לרשימה');
ok(D.hiddenCards(mine).indexOf('failures') >= 0, 'אבל הוא מופיע כזמין להוספה — ולא נעלם בשקט');

console.log('\nד. מזהה שכבר לא קיים בקוד:');
ok(D.resolveCards(['hero','כרטיס-שנמחק','tasks']).join() === 'hero,tasks', 'נזרק בלי להפיל כלום');
ok(D.resolveCards(['רק-זבל']).join() === D.DEFAULT_ORDER.join(), 'רשימה שכולה זבל → ברירת מחדל');

console.log('\nה. גרירה:');
let l = ['a','b','c','d'];
ok(D.moveCard(l,0,2).join() === 'b,c,a,d', 'מלמעלה למטה');
ok(D.moveCard(l,3,0).join() === 'd,a,b,c', 'מלמטה למעלה');
ok(D.moveCard(l,1,1).join() === 'a,b,c,d', 'למקום עצמו');
ok(D.moveCard(l,-1,2).join() === 'a,b,c,d', 'אינדקס שלילי');
ok(D.moveCard(l,0,99).join() === 'a,b,c,d', 'מחוץ לתחום');
ok(l.join() === 'a,b,c,d', 'והמקור לא השתנה');

console.log('\nו. חלוקה לעמודות במחשב:');
const col = {}; D.DASH_CARDS.forEach(c => col[c.id] = c.column);
const chosen = D.resolveCards(['recent','shabbat','hero','quick']);
const main = chosen.filter(id => col[id] === 'main');
const side = chosen.filter(id => col[id] === 'side');
console.log('   ראשית:', main.join(', '), '· צדדית:', side.join(', '));
ok(main.join() === 'recent,hero', 'הסדר היחסי נשמר בעמודה הראשית');
ok(side.join() === 'shabbat,quick', 'וגם בצדדית');
ok(main.length + side.length === chosen.length, 'ואף כרטיס לא נפל בין הכיסאות');

console.log('\nז. לכל כרטיס יש תיאור:');
ok(D.DASH_CARDS.every(c => c.label && c.hint && c.icon), 'שם, הסבר ואייקון');
ok(D.DASH_CARDS.length === D.DEFAULT_ORDER.length, 'וברירת המחדל מכסה את כולם');
