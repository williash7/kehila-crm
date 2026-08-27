// ─────────────────────────────────────────────────────────────────────────────
// מזומן שנלקח כמשכורת, והוראות קבע בתחזית.
//
// שני התיקונים האלה נולדו מאותו משפט של אשר: „הסתבכתי לגמרי, כי הכנסתי
// חלק מהמשכורת מתוך המזומן אבל לא הכל”. הבדיקות כאן שומרות על שני
// הכללים שמונעים את ההסתבכות הזו מלחזור:
//
//   1. מזומן שנלקח כמשכורת נספר **פעמיים** — פעם כהכנסה ופעם כהוצאה —
//      ואפס פעמים בבנק.
//   2. תחזית שרואה רק את מה שיוצא היא תחזית שגויה. הוראות קבע נכנסות.
// ─────────────────────────────────────────────────────────────────────────────

const assert = require('assert');
const F = require('/tmp/stub/finance.js');
const S = require('/tmp/stub/standingOrderForecast.js');
const C = require('/tmp/stub/cashDonations.js');

const base = F.normalizeFinanceData({
  openingDate: '2026-08-01',
  openingBalance: 0,
  safetyReserve: 0,
  nextRentAmount: 0,
  nextRentDate: '',
  forecastDays: 120,
  includeDonations: true,
  cashDonations: 'personal',
  transactions: [],
});

const cash = (id, amount, destination) => ({
  id, name: id, amount, date: '10/08/2026', method: 'מזומן', cashDestination: destination,
});

console.log('א. מזומן שנלקח כמשכורת:');
{
  const summary = F.summarizeFinance(base, [cash('s', 1000, 'salary')]);
  assert.strictEqual(summary.actualIncome, 1000, 'התרומה נכנסה — היא הכנסה אמיתית');
  assert.strictEqual(summary.actualExpense, 1000, 'והיא יצאה מיד כמשכורת — הוצאה אמיתית');
  assert.strictEqual(summary.currentBalance, 0, 'הבנק לא זז: הכסף מעולם לא עבר דרכו');
  assert.strictEqual(summary.personalBalance, 0, 'אין חוב לאף כיוון — המזומן ששכב אצלו הוא בדיוק מה ששולם לו');
  assert.strictEqual(summary.salaryFromCash, 1000, 'הסכום מדווח בנפרד כדי שאפשר יהיה להסביר אותו');
  console.log('   ✓ נספר כהכנסה וכהוצאה, בלי לגעת בבנק');
}

console.log('ב. מה עוד מחכה להחלטה:');
{
  const donations = [
    cash('a', 100, 'org_account'),
    cash('b', 200, 'activity_cashbox'),
    cash('c', 300, 'salary'),
    cash('d', 400, 'personal'),
    cash('e', 500, 'unclassified'),
    { id: 'f', name: 'f', amount: 600, date: '10/08/2026', method: 'מזומן' },
    { id: 'g', name: 'g', amount: 700, date: '10/08/2026', method: 'העברה בנקאית' },
  ];
  const summary = F.summarizeFinance(base, donations);

  assert.strictEqual(summary.availableCash, 300, 'רק עמותה וקופת הפעילות נחשבים מזומן זמין');
  assert.strictEqual(summary.unresolvedCash, 1500, '„נשמר בצד” + „לא סווג” + מזומן בלי בחירה בכלל');
  assert.strictEqual(summary.unresolvedCashCount, 3, 'שלוש תרומות מחכות להחלטה');

  // כל התרומות סופרות לברוטו — גם ה„לא מסווג” שאינו נכנס ל-actualIncome.
  // זו בדיוק הנקודה שבה חישוב בדיעבד היה סופר את „נשמר בצד” פעמיים.
  assert.strictEqual(summary.grossIncome, 2800, 'כל מה שנכנס, בלי שום קיזוז ובלי כפילות');

  const list = F.unresolvedCashDonations(base, donations);
  assert.deepStrictEqual(list.map(d => d.id), ['d', 'e', 'f'], 'הרשימה מצביעה על התרומות עצמן, לא רק על מספר');
  console.log('   ✓ שלושה מצבים פתוחים, ברוטו בלי כפילות, ורשימה שאפשר לפעול לפיה');
}

