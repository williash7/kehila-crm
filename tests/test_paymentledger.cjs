const fs = require('fs');
const assert = require('assert');
const P = require('/tmp/stub/paymentLedger.js');
const R = require('/tmp/stub/reconciliation.js');

const ledger = [
  { id: '100', name: 'ישראל ישראלי', date: '03/08/2026', amount: 100, status: 'received' },
  { id: '101', name: 'שרה כהן', date: '04/08/2026', amount: 200, status: 'received' },
  { id: 'hk:7:2026-09', orderId: '7', name: 'ישראל ישראלי', date: '03/09/2026', amount: 100, status: 'future' },
  { id: 'hk:8:2026-08', orderId: '8', name: 'דוד לוי', date: '05/08/2026', amount: 300, status: 'failed' },
  { id: 'hk:9:2026-08', orderId: '9', name: 'לאה', date: '06/08/2026', amount: 400, status: 'cancelled' },
];

const summary = P.summarizePaymentRows(ledger);
assert.deepStrictEqual(summary.received, { count: 2, total: 300 });
assert.deepStrictEqual(summary.failed, { count: 1, total: 300 });
assert.strictEqual(P.filterPaymentRows(ledger, { month: '2026-08' }).length, 4);
assert.strictEqual(P.filterPaymentRows(ledger, { search: 'order 7' }).length, 0);
assert.strictEqual(P.filterPaymentRows(ledger, { search: '7' })[0].orderId, '7');

const csv = '\uFEFFמספר אישור,שם לקוח,תאריך עסקה,סכום עסקה,סטטוס\n' +
  '100,ישראל ישראלי,03/08/2026,"100.00",הצלחה\n' +
  '101,שרה כהן,04.08.2026,"250,00",הצלחה\n' +
  '999,"שם, עם פסיק",07/08/2026,50,נדחה\n';
const report = R.parseReconciliationFile(csv);
assert.strictEqual(report.length, 3);
assert.strictEqual(report[1].amount, 250);
assert.strictEqual(report[1].date, '04/08/2026');
assert.strictEqual(report[2].name, 'שם, עם פסיק');
assert.strictEqual(report[2].status, 'failed');

const result = R.reconcilePayments(ledger, report, '2026-08');
assert.strictEqual(result.matched.length, 1, 'מספר אישור מדויק תואם');
assert.strictEqual(result.amountMismatch.length, 1, 'שם+תאריך מוצאים רשומה ומדווחים הפרש סכום');
assert.strictEqual(result.appOnly.length, 0);
assert.strictEqual(result.ignoredReport.length, 1, 'שורה שנדחתה אינה מושווית להכנסה');

const duplicateReport = R.parseReconciliationFile(JSON.stringify([
  { 'מספר אישור': '100', 'סכום': 100 },
  { 'מספר אישור': '100', 'סכום': 100 },
]));
const duplicateResult = R.reconcilePayments(ledger, duplicateReport, '2026-08');
assert.strictEqual(duplicateResult.matched.length, 1);
assert.strictEqual(duplicateResult.ambiguous.length, 1, 'שורת דוח כפולה אינה משודכת בניחוש לרשומה אחרת');

assert.throws(() => R.parseReconciliationFile('עמודה,אחרת\nא,ב'), /עמודות הנדרשות/);

const settings = require('/tmp/settings.js');
assert.strictEqual(settings.DEFAULT_SETTINGS.showPaymentStatuses, false, 'התצוגה האופציונלית כבויה כברירת מחדל');
const donationsTab = fs.readFileSync('src/components/DonationsTab.tsx', 'utf8');
assert.ok(donationsTab.includes('settings.showPaymentStatuses'), 'הטאב מופיע רק דרך ההגדרה');
const setupWizard = fs.readFileSync('src/components/SetupWizard.tsx', 'utf8');
assert.ok(/if \(step === 2\) return true/.test(setupWizard), 'מצב ההדגמה המובטח באשף אינו חוסם את כפתור ההמשך');
const orgConfig = fs.readFileSync('src/lib/orgConfig.ts', 'utf8');
assert.ok(/return o\.configured && !!o\.orgName\.he;/.test(orgConfig), 'מצב הדגמה אינו דורש כתובת גיליון לאחר סיום האשף');
console.log('✓ מצבי תשלום והתאמה חודשית בצד הלקוח');
