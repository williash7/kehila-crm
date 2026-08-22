// הקמפיין של הוראת קבע — מהגיליון לאפליקציה ובחזרה
const fs=require('fs');
eval(fs.readFileSync('/tmp/base.js','utf8').split("console.log('1.")[0]);
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}
const get = id => getHK_().find(h => h.id === id);

console.log('א. הקמפיין חוזר לאפליקציה:');
addStandingOrder_({ name:'יוסי', amount:250, startDate:'2026-06-10', payments:12,
                    id:'8500', campaign:'לוחות שנה תשפ״ז', phone:'050-1234567' });
let h = get('8500');
console.log('   ', JSON.stringify({ campaign:h.campaign, phone:h.phone }));
ok(h.campaign === 'לוחות שנה תשפ״ז', 'הקמפיין מוחזר — בלעדיו אי אפשר לשייך לפרויקט');
ok(h.phone === '050-1234567', 'וגם הטלפון, לעריכה');

console.log('\nב. הוראה שהגיעה ממייל בלי קמפיין:');
addStandingOrder_({ name:'דוד', amount:100, startDate:'2026-06-10', payments:12, id:'8501' });
h = get('8501');
ok(h.campaign === '', 'ריק, ולא undefined');

console.log('\nג. משייכים אותה לקמפיין בעריכה:');
let res = updateStandingOrder_({ id:'8501', campaign:'לוחות שנה תשפ״ז' });
console.log('   ', JSON.stringify({ changed:res.changed, rebuilt:res.rebuilt }));
h = get('8501');
ok(h.campaign === 'לוחות שנה תשפ״ז', 'השיוך נשמר');
ok(res.rebuilt === false, 'ולוח החיובים לא נגע — זה רק תיוג');

console.log('\nד. ביטול השיוך:');
updateStandingOrder_({ id:'8501', campaign:'' });
ok(get('8501').campaign === '', 'אפשר גם לנקות');

console.log('\nה. הקמפיין נכתב גם לחיובים החודשיים:');
const log = sheets['יומן תרומות ומפגשים'].values;
const head = log[0];
const cPurpose = head.indexOf('ייעוד'), cId = head.indexOf('מזהה');
const charges = log.slice(1).filter(r => String(r[cId]).indexOf('hk:8500:') === 0);
console.log('   חיובים:', charges.length, '· ייעוד:', charges[0] && charges[0][cPurpose]);
ok(charges.length > 0 && charges[0][cPurpose] === 'לוחות שנה תשפ״ז',
   'כל חיוב נושא את הקמפיין — כך הוא נספר בפרויקט גם כתשלום');
