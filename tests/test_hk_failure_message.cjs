const assert = require('assert');
const { buildRecipients, fillTemplate, DEFAULT_TEMPLATES, roundKey, isFailureContactEligible, FAILURE_CONTACT_DAYS } = require('/tmp/stub/hkBroadcast.js');
const TEST_NOW = new Date(2026, 9, 24);

const oneOrder = {
  id: '101', name: 'יעקב חיים', active: true, amount: 100,
  remaining: 8, lastBilled: '01/10/2026',
};
const oneFailure = {
  order: '101', name: 'יעקב חיים', amount: 50,
  date: '20/10/2026', reason: 'כרטיס לא תקין',
};
const recipients = buildRecipients('failure', [oneOrder], [oneFailure], {}, {}, 2, [], TEST_NOW);
assert.strictEqual(recipients.length, 1);
assert.strictEqual(recipients[0].amount, 50, 'Show actual failed amount, not just standing order total');
assert.strictEqual(recipients[0].failureDate, '20/10/2026');
assert.strictEqual(recipients[0].failureCount, 1);

const varsHe = { signer: 'הרב אשר', org: 'חב״ד בעליה עפולה', lang: 'he' };
const msgHe = fillTemplate(DEFAULT_TEMPLATES.failure.he, recipients[0], varsHe);
assert.ok(msgHe.startsWith('מה שלומך, יעקב חיים?'));
assert.ok(msgHe.includes('רציתי להודות לך על השותפות הקבועה שלך'));
assert.ok(msgHe.includes('כשיתאפשר לך, אשמח אם תוכל לבדוק את העניין. ואם צריך עזרה, אשתדל לסייע.'));
assert.ok(msgHe.includes('החיוב האחרון של הוראת הקבע'));
assert.ok(msgHe.includes('50 ₪, מתאריך 20/10/2026'));
assert.ok(msgHe.includes('תודה רבה על הכול!'));
assert.ok(!msgHe.includes('כרטיס לא תקין'), 'Never expose payment-failure reason automatically');
assert.ok(!msgHe.includes('{פרטי חיוב}'));

const msgRu = fillTemplate(DEFAULT_TEMPLATES.failure.ru, recipients[0], {
  signer: 'Раввин Ашер', org: 'Хабад ба-Алия — Афула', lang: 'ru',
});
assert.ok(msgRu.includes('от 20/10/2026'));
assert.ok(msgRu.includes('50 ₪'));
assert.ok(!msgRu.includes('כרטיס לא תקין'));
assert.ok(!msgRu.includes('{פרטי חיוב}'));

const twoOrders = [
  oneOrder,
  { id: '102', name: 'יעקב חיים', active: true, amount: 70, remaining: 5, lastBilled: '01/10/2026' },
];
const twoFailures = [
  oneFailure,
  { order: '102', name: 'יעקב חיים', amount: 70, date: '22/10/2026' },
];
const combined = buildRecipients('failure', twoOrders, twoFailures, {}, {}, 2, [], TEST_NOW);
assert.strictEqual(combined.length, 1, 'One donor should receive one message');
assert.strictEqual(combined[0].amount, 120);
assert.strictEqual(combined[0].failureCount, 2);
assert.strictEqual(combined[0].failureDate, '', 'Do not attribute combined amount to one date');
const combinedMsg = fillTemplate(DEFAULT_TEMPLATES.failure.he, combined[0], varsHe);
assert.ok(combinedMsg.includes('כמה חיובים'));
assert.ok(combinedMsg.includes('120 ₪'));
assert.ok(!combinedMsg.includes('22/10/2026'));

const settled = buildRecipients('failure', [{...oneOrder,lastBilled:'21/10/2026'}], [oneFailure], {}, {}, 2, [], TEST_NOW);
assert.strictEqual(settled.length, 0, 'Never message a charge already followed by successful billing');

const noDate = fillTemplate(DEFAULT_TEMPLATES.failure.he, {
  name: 'יעקב', amount: 50, reason: '', failureDate: '', failureCount: 1,
}, varsHe);
assert.ok(noDate.includes('החיוב האחרון של הוראת הקבע, בסך 50 ₪, לא הושלם'));
assert.ok(!noDate.includes('מתאריך  לא'));
assert.strictEqual(
  roundKey('failure', new Date(2026, 9, 1)),
  roundKey('failure', new Date(2026, 10, 1)),
  'An unresolved incident should not be queued as new each month',
);
assert.notStrictEqual(
  roundKey('thanks', new Date(2026, 9, 1)),
  roundKey('thanks', new Date(2026, 10, 1)),
  'Normal monthly thank-you rounds should still reset',
);

