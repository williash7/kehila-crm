const assert = require('assert');
const fs = require('fs');
const path = require('path');
const M = require('/tmp/stub/monthClose.js');
const A = require('/tmp/stub/activityScenario.js');
const F = require('/tmp/stub/finance.js');

console.log('א. סגירת חודש אינה מאזנת פערים לבד:');
const open = M.calculateMonthClose({
  month: '2026-08', computedOrgBalance: 10000, officialOrgBalance: 9800,
  cash: [
    { id: 'mine', label: 'מזומן אצלי', computed: 500, counted: 450 },
    { id: 'box', label: 'קופת צדקה', computed: 300, counted: 300 },
  ],
  reimbursementDue: 900, heldActivityCash: 450,
  commitmentsDue: 4000, deferredChecksOut: 1200, deferredChecksIn: 2000,
});
assert.strictEqual(open.orgDifference, -200, 'הפער נשאר גלוי');
assert.strictEqual(open.totalCashDifference, -50, 'מיקומי המזומן מושווים בנפרד');
assert.strictEqual(open.personalPosition, 450, 'החזר פחות מזומן מוחזק = מה שהפעילות חייבת');
assert.strictEqual(open.protectedOutgoing, 5200, 'הכנסה עתידית אינה מקטינה התחייבויות וצ׳קים יוצאים');
assert.strictEqual(open.status, 'review', 'פער לא מוסבר נשאר לבדיקה');

const explained = M.calculateMonthClose({
  ...open, cash: open.cash, officialOrgBalance: open.officialOrgBalance,
  differencesExplained: true, notes: 'עמלה שטרם הוזנה',
});
assert.strictEqual(explained.status, 'explained', 'רק פער מלא עם הסבר מפורש נסגר כמוסבר');

const incomplete = M.calculateMonthClose({
  month: '2026-08', computedOrgBalance: 10000, officialOrgBalance: null,
  cash: [{ id: 'mine', label: 'אצלי', computed: 0, counted: null }],
  reimbursementDue: 0, heldActivityCash: 0, commitmentsDue: 0,
  deferredChecksOut: 0, deferredChecksIn: 0,
});
assert.strictEqual(incomplete.complete, false);
assert.strictEqual(incomplete.status, 'review', 'אי אפשר לסמן תואם לפני שהיתרה והמזומן הוזנו');

const matched = M.calculateMonthClose({
  ...incomplete, officialOrgBalance: 10000,
  cash: [{ id: 'mine', label: 'אצלי', computed: 0, counted: 0 }],
});
assert.strictEqual(matched.status, 'matched');
const v1 = M.createMonthClosureSnapshot({ ...incomplete, officialOrgBalance: 10000, cash: matched.cash }, [], '2026-08-31T10:00:00Z');
const v2 = M.createMonthClosureSnapshot({ ...incomplete, officialOrgBalance: 10000, cash: matched.cash }, [v1], '2026-08-31T11:00:00Z');
assert.strictEqual(v1.version, 1);
assert.strictEqual(v2.version, 2, 'פתיחה מחדש יוצרת גרסה ואינה מוחקת את הקודמת');

console.log('ב. תרחיש פעילות שומר כסף חיוני בצד:');
const scenario = A.calculateActivityScenario({
  name: 'ליל הסדר', activityDate: '2026-09-10', currentBalance: 100000,
  safetyReserve: 10000, rentDue: 20000, salaryDue: 15000,
  otherCommitments: 5000, reimbursementDue: 3000,
  restrictedElsewhere: 20000, designatedAvailable: 8000,
  plannedCost: 40000, alreadyPaid: 0,
  guaranteedFutureIncome: 5000, expectedFutureIncome: 10000,
});
assert.strictEqual(scenario.generalSafeBalance, 19000);
assert.strictEqual(scenario.guaranteedAvailable, 32000,
  'כסף ייעודי נספר פעם אחת בלבד ולא גם כחלק מהיתרה הכללית');
