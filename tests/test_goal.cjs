// היעד הכללי של הקמפיין — שלוש דרגות ודאות, וביטול הו״ק שמחסיר מהיעד
const P = require('/tmp/stub/proj.js');
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}
const proj = (sols) => ({ id:'p1', name:'קמפיין שנתי', kind:'campaign', goal:180000, status:'active',
  purposeTag:'קמפיין שנתי', budget:{}, tasks:[], createdAt:'', solicitations:sols });

// שני תורמים על ₪3,000: אחד פתח הו״ק, השני רק הבטיח בטלפון
const hk = [{ id:'h1', name:'עם הוראה', amount:250, payments:12, paid:1, unlimited:false,
              campaign:'קמפיין שנתי', active:true, cancelDate:'' }];
const charge = { id:'hk:h1:2026-09', name:'עם הוראה', amount:250, date:'15/09/2026',
                 purpose:'קמפיין שנתי', method:'הוראת קבע' };
const sols = [
  { name:'עם הוראה',  ask:3000, status:'תורם' },
  { name:'רק הבטיח', ask:3000, status:'תורם ללא סכום', pledged:3000 },
];

console.log('א. שניהם "התחייבו" ל-₪3,000 — אבל לא באותה ודאות:');
let prog = P.projectProgress(proj(sols), [charge], hk);
console.log('   ', JSON.stringify({ raised:prog.raised, hk:prog.hkOutstanding,
  pledge:prog.pledgeOutstanding, secured:prog.secured, committed:prog.committed }));
ok(prog.committed === 6000, 'מול היעד נספרים ₪6,000 — שניהם');
ok(prog.raised === 250, 'בקופה יש ₪250 בלבד');
ok(prog.hkOutstanding === 2750, 'יתרת ההו״ק ₪2,750 — חתומה אצל הספק');
ok(prog.pledgeOutstanding === 3000, 'וההבטחה בעל פה ₪3,000 — אמירה בלבד');
ok(prog.secured === 3000, 'מה שאפשר לעמוד מולו: ₪3,000');
ok(prog.secured + prog.pledgeOutstanding === prog.committed, 'ושלושת החלקים מרכיבים את הסך');

console.log('\nב. ההו״ק בוטלה — יורדת מהעמידה ביעד:');
const cancelled = [{ ...hk[0], cancelDate:'01/10/2026', active:false }];
prog = P.projectProgress(proj(sols), [charge], cancelled);
console.log('   ', JSON.stringify({ raised:prog.raised, hk:prog.hkOutstanding,
  secured:prog.secured, committed:prog.committed }));
ok(prog.hkOutstanding === 0, 'אין יותר צפי מההוראה');
ok(prog.raised === 250, 'אבל מה שכבר נגבה נשאר — הכסף הזה באמת נכנס');
ok(prog.committed === 3250, 'סה״כ ירד מ-₪6,000 ל-₪3,250');
ok(prog.secured === 250, 'והמובטח ירד ל-₪250');

console.log('\nג. אחוזי היעד:');
prog = P.projectProgress(proj(sols), [charge], hk);
console.log(`    ${prog.percent}% מהיעד · ${Math.round(prog.secured/prog.goal*100)}% מובטחים · ${prog.percentCash}% במזומן`);
ok(prog.percent === Math.round(6000/180000*100), 'האחוז נמדד מול ההתחייבות');
ok(prog.percentCash < prog.percent, 'ואחוז המזומן נמוך ממנו, כמו במציאות');
ok(prog.gap === 180000 - 6000, 'החסר ליעד');

console.log('\nד. גם ההבטחה בעל פה מתבטלת אם משנים סטטוס ומוחקים סכום:');
prog = P.projectProgress(proj([sols[0], { name:'רק הבטיח', ask:3000, status:'לא תורם' }]), [charge], hk);
ok(prog.pledgeOutstanding === 0, 'ההבטחה ירדה');
ok(prog.committed === 3000, 'ונשארה רק ההו״ק');

console.log('\nה. הו״ק שהסתיימה בלי ביטול — כל התשלומים נגבו:');
const done = [{ id:'h2', name:'סיים', amount:250, payments:12, paid:12, unlimited:false,
                campaign:'קמפיין שנתי', active:false, cancelDate:'' }];
const charges12 = Array.from({ length: 12 }, (_, i) => ({
  id:`hk:h2:2026-${String(i+1).padStart(2,'0')}`, name:'סיים', amount:250,
  date:`15/${String(i+1).padStart(2,'0')}/2026`, purpose:'קמפיין שנתי', method:'הוראת קבע' }));
prog = P.projectProgress(proj([{ name:'סיים', ask:3000, status:'תורם' }]), charges12, done);
console.log('   ', JSON.stringify({ raised:prog.raised, hk:prog.hkOutstanding, committed:prog.committed }));
ok(prog.raised === 3000, 'כל ה-₪3,000 בקופה');
ok(prog.hkOutstanding === 0, 'ואין יותר צפי');
ok(prog.committed === 3000, 'בלי כפילות');