console.log('ג. הסיווג הישן ממשיך לעבוד:');
{
  assert.strictEqual(C.cashDestinationNeedsAttention('org_account'), false);
  assert.strictEqual(C.cashDestinationNeedsAttention('activity_cashbox'), false);
  assert.strictEqual(C.cashDestinationNeedsAttention('salary'), false);
  assert.strictEqual(C.cashDestinationNeedsAttention('personal'), true);
  assert.strictEqual(C.cashDestinationNeedsAttention('unclassified'), true);
  assert.strictEqual(C.cashDestinationNeedsAttention(''), true, 'תרומה ישנה בלי בחירה כלל היא מקרה פתוח');
  assert.strictEqual(C.cashDestinationLabel('salary'), 'נלקח כמשכורת');
  console.log('   ✓ חמש האפשרויות מסווגות נכון, וגם „לא נבחר כלום”');
}

console.log('ד. חיזוי הוראות קבע:');
{
  const hk = { id: '1', name: 'תורם', active: true, amount: 100, remaining: 3, nextCharge: '2026-09-10', lastBilled: '2026-08-10' };
  const charges = S.projectChargesFor(hk, '2026-08-27', '2027-08-27');
  assert.deepStrictEqual(charges.map(c => c.date), ['2026-09-10', '2026-10-10', '2026-11-10'], 'שלושה חיובים חודשיים, כמספר שנותר');
  assert.strictEqual(charges.every(c => c.amount === 100), true);

  const cancelled = S.projectChargesFor({ ...hk, cancelDate: '2026-08-20' }, '2026-08-27', '2027-08-27');
  assert.strictEqual(cancelled.length, 0, 'הוראה שבוטלה אינה מייצרת הכנסה עתידית');

  const renewed = S.projectChargesFor({ ...hk, renewedBy: '2' }, '2026-08-27', '2027-08-27');
  assert.strictEqual(renewed.length, 0, 'הוראה שחודשה נגבית תחת המספר החדש, לא תחת הישן');

  const unlimited = S.projectChargesFor({ ...hk, unlimited: true, remaining: 0 }, '2026-08-27', '2026-12-31');
  assert.strictEqual(unlimited.length, 4, 'הוראה ללא הגבלה נמשכת עד סוף האופק');

  const noAnchor = S.projectChargesFor({ ...hk, nextCharge: '', lastBilled: '' }, '2026-08-27', '2027-08-27');
  assert.strictEqual(noAnchor.length, 0, 'בלי מועד ידוע לא מנחשים לוח זמנים');

  // חיוב שכבר נגבה יושב כשורת תרומה אמיתית. אם היינו חוזים גם אותו,
  // אותו כסף היה נספר פעמיים — פעם כתרומה ופעם כצפי.
  const past = S.projectChargesFor({ ...hk, nextCharge: '2026-08-10' }, '2026-08-27', '2027-08-27');
  assert.strictEqual(past.every(c => c.date > '2026-08-27'), true, 'חיוב שכבר עבר אינו נחזה שוב');
  console.log('   ✓ פעילות בלבד, ספירה מדויקת, ובלי כפילות מול חיובים שכבר נגבו');
}

console.log('ה. ה-31 בחודש:');
{
  // הבאג הקלאסי: setMonth על 31 בינואר מגלגל ל-3 במרץ. כאן היום נחתך
  // לאורך החודש בפועל וחוזר ל-31 בחודש שאחריו.
  assert.strictEqual(S.addMonthsKeepingDay('2027-01-31', 1, 31), '2027-02-28', 'פברואר נחתך ולא גולש למרץ');
  assert.strictEqual(S.addMonthsKeepingDay('2027-01-31', 2, 31), '2027-03-31', 'ומרץ חוזר ל-31');
  assert.strictEqual(S.addMonthsKeepingDay('2026-12-15', 1, 15), '2027-01-15', 'מעבר שנה');
  console.log('   ✓ אין גלישה לחודש הבא');
}

