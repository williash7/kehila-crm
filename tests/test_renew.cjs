// חידוש הוראת קבע: המשכיות ההיסטוריה, אי-חפיפה, ושינוי סכום בחידוש
const fs=require('fs');
eval(fs.readFileSync('/tmp/base.js','utf8').split("console.log('1.")[0]);

function charges(id){
  const t=sheets['יומן תרומות ומפגשים'].values;
  return t.slice(1).filter(r=>String(r[0]).indexOf('hk:'+id+':')===0)
    .map(r=>({d:r[2],amt:r[3],st:r[11]}));
}
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}

// ── הוראה שהסתיימה: 6 תשלומים מ-01/09/2025, כלומר עד 01/02/2026 ─────────────
addStandingOrder_({name:'שלמה כהן',amount:200,startDate:'2025-09-01',payments:6,id:'8001',phone:'050-1'});
let before=getHK_().find(h=>h.id==='8001');
console.log('1. לפני החידוש:',JSON.stringify({paid:before.paid,remaining:before.remaining,active:before.active,start:before.startDate}));
ok(before.paid===6,'6 חיובים נגבו');
ok(before.active===false,'ההוראה הסתיימה');

// ── חידוש עם סכום חדש, בלי לציין תאריך ──────────────────────────────────────
const r=renewStandingOrder_({id:'8001',amount:300,payments:12});
console.log('2. תוצאת החידוש:',JSON.stringify(r));
ok(r.success===true,'החידוש הצליח');
// המשבצת הטבעית (01/03/2026) כבר עברה ביום החידוש, ולכן מתגלגלים קדימה
// ליום החיוב הקרוב שעוד לא הגיע — בדיוק הכלל של הספק.
ok(r.startDate==='01/09/2026','החיוב הראשון הוא ה-1 הקרוב שלא עבר (01/09/2026), התקבל '+r.startDate);
ok(r.closedOld==='','לא נסגרה הוראה שממילא הסתיימה');

const all=getHK_();
const oldOne=all.find(h=>h.id==='8001'), neu=all.find(h=>h.id===r.id);
console.log('3. הישנה:',JSON.stringify({id:oldOne.id,amount:oldOne.amount,paid:oldOne.paid,start:oldOne.startDate}));
console.log('   החדשה:',JSON.stringify({id:neu.id,amount:neu.amount,paid:neu.paid,remaining:neu.remaining,renewalOf:neu.renewalOf,start:neu.startDate}));
ok(oldOne.paid===6&&oldOne.amount===200,'ההיסטוריה הישנה לא נגעה בה: 6 חיובים על ₪200');
ok(neu.renewalOf==='8001','החדשה מקושרת לישנה');
ok(neu.amount===300,'הסכום החדש נשמר');

const oc=charges('8001'), nc=charges(r.id);
console.log('4. חיובי הישנה:',oc.map(c=>c.d+'/'+c.amt).join(' '));
console.log('   חיובי החדשה:',nc.map(c=>c.d+'/'+c.amt).join(' '));
ok(oc.length===6&&oc.every(c=>c.amt===200),'6 חיובים ישנים על 200 — לא שוכתבו לסכום החדש');
ok(nc.every(c=>new Date(c.d) >= new Date(2026,8,1)),'ואף חיוב חדש אינו מתוארך לעבר');
ok(nc.every(c=>c.amt===300),'כל החיובים החדשים על 300');
ok(new Set(oc.concat(nc).map(c=>c.d)).size===oc.length+nc.length,'אין חודש שמחויב פעמיים');

// ── חידוש מוקדם של הוראה שעדיין רצה: חייב לסגור את הישנה ────────────────────
console.log('\n5. חידוש מוקדם של הוראה פעילה:');
addStandingOrder_({name:'דוד לוי',amount:100,startDate:'2026-01-10',payments:24,id:'8002'});
const r2=renewStandingOrder_({id:'8002',amount:150,payments:12,startDate:'2026-06-10'});
console.log('  ',JSON.stringify(r2));
ok(r2.closedOld==='10/06/2026','הישנה נסגרה בדיוק ביום שהחדשה מתחילה');
const o2=charges('8002'),n2=charges(r2.id);
const liveOld=o2.filter(c=>c.st!=='מבוטל');
console.log('   ישנה פעילים:',liveOld.map(c=>c.d).join(' '));
console.log('   חדשה:',n2.slice(0,3).map(c=>c.d).join(' '),'...');
ok(liveOld.length===5,'נשארו 5 חיובים ישנים (ינו׳–מאי), התקבל '+liveOld.length);
ok(o2.filter(c=>c.st==='מבוטל').length>0,'החיובים שאחרי מועד החידוש סומנו מבוטלים');
ok(String(new Date(n2[0].d).getDate())+'/'+(new Date(n2[0].d).getMonth()+1)==='10/6','החדשה מתחילה 10/06/2026');

// ── שרשרת: חידוש של חידוש ───────────────────────────────────────────────────
console.log('\n6. חידוש של חידוש:');
const r3=renewStandingOrder_({id:r2.id,payments:12,startDate:'2027-06-10'});
console.log('  ',JSON.stringify({id:r3.id,renewalOf:r3.renewalOf,amount:r3.amount,success:r3.success}));
ok(r3.success&&r3.renewalOf===r2.id&&r3.id==='8002-r3','החידוש השני מקושר לראשון ומזהה שטוח: '+r3.id);
ok(r3.amount===150,'בלי סכום מפורש — נשמר הסכום מההוראה שחודשה');

console.log('\n7. הוראה שלא קיימת:');
console.log('  ',JSON.stringify(renewStandingOrder_({id:'לא-קיים',amount:100,payments:12})));
ok(renewStandingOrder_({id:'zzz'}).success===false,'נדחה בשקט ובלי לכתוב לגיליון');
