const P = require('/tmp/stub/proj.js');
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}

const project = {
  id:'p1', name:'הדפסת לוחות שנה תשפ״ז', kind:'campaign', goal:90000, status:'active',
  purposeTag:'הדפסת לוחות שנה תשפ״ז', budget:{}, tasks:[], createdAt:'',
  solicitations: [
    { name:'מ אלפרין',    ask:6000, status:'לחזור אליו', notes:'לחזור בחודש 9' },
    { name:'עמיקם רשף',   ask:6000, status:'תורם' },
    { name:'אברהם מרקוב', ask:2400, status:'תורם' },
    { name:'אלה חונוביץ', ask:3600, status:'לא תורם' },
    { name:'שמואל ליפש',  ask:3600, status:'נשלח לינק', pledged:1000 },
  ],
};

// אברהם פתח הוראת קבע לקמפיין: ₪200 × 12 = ₪2,400, נגבה חודש אחד
const hk = [
  { id:'1866314-r2', name:'אברהם מרקוב', amount:200, payments:12, paid:1, unlimited:false,
    campaign:'הדפסת לוחות שנה תשפ״ז', active:true, cancelDate:'' },
  // הוראה כללית של מישהו אחר — לא אמורה להיספר לקמפיין
  { id:'999', name:'עמיקם רשף', amount:500, payments:12, paid:3, unlimited:false,
    campaign:'תרומה כללית', active:true, cancelDate:'' },
];

const donations = [
  { id:'ned:1', name:'עמיקם רשף', amount:6000, date:'01/07/2026', purpose:'הדפסת לוחות שנה תשפ״ז' },
  { id:'hk:1866314-r2:2026-08', name:'אברהם מרקוב', amount:200, date:'07/08/2026',
    purpose:'הדפסת לוחות שנה תשפ״ז', method:'הוראת קבע' },
  { id:'ned:2', name:'עמיקם רשף', amount:500, date:'01/06/2026', purpose:'תרומה כללית' },
];

console.log('א. סטטוסים מהגיליון:');
ok(P.normalizeStatus('לחזור אליו') === 'callBack', 'טקסט עברי מזוהה');
ok(P.normalizeStatus('תורם ללא סכום') === 'giverNoAmount', 'גם המצב שאין לו מקבילה גנרית');
ok(P.normalizeStatus('gave') === 'giver', 'ערך ישן ממופה');
ok(P.normalizeStatus('שטות כלשהי') === 'toSend', 'ערך לא מוכר נופל להתחלה ולא נעלם');
ok(P.normalizeStatus('') === 'toSend', 'ריק');

console.log('\nב. שורות ההתרמה:');
const rows = P.buildSolicitationRows(project, donations, hk);
rows.forEach(r => console.log('   ', r.sol.name.padEnd(14), 'לבקש', String(r.ask).padStart(5),
  '| נכנס', String(r.raised).padStart(5), '| צפוי', String(r.outstanding).padStart(5),
  '| מובטח', String(r.committed).padStart(5), '|', P.SOLICITATION_LABEL[r.status]));

const avraham = rows.find(r => r.sol.name === 'אברהם מרקוב');
ok(avraham.raised === 200, 'נכנס ממנו ₪200 — חיוב אחד');
ok(avraham.commitments.length === 1, 'הוראת הקבע שלו משויכת לקמפיין');
ok(avraham.commitments[0].total === 2400, 'ההתחייבות המלאה ₪2,400');
ok(avraham.outstanding === 2200, 'נותרו ₪2,200 לגבייה');
ok(avraham.committed === 2400, 'ובסך הכול הוא סגר ₪2,400 מהיעד');

const amikam = rows.find(r => r.sol.name === 'עמיקם רשף');
ok(amikam.raised === 6000, 'עמיקם — ₪6,000 נכנסו');
ok(amikam.commitments.length === 0, 'ההוראה הכללית שלו לא נספרת לקמפיין');
ok(amikam.outstanding === 0, 'ואין ממנו צפי נוסף');

const shmuel = rows.find(r => r.sol.name === 'שמואל ליפש');
ok(shmuel.outstanding === 1000, 'הבטחה ידנית נספרת כשאין הו״ק');
ok(shmuel.pledgeRemaining === 1000, 'וכולה עדיין פתוחה');