assert.strictEqual(scenario.fundraisingGap, 8000);
assert.strictEqual(scenario.optimisticFundraisingGap, 0);
assert.strictEqual(scenario.canProceedSafely, false);
assert.strictEqual(scenario.dependsOnExpectedIncome, true,
  'הכנסה צפויה מוצגת כתרחיש אופטימי ולא כהבטחה');

console.log('ג. עלות שכבר שולמה אינה נדרשת שוב:');
const partlyPaid = A.calculateActivityScenario({
  ...scenario, currentBalance: 50000, safetyReserve: 5000, rentDue: 5000,
  salaryDue: 0, otherCommitments: 0, reimbursementDue: 0,
  restrictedElsewhere: 0, designatedAvailable: 10000,
  plannedCost: 30000, alreadyPaid: 12000,
  guaranteedFutureIncome: 0, expectedFutureIncome: 0,
});
assert.strictEqual(partlyPaid.remainingCost, 18000);
assert.strictEqual(partlyPaid.fundraisingGap, 0);

console.log('ד. תאריך הסיכון מחושב בלי לסמוך על צפי:');
const timed = A.calculateActivityScenario({
  name: 'אירוע', activityDate: '2026-09-10', currentBalance: 30000,
  safetyReserve: 5000, rentDue: 0, salaryDue: 0, otherCommitments: 0,
  reimbursementDue: 0, restrictedElsewhere: 0, designatedAvailable: 0,
  plannedCost: 20000, alreadyPaid: 0,
  guaranteedFutureIncome: 0, expectedFutureIncome: 0,
  timeline: [
    { date: '2026-09-05', amount: 10000, direction: 'expense', certainty: 'guaranteed', label: 'שכירות' },
    { date: '2026-09-08', amount: 15000, direction: 'income', certainty: 'expected', label: 'צפי תרומות' },
  ],
});
assert.strictEqual(timed.firstRiskDate, '2026-09-10', 'בלי הצפי הסיכון נחשף ביום הפעילות');
assert.strictEqual(timed.firstOptimisticRiskDate, '', 'בתרחיש האופטימי הצפי מונע את המחסור');

console.log('ה. הכלים מחוברים למרכז הכספי ונשמרים בתאימות לאחור:');
const legacy = F.normalizeFinanceData({ version: 1, transactions: [] });
assert.deepStrictEqual(legacy.monthClosures, [], 'נתונים ישנים מקבלים רשימת סגירות ריקה');
assert.deepStrictEqual(legacy.activityScenarios, [], 'ונתוני תרחישים ריקים');
const root = path.join(__dirname, '..');
const tab = fs.readFileSync(path.join(root, 'src/components/FinanceTab.tsx'), 'utf8');
const tools = fs.readFileSync(path.join(root, 'src/components/FinancePlanningTools.tsx'), 'utf8');
assert.match(tab, /\{ id: 'planning', label: 'בדיקה ותכנון' \}/,
  'הכלים מרוכזים בלשונית אחת כדי לא להעמיס');
assert.match(tab, /<FinancePlanningTools[^>]*persist=\{persist\}/);
assert.match(tools, /createMonthClosureSnapshot\(draft, data\.monthClosures\)/);
assert.match(tools, /snapshot\.status === 'review' \? data\.lastClosedMonth : month/,
  'טיוטה עם פער פתוח נשמרת אך אינה מסומנת כחודש שנסגר');
assert.match(tools, /row\.includedAfterOpening && row\.cashDestination === 'activity_cashbox'/,
  'ספירת הקופה אינה כוללת שוב תרומות שכבר נבלעו ביתרת הפתיחה');
assert.match(tools, /activityScenarios: \[\.\.\.data\.activityScenarios, snapshot\]/);
assert.match(tools, /אינה יוצרת תנועת איזון/,
  'המסך אומר במפורש שסגירה אינה משנה את החשבון');
assert.match(tools, /תרחיש בלבד.*אינו יוצר פעילות, קמפיין או התחייבות/s,
  'תרחיש אינו מתחזה להחלטה או משנה נתונים אחרים');

console.log('✓ סגירת חודש ותרחיש פעילות');
