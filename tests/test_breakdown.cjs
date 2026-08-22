// לחיצה על מספר → הרשימה שמאחוריו
const P = require('/tmp/stub/proj.js');
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}
const proj = (sols) => ({ id:'p1', name:'קמפיין תשפ״ו', kind:'campaign', goal:180000, status:'active',
  purposeTag:'קמפיין תשפ״ו', budget:{}, tasks:[], createdAt:'', solicitations:sols });

const hk = [
  { id:'H1', name:'מרקוב', amount:200, payments:12, paid:1, unlimited:false,
    campaign:'קמפיין תשפ״ו', active:true, cancelDate:'', nextCharge:'07/09/2026' },
  { id:'H2', name:'לוין', amount:300, payments:12, paid:0, unlimited:false,
    campaign:'קמפיין תשפ״ו', active:true, cancelDate:'', nextCharge:'01/09/2026' },
];
const donations = [
  { id:'hk:H1:2026-08', name:'מרקוב', amount:200, date:'07/08/2026', purpose:'קמפיין תשפ״ו', method:'הוראת קבע' },
  { id:'ned:1', name:'רשף', amount:1200, date:'01/07/2026', purpose:'קמפיין תשפ״ו', method:'קישור ישיר' },
  { id:'man:2', name:'כהן', amount:310, date:'15/08/2026', purpose:'קמפיין תשפ״ו', method:'מזומן' },
];
const rows = P.buildSolicitationRows(proj([
  { name:'מרקוב', ask:2400, status:'תורם' },
  { name:'לוין',  ask:3600, status:'תורם' },
  { name:'רשף',   ask:1200, status:'תורם' },
  { name:'כהן',   ask:500,  status:'תורם' },
  { name:'שנייר', ask:410,  status:'תורם ללא סכום', pledged:1000 },
  { name:'מרינה', ask:150,  status:'לשלוח לינק' },
]), donations, hk);
const t = P.sumSolicitationRows(rows);

const show = (metric) => {
  const items = P.breakdownFor(rows, metric);
  const sum = items.reduce((s,x)=>s+x.amount,0);
  console.log(`\n${P.BREAKDOWN_LABEL[metric]} — ₪${sum.toLocaleString()} · ${items.length} רשומות`);
  items.forEach(x => console.log(`   ${x.name.padEnd(8)} ₪${String(x.amount).padStart(5)}  ${x.detail}`));
  return { items, sum };
};

let r = show('raised');
ok(r.sum === t.raised, 'הסכום בפירוט שווה למספר שעליו לחצת');
ok(r.items.length === 3, 'שלושה תשלומים');
ok(r.items.some(x => x.kind === 'hk' && x.name === 'מרקוב'), 'חיוב ההו״ק מופיע כשורה משלו');

r = show('hkOutstanding');
ok(r.sum === t.hkOutstanding, 'תואם');
ok(r.items.length === 2, 'שתי הוראות עם יתרה');
ok(r.items[0].detail.indexOf('הבא') > 0, 'ומצוין מתי החיוב הבא');

r = show('pledgeOutstanding');
ok(r.sum === t.pledgeOutstanding, 'תואם');
ok(r.items.length === 1 && r.items[0].name === 'שנייר', 'רק מי שהבטיח בעל פה');

r = show('pledged');
ok(r.sum === t.pledged, 'תואם');
ok(r.items.filter(x => x.kind === 'hk').length === 2, 'שתי ההו״ק');
ok(r.items.filter(x => x.kind === 'pledge').length === 1, 'וההבטחה');

r = show('committed');
ok(r.sum === t.committed, 'תואם — נכנס ועוד צפוי');

r = show('ask');
ok(r.sum === t.ask, 'תואם');
ok(r.items.length === 6, 'כל מי שיש לו סכום לבקש');

console.log('\nמיון:');
ok(P.breakdownFor(rows,'committed').every((x,i,a) => i===0 || a[i-1].amount >= x.amount),
   'לפי סכום יורד — "ממי מגיע רובו" ולא לפי אלף-בית');

console.log('\nמקרי קצה:');
ok(P.breakdownFor([], 'raised').length === 0, 'רשימה ריקה');
ok(P.breakdownFor(rows, 'raised').every(x => x.amount > 0), 'אין שורות באפס');
