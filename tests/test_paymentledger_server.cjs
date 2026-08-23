const fs = require('fs');
const assert = require('assert');
const code = fs.readFileSync('google-apps-script/Code.gs', 'utf8');
eval(fs.readFileSync('/tmp/base.js', 'utf8').split("console.log('1.")[0]);

sheets[SH.LOG].values = [
  COLS.LOG.slice(),
  ['ok', 'ישראל', '01/08/2026', 100, '', 'מזומן', '', '', '', '', 'ידני', ''],
  ['future', 'ישראל', '01/09/2026', 100, '', 'הוראת קבע', '', '', '', '', 'הוראת קבע 7', STATUS_FUTURE],
  ['hk:7:2026-08', 'ישראל', '01/08/2026', 100, '', 'הוראת קבע', '', '', '', '', 'הוראת קבע 7', STATUS_FAILED],
  ['cancelled', 'שרה', '02/08/2026', 200, '', 'הוראת קבע', '', '', '', '', '', STATUS_CANCELLED],
  ['meeting', 'דוד', '', '', '', '', '03/08/2026', 'בית', 'פגישה', '', '', ''],
  ['odd', 'לאה', '04/08/2026', 50, '', 'מזומן', '', '', '', '', '', 'מצב חדש'],
];
__tableCache = {};

const payments = getPaymentLedger_();
assert.strictEqual(payments.length, 5, 'מפגש ללא תרומה אינו נכנס ליומן הכספי');
assert.deepStrictEqual(payments.map(p => p.status), ['received', 'future', 'failed', 'cancelled', 'received']);
assert.strictEqual(payments[2].orderId, '7');
assert.strictEqual(payments[4].rawStatus, 'מצב חדש', 'סטטוס לא מוכר נשמר לתצוגת חריגה');
assert.deepStrictEqual(getDonations_().map(d => d.id), ['ok', 'meeting', 'odd'],
  'ההזנה הקיימת נשארת ללא שינוי: מפגשים נשמרים בה, ורק סטטוסים שאינם כסף מסוננים');
assert.ok(code.includes("action !== 'getPaymentLedger'"), 'פתיחת תצוגת הבקרה אינה מתזמנת כתיבה ברקע');
console.log('✓ שרת מצבי תשלום: כל המצבים בלי לשנות את חישוב ההכנסה');
