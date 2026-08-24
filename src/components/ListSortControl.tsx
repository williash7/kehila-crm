import React from 'react';

export type ListSortField = 'date' | 'amount' | 'name';
export type ListSortDirection = 'asc' | 'desc';
export interface ListSortValue { field: ListSortField; direction: ListSortDirection }

function readSort(key: string, fallback: ListSortValue): ListSortValue {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    if (['date', 'amount', 'name'].includes(parsed?.field) && ['asc', 'desc'].includes(parsed?.direction)) return parsed;
  } catch { /* אחסון מקומי הוא שיפור נוחות בלבד */ }
  return fallback;
}

export function usePersistentListSort(key: string, fallback: ListSortValue = { field: 'date', direction: 'desc' }) {
  const [value, setValue] = React.useState<ListSortValue>(() => readSort(key, fallback));
  React.useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* לא חוסמים את המסך */ }
  }, [key, value]);
  return [value, setValue] as const;
}

export function compareListValues(
  a: { name?: unknown; amount?: unknown; date?: unknown },
  b: { name?: unknown; amount?: unknown; date?: unknown },
  sort: ListSortValue,
  parseDate: (value?: string | null) => Date | null,
) {
  let result = 0;
  if (sort.field === 'amount') result = (Number(a.amount) || 0) - (Number(b.amount) || 0);
  else if (sort.field === 'name') result = String(a.name || '').localeCompare(String(b.name || ''), 'he');
  else result = (parseDate(String(a.date || ''))?.getTime() || 0) - (parseDate(String(b.date || ''))?.getTime() || 0);
  return sort.direction === 'asc' ? result : -result;
}

export function ListSortControl({
  value, onChange, fields = ['date', 'amount', 'name'],
}: {
  value: ListSortValue;
  onChange: (value: ListSortValue) => void;
  fields?: ListSortField[];
}) {
  const labels: Record<ListSortField, string> = { date: 'תאריך', amount: 'סכום', name: 'א׳–ב׳' };
  const directionLabels: Record<ListSortField, { desc: string; asc: string }> = {
    date: { desc: 'מהחדש לישן', asc: 'מהישן לחדש' },
    amount: { desc: 'מהגדול לקטן', asc: 'מהקטן לגדול' },
    name: { desc: 'מת׳ עד א׳', asc: 'מא׳ עד ת׳' },
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="block"><span className="block text-[10px] font-bold text-gray-500 mb-1">מיון לפי</span>
        <select value={value.field} onChange={e => onChange({ ...value, field: e.target.value as ListSortField })} className="w-full bg-gray-50 border border-[#EDE6D6] rounded-lg px-2 py-2 text-xs outline-none focus:border-[#C9A84C]">
          {fields.map(field => <option key={field} value={field}>{labels[field]}</option>)}
        </select>
      </label>
      <label className="block"><span className="block text-[10px] font-bold text-gray-500 mb-1">סדר</span>
        <select value={value.direction} onChange={e => onChange({ ...value, direction: e.target.value as ListSortDirection })} className="w-full bg-gray-50 border border-[#EDE6D6] rounded-lg px-2 py-2 text-xs outline-none focus:border-[#C9A84C]">
          <option value="desc">יורד — {directionLabels[value.field].desc}</option>
          <option value="asc">עולה — {directionLabels[value.field].asc}</option>
        </select>
      </label>
    </div>
  );
}
