// וואטסאפ לבעלי הוראות קבע — מי מקבל, כמה פעמים, ומה כתוב בהודעה.
const assert = require('assert');
const fs = require('fs');

const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};

const B = require('/tmp/stub/hkBroadcast.js');

console.log('א. מספרי טלפון מנורמלים לפורמט wa.me:');
assert.strictEqual(B.normalizePhone('050-123-4567'), '972501234567');
assert.strictEqual(B.normalizePhone('+972 50 123 4567'), '972501234567');
assert.strictEqual(B.normalizePhone('501234567'), '972501234567');
assert.strictEqual(B.normalizePhone('00972501234567'), '972501234567');
assert.strictEqual(B.normalizePhone(''), '');
assert.strictEqual(B.normalizePhone('123'), '');

const hk = [
  { id: '1', name: 'דוד כהן', active: true, amount: 100, remaining: 8, lastBilled: '01/10/2026', phone: '0501111111' },
  { id: '2', name: 'דוד כהן', active: true, amount: 50, remaining: 8, lastBilled: '01/10/2026', phone: '050-111-1111' },
  { id: '3', name: 'שרה לוי', active: true, amount: 36, remaining: 1, lastBilled: '01/10/2026' },
  { id: '4', name: 'משה ישן', active: false, amount: 200, remaining: 0, lastBilled: '01/01/2025', phone: '0502222222' },
  { id: '5', name: 'רחל מבטלת', active: true, amount: 80, remaining: 5, lastBilled: '01/09/2026', cancelDate: '05/09/2026', phone: '0503333333' },
  { id: '6', name: 'יוסי נכשל', active: true, amount: 120, remaining: 6, lastBilled: '01/08/2026', phone: '0504444444' },
  { id: '7', name: 'בלי טלפון', active: true, amount: 18, remaining: 4, lastBilled: '01/10/2026' },
  { id: '8', name: 'חיים שתיקן', active: true, amount: 60, remaining: 4, lastBilled: '01/10/2026', phone: '0505555555' },
];
const failures = [
  { date: '02/10/2026', name: 'יוסי נכשל', order: '6', amount: 120, reason: 'כרטיס פג תוקף' },
  // כשל ישן שנכנס כסף אחריו — כבר לא פתוח
  { date: '02/09/2026', name: 'חיים שתיקן', order: '8', amount: 60, reason: 'סירוב' },
  // הוראה מבוטלת לא נחשבת כשל
  { date: '02/10/2026', name: 'רחל מבטלת', order: '5', amount: 80, reason: 'סירוב' },
];
const crm = { 'שרה לוי': { phone: '0526666666' } };
const donors = {};

console.log('ב. תודה: רק הוראות פעילות, אדם עם כמה הוראות מקבל הודעה אחת עם הסכום המצטבר:');
const thanks = B.buildRecipients('thanks', hk, failures, crm, donors, 2);
const names = thanks.map(r => r.name);
assert.ok(!names.includes('משה ישן'), 'הוראה שהסתיימה לא מקבלת');
assert.ok(!names.includes('רחל מבטלת'), 'הוראה שבוטלה לא מקבלת');
const david = thanks.filter(r => r.name === 'דוד כהן');
assert.strictEqual(david.length, 1);
assert.strictEqual(david[0].amount, 150);
assert.deepStrictEqual(david[0].orderIds, ['1', '2']);

console.log('ג. טלפון נלקח גם מכרטיס איש הקשר, ומי שאין לו טלפון נשאר ברשימה בלי טלפון:');
assert.strictEqual(thanks.find(r => r.name === 'שרה לוי').phone, '972526666666');
assert.strictEqual(thanks.find(r => r.name === 'בלי טלפון').phone, '');

console.log('ד. כשל חיוב: רק כשלים פתוחים:');
const fail = B.buildRecipients('failure', hk, failures, crm, donors, 2);
assert.deepStrictEqual(fail.map(r => r.name), ['יוסי נכשל']);
assert.strictEqual(fail[0].reason, 'כרטיס פג תוקף');