console.log('ו. הוראות קבע משפרות את התחזית ולא את היתרה הבטוחה:');
{
  const withCheque = F.normalizeFinanceData({
    ...base,
    openingBalance: 1000,
    transactions: [{
      id: 'cheque', kind: 'expense', amount: 3000, title: 'צ׳ק', status: 'committed',
      date: '2026-11-01', category: 'אחר', createdAt: '2026-08-10T00:00:00Z',
      updatedAt: '2026-08-10T00:00:00Z', revision: 1, history: [],
    }],
  });
  const hk = [{ id: '1', name: 'תורם', active: true, amount: 1000, remaining: 3, nextCharge: '2026-09-01', lastBilled: '' }];

  const without = F.summarizeFinance(withCheque, [], []);
  const withHk = F.summarizeFinance(withCheque, [], hk);

  assert.strictEqual(without.optimisticBalance, withHk.optimisticBalance - 3000, 'שלושה חיובי הו״ק נכנסים לתמונה האופטימית');
  assert.strictEqual(without.guaranteedBalance, withHk.guaranteedBalance, 'ולא לתמונה הבטוחה — הוראת קבע יכולה להיכשל');
  assert.strictEqual(withHk.expectedIncome, 3000, 'הן מדווחות כהכנסה צפויה');
  console.log('   ✓ הצ׳ק בעוד שלושה חודשים כבר לא מסתיר את ההכנסות שבדרך');
}

console.log('ז. חוסר מוצג ולא נבלע:');
{
  const tight = F.normalizeFinanceData({ ...base, openingBalance: 1000, safetyReserve: 5000 });
  const summary = F.summarizeFinance(tight, []);
  assert.strictEqual(summary.safeToUse, 0, '„בטוח לשימוש” נשאר לא־שלילי — מינוס אינו סכום שאפשר לפעול לפיו');
  assert.strictEqual(summary.shortfall, 4000, 'אבל החוסר עצמו נשמר במפורש ולא נעלם בקטיעה');
  console.log('   ✓ המצב שבו צריך לצאת יותר ממה שיש מופיע כמספר');
}

console.log('ח. מחיקת תנועה:');
{
  const withRows = F.normalizeFinanceData({
    ...base,
    transactions: [
      { id: 'a', kind: 'expense', amount: 100, title: 'א', status: 'actual', date: '2026-08-10', category: '', createdAt: '', updatedAt: '', revision: 1, history: [] },
      { id: 'b', kind: 'expense', amount: 200, title: 'ב', status: 'actual', date: '2026-08-10', category: '', createdAt: '', updatedAt: '', revision: 1, history: [] },
    ],
  });
  assert.deepStrictEqual(F.deleteTransaction(withRows, 'a').transactions.map(t => t.id), ['b'], 'השורה נעלמת באמת, לא מסומנת כמבוטלת');
  assert.strictEqual(F.deleteTransaction(withRows, 'לא-קיים').transactions.length, 2, 'מזהה שאינו קיים אינו מוחק דבר');
  assert.strictEqual(F.deleteTransaction(withRows, '').transactions.length, 2, 'מזהה ריק אינו מרוקן את הרשימה');
  console.log('   ✓ מחיקה מדויקת, ובלי תאונות על קלט ריק');
}

