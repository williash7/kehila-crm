import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { sumBudgetLines } from '../lib/holidayEvents';

// ─────────────────────────────────────────────────────────────────────────────
// עורך תקציב משותף — הוצאות מול הכנסות, מתוכנן מול בפועל.
//
// אותו מבנה נתונים משמש את החג, את האירוע ואת הפרויקט, ולכן הרכיב הזה נכתב
// פעם אחת ומשמש את שלושתם. שינוי בהיגיון התקציב קורה במקום אחד בלבד.
// ─────────────────────────────────────────────────────────────────────────────

export interface BudgetLine {
  name: string;
  planned?: number | string;
  actual?: number | string;
}

export interface Budget {
  expenses: BudgetLine[];
  income: BudgetLine[];
}

export function emptyBudget(): Budget {
  return { expenses: [], income: [] };
}

export function BudgetEditor({ budget, onChange, currency = '₪' }: {
  budget: Budget;
  onChange: (next: Budget) => void;
  currency?: string;
}) {
  const b: Budget = { expenses: budget?.expenses || [], income: budget?.income || [] };

  const patch = (kind: 'expenses' | 'income', idx: number, field: keyof BudgetLine, value: string) => {
    const lines = [...b[kind]];
    lines[idx] = { ...lines[idx], [field]: value };
    onChange({ ...b, [kind]: lines });
  };

  const add = (kind: 'expenses' | 'income') =>
    onChange({ ...b, [kind]: [...b[kind], { name: '', planned: '', actual: '' }] });

  const remove = (kind: 'expenses' | 'income', idx: number) =>
    onChange({ ...b, [kind]: b[kind].filter((_, i) => i !== idx) });

  const totals = {
    expPlan: sumBudgetLines(b.expenses, 'planned'),
    expAct: sumBudgetLines(b.expenses, 'actual'),
    incPlan: sumBudgetLines(b.income, 'planned'),
    incAct: sumBudgetLines(b.income, 'actual'),
  };
  const balance = totals.incAct - totals.expAct;

  const section = (kind: 'expenses' | 'income', title: string, color: string) => (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-bold text-[#0D1B2A]">{title}</h4>
        <button
          onClick={() => add(kind)}
          className="text-[#9B7A2F] bg-[#C9A84C]/10 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 active:scale-95 transition-transform"
        >
          <Plus size={12} /> שורה
        </button>
      </div>

      {b[kind].length === 0 ? (
        <p className="text-xs text-gray-400 py-2">אין שורות</p>
      ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_72px_72px_28px] gap-1.5 text-[10px] text-gray-400 font-bold px-1">
            <span>סעיף</span><span>מתוכנן</span><span>בפועל</span><span />
          </div>
          {b[kind].map((line, i) => (
            <div key={i} className="grid grid-cols-[1fr_72px_72px_28px] gap-1.5 items-center">
              <input
                value={line.name || ''}
                onChange={e => patch(kind, i, 'name', e.target.value)}
                placeholder="שם הסעיף"
                className="border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#C9A84C]"
              />
              <input
                type="number" inputMode="decimal"
                value={line.planned ?? ''}
                onChange={e => patch(kind, i, 'planned', e.target.value)}
                className="border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#C9A84C]"
              />
              <input
                type="number" inputMode="decimal"
                value={line.actual ?? ''}
                onChange={e => patch(kind, i, 'actual', e.target.value)}
                className={`border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#C9A84C] font-bold ${color}`}
              />
              <button
                onClick={() => remove(kind, i)}
                className="text-red-400 hover:text-red-600 flex justify-center"
                aria-label="מחק שורה"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {section('expenses', '💸 הוצאות', 'text-red-600')}
      {section('income', '💰 הכנסות', 'text-emerald-600')}

      <div className="bg-[#FAF6EE] rounded-xl p-3 border border-[#EDE6D6] space-y-1.5 text-sm">
        <Row label="הוצאות" plan={totals.expPlan} act={totals.expAct} currency={currency} />
        <Row label="הכנסות" plan={totals.incPlan} act={totals.incAct} currency={currency} />
        <div className="flex justify-between items-center pt-1.5 border-t border-[#EDE6D6] font-bold">
          <span className="text-[#0D1B2A]">מאזן בפועל</span>
          <span className={balance >= 0 ? 'text-emerald-700' : 'text-red-600'}>
            {currency}{balance.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, plan, act, currency }: { label: string; plan: number; act: number; currency: string }) {
  return (
    <div className="flex justify-between items-center text-gray-600">
      <span>{label}</span>
      <span className="text-xs">
        מתוכנן {currency}{plan.toLocaleString()} · בפועל <b className="text-[#0D1B2A]">{currency}{act.toLocaleString()}</b>
      </span>
    </div>
  );
}