console.log('ה. מילוי הנוסח:');
const text = B.fillTemplate('שלום {שם}, תודה על ₪{סכום}. {סיבה}\n{חותם} / {ארגון}', { name: 'דוד', amount: 1500, reason: 'סירוב' }, { signer: 'הרב', org: 'חב"ד' });
assert.strictEqual(text, 'שלום דוד, תודה על ₪1,500. סירוב\nהרב / חב"ד');
assert.ok(!/\{[^}]+\}/.test(B.fillTemplate(B.DEFAULT_TEMPLATES.thanks.ru, { name: 'x', amount: 1, reason: '' }, { signer: 's', org: 'o' })), 'לא נשארים שדות לא ממולאים');
assert.ok(B.waLink('972501234567', 'שלום עולם').startsWith('https://wa.me/972501234567?text=%D7%A9'));

console.log('ו. "נשלח" נשמר לפי סוג וחודש:');
B.saveSent('thanks', { a: 'x' });
assert.deepStrictEqual(B.loadSent('thanks'), { a: 'x' });
assert.deepStrictEqual(B.loadSent('failure'), {});
assert.ok(/:thanks:\d{4}-\d{2}$/.test(B.roundKey('thanks')));

console.log('ז. הכפתורים מחוברים למסכי הוראות הקבע:');
const modal = fs.readFileSync('src/components/StandingOrdersModal.tsx', 'utf8');
const tab = fs.readFileSync('src/components/DonationsTab.tsx', 'utf8');
assert.ok(modal.includes('<HkWhatsAppModal'));
assert.ok(tab.includes('<HkWhatsAppModal'));

console.log('✓ וואטסאפ להוראות קבע');

console.log('ח. תרומה בתשלומי אשראי מקבלת הודעה כל עוד נשארו תשלומים:');
{
  const now = new Date();
  const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  const monthsAgo = n => { const d = new Date(now.getFullYear(), now.getMonth() - n, 1); return fmt(d); };
  const dons = [
    { name: 'אבי תשלומים', date: monthsAgo(3), amount: 1200, notes: 'שולם ב-12 תשלומים' },
    { name: 'גמר לשלם', date: monthsAgo(13), amount: 1200, notes: 'שולם ב-12 תשלומים' },
    { name: 'חד פעמי', date: monthsAgo(0), amount: 500, notes: '' },
    { name: 'נכשל', date: monthsAgo(1), amount: 600, notes: 'שולם ב-6 תשלומים', status: 'נכשל' },
  ];
  const plans = B.activeInstallments(dons, now);
  assert.deepStrictEqual(plans.map(p => p.name), ['אבי תשלומים']);
  assert.strictEqual(plans[0].monthly, 100);
  assert.strictEqual(plans[0].paid, 4);
  const crm2 = { 'אבי תשלומים': { phone: '0507777777' } };
  const t2 = B.buildRecipients('thanks', [], [], crm2, {}, 2, dons);
  assert.strictEqual(t2.length, 1);
  assert.strictEqual(t2[0].amount, 100);
  assert.deepStrictEqual(t2[0].installments, { paid: 4, total: 12 });
  assert.strictEqual(B.buildRecipients('failure', [], [], crm2, {}, 2, dons).length, 0, 'אין "כשל חיוב" לתשלומי אשראי');
}
console.log('✓ תשלומי אשראי');

console.log('ט. חלון תשלומי אשראי: רצות וגמורות, ותאריך סיום:');
{
  const rows = B.installmentRows([
    { name: 'א', date: '15/03/2026', amount: 1200, notes: 'שולם ב-12 תשלומים' },
    { name: 'ב', date: '01/01/2025', amount: 600, notes: 'שולם ב-6 תשלומים' },
  ], new Date(2026, 9, 19));
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].name, 'א');
  assert.strictEqual(rows[0].paid, 8);
  assert.strictEqual(rows[0].endsMonth, '02/2027');
  assert.strictEqual(rows[1].done, true);
  assert.strictEqual(rows[1].paid, 6);
  const modal = fs.readFileSync('src/components/StandingOrdersModal.tsx', 'utf8');
  assert.ok(modal.includes('<InstallmentsModal'));
}
console.log('✓ חלון תשלומי אשראי');