console.log('\nג. סיכומים:');
const t = P.sumSolicitationRows(rows);
console.log('   ', JSON.stringify({ ask:t.ask, raised:t.raised, outstanding:t.outstanding, committed:t.committed }));
ok(t.raised === 6200, 'נכנס בפועל ₪6,200');
ok(t.outstanding === 3200, 'צפוי ₪3,200 (2,200 מהו״ק + 1,000 הבטחה)');
ok(t.committed === 9400, 'סה״כ מובטח ₪9,400');
ok(t.counts.giver === 2 && t.counts.callBack === 1 && t.counts.notGiver === 1, 'הספירה לפי סטטוס');

console.log('\nד. התקדמות מול היעד:');
const prog = P.projectProgress(project, donations, hk);
console.log('   ', JSON.stringify({ raised:prog.raised, pledged:prog.pledged, committed:prog.committed,
  percent:prog.percent, percentCash:prog.percentCash }));
ok(prog.raised === 6200, 'מזומן בקופה');
ok(prog.committed === 9400, 'מובטח — כולל הוראות הקבע קדימה');
ok(prog.percent > prog.percentCash, 'אחוז ההתחייבות גבוה מאחוז המזומן, כמו במציאות');
ok(prog.gap === 90000 - 9400, 'מה שחסר ליעד נמדד מול ההתחייבות');

console.log('\nה. הוראה שבוטלה כבר לא מתחייבת קדימה:');
const cancelledHk = [{ ...hk[0], cancelDate: '01/09/2026' }];
const r2 = P.buildSolicitationRows(project, donations, cancelledHk).find(r => r.sol.name === 'אברהם מרקוב');
ok(r2.commitments[0].outstanding === 0, 'אין צפי מהוראה מבוטלת');
ok(r2.committed === 200, 'נשאר רק מה שנגבה בפועל');

console.log('\nו. הוראה ללא הגבלת זמן — אופק שנה:');
const unlimitedHk = [{ id:'u1', name:'אברהם מרקוב', amount:250, payments:0, paid:2, unlimited:true,
                       campaign:'הדפסת לוחות שנה תשפ״ז', active:true, cancelDate:'' }];
const r3 = P.buildSolicitationRows(project, donations, unlimitedHk).find(r => r.sol.name === 'אברהם מרקוב');
console.log('   ', JSON.stringify({ total:r3.commitments[0].total, outstanding:r3.commitments[0].outstanding }));
ok(r3.commitments[0].total === 250 * 12, '₪250 × 12 חודשים קדימה');
ok(r3.commitments[0].outstanding === 250 * 10, 'פחות שני חיובים שכבר נגבו');

console.log('\nז. שיוך מפורש גובר על הקטגוריה:');
const withLink = { ...project, solicitations: project.solicitations.map(x =>
  x.name === 'עמיקם רשף' ? { ...x, hkId: '999' } : x) };
const r4 = P.buildSolicitationRows(withLink, donations, hk).find(r => r.sol.name === 'עמיקם רשף');
ok(r4.commitments.length === 1 && r4.commitments[0].total === 6000, 'ההוראה הכללית שויכה ידנית ונספרת');

console.log('\nח. אין ספירה כפולה:');
ok(rows.every(r => r.committed === r.raised + r.outstanding), 'מובטח = נכנס + צפוי, תמיד');
const both = P.buildSolicitationRows(
  { ...project, solicitations: [{ name:'אברהם מרקוב', ask:2400, status:'תורם', pledged:5000 }] },
  donations, hk)[0];
// הבטיח ₪5,000 ופתח הו״ק על ₪2,400 (מתוכם ₪200 כבר נגבו).
// ההו״ק מכסה ₪2,400 מההבטחה — כולל מה שנגבה ממנה — ולכן נותרו ₪2,600
// שצריך לגייס בדרך אחרת.
console.log('   ', JSON.stringify({ pledge:both.pledge, raised:both.raised,
  pledgeRemaining:both.pledgeRemaining, outstanding:both.outstanding }));
ok(both.pledgeRemaining === 2600, 'ההו״ק מקזזת את ההבטחה, ולא מתעלמת ממנה');
ok(both.outstanding === 2200 + 2600, 'יתרת ההו״ק ועוד יתרת ההבטחה');
ok(both.raised === 200, 'ומה שנכנס בפועל נספר פעם אחת בלבד');