console.log('ט. שמירה חוזרת אינה הזנה נוספת:');
{
  // ── הבאג ──
  //
  // אשר: „הכנסתי 150 ש״ח לבדיקה — הוא נכנס פעמיים.”
  //
  // הטופס יצר רשומה חדשה בכל לחיצה, כי בלי מזהה אין דרך לדעת שזו אותה
  // הזנה. החלון גם לא נסגר אחרי שמירה, וזה הזמין את הלחיצה השנייה.
  const draft = {
    id: 'tx_thelma_1', kind: 'income', amount: 150, title: 'בדיקה',
    status: 'actual', date: '2026-08-27', category: '',
  };

  const once = F.saveTransaction(base, draft, 1);
  assert.strictEqual(once.transactions.length, 1, 'שמירה אחת יוצרת רשומה אחת');
  assert.strictEqual(once.transactions[0].id, 'tx_thelma_1', 'והמזהה שהגיע מהטופס נשמר');

  const twice = F.saveTransaction(once, draft, 1);
  assert.strictEqual(twice.transactions.length, 1, 'לחיצה שנייה על אותו טופס מעדכנת ואינה מוסיפה');
  assert.strictEqual(twice.transactions[0].amount, 150, 'והסכום נשאר 150 ולא 300');

  const edited = F.saveTransaction(once, { ...draft, amount: 200 }, 1);
  assert.strictEqual(edited.transactions.length, 1, 'גם עריכה אינה מייצרת רשומה נוספת');
  assert.strictEqual(edited.transactions[0].amount, 200, 'הסכום החדש נכנס');

  // רשומה בלי מזהה עדיין מקבלת מזהה חדש — אחרת שתי הזנות שונות היו
  // דורסות זו את זו.
  const anonymous = F.saveTransaction(once, { ...draft, id: undefined, title: 'הזנה אחרת' }, 1);
  assert.strictEqual(anonymous.transactions.length, 2, 'הזנה חדשה בלי מזהה היא רשומה נוספת');

  // חזרה חודשית: רק הראשונה לוקחת את המזהה שהגיע, השאר עצמאיות.
  const series = F.saveTransaction(base, { ...draft, status: 'committed' }, 3);
  assert.strictEqual(series.transactions.length, 3, 'שלוש חזרות הן שלוש רשומות');
  assert.strictEqual(new Set(series.transactions.map(t => t.id)).size, 3, 'ולכל אחת מזהה משלה');
  assert.strictEqual(series.transactions[0].id, 'tx_thelma_1', 'הראשונה שומרת על המזהה מהטופס');
  console.log('   ✓ 150 נשארים 150 גם בלחיצה שנייה');
}

console.log('י. יתרה רצה — „כמה היה בחשבון באותו רגע”:');
{
  const withRows = F.normalizeFinanceData({ ...base, openingBalance: 1000 });
  const rows = F.buildFinanceFlowRows(withRows, [
    { id: 'd1', name: 'תרומה', amount: 500, date: '05/08/2026', method: 'העברה בנקאית' },
    { id: 'd2', name: 'תרומה ב', amount: 300, date: '20/08/2026', method: 'העברה בנקאית' },
  ]);
  const balances = F.runningBalances(rows, withRows.openingBalance);

  const byDate = rows
    .filter(r => balances.has(r.id))
    .sort((a, b) => a.date.localeCompare(b.date));
  assert.strictEqual(balances.get(byDate[0].id), 1500, 'אחרי הראשונה: 1000 + 500');
  assert.strictEqual(balances.get(byDate[1].id), 1800, 'ואחרי השנייה: 1500 + 300');

  // ── הנקודה הקריטית ──
  //
  // יתרה רצה שמחושבת על רשימה מסוננת היא שקר: סינון ל„הכנסות בלבד”
  // היה מייצר יתרה שרק מטפסת. לכן היא מחושבת על הכל, והמסך שולף לפי
  // מזהה — „מה היה ב-20 באוגוסט” אינו משתנה בגלל סינון.
  const filtered = rows.filter(r => r.id === byDate[1].id);
  const wrong = F.runningBalances(filtered, withRows.openingBalance);
  assert.strictEqual(wrong.get(byDate[1].id), 1300, 'חישוב על המסונן היה נותן 1300 — ולכן לא מחשבים על המסונן');
  assert.strictEqual(balances.get(byDate[1].id), 1800, 'החישוב הנכון נשאר 1800');
  console.log('   ✓ היתרה שייכת לרגע ולא למיקום ברשימה');
}

console.log('\nכל הבדיקות עברו');
