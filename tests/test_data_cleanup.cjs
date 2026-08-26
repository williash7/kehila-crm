const fs = require('fs');
eval(fs.readFileSync('/tmp/base.js', 'utf8').split("console.log('1.")[0]);
function ok(c, m) { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; }

console.log('א. סימון ידני של כשל הוראת קבע:');
addStandingOrder_({ name: 'תורם בדיקה', amount: 180, startDate: '2026-08-05', payments: 12, id: 'manual-fail-1' });
let result = addManualChargeFailure_({ orderId: 'manual-fail-1', date: '2026-08-05', reason: 'החיוב נדחה ידנית' });
ok(result.success === true && result.duplicate === false, 'הכשל נרשם בפעם הראשונה');
ok(getFailures_().filter(f => f.order === 'manual-fail-1').length === 1, 'נוספה שורת כשל אחת');
let charge = getPaymentLedger_().find(row => row.id === 'hk:manual-fail-1:2026-08');
ok(charge && charge.status === 'failed', 'חיוב החודש סומן כנכשל');
ok(!getDonations_().some(row => row.id === 'hk:manual-fail-1:2026-08'), 'החיוב לא נספר כתרומה שנכנסה');

result = addManualChargeFailure_({ orderId: 'manual-fail-1', date: '2026-08-22', reason: 'ניסיון חוזר' });
ok(result.success === true && result.duplicate === true, 'אותו חודש מזוהה ככפילות');
ok(getFailures_().filter(f => f.order === 'manual-fail-1').length === 1, 'ניסיון חוזר לא יוצר שורת כשל נוספת');
ok(addManualChargeFailure_({ orderId: 'not-found', date: '2026-08-05' }).success === false, 'הוראה שאינה קיימת נדחית');

console.log('\nב. ניקוי תרומות שומר היסטוריה ומגן על רשומות מורכבות:');
addDonation_({ reqId: 'clean-manual', name: 'תרומה ידנית', amount: 500, date: '2026-08-01' });
appendByName_(SH.LOG, {
  'מזהה': 'mail:clean-email', 'שם': 'תרומת מייל', 'תאריך תרומה': '02/08/2026',
  'סכום': 700, 'מקור': 'מייל', 'סיכום ותובנות': 'הערה קיימת',
});
appendByName_(SH.LOG, {
  'מזהה': 'mixed:clean', 'שם': 'תרומה ומפגש', 'תאריך תרומה': '03/08/2026',
  'סכום': 250, 'מקור': 'ידני', 'תאריך מפגש': '03/08/2026',
});
flushWrites_();
result = cancelDonationsBulk_({ ids: ['man:clean-manual', 'mail:clean-email', 'mixed:clean', 'hk:manual-fail-1:2026-08'], reason: 'בדיקת ניקוי' });
ok(result.cancelled === 2, 'רק שתי התרומות הרגילות בוטלו');
ok(result.mixed === 1, 'שורה שכוללת מפגש הוגנה');
ok(result.protected === 1, 'חיוב הוראת קבע הוגן');
ok(!getDonations_().some(row => row.id === 'man:clean-manual' || row.id === 'mail:clean-email'), 'התרומות שבוטלו יצאו מהסכומים');
ok(getDonations_().some(row => row.id === 'mixed:clean'), 'תיעוד משולב לא נעלם');
const ledger = getPaymentLedger_();
const cancelled = ledger.find(row => row.id === 'mail:clean-email');
ok(cancelled && cancelled.status === 'cancelled', 'השורה נשארה ביומן כ„מבוטל”');
ok(cancelled.notes === 'הערה קיימת', 'הערה קיימת נשמרה בדיוק ולא נדרסה בניקוי');

result = cancelDonationsBulk_({ ids: ['man:clean-manual', 'mail:clean-email'] });
ok(result.cancelled === 0 && result.already === 2, 'הרצה חוזרת אינה משנה שוב את אותן שורות');

