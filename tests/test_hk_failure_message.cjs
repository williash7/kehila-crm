const assert = require('assert');
const { buildRecipients, fillTemplate, DEFAULT_TEMPLATES, roundKey } = require('/tmp/stub/hkBroadcast.js');

const oneOrder = {
  id: '101', name: 'יעקב חיים', active: true, amount: 100,
  remaining: 8, lastBilled: '01/10/2026',
};
const oneFailure = {
  order: '101', name: 'יעקב חיים', amount: 50,
  date: '20/10/2026', reason: 'כרטיס לא תקין',
};
const recipients = buildRecipients('failure', [oneOrder], [oneFailure], {}, {}, 2);
assert.strictEqual(recipients.length, 1);
assert.strictEqual(recipients[0].amount, 50, 'Show actual failed amount, not just standing order total');
assert.strictEqual(recipients[0].failureDate, '20/10/2026');
assert.strictEqual(recipients[0].failureCount, 1);

const varsHe = { signer: 'הרב אשר', org: 'חב״ד בעליה עפולה', lang: 'he' };
const msgHe = fillTemplate(DEFAULT_TEMPLATES.failure.he, recipients[0], varsHe);
assert.ok(msgHe.includes('שלום יעקב חיים'));
assert.ok(msgHe.includes('50 ₪, מתאריך 20/10/2026'));
assert.ok(msgHe.includes('תודה רבה על השותפות'));
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
const combined = buildRecipients('failure', twoOrders, twoFailures, {}, {}, 2);
assert.strictEqual(combined.length, 1, 'One donor should receive one message');
assert.strictEqual(combined[0].amount, 120);
assert.strictEqual(combined[0].failureCount, 2);
assert.strictEqual(combined[0].failureDate, '', 'Do not attribute combined amount to one date');
const combinedMsg = fillTemplate(DEFAULT_TEMPLATES.failure.he, combined[0], varsHe);
assert.ok(combinedMsg.includes('כמה חיובים'));
assert.ok(combinedMsg.includes('120 ₪'));
assert.ok(!combinedMsg.includes('22/10/2026'));

const settled = buildRecipients('failure', [{...oneOrder,lastBilled:'21/10/2026'}], [oneFailure], {}, {}, 2);
assert.strictEqual(settled.length, 0, 'Never message a charge already followed by successful billing');

const noDate = fillTemplate(DEFAULT_TEMPLATES.failure.he, {
  name: 'יעקב', amount: 50, reason: '', failureDate: '', failureCount: 1,
}, varsHe);
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
console.log('✓ ניסוח כשל חיוב אישי, עדין ועם סכום/תאריך מדויקים');
