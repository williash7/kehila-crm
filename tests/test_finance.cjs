const assert = require('assert');
const F = require('/tmp/stub/finance.js');

const base = F.normalizeFinanceData({
  openingDate: '2026-08-01',
  openingBalance: 10000,
  openingPersonalBalance: 0,
  safetyReserve: 1000,
  nextRentAmount: 4000,
  nextRentDate: '2026-09-01',
  forecastDays: 90,
  includeDonations: true,
  cashDonations: 'personal',
  transactions: [],
});

const tx = (kind, amount, title, status = 'actual', date = '2026-08-10', extra = {}) => ({
  id: `${kind}_${amount}_${title}`, kind, amount, title, status, date,
  category: kind === 'expense' ? 'שכירות' : 'אחר', createdAt: '2026-08-10T00:00:00Z',
  updatedAt: '2026-08-10T00:00:00Z', revision: 1, history: [], ...extra,
});

console.log('א. תזרים והתחשבנות אישית:');
const scenario = F.normalizeFinanceData({
  ...base,
  transactions: [
    tx('personal_expense', 300, 'קנייה מכיסי'),
    tx('salary', 500, 'משכורת מהמזומן'),
    tx('expense', 4000, 'שכירות', 'committed', '2026-09-01'),
    tx('income', 1000, 'תרומה צפויה', 'expected', '2026-08-20'),
  ],
});
const donations = [
  { id: 'bank', name: 'א', amount: 1000, date: '05/08/2026', method: 'העברה בנקאית' },
  { id: 'cash', name: 'ב', amount: 1000, date: '06/08/2026', method: 'מזומן' },
];
const summary = F.summarizeFinance(scenario, donations);
assert.strictEqual(summary.currentBalance, 11000, 'מזומן אישי אינו מגדיל יתרה זמינה');
assert.strictEqual(summary.personalBalance, -200, '1000 אצל המשתמש פחות 300 הוצאה ופחות 500 משכורת');
assert.strictEqual(summary.actualIncome, 2000, 'שתי התרומות הן הכנסה אמיתית');
assert.strictEqual(summary.actualExpense, 800, 'הוצאה פרטית ומשכורת נספרות כהוצאות');
assert.strictEqual(summary.guaranteedBalance, 7000, 'השכירות המחויבת יורדת מהתחזית הבטוחה');
assert.strictEqual(summary.optimisticBalance, 8000, 'הכנסה צפויה מופיעה רק בתרחיש הצפוי');
assert.strictEqual(summary.protectedAmount, 1000, 'שכירות שכבר נרשמה כהתחייבות אינה מוגנת פעמיים');
assert.strictEqual(summary.safeToUse, 6000);
const owed = F.summarizeFinance(F.normalizeFinanceData({
  ...base, nextRentAmount: 0, nextRentDate: '',
  transactions: [tx('personal_expense', 300, 'הוצאה פרטית')],
}), []);
assert.strictEqual(owed.protectedAmount, 1300, 'חוב של הפעילות למשתמש מוגן כמו כל חבות');
assert.strictEqual(owed.safeToUse, 8700);
const sameDay = F.summarizeFinance(F.normalizeFinanceData({
  ...base, openingDate: '2026-08-23', openingRecordedAt: '2026-08-23T12:00:00.000Z',
  openingBalance: 1000, nextRentAmount: 0, nextRentDate: '', safetyReserve: 0,
  transactions: [
    tx('expense', 100, 'חדש אחרי הפתיחה', 'actual', '2026-08-23', { createdAt: '2026-08-23T13:00:00.000Z' }),
    tx('income', 200, 'יובא מהעבר', 'actual', '2026-08-23', { source: 'import', createdAt: '2026-08-23T13:00:00.000Z' }),
  ],
}), [{ name: 'תרומה שכבר ביתרה', amount: 500, date: '23/08/2026', method: 'העברה' }]);
assert.strictEqual(sameDay.currentBalance, 900, 'יתרת עכשיו אינה סופרת שוב תרומה או ייבוא מאותו יום, אך תנועה חדשה כן');

console.log('ב. תיקון וביטול אינם מוחקים היסטוריה:');
let data = F.saveTransaction(base, tx('expense', 100, 'ציוד'));
const created = data.transactions[0];
data = F.saveTransaction(data, { ...created, amount: 150 });
assert.strictEqual(data.transactions[0].amount, 150);
assert.strictEqual(data.transactions[0].history.length, 1);
assert.strictEqual(data.transactions[0].history[0].snapshot.amount, 100);
data = F.cancelTransaction(data, created.id);
assert.strictEqual(data.transactions[0].status, 'cancelled');
assert.strictEqual(data.transactions[0].history.length, 2);

console.log('ג. הוצאות חוזרות וחלוקה בין יעדים:');
data = F.saveTransaction(base, tx('expense', 1200, 'הוצאה חודשית', 'committed'), 3);
assert.deepStrictEqual(data.transactions.map(x => x.date).sort(), ['2026-08-10', '2026-09-10', '2026-10-10']);
const splitData = F.normalizeFinanceData({ ...base, transactions: [tx('expense', 1000, 'מודעה', 'actual', '2026-08-10', {
  scopeType: 'event', scopeName: 'כללי', allocations: [
    { id: 'a', label: 'פורים', amount: 600 }, { id: 'b', label: 'פסח', amount: 400 },
  ],
})] });
const scopes = F.summarizeScopes(splitData);
assert.strictEqual(scopes.find(x => x.name === 'פורים').actualExpense, 600);
assert.strictEqual(scopes.find(x => x.name === 'פסח').actualExpense, 400);