// חלון פנייה לפי ימים קלנדריים: יום הכשל ויום 14 נכללים, יום 15 אינו נכלל.
assert.strictEqual(FAILURE_CONTACT_DAYS, 14);
const fixedNow = new Date(2026, 10, 1, 20, 30);
assert.strictEqual(isFailureContactEligible('01/11/2026', fixedNow), true, 'Same day');
assert.strictEqual(isFailureContactEligible('18/10/2026', fixedNow), true, 'Exactly 14 days');
assert.strictEqual(isFailureContactEligible('17/10/2026', fixedNow), false, 'Day 15 expired');
assert.strictEqual(isFailureContactEligible('2026-10-18', fixedNow), true, 'ISO date support');
assert.strictEqual(isFailureContactEligible('2026-10-17', fixedNow), false);
assert.strictEqual(isFailureContactEligible('02/11/2026', fixedNow), false, 'Future dates must not be contacted');
assert.strictEqual(isFailureContactEligible('', fixedNow), false, 'Missing date must not be contacted');
assert.strictEqual(isFailureContactEligible('31/02/2026', fixedNow), false, 'Invalid date must not be contacted');
assert.strictEqual(isFailureContactEligible('18.10.2026', fixedNow), true, 'Other persisted formats');

const fresh = buildRecipients('failure', [oneOrder], [{...oneFailure, date:'18/10/2026'}], {}, {}, 2, [], fixedNow);
const stale = buildRecipients('failure', [oneOrder], [{...oneFailure, date:'17/10/2026'}], {}, {}, 2, [], fixedNow);
assert.strictEqual(fresh.length, 1, 'Day 14 still offers the message');
assert.strictEqual(stale.length, 0, 'Day 15 no longer offers the message');

const mixed = buildRecipients('failure', [
  oneOrder,
  {...oneOrder, id:'102', amount:70},
], [
  {...oneFailure, date:'17/10/2026'},
  {order:'102', name:oneOrder.name, amount:70, date:'31/10/2026'},
], {}, {}, 2, [], fixedNow);
assert.strictEqual(mixed.length, 1, 'A fresh failure remains sendable when another is old');
assert.strictEqual(mixed[0].amount, 70, 'Never include an old failed charge in the sum');
assert.strictEqual(mixed[0].failureDate, '31/10/2026');


// כשלי חיוב חדשים שהתקבלו במערכת ללא הוראת קבע תואמת אינם נעלמים.
// זהו המקרה שבו לשונית שגיאות מציגה חיובים מ-1/11 ו-22/10,
// אבל מסך הוואטסאפ הציג רק הוראה קיימת מ-20/10.
const screenshotCases = buildRecipients('failure', [
  {...oneOrder, id:'002', name:'אילון מדיה - יוסף ונחמי אילון', amount:250, lastBilled:'01/10/2026'},
], [
  {name:'שלום בוהרון', date:'01/11/2026', amount:200, reason:'סירוב - מסגרת מלאה או חוק שגוי'},
  {name:'מושקי גורליק', date:'22/10/2026', amount:100, reason:'סירוב - מסגרת מלאה או חוק שגוי'},
  {name:'אילון מדיה - יוסף ונחמי אילון', order:'002', date:'20/10/2026', amount:250, reason:'כרטיס (002)'},
], {
  'שלום בוהרון':{phone:'0501111111'},
  'אילון מדיה - יוסף ונחמי אילון':{phone:'0502222222'},
}, {}, 2, [], new Date(2026,10,1));
assert.strictEqual(screenshotCases.length, 3, 'Three recent failures must be in the recipient list');
assert.deepStrictEqual(screenshotCases.map(r=>r.name).sort(), [
  'שלום בוהרון','מושקי גורליק','אילון מדיה - יוסף ונחמי אילון',
].sort());
assert.strictEqual(screenshotCases.filter(r=>r.phone).length,2);
const oldNotice = screenshotCases.find(r=>r.name==='מושקי גורליק');
assert.strictEqual(oldNotice.failureDate,'22/10/2026');
assert.strictEqual(oldNotice.failureType,'donation');
assert.ok(fillTemplate(DEFAULT_TEMPLATES.failure.he,oldNotice,varsHe).includes('של התרומה'));
assert.ok(!fillTemplate(DEFAULT_TEMPLATES.failure.he,oldNotice,varsHe).includes('הוראת הקבע'));
const standingNotice = screenshotCases.find(r=>r.name.includes('אילון'));
assert.strictEqual(standingNotice.failureType,'standing');
assert.ok(fillTemplate(DEFAULT_TEMPLATES.failure.he,standingNotice,varsHe).includes('של הוראת הקבע'));

// הוראת קבע שבוטלה אוטומטית ביום הקמתה עדיין דורשת טיפול,
// בשונה מהוראה שבוטלה במכוון או חויבה בהצלחה אחר כך.
const rejectedSetup = {...oneOrder,id:'701',name:'הוראה שלא הוקמה',startDate:'01/11/2026',
  cancelDate:'01/11/2026',notes:'בוטל אוטומטית: סורבה ביום ההקמה',lastBilled:''};
const setupFailure = {order:'701',name:'הוראה שלא הוקמה',date:'01/11/2026',amount:100,reason:'סורב'};
assert.strictEqual(buildRecipients('failure',[rejectedSetup],[setupFailure],{},{},2,[],new Date(2026,10,1)).length,1);
assert.strictEqual(buildRecipients('failure',[{...rejectedSetup,notes:''}],[setupFailure],{},{},2,[],new Date(2026,10,1)).length,0);

console.log('✓ ניסוח כשל חיוב אישי, עדין ועם סכום/תאריך מדויקים');
