const D = require('/tmp/stub/dash.js');
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}

console.log('א. ברירת מחדל:');
ok(D.resolveCards([]).join() === D.DEFAULT_ORDER.join(), 'מי שלא נגע רואה בדיוק את הסדר הקודם');
// נגזר מהרשימה ולא ממספר קשיח: כרטיס חדש שנוסף לאפליקציה אינו אמור
// להפיל בדיקה שלא בודקת אותו כלל.
const ALL = D.DASH_CARDS.length;
const DEF = D.DEFAULT_ORDER.length;
ok(D.resolveCards(null).length === DEF, 'null');
ok(D.resolveCards(undefined).length === DEF, 'undefined');

// ── ברירת המחדל אינה "כל הכרטיסים", והפער הזה מכוון ──
// כרטיס שנוסף לאפליקציה אחרי שהמשתמש כבר עובד איתה נכנס כ**אופציה**
// ולא כהפתעה בראש מסך הבית. מי שרוצה אותו מוסיף בלחיצה.
const optIn = D.hiddenCards([]);
ok(optIn.length === ALL - DEF, `${optIn.length} כרטיסים אופציונליים, לא בברירת המחדל`);
ok(optIn.every(id => D.DASH_CARDS.some(c => c.id === id)),
   'וכולם מוכרים לעורך — כלומר זמינים להוספה ולא נעלמים');

console.log('\nב. בחירה חלקית:');
const mine = ['hero','tasks','recent'];
ok(D.resolveCards(mine).join() === 'hero,tasks,recent', 'הסדר נשמר בדיוק');
console.log('   מוסתרים:', D.hiddenCards(mine).join(', '));
ok(D.hiddenCards(mine).length === ALL - mine.length, 'השאר מוסתרים');

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
// ברירת המחדל כבר אינה מכילה את כל הכרטיסים — יש כרטיסים אופציונליים.
// אבל הכלל שהבדיקה הזו באמת שמרה עליו עדיין חשוב, ובניסוח נכון יותר:
// **שום כרטיס לא נשכח.** כל אחד חייב להיות או בברירת המחדל, או ברשימת
// המוסתרים שבעורך. כרטיס שאינו באף אחת מהן קיים בקוד ובלתי נגיש למשתמש.
{
  const reachable = new Set([...D.DEFAULT_ORDER, ...D.hiddenCards([])]);
  const lost = D.DASH_CARDS.map(c => c.id).filter(id => !reachable.has(id));
  ok(lost.length === 0,
     lost.length ? 'כרטיסים שאי אפשר להגיע אליהם: ' + lost.join(', ')
                 : 'כל כרטיס נגיש — בברירת המחדל או דרך העורך');
}
