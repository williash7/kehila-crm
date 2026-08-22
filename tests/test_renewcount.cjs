// "שולמו 0 מתוך 12" לצד "נותרו 11" — הסתירה שעל המסך
const fs=require('fs');
eval(fs.readFileSync('/tmp/base.js','utf8').split("console.log('1.")[0]);
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}

console.log('א. חילוץ מספר ההוראה ממזהה חיוב:');
[['hk:1866314:2026-08','1866314','מספר רגיל'],
 ['hk:1866314-r2:2026-08','1866314-r2','חידוש בפורמט החדש'],
 ['hk:ren:1866314:2:2026-08','ren:1866314:2','חידוש בפורמט הישן — עם נקודתיים'],
 ['hk:man1755000:2026-01','man1755000','הוראה שנוספה ידנית'],
 ['ned:12345','','לא חיוב הו״ק'],
 ['','','ריק'],
].forEach(([id,expected,why]) => {
  const got = orderIdFromChargeId_(id);
  ok(got === expected, `${id || '(ריק)'} → "${got}"   (${why})`);
});

console.log('\nב. הפירוק הישן, לשם השוואה:');
ok('hk:ren:1866314:2:2026-08'.split(':')[1] === 'ren',
   'split(":")[1] החזיר "ren" — ולכן לא נמצא אף חיוב להוראה');

console.log('\nג. שחזור המקרה מהמסך — חידוש שהתחיל 07/08/2026, 12 תשלומים:');
addStandingOrder_({ name:'אברהם מרקוב', amount:200, startDate:'2025-08-07', payments:12, id:'1866314' });
const r = renewStandingOrder_({ id:'1866314', payments:12, startDate:'2026-08-07' });
console.log('   מזהה החידוש:', r.id);
ok(r.id === '1866314-r2', 'מזהה בלי נקודתיים');
ok(r.success, 'החידוש הצליח');

const neu = getHK_().find(h => h.id === r.id);
console.log('   ', JSON.stringify({ paid: neu.paid, remaining: neu.remaining, payments: neu.payments, active: neu.active }));
ok(neu.paid === 1, 'שולמו 1 — החיוב של 07/08 כבר בשל (היום 12/08 בסביבת הבדיקה)');
ok(neu.remaining === 11, 'נותרו 11');
ok(neu.paid + neu.remaining === neu.payments, 'שולמו + נותרו = סך התשלומים — אין יותר סתירה');

console.log('\nד. וגם הוראה בפורמט הישן ממשיכה להיספר:');
// מדמים הוראה שכבר נשמרה בגיליון עם המזהה הישן
sheets['הוראות קבע'].values.push(['ren:9001:2','ישן נושן','2026-06-01',100,6,'','','','','','']);
_hkIndex = null; _logIds = null;
generateStandingOrderCharges();
const old = getHK_().find(h => h.id === 'ren:9001:2');
console.log('   ', JSON.stringify({ paid: old.paid, remaining: old.remaining }));
ok(old.paid === 3, '3 חיובים נגבו (יוני, יולי, אוגוסט) — הפורמט הישן נקרא נכון');
ok(old.paid + old.remaining === 6, 'והסכום מסתדר');
