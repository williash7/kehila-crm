// מועד החיוב הבא, וסירובים של הוראה שחודשה
const fs=require('fs');
eval(fs.readFileSync('/tmp/base.js','utf8').split("console.log('1.")[0]);
const S = require('/tmp/stub/standingOrders.js');
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}

console.log('א. מועד החיוב הבא (היום 12/08/2026 בסביבת הבדיקה):');
addStandingOrder_({ name:'תורם א', amount:200, startDate:'2026-03-07', payments:12, id:'5001' });
let h = getHK_().find(x => x.id === '5001');
console.log('   ', JSON.stringify({ lastBilled:h.lastBilled, nextCharge:h.nextCharge, paid:h.paid, remaining:h.remaining }));
ok(h.nextCharge === '07/09/2026', 'החיוב הבא הוא ה-7 בספטמבר');
ok(h.lastBilled === '07/08/2026', 'והאחרון היה ה-7 באוגוסט');

console.log('\nב. הוראה שהסתיימה — אין חיוב הבא:');
addStandingOrder_({ name:'תורם ב', amount:100, startDate:'2025-01-05', payments:6, id:'5002' });
h = getHK_().find(x => x.id === '5002');
ok(h.nextCharge === '', 'ריק, ולא תאריך מומצא');
ok(h.active === false, 'וההוראה אינה פעילה');

console.log('\nג. הוראה שבוטלה:');
cancelStandingOrder_({ id:'5001', date:'2026-09-01' });
h = getHK_().find(x => x.id === '5001');
ok(h.nextCharge === '', 'הוראה מבוטלת לא תיגבה שוב');

console.log('\nד. הוראה ללא הגבלת זמן:');
addStandingOrder_({ name:'תורם ג', amount:80, startDate:'2026-05-15', unlimited:true, id:'5003' });
h = getHK_().find(x => x.id === '5003');
console.log('   ', JSON.stringify({ nextCharge:h.nextCharge, unlimited:h.unlimited }));
ok(h.nextCharge === '15/08/2026' || h.nextCharge === '15/09/2026', 'יש מועד הבא גם בלי מספר תשלומים');

console.log('\nה. סירובים של הוראה שחודשה — לא מוצגים יותר:');
const failures = [{ date:'01/06/2026', name:'תורם ד', order:'6001', reason:'כרטיס פג תוקף' }];
const idx = S.indexFailures(failures);
const list = S.annotateRenewals([
  { id:'6001', name:'תורם ד', amount:200, payments:12, paid:5, remaining:0, active:false, lastBilled:'01/05/2026' },
  { id:'6001-r2', name:'תורם ד', amount:250, payments:12, paid:1, remaining:11, active:true,
    lastBilled:'01/08/2026', renewalOf:'6001' },
]);
const oldOne = list.find(x => x.id === '6001');
const neu = list.find(x => x.id === '6001-r2');
console.log('   הישנה:', S.openFailureFor(oldOne, idx) ? 'מסומנת אדום' : 'נקייה');
console.log('   החדשה:', S.openFailureFor(neu, idx) ? 'מסומנת אדום' : 'נקייה');
ok(S.openFailureFor(oldOne, idx) === null, 'ההוראה שחודשה כבר לא מסומנת ככשל — הבעיה טופלה');
ok(S.openFailureFor(neu, idx) === null, 'וגם החדשה נקייה — הכשל אינו שלה');

console.log('\nו. אבל הוראה שנכשלה ולא חודשה — כן מסומנת:');
const alone = S.annotateRenewals([
  { id:'6002', name:'תורם ה', amount:200, payments:12, paid:2, remaining:8, active:true, lastBilled:'01/04/2026' },
]);
const idx2 = S.indexFailures([{ date:'01/06/2026', name:'תורם ה', order:'6002', reason:'אין כיסוי' }]);
ok(S.openFailureFor(alone[0], idx2) !== null, 'הסימון האדום נשאר במקום שבו הוא באמת נחוץ');
