import React, { useMemo, useState } from 'react';
import { useAppStore } from '../store/AppContext';
import { X, Link2, Trash2, Sparkles, ArrowLeftRight, RotateCcw } from 'lucide-react';
import { NameMergeSuggestion, suggestNameMerges } from '../lib/nameMerges';

export function MergeContactsModal({ onClose, presetName, onMerged }: { onClose: () => void; presetName?: string; onMerged?: () => void }) {
  const { donors, crm, nameMerges, mergeContacts, unmergeContact } = useAppStore();
  const [tab, setTab] = useState<'suggestions' | 'new' | 'existing'>(presetName ? 'new' : 'suggestions');
  const [nameA, setNameA] = useState(presetName || '');
  const [nameB, setNameB] = useState('');
  const [keep, setKeep] = useState<'a' | 'b'>('a');
  const [busy, setBusy] = useState(false);
  const [busySuggestion, setBusySuggestion] = useState('');
  const [error, setError] = useState('');
  const [lastMerge, setLastMerge] = useState<{ alias: string; canonical: string; closeAfter: boolean; closeProfile: boolean } | null>(null);
  const undoTimer = React.useRef<number | null>(null);

  const clearUndoTimer = () => {
    if (undoTimer.current != null) window.clearTimeout(undoTimer.current);
    undoTimer.current = null;
  };

  React.useEffect(() => () => clearUndoTimer(), []);

  const closeModal = () => {
    clearUndoTimer();
    if (lastMerge?.closeAfter && lastMerge.closeProfile && onMerged) onMerged();
    else onClose();
  };

  const offerUndo = (alias: string, canonical: string, closeAfter: boolean, closeProfile = false) => {
    clearUndoTimer();
    setLastMerge({ alias, canonical, closeAfter, closeProfile });
    undoTimer.current = window.setTimeout(() => {
      setLastMerge(null);
      undoTimer.current = null;
      if (closeAfter) {
        if (closeProfile && onMerged) onMerged();
        else onClose();
      }
    }, 5000);
  };

  const undoLastMerge = async () => {
    if (!lastMerge || busy) return;
    clearUndoTimer();
    setBusy(true);
    setError('');
    const ok = await unmergeContact(lastMerge.alias);
    setBusy(false);
    if (ok) setLastMerge(null);
    else setError('לא הצלחתי לבטל את המיזוג. אפשר לנסות שוב בלשונית „מיזוגים קיימים”.');
  };

  const donorNames = Object.keys(donors).sort((x, y) => x.localeCompare(y, 'he'));
  const mergeEntries = Object.entries(nameMerges);
  const suggestions = useMemo(
    () => suggestNameMerges(Object.keys(donors), nameMerges),
    [donors, nameMerges]
  );

  const detailScore = (name: string) => {
    const donor: any = donors[name] || {};
    const crmData: any = crm[name] || {};
    const donorFields = Object.entries(donor)
      .filter(([key, value]) => !['name', 'donations', 'total'].includes(key) && value !== '' && value != null).length;
    const crmFields = Object.values(crmData)
      .filter(value => value !== '' && value != null && value !== false).length;
    return (donor.donations?.length || 0) * 4 + donorFields + crmFields * 2;
  };

  const recommendedName = (suggestion: NameMergeSuggestion) => {
    if (suggestion.reason === 'extendedName') return suggestion.recommendedCanonical;
    const scoreA = detailScore(suggestion.nameA);
    const scoreB = detailScore(suggestion.nameB);
    if (scoreA !== scoreB) return scoreA > scoreB ? suggestion.nameA : suggestion.nameB;
    return suggestion.recommendedCanonical;
  };

  const canMerge = nameA.trim() && nameB.trim() && nameA.trim() !== nameB.trim()
    && donors[nameA.trim()] && donors[nameB.trim()];

  // סוגרים את החלון **רק אחרי** שהגיליון אישר את הכתיבה. קודם הוא נסגר מיד,
  // והמיזוג "התבטל" בשקט כשהשמירה לא הספיקה להגיע לפני הרענון הבא.
  const doMerge = async () => {
    const a = nameA.trim();
    const b = nameB.trim();
    if (!canMerge || busy) return;
    const canonicalName = keep === 'a' ? a : b;
    const aliasName = keep === 'a' ? b : a;

    setBusy(true);
    setError('');
    const ok = await mergeContacts(aliasName, canonicalName);
    setBusy(false);

    if (!ok) {
      setError('המיזוג לא נשמר בגיליון. בדוק את החיבור ונסה שוב — שום דבר לא השתנה.');
      return;
    }

    setNameA('');
    setNameB('');
    setKeep('a');
    offerUndo(aliasName, canonicalName, true, aliasName === presetName);
  };

  const doSuggestedMerge = async (suggestion: NameMergeSuggestion, canonicalName: string) => {
    if (busy) return;
    const aliasName = canonicalName === suggestion.nameA ? suggestion.nameB : suggestion.nameA;
    const key = `${aliasName}\u0000${canonicalName}`;
    setBusy(true);
    setBusySuggestion(key);
    setError('');
    const ok = await mergeContacts(aliasName, canonicalName);
    setBusy(false);
    setBusySuggestion('');
    if (!ok) setError('המיזוג לא נשמר בגיליון. בדוק את החיבור ונסה שוב.');
    else offerUndo(aliasName, canonicalName, false);
  };

  const reasonLabel: Record<NameMergeSuggestion['reason'], string> = {
    wordOrder: 'אותן מילים בסדר שונה',
    oneLetter: 'הבדל של אות אחת',
    extendedName: 'שם קצר מול שם מורחב',
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl p-5 pb-8 md:pb-5 w-full max-w-[430px] md:max-w-lg max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A] flex items-center gap-2">
            <Link2 className="text-[#C9A84C]" size={20} /> חיבור אנשי קשר כפולים
          </h2>
          <button onClick={closeModal} className="p-2 bg-white rounded-full shadow-sm"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-3 bg-gray-100 p-1 rounded-xl mb-5">
          <button
            className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors ${tab === 'suggestions' ? 'bg-white shadow text-[#0D1B2A]' : 'text-gray-500'}`}
            onClick={() => setTab('suggestions')}
          >
            הצעות ({suggestions.length})
          </button>
          <button
            className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors ${tab === 'new' ? 'bg-white shadow text-[#0D1B2A]' : 'text-gray-500'}`}
            onClick={() => setTab('new')}
          >
            מיזוג ידני
          </button>
          <button
            className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors ${tab === 'existing' ? 'bg-white shadow text-[#0D1B2A]' : 'text-gray-500'}`}
            onClick={() => setTab('existing')}
          >
            קיימים ({mergeEntries.length})
          </button>
        </div>

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mb-3 leading-relaxed">{error}</div>
        )}

        {tab === 'suggestions' ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 leading-relaxed bg-white rounded-xl p-3 border border-[#EDE6D6]">
              אלו הצעות בלבד. דבר אינו מתחבר מעצמו. בכל כרטיס אפשר לבחור בלחיצה אחת איזה שם יישאר.
            </p>
            {suggestions.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <Sparkles className="mx-auto mb-2 text-[#C9A84C]" size={24} />
                לא נמצאו כרגע שמות דומים שלא מוזגו.
              </div>
            ) : suggestions.map(suggestion => {
              const recommended = recommendedName(suggestion);
              const alternative = recommended === suggestion.nameA ? suggestion.nameB : suggestion.nameA;
              const primaryKey = `${alternative}\u0000${recommended}`;
              const alternativeKey = `${recommended}\u0000${alternative}`;
              return (
                <div key={`${suggestion.nameA}\u0000${suggestion.nameB}`} className="bg-white rounded-2xl p-3.5 border border-[#EDE6D6] shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold text-[#8A6F26] bg-[#FBF3D5] px-2 py-1 rounded-full">
                      {reasonLabel[suggestion.reason]}
                    </span>
                    <Sparkles size={14} className="text-[#C9A84C] shrink-0" />
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-[#0D1B2A] mb-3">
                    <span className="font-semibold text-center">{suggestion.nameA}</span>
                    <ArrowLeftRight size={14} className="text-gray-300 shrink-0" />
                    <span className="font-semibold text-center">{suggestion.nameB}</span>
                  </div>
                  <button
                    onClick={() => doSuggestedMerge(suggestion, recommended)}
                    disabled={busy}
                    className="w-full bg-[#0D1B2A] text-[#E8C97A] py-2.5 px-3 rounded-xl font-bold text-xs disabled:opacity-50"
                  >
                    {busySuggestion === primaryKey ? 'שומר בגיליון...' : `מזג והשאר „${recommended}”`}
                  </button>
                  <button
                    onClick={() => doSuggestedMerge(suggestion, alternative)}
                    disabled={busy}
                    className="w-full mt-1.5 py-1.5 text-[11px] font-semibold text-gray-500 hover:text-[#0D1B2A] disabled:opacity-40"
                  >
                    {busySuggestion === alternativeKey ? 'שומר בגיליון...' : `או השאר דווקא „${alternative}”`}
                  </button>
                </div>
              );
            })}
          </div>
        ) : tab === 'new' ? (
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
              disabled={!canMerge || busy}
              className="w-full bg-[#0D1B2A] text-[#E8C97A] py-3.5 rounded-xl font-bold text-sm shadow-lg active:scale-[0.98] transition-transform disabled:opacity-40"
            >
              {busy ? 'שומר בגיליון...' : 'מזג לאיש קשר אחד'}
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
      {lastMerge && <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[320] bg-[#0D1B2A] text-white rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-4 text-sm whitespace-nowrap">
        <span>„{lastMerge.alias}” מוזג ל„{lastMerge.canonical}”</span>
        <button onClick={() => void undoLastMerge()} disabled={busy} className="text-[#E8C97A] font-bold flex items-center gap-1 disabled:opacity-50"><RotateCcw size={14} /> ביטול</button>
      </div>}
    </div>
  );
}