console.log('ד. ייבוא מקומי מזהה עמודות וכפילויות:');
const csv = 'תאריך,תיאור,חובה,זכות,אסמכתא\n10/08/2026,חשמל,250,,A1\n11/08/2026,תרומה,,500,B1\n10/08/2026,חשמל,250,,A1';
const parsed = F.parseFinanceFile(csv, []);
assert.strictEqual(parsed[0].transaction.kind, 'expense');
assert.strictEqual(parsed[1].transaction.kind, 'income');
assert.strictEqual(parsed[2].duplicate, true);
assert.strictEqual(F.importFinanceRows(base, parsed).transactions.length, 2);
const exported = F.financeCsv(base, donations);
assert.ok(exported.includes('ישראל ישראלי') || exported.includes('"א"'), 'ייצוא מלא כולל גם תרומות שנקראות אוטומטית');

console.log('ה. AI קולט שכירות חודשית והכנסה שוטפת בלי אירוע:');
const aiImport = F.importAIFinanceTransactions(base, [
  { kind: 'expense', status: 'committed', title: 'שכירות בית חב״ד', amount: 4500, date: '2026-09-01', category: 'שכירות', repeatMonths: 3, scopeType: 'general' },
  { kind: 'income', status: 'expected', title: 'החזר הוצאות', amount: 1200, date: '2026-09-15', category: 'פעילות שוטפת', repeatMonths: 1, scopeType: 'general' },
]);
assert.strictEqual(aiImport.added, 4);
assert.deepStrictEqual(aiImport.data.transactions.filter(x => x.title.includes('שכירות')).map(x => x.date).sort(), ['2026-09-01', '2026-10-01', '2026-11-01']);
assert.ok(aiImport.data.transactions.every(x => x.scopeType === 'general'));
const aiAgain = F.importAIFinanceTransactions(aiImport.data, [
  { kind: 'expense', status: 'committed', title: 'שכירות בית חב״ד', amount: 4500, date: '2026-09-01', category: 'שכירות', repeatMonths: 3, scopeType: 'general' },
]);
assert.strictEqual(aiAgain.added, 0);
assert.strictEqual(aiAgain.skipped, 3, 'ייבוא חוזר אינו מכפיל את חודשי השכירות');

console.log('ו. תזרים מאוחד כולל את כל היסטוריית התרומות ומסכם לפי חודש:');
const historicalDonation = { id: 'old', name: 'ישן', amount: 700, date: '15/07/2026', method: 'העברה', purpose: 'פסח' };
const flowRows = F.buildFinanceFlowRows(scenario, [...donations, historicalDonation]);
assert.strictEqual(flowRows.filter(row => row.source === 'donation').length, 3, 'גם תרומה שלפני נקודת הפתיחה מוצגת בדוח');
const oldRow = flowRows.find(row => row.sourceId === 'old');
assert.strictEqual(oldRow.currentBalanceEffect, 0, 'תרומה היסטורית אינה נספרת שוב ביתרה הנוכחית');
assert.strictEqual(oldRow.purpose, 'פסח');
const flowMonths = F.summarizeFinanceFlowMonths(flowRows.filter(row => row.status === 'actual'));
assert.strictEqual(flowMonths.find(row => row.month === '2026-07').income, 700);
assert.strictEqual(flowMonths.find(row => row.month === '2026-08').income, 2000);
assert.strictEqual(flowMonths.find(row => row.month === '2026-08').expense, 800);

console.log('ז. המרכז אופציונלי והשרת כולל אותו בגיבוי:');
const fs = require('fs');
const settings = require('/tmp/settings.js');
assert.strictEqual(settings.DEFAULT_SETTINGS.showFinanceCenter, false);
const code = fs.readFileSync('google-apps-script/Code.gs', 'utf8');
assert.ok(code.includes("readSync_('finance')"));
assert.ok(/RESTORE_SYNC_KEYS[^;]+finance/s.test(code));
const app = fs.readFileSync('src/App.tsx', 'utf8');
assert.ok(app.includes("activeTab === 'finance'"));
const context = fs.readFileSync('src/store/AppContext.tsx', 'utf8');
assert.ok(/bundle\.finance === undefined \? getFinanceData\(\)/.test(context), 'שרת ישן אינו דורס נתונים כספיים מקומיים');
const aiUi = fs.readFileSync('src/components/GlobalAIImportModal.tsx', 'utf8');
const financeUi = fs.readFileSync('src/components/FinanceTab.tsx', 'utf8');
assert.ok(/הכנסות והוצאות שוטפות/.test(aiUi) && /schema\.finance/.test(aiUi));
assert.ok(/קלוט הכנסות והוצאות עם AI/.test(financeUi) && /initialTopics=\{\['finance'\]\}/.test(financeUi));
assert.ok(/תזרים הפעילות/.test(financeUi) && /חלוקה לפי חודשים/.test(financeUi), 'חייב להיות דוח תזרים חודשי עם סינונים');
assert.ok(/מה כלול בזמין כרגע/.test(financeUi) && /מה מחויב לצאת/.test(financeUi), 'ארבע המשבצות חייבות לפתוח פירוט');
assert.ok(/נקראת אוטומטית מיומן התרומות/.test(financeUi), 'תרומות חייבות להופיע בתוך רשימת התנועות');
assert.ok(/לא מודדים רווח/.test(financeUi) && /מעקב תקציב ומימון/.test(financeUi), 'מעקב פעילות אינו מסך רווח');

console.log('✓ חוזה המרכז הכספי תקין');