console.log('\nג. סינון וביטול בצד האפליקציה:');
const D = require('/tmp/stub/dataCleanup.js');
const donations = [
  { id: 'a', name: 'א', amount: 10, date: '01/08/2026', source: 'ידני' },
  { id: 'b', name: 'ב', amount: 20, date: '02/08/2026', source: 'מייל' },
  { id: 'hk:1:2026-08', name: 'ג', amount: 30, date: '03/08/2026', source: 'הוראת קבע 1' },
];
ok(D.donationSourceGroup(donations[0]) === 'manual', 'מקור ידני מזוהה');
ok(D.donationSourceGroup(donations[2]) === 'standing', 'חיוב הוראת קבע מזוהה לפי המזהה והמקור');
ok(D.filterDonationsForCleanup(donations, { source: 'email', from: '', to: '' }).length === 1, 'סינון תרומות לפי מקור');
ok(D.filterDonationsForCleanup(donations, { source: 'all', from: '2026-08-02', to: '2026-08-03' }).length === 2, 'סינון תרומות לפי טווח תאריכים');

const finance = {
  version: 1, openingDate: '', openingRecordedAt: '', openingBalance: 0,
  openingPersonalBalance: 0, openingHeldCashBalance: 0, safetyReserve: 0,
  nextRentAmount: 0, nextRentDate: '', forecastDays: 90, includeDonations: true,
  cashDonations: 'personal', categories: [], monthClosures: [], activityScenarios: [],
  transactions: [
    { id: 'f1', kind: 'expense', status: 'actual', title: 'שכירות', amount: 1000, date: '2026-08-01', category: 'שכירות', source: 'manual', createdAt: 'x', updatedAt: 'x', revision: 1, history: [] },
    { id: 'f2', kind: 'income', status: 'actual', title: 'הכנסה', amount: 500, date: '2026-08-02', category: 'אחר', source: 'import', createdAt: 'x', updatedAt: 'x', revision: 1, history: [] },
  ],
};
const filtered = D.filterFinanceForCleanup(finance.transactions, { source: 'manual', direction: 'expense', from: '', to: '' });
ok(filtered.length === 1 && filtered[0].id === 'f1', 'סינון תנועה לפי מקור וכיוון');
const changed = D.cancelFinanceTransactions(finance, ['f1']);
ok(changed.cancelled === 1 && changed.data.transactions.find(x => x.id === 'f1').status === 'cancelled', 'תנועה בוטלה במקום להימחק');
ok(changed.data.transactions.find(x => x.id === 'f1').history.length === 1, 'המצב הקודם נשמר בהיסטוריה');

console.log('\nד. שערי הבטיחות בממשק:');
const cardSource = fs.readFileSync(__dirname + '/../src/components/DataCleanupCard.tsx', 'utf8');
const backupAt = cardSource.indexOf('await createAndDownloadFullBackup');
const donationAt = cardSource.indexOf('await cancelDonationsBulkQueued');
const financeAt = cardSource.indexOf('await updateFinanceData(result.data)');
ok(backupAt >= 0 && donationAt > backupAt && financeAt > backupAt, 'הגיבוי מסתיים לפני כל אחד משני מסלולי הניקוי');
ok(/confirmText\.trim\(\) !== 'נקה'/.test(cardSource), 'נדרש אישור כתוב לפני ביצוע');
ok(/donationSourceGroup\(row\) !== 'standing'/.test(cardSource), 'חיובי הוראות קבע אינם נבחרים בניקוי תרומות');

const failureDialog = fs.readFileSync(__dirname + '/../src/components/ManualFailureDialog.tsx', 'utf8');
ok(/addManualChargeFailureQueued/.test(failureDialog), 'מסך הכשל משתמש בפעולה בטוחה לתור ושליחה חוזרת');
ok(/הוראת הקבע עצמה לא תבוטל/.test(failureDialog), 'המשתמש מקבל הסבר שההוראה עצמה נשארת פעילה');
