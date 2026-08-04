import React, { useState } from 'react';
import { X, ArrowDownUp, CalendarDays } from 'lucide-react';
import { HebrewDatePicker, emptyHebrewDateValue, type HebrewDateValue } from './HebrewDatePicker';

export function DateConverterModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'g2h' | 'h2g'>('g2h');
  const [gDate, setGDate] = useState('');
  const [hDateParams, setHDateParams] = useState<HebrewDateValue>(emptyHebrewDateValue());

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const convert = async () => {
    setLoading(true);
    setResult(null);
    try {
      let url = '';
      if (mode === 'g2h') {
        if (!gDate) return;
        url = `https://www.hebcal.com/converter?cfg=json&date=${gDate}&g2h=1&strict=1`;
      } else {
        if (!hDateParams.y || !hDateParams.m || !hDateParams.d) return;
        url = `https://www.hebcal.com/converter?cfg=json&hy=${hDateParams.y}&hm=${hDateParams.m}&hd=${hDateParams.d}&h2g=1&strict=1`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      alert('שגיאה בהמרת התאריך.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-[400px] shadow-2xl animate-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-['Frank_Ruhl_Libre'] text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="text-[#C9A84C]" />
            ממיר תאריכים
          </h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
            <X size={16} />
          </button>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl mb-5">
          <button 
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${mode === 'g2h' ? 'bg-white shadow text-[#0D1B2A]' : 'text-gray-500'}`}
            onClick={() => setMode('g2h')}
          >
            לועזי לעברי
          </button>
          <button 
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${mode === 'h2g' ? 'bg-white shadow text-[#0D1B2A]' : 'text-gray-500'}`}
            onClick={() => setMode('h2g')}
          >
            עברי ללועזי
          </button>
        </div>

        <div className="space-y-4 mb-6">
          {mode === 'g2h' ? (
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">תאריך לועזי</label>
              <input 
                type="date" 
                value={gDate} 
                onChange={e => setGDate(e.target.value)}
                className="w-full border-2 border-[#EDE6D6] rounded-xl p-3 focus:border-[#C9A84C] outline-none"
              />
            </div>
          ) : (
            <HebrewDatePicker value={hDateParams} onChange={setHDateParams} />
          )}
        </div>

        <button 
          onClick={convert}
          disabled={loading || (mode === 'g2h' ? !gDate : (!hDateParams.y || !hDateParams.d))}
          className="w-full bg-[#0D1B2A] text-[#E8C97A] py-3 rounded-xl font-bold mb-4 disabled:opacity-50"
        >
          {loading ? 'ממיר...' : 'המר תאריך'}
        </button>

        {result && (
          <div className="bg-[#FAF6EE] border border-[#E8C97A] rounded-xl p-4 text-center">
            {mode === 'g2h' ? (
              <>
                <div className="text-sm text-gray-500 mb-1">התאריך העברי:</div>
                <div className="font-['Frank_Ruhl_Libre'] text-2xl font-bold text-[#0D1B2A]">{result.hebrew}</div>
              </>
            ) : (
              <>
                <div className="text-sm text-gray-500 mb-1">התאריך הלועזי:</div>
                <div className="font-['Frank_Ruhl_Libre'] text-2xl font-bold text-[#0D1B2A]">
                  {new Date(result.gy, result.gm - 1, result.gd).toLocaleDateString('he-IL')}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
