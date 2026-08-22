// התחייבות מול מה שנכנס בפועל — התרחיש שתיארת
const P = require('/tmp/stub/proj.js');
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}
const proj = (sols) => ({ id:'p1', name:'קמפיין', kind:'campaign', goal:90000, status:'active',
  purposeTag:'קמפיין', budget:{}, tasks:[], createdAt:'', solicitations:sols });

console.log('א. "אני אתן לך אלף שקל" — ועדיין לא נתן:');
let rows = P.buildSolicitationRows(proj([{ name:'יוסי', ask:1000, status:'תורם ללא סכום', pledged:1000 }]), [], []);
let r = rows[0];
console.log('   ', JSON.stringify({ pledge:r.pledge, raised:r.raised, remaining:r.pledgeRemaining, committed:r.committed }));
ok(r.pledge === 1000 && r.raised === 0, 'התחייב ₪1,000, נכנס ₪0');
ok(r.committed === 1000, 'ומול היעד זה נספר כ-₪1,000');

console.log('\nב. חודש אחרי — נכנסו 500 בקישור:');
const d500 = { id:'ned:1', name:'יוסי', amount:500, date:'15/09/2026', purpose:'קמפיין', method:'קישור ישיר' };
rows = P.buildSolicitationRows(proj([{ name:'יוסי', ask:1000, status:'תורם', pledged:1000 }]), [d500], []);
r = rows[0];
console.log('   ', JSON.stringify({ raised:r.raised, remaining:r.pledgeRemaining, committed:r.committed, attached:r.donations.length }));
ok(r.raised === 500, 'נכנס ₪500 — זוהה לבד לפי הייעוד');
ok(r.pledgeRemaining === 500, 'נותרו ₪500 מההבטחה');
ok(r.committed === 1000, 'ההתחייבות עדיין ₪1,000 — לא נספרת פעמיים');

console.log('\nג. במקום זה הוא פתח הו״ק מוגדלת — ₪250×12:');
const hk = [{ id:'h1', name:'יוסי', amount:250, payments:12, paid:1, unlimited:false,
              campaign:'קמפיין', active:true, cancelDate:'' }];
const hkCharge = { id:'hk:h1:2026-09', name:'יוסי', amount:250, date:'15/09/2026', purpose:'קמפיין' };
rows = P.buildSolicitationRows(proj([{ name:'יוסי', ask:1000, status:'תורם', pledged:1000 }]), [hkCharge], hk);
r = rows[0];
console.log('   ', JSON.stringify({ raised:r.raised, pledgeLeft:r.pledgeRemaining, outstanding:r.outstanding, committed:r.committed }));
ok(r.pledgeRemaining === 0, 'ההו״ק על ₪3,000 מכסה את ההבטחה של ₪1,000');
ok(r.raised === 250, 'נכנס חיוב אחד');
ok(r.outstanding === 2750, 'ועוד ₪2,750 צפויים');
ok(r.donations.length === 0, 'חיוב ההו״ק לא נספר גם כתשלום נפרד — אין כפילות');
ok(r.committed === 3000, 'סה״כ ₪3,000');

console.log('\nד. סיור סליחות — תשלום שאינו הקמפיין:');
const tour = { id:'ned:2', name:'יוסי', amount:120, date:'20/09/2026', purpose:'סיור סליחות' };
rows = P.buildSolicitationRows(proj([{ name:'יוסי', ask:1000, status:'תורם', pledged:1000 }]), [d500, tour], []);
r = rows[0];
console.log('   משויכים:', r.donations.map(x=>x.amount), '· מוצעים לצירוף:', r.candidates.map(x=>x.amount));
ok(r.raised === 500, 'רק ה-500 נספר — לסיור יש ייעוד אחר');
ok(r.candidates.length === 1 && r.candidates[0].amount === 120, 'הסיור מוצע לצירוף, ולא נכפה');

console.log('\nה. צירוף ידני של תשלום בלי ייעוד:');
const noPurpose = { id:'ned:3', name:'יוסי', amount:300, date:'01/10/2026', purpose:'' };
rows = P.buildSolicitationRows(proj([{ name:'יוסי', pledged:1000, status:'תורם', includedDonationIds:['ned:3'] }]), [d500, noPurpose], []);
r = rows[0];
ok(r.raised === 800, 'נכנס ₪800 אחרי הצירוף');
ok(r.pledgeRemaining === 200, 'ונותרו ₪200 מההבטחה');

console.log('\nו. הסרה של תשלום ששויך אוטומטית:');
rows = P.buildSolicitationRows(proj([{ name:'יוסי', pledged:1000, status:'תורם', excludedDonationIds:['ned:1'] }]), [d500], []);
r = rows[0];
console.log('   ', JSON.stringify({ raised:r.raised, remaining:r.pledgeRemaining, offeredBack:r.candidates.length }));
ok(r.raised === 0, 'ההסרה עובדת');
ok(r.pledgeRemaining === 1000, 'וההבטחה חוזרת להיות פתוחה במלואה');
ok(r.candidates.length === 1, 'והתשלום מוצע בחזרה, כדי שאפשר יהיה להתחרט');

console.log('\nז. הסרת הוראת קבע שאינה קשורה:');
rows = P.buildSolicitationRows(proj([{ name:'יוסי', pledged:1000, status:'תורם', excludedHkIds:['h1'] }]), [hkCharge], hk);
r = rows[0];
ok(r.commitments.length === 0, 'ההוראה הוסרה');
ok(r.pledgeRemaining === 1000 - 250, 'והחיוב שלה נספר עכשיו כתשלום רגיל מול ההבטחה');

console.log('\nח. הסיכומים — שני החישובים שביקשת:');
const rows2 = P.buildSolicitationRows(proj([
  { name:'יוסי',  ask:1000, status:'תורם', pledged:1000 },
  { name:'דוד',   ask:3000, status:'תורם ללא סכום', pledged:2400 },
  { name:'משה',   ask:500,  status:'לא תורם' },
]), [d500], []);
const t = P.sumSolicitationRows(rows2);
console.log('   ', JSON.stringify({ ask:t.ask, pledged:t.pledged, raised:t.raised, outstanding:t.outstanding, committed:t.committed }));
ok(t.pledged === 3400, 'כמה התחייבויות אספתי: ₪3,400');
ok(t.raised === 500, 'וכמה באמת נכנס: ₪500');
ok(t.committed === 3400, 'סה״כ מובטח = ההתחייבויות');
ok(t.outstanding === 2900, 'ועוד ₪2,900 לגבות');
