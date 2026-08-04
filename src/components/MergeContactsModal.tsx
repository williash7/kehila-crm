import React, { useState } from 'react';
import { useAppStore } from '../store/AppContext';
import { X, Link2, Trash2 } from 'lucide-react';

export function MergeContactsModal({ onClose, presetName, onMerged }: { onClose: () => void; presetName?: string; onMerged?: () => void }) {
  const { donors, nameMerges, mergeContacts, unmergeContact } = useAppStore();
  const [tab, setTab] = useState<'new' | 'existing'>('new');
  const [nameA, setNameA] = useState(presetName || '');
  const [nameB, setNameB] = useState('');
  const [keep, setKeep] = useState<'a' | 'b'>('a');

  const donorNames = Object.keys(donors).sort((x, y) => x.localeCompare(y, 'he'));
  const mergeEntries = Object.entries(nameMerges);

  const canMerge = nameA.trim() && nameB.trim() && nameA.trim() !== nameB.trim()
    && donors[nameA.trim()] && donors[nameB.trim()];

  const doMerge = () => {
    const a = nameA.trim();
    const b = nameB.trim();
    if (!canMerge) return;
    const canonicalName = keep === 'a' ? a : b;
    const aliasName = keep === 'a' ? b : a;
    mergeContacts(aliasName, canonicalName);
    setNameA('');
    setNameB('');
    setKeep('a');
    if (onMerged && (aliasName === presetName)) onMerged();
    else onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl p-5 pb-8 md:pb-5 w-full max-w-[430px] md:max-w-lg max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A] flex items-center gap-2">
            <Link2 className="text-[#C9A84C]" size={20} /> חיבור אנשי קשר כפולים
          </h2>
          <button onClick={onClose} className="p-2 bg-white rounded-full shadow-sm"><X size={16} /></button>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl mb-5">
          <button
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${tab === 'new' ? 'bg-white shadow text-[#0D1B2A]' : 'text-gray-500'}`}
            onClick={() => setTab('new')}
          >
            מיזוג חדש
          </button>
          <button
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${tab === 'existing' ? 'bg-white shadow text-[#0D1B2A]' : 'text-gray-500'}`}
            onClick={() => setTab('existing')}
          >
            מיזוגים קיימים ({mergeEntries.length})
          </button>
        </div>

        {tab === 'new' ? (
          <div className="space-y-4">
            <p className="text-xs text-gray-500 leading-relaxed bg-white rounded-xl p-3 border border-[#EDE6D6]">
              בוחרים שני שמות שהם בעצם אותו אדם (למשל "אברהם אריאל" ו"אברהם אריאל ציגנוב"). כל התרומות, המפגשים והפרטים יתאחדו תחת השם שתבחרו לשמור. אפשר לבטל בכל עת בלשונית "מיזוגים קיימים".
            </p>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">שם ראשון</label>
              <input
                type="text"
                list="merge-donor-names"
                value={nameA}
                onChange={e => setNameA(e.target.value)}
                placeholder="הקלד שם איש קשר..."
                className="w-full border-2 border-[#EDE6D6] rounded-xl px-4 py-3 focus:border-[#C9A84C] outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">שם שני</label>
              <input
                type="text"
                list="merge-donor-names"
                value={nameB}
                onChange={e => setNameB(e.target.value)}
                placeholder="הקלד שם איש קשר..."
                className="w-full border-2 border-[#EDE6D6] rounded-xl px-4 py-3 focus:border-[#C9A84C] outline-none transition-colors"
              />
            </div>
            <datalist id="merge-donor-names">
              {donorNames.map(n => <option key={n} value={n} />)}
            </datalist>

            {nameA.trim() && nameB.trim() && (!donors[nameA.trim()] || !donors[nameB.trim()]) && (
              <p className="text-xs text-red-500">שני השמות צריכים להיות אנשי קשר קיימים ברשימה.</p>
            )}

            {canMerge && (
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">איזה שם לשמור?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setKeep('a')}
                    className={`p-3 rounded-xl border-2 text-center text-sm font-semibold transition-colors ${keep === 'a' ? 'bg-[#D1FAE5] border-[#10B981] text-[#0D1B2A]' : 'bg-white border-[#EDE6D6] text-gray-500'}`}
                  >
                    {nameA.trim()}
                  </button>
                  <button
                    onClick={() => setKeep('b')}
                    className={`p-3 rounded-xl border-2 text-center text-sm font-semibold transition-colors ${keep === 'b' ? 'bg-[#D1FAE5] border-[#10B981] text-[#0D1B2A]' : 'bg-white border-[#EDE6D6] text-gray-500'}`}
                  >
                    {nameB.trim()}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={doMerge}
              disabled={!canMerge}
              className="w-full bg-[#0D1B2A] text-[#E8C97A] py-3.5 rounded-xl font-bold text-sm shadow-lg active:scale-[0.98] transition-transform disabled:opacity-40"
            >
              מזג לאיש קשר אחד
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {mergeEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">אין עדיין מיזוגים.</div>
            ) : (
              mergeEntries.map(([alias, canonical]) => (
                <div key={alias} className="bg-white rounded-xl p-3 border border-[#EDE6D6] flex items-center justify-between gap-2">
                  <div className="min-w-0 text-sm">
                    <span className="text-gray-500">{alias}</span>
                    <span className="mx-1.5 text-gray-300">←</span>
                    <span className="font-bold text-[#0D1B2A]">{canonical}</span>
                  </div>
                  <button
                    onClick={() => unmergeContact(alias)}
                    className="shrink-0 flex items-center gap-1 bg-red-50 text-red-600 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={12} /> בטל מיזוג
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
