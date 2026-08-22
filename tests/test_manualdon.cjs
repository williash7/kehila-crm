const M = require('/tmp/stub/md.js');
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}

// מה שהאפליקציה יוצרת: toLocaleDateString('he-IL') → נקודות.
// מה שהגיליון מחזיר: asDate_ → לוכסנים. אותה תרומה בדיוק.
const local  = { name: 'אסתר לאר וולמיר', date: '18.08.2026', amount: 360 };
const server = { name: 'אסתר לאר וולמיר', date: '18/08/2026', amount: 360, id: 'man:1' };

console.log('א. אותה תרומה בשני פורמטים:');
console.log('   מקומי:', M.donationKey(local));
console.log('   שרת:  ', M.donationKey(server));
ok(M.donationKey(local) === M.donationKey(server), 'אותו מפתח — הכפילות מזוהה');

console.log('\nב. מיזוג:');
let r = M.mergeManualDonations([server], [local]);
console.log('   ', JSON.stringify({ merged: r.merged.length, keep: r.keepLocal.length, pruned: r.pruned }));
ok(r.merged.length === 1, 'תרומה אחת ולא שתיים');
ok(r.pruned === 1, 'העותק המקומי נגזם');
ok(r.keepLocal.length === 0, 'ולא יישאר באחסון לסבב הבא');
ok(r.merged[0].id === 'man:1', 'הרשומה שנשארה היא זו של השרת, עם המזהה');

console.log('\nג. תרומה שעדיין לא הגיעה מהשרת נשארת:');
const fresh = { name: 'משה', date: '18.08.2026', amount: 100 };
r = M.mergeManualDonations([server], [local, fresh]);
console.log('   ', JSON.stringify({ merged: r.merged.length, keep: r.keepLocal.length, pruned: r.pruned }));
ok(r.merged.length === 2 && r.keepLocal.length === 1, 'החדשה מוצגת ונשמרת, הישנה נגזמת');
ok(r.keepLocal[0].name === 'משה', 'ובדיוק הנכונה');

console.log('\nד. סכום כמחרוזת מול מספר:');
ok(M.donationKey({ name: 'א', date: '01/01/2026', amount: '250' }) ===
   M.donationKey({ name: 'א', date: '01.01.2026', amount: 250 }), 'לא מבחין בין "250" ל-250');

console.log('\nה. אותו אדם, סכום שונה — שתי תרומות:');
r = M.mergeManualDonations(
  [{ name: 'משה', date: '18/08/2026', amount: 100 }],
  [{ name: 'משה', date: '18.08.2026', amount: 200 }]
);
ok(r.merged.length === 2 && r.pruned === 0, 'לא ממוזגות בטעות');

console.log('\nו. מקרי קצה:');
ok(M.mergeManualDonations([], []).merged.length === 0, 'רשימות ריקות');
ok(M.mergeManualDonations(null, null).merged.length === 0, 'null לא מפיל');
ok(M.donationKey({}) === '||0', 'רשומה ריקה לא זורקת');
const noDate = { name: 'ללא תאריך', amount: 50 };
ok(M.mergeManualDonations([noDate], [{ ...noDate }]).pruned === 1, 'גם בלי תאריך הכפילות מזוהה');

console.log('\nז. הסימולציה שגרמה לבאג — חמישה רענונים ברצף:');
let stored = [local];
let shown = 0;
for (let i = 0; i < 5; i++) {
  const res = M.mergeManualDonations([server], stored);
  stored = res.keepLocal;
  shown = res.merged.reduce((s, d) => s + Number(d.amount), 0);
}
console.log('   סכום שמוצג אחרי חמישה רענונים: ₪' + shown);
ok(shown === 360, 'נשאר 360 — לא מצטבר');
