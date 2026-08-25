export type ScenarioCertainty = 'guaranteed' | 'expected';

export interface ScenarioCashflow {
  date: string; // yyyy-MM-dd
  amount: number;
  direction: 'income' | 'expense';
  certainty?: ScenarioCertainty;
  label?: string;
}

export interface ActivityScenarioInput {
  name: string;
  activityDate: string;
  currentBalance: number;
  safetyReserve: number;
  rentDue: number;
  salaryDue: number;
  otherCommitments: number;
  reimbursementDue: number;
  restrictedElsewhere: number;
  /** כסף שכבר התקבל ונשאר זמין דווקא לפעילות הזו. כלול ביתרה הנוכחית. */
  designatedAvailable: number;
  plannedCost: number;
  alreadyPaid: number;
  /** הכנסה שעוד לא ביתרה, אך מחויבת ובטוחה. */
  guaranteedFutureIncome: number;
  /** צפי בלבד; לעולם אינו משמש בהחלטת "אפשר לקיים" הבטוחה. */
  expectedFutureIncome: number;
  timeline?: ScenarioCashflow[];
}

export interface ActivityScenarioResult {
  name: string;
  activityDate: string;
  remainingCost: number;
  designatedAvailable: number;
  generalSafeBalance: number;
  guaranteedFutureIncome: number;
  expectedFutureIncome: number;
  guaranteedAvailable: number;
  optimisticAvailable: number;
  fundraisingGap: number;
  optimisticFundraisingGap: number;
  canProceedSafely: boolean;
  dependsOnExpectedIncome: boolean;
  firstRiskDate: string;
  firstOptimisticRiskDate: string;
  protectedBreakdown: {
    safetyReserve: number;
    rentDue: number;
    salaryDue: number;
    otherCommitments: number;
    reimbursementDue: number;
    restrictedElsewhere: number;
    designatedAvailable: number;
    total: number;
  };
}

const money = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};
const nonNegative = (value: unknown): number => Math.max(0, money(value));

function validDate(value: unknown): string {
  const text = String(value || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function riskDate(
  input: ActivityScenarioInput,
  includeExpected: boolean,
  protectedFloor: number,
  remainingCost: number,
): string {
  const rows = (input.timeline || [])
    .filter(row => validDate(row.date) && (includeExpected || row.certainty !== 'expected'))
    .map(row => ({
      date: validDate(row.date),
      effect: (row.direction === 'income' ? 1 : -1) * nonNegative(row.amount),
    }));
  const activityDate = validDate(input.activityDate);
  if (activityDate && remainingCost > 0) rows.push({ date: activityDate, effect: -remainingCost });
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.effect - b.effect); // הוצאה לפני הכנסה באותו יום

  let balance = money(input.currentBalance);
  for (const row of rows) {
    balance = money(balance + row.effect);
    if (balance < protectedFloor) return row.date;
  }
  return '';
}

/**
 * מחשב תרחיש בלבד. אין כאן יצירת פעילות, קמפיין או תנועה כספית.
 * כסף ייעודי מופרד מן היתרה הכללית כדי שלא ייספר פעמיים.
 */
export function calculateActivityScenario(input: ActivityScenarioInput): ActivityScenarioResult {
  const safetyReserve = nonNegative(input.safetyReserve);
  const rentDue = nonNegative(input.rentDue);
  const salaryDue = nonNegative(input.salaryDue);
  const otherCommitments = nonNegative(input.otherCommitments);
  const reimbursementDue = nonNegative(input.reimbursementDue);
  const restrictedElsewhere = nonNegative(input.restrictedElsewhere);
  const designatedAvailable = nonNegative(input.designatedAvailable);
  const guaranteedFutureIncome = nonNegative(input.guaranteedFutureIncome);
  const expectedFutureIncome = nonNegative(input.expectedFutureIncome);
  const remainingCost = Math.max(0, money(nonNegative(input.plannedCost) - nonNegative(input.alreadyPaid)));

  // המיועד לפעילות כלול ביתרת החשבון. מורידים אותו מן הבריכה הכללית ואז
  // מוסיפים אותו פעם אחת ככסף ייעודי — אחרת אותו שקל מממן את הפעילות פעמיים.
  const protectedTotal = money(
    safetyReserve + rentDue + salaryDue + otherCommitments
    + reimbursementDue + restrictedElsewhere + designatedAvailable,
  );
  const generalSafeBalance = Math.max(0, money(money(input.currentBalance) - protectedTotal));
  const guaranteedAvailable = money(designatedAvailable + generalSafeBalance + guaranteedFutureIncome);
  const optimisticAvailable = money(guaranteedAvailable + expectedFutureIncome);
  const fundraisingGap = Math.max(0, money(remainingCost - guaranteedAvailable));
  const optimisticFundraisingGap = Math.max(0, money(remainingCost - optimisticAvailable));
  const protectedFloor = money(safetyReserve + reimbursementDue + restrictedElsewhere);

  return {
    name: String(input.name || '').trim(),
    activityDate: validDate(input.activityDate),
    remainingCost,
    designatedAvailable,
    generalSafeBalance,
    guaranteedFutureIncome,
    expectedFutureIncome,
    guaranteedAvailable,
    optimisticAvailable,
    fundraisingGap,
    optimisticFundraisingGap,
    canProceedSafely: fundraisingGap === 0,
    dependsOnExpectedIncome: fundraisingGap > optimisticFundraisingGap,
    firstRiskDate: riskDate(input, false, protectedFloor, remainingCost),
    firstOptimisticRiskDate: riskDate(input, true, protectedFloor, remainingCost),
    protectedBreakdown: {
      safetyReserve,
      rentDue,
      salaryDue,
      otherCommitments,
      reimbursementDue,
      restrictedElsewhere,
      designatedAvailable,
      total: protectedTotal,
    },
  };
}
