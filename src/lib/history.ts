// היסטוריה של חגים/אירועים: כשמסמנים מופע כ"הסתיים", מצלמים תמונת מצב של
// המשימות/נוכחות/תקציב שלו לרשומת היסטוריה קבועה, ומרוקנים את המשימות
// החיות כדי שהמופע הבא (השנה הבאה) יתחיל נקי. אפשר לייבא בחזרה משימות
// מהמופע הקודם בלחיצת כפתור — הן נוספות כמשימות חדשות (done:false).

import { stampCreated } from './tasks';

export interface HistoryEntry {
  id: string;
  type: 'holiday' | 'event';
  name: string;
  occurrenceDate?: string;
  archivedAt: string; // ISO
  tasks: any[];
  attendance: Record<string, Record<string, boolean>>;
  budget: { expenses: any[]; income: any[] };
  insights: { good: string; improve: string; plan: string };
}

// כמה אנשים נכחו בסה"כ (איחוד לפי שם על פני כל תאריכי הנוכחות שנשמרו למופע זה)
export function countAttendance(attendance: Record<string, Record<string, boolean>> | undefined): number {
  if (!attendance) return 0;
  const names = new Set<string>();
  Object.values(attendance).forEach(byName => {
    Object.entries(byName || {}).forEach(([name, present]) => { if (present) names.add(name); });
  });
  return names.size;
}

export function sumBudget(budget: { expenses?: any[]; income?: any[] } | undefined) {
  const exps = budget?.expenses || [];
  const incs = budget?.income || [];
  const sum = (arr: any[], key: string) => arr.reduce((s, x) => s + (Number(x[key]) || 0), 0);
  return {
    plannedExpense: sum(exps, 'planned'),
    actualExpense: sum(exps, 'actual'),
    plannedIncome: sum(incs, 'planned'),
    actualIncome: sum(incs, 'actual'),
  };
}

export function buildHistoryEntry(params: {
  type: 'holiday' | 'event';
  name: string;
  occurrenceDate?: string;
  tasks?: any[];
  attendance?: Record<string, Record<string, boolean>>;
  budget?: { expenses: any[]; income: any[] };
  insights?: { good: string; improve: string; plan: string };
}): HistoryEntry {
  return {
    id: `hist_${params.type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: params.type,
    name: params.name,
    occurrenceDate: params.occurrenceDate,
    archivedAt: new Date().toISOString(),
    tasks: params.tasks || [],
    attendance: params.attendance || {},
    budget: params.budget || { expenses: [], income: [] },
    insights: params.insights || { good: '', improve: '', plan: '' },
  };
}

// מוצא את רשומת ההיסטוריה האחרונה עבור אותו שם (אותו חג/אירוע), לצורך ייבוא משימות
export function findLatestHistoryFor(history: HistoryEntry[], type: 'holiday' | 'event', name: string): HistoryEntry | null {
  const matches = history.filter(h => h.type === type && h.name === name);
  if (matches.length === 0) return null;
  return matches.reduce((latest, cur) => (new Date(cur.archivedAt) > new Date(latest.archivedAt) ? cur : latest));
}

// משכפל את המשימות מרשומת היסטוריה כמשימות חדשות ("איפוס" מצב done, ותאריך יצירה חדש)
export function tasksFromHistory(entry: HistoryEntry): any[] {
  return (entry.tasks || []).map(t => stampCreated({
    ...t,
    done: false,
    ...(t.kind === 'invite' ? { doneNames: [] } : {}),
  }));
}
