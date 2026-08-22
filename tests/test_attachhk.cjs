// צירוף הוראת קבע שהגיעה מהמייל לקמפיין
const P = require('/tmp/stub/proj.js');
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}
const proj = (sols) => ({ id:'p1', name:'לוחות שנה', kind:'campaign', goal:90000, status:'active',
  purposeTag:'לוחות שנה', budget:{}, tasks:[], createdAt:'', solicitations:sols });

// שלוש הוראות של אותו אדם, כפי שהן מגיעות מהמייל: קטגוריה שאינה שם הקמפיין
const hk = [
  { id:'A', name:'יוסי', amount:100, payments:12, paid:2, unlimited:false, campaign:'', active:true, cancelDate:'' },
  { id:'B', name:'יוסי', amount:250, payments:12, paid:0, unlimited:false, campaign:'תרומה כללית', active:true, cancelDate:'' },
  { id:'C', name:'יוסי', amount:50,  payments:6,  paid:6, unlimited:false, campaign:'', active:false, cancelDate:'' },
  { id:'D', name:'אחר',  amount:300, payments:12, paid:1, unlimited:false, campaign:'', active:true, cancelDate:'' },
];

console.log('א. בלי שיוך — אף הוראה לא נספרת:');
let sol = { name:'יוסי', ask:3000, status:'תורם' };
let rows = P.buildSolicitationRows(proj([sol]), [], hk);
ok(rows[0].commitments.length === 0, 'אף אחת מהן לא משויכת לבד — הקטגוריה אינה שם הקמפיין');

let offered = P.unlinkedHkFor(sol, proj([sol]), hk);
console.log('   מוצעות לצירוף:', offered.map(h => `${h.id}(₪${h.amount}${h.active?'':', הסתיימה'})`).join(' · '));
ok(offered.length === 3, 'שלוש ההוראות שלו מוצעות — ולא של אנשים אחרים');
ok(offered[0].active === true, 'הפעילות ראשונות');
ok(offered.some(h => h.id === 'C'), 'וגם הוראה שהסתיימה מוצעת — מה שנגבה ממנה כסף אמיתי');

console.log('\nב. מצרפים אחת:');
sol = { name:'יוסי', ask:3000, status:'תורם', hkIds:['B'] };
rows = P.buildSolicitationRows(proj([sol]), [], hk);
console.log('   ', JSON.stringify({ commitments:rows[0].commitments.map(c=>c.id), committed:rows[0].committed }));
ok(rows[0].commitments.length === 1 && rows[0].commitments[0].id === 'B', 'רק זו שצורפה');
ok(rows[0].committed === 3000, 'ההתחייבות ₪250×12');

console.log('\nג. ועוד אחת — לתורם יכולות להיות כמה:');
sol = { name:'יוסי', ask:3000, status:'תורם', hkIds:['B','A'] };
rows = P.buildSolicitationRows(proj([sol]), [], hk);
console.log('   ', JSON.stringify({ ids:rows[0].commitments.map(c=>c.id), committed:rows[0].committed }));
ok(rows[0].commitments.length === 2, 'שתיהן נספרות');
ok(rows[0].committed === 3000 + 1200, 'סך ההתחייבות משתיהן');
ok(P.unlinkedHkFor(sol, proj([sol]), hk).length === 1, 'ונשארה אחת להצעה');

console.log('\nד. הסרה:');
sol = { name:'יוסי', ask:3000, status:'תורם', hkIds:['B'], excludedHkIds:['B'] };
rows = P.buildSolicitationRows(proj([sol]), [], hk);
ok(rows[0].commitments.length === 0, 'ההסרה גוברת על הצירוף');
ok(P.unlinkedHkFor(sol, proj([sol]), hk).every(h => h.id !== 'B'), 'ומה שהוסר לא מוצע שוב מיד');

console.log('\nה. שיוך אוטומטי לפי קטגוריה עדיין עובד:');
const tagged = [{ id:'E', name:'דוד', amount:200, payments:12, paid:1, unlimited:false,
                  campaign:'לוחות שנה', active:true, cancelDate:'' }];
rows = P.buildSolicitationRows(proj([{ name:'דוד', status:'תורם' }]), [], tagged);
ok(rows[0].commitments.length === 1, 'הוראה עם קטגוריה תואמת משויכת בלי לגעת');

console.log('\nו. תאימות לאחור — hkId יחיד מהגרסה הקודמת:');
sol = { name:'יוסי', status:'תורם', hkId:'A' };
rows = P.buildSolicitationRows(proj([sol]), [], hk);
ok(rows[0].commitments.length === 1 && rows[0].commitments[0].id === 'A', 'עדיין נקרא');
ok(P.explicitHkIds({ hkId:'A', hkIds:['B'] }).sort().join() === 'A,B', 'ושניהם מתאחדים');
