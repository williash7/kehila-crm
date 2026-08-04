import React from 'react';
import { HDate } from '@hebcal/core';

export const HEBREW_MONTHS = ['Nisan', 'Iyyar', 'Sivan', 'Tamuz', 'Av', 'Elul', 'Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shvat', 'Adar 1', 'Adar 2'];
export const HEBREW_MONTHS_HE = ['ניסן', 'אייר', 'סיוון', 'תמוז', 'אב', 'אלול', 'תשרי', 'חשוון', 'כסלו', 'טבת', 'שבט', 'אדר א\'', 'אדר ב\''];

export interface HebrewDateValue {
  d: string;
  m: string;
  y: string;
}

export const emptyHebrewDateValue = (): HebrewDateValue => ({ d: '', m: 'Nisan', y: '' });

// בורר תאריך עברי (יום / חודש / שנה) — משמש גם בממיר התאריכים העצמאי וגם
// ישירות בטופס עריכת הפרופיל, כדי שהזנת תאריך עברי תמיד תיצור ערך אמין
// שניתן לחשב איתו (ולא טקסט חופשי).
export function HebrewDatePicker({ value, onChange }: { value: HebrewDateValue; onChange: (v: HebrewDateValue) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div>
        <label className="block text-xs font-bold text-gray-500 mb-1">יום</label>
        <input
          type="number" min="1" max="30" placeholder="1-30"
          value={value.d}
          onChange={e => onChange({ ...value, d: e.target.value })}
          className="w-full border-2 border-[#EDE6D6] rounded-xl p-3 focus:border-[#C9A84C] outline-none text-center"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 mb-1">חודש</label>
        <select
          value={value.m}
          onChange={e => onChange({ ...value, m: e.target.value })}
          className="w-full border-2 border-[#EDE6D6] rounded-xl p-3 focus:border-[#C9A84C] outline-none bg-white text-center"
        >
          {HEBREW_MONTHS.map((m, i) => (
            <option key={m} value={m}>{HEBREW_MONTHS_HE[i]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 mb-1">שנה</label>
        <input
          type="number" min="5700" placeholder="לדוגמה 5786"
          value={value.y}
          onChange={e => onChange({ ...value, y: e.target.value })}
          className="w-full border-2 border-[#EDE6D6] rounded-xl p-3 focus:border-[#C9A84C] outline-none text-center"
        />
      </div>
    </div>
  );
}

// הופך אובייקט HDate לערך בורר (כדי לאתחל את הבורר מתאריך קיים)
export function hdateToValue(hdate: HDate): HebrewDateValue {
  return {
    d: String(hdate.getDate()),
    m: HEBREW_MONTHS[hdate.getMonth() - 1] || 'Nisan',
    y: String(hdate.getFullYear()),
  };
}

// הופך ערך בורר לאובייקט HDate, או null אם חסר/לא תקין
export function hebrewDateValueToHDate(value: HebrewDateValue): HDate | null {
  const day = parseInt(value.d, 10);
  const year = parseInt(value.y, 10);
  if (!day || day < 1 || day > 30 || !year || year < 3000) return null;
  try {
    return new HDate(day, value.m, year);
  } catch {
    return null;
  }
}
