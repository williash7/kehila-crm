import React, { useMemo, useState } from 'react';
import { X, Wand2, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { apiPost } from '../lib/api';
import {
  FamilyMember, collectLegacyYahrzeits, legacyToFamilyMember, familyLabel,
} from '../lib/family';

// ─────────────────────────────────────────────────────────────────────────────
// המרה חד-פעמית: יארצייטים מעמודות → רשומות בכרטיס.
//
// המבנה הישן שמר את שם הנפטר בשם העמודה, ולכן כל יארצייט שנוסף הוסיף
// עמודה לכל אנשי הקשר. כאן מעבירים את הערכים לרשומות במקום הנכון,
// ורק אחר כך מוחקים את העמודות.
//
// **מציגים מה עומד לקרות לפני שנוגעים בכלום.** מחיקת עמודות מגיליון היא
// בלתי הפיכה, וזו בדיוק הפעולה שאסור לעשות על סמך הבטחה.
// ─────────────────────────────────────────────────────────────────────────────

interface Plan {
  contact: string;
  members: FamilyMember[];
  columns: string[];
}

export function MigrateYahrzeitsModal({ onClose }: { onClose: () => void }) {
  const { donors, crm, updateCrm, refresh } = useAppStore();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ contacts: number; records: number; columns: number } | null>(null);
  const [error, setError] = useState('');

  const plan = useMemo<Plan[]>(() => {
    const out: Plan[] = [];
    Object.keys(donors).forEach(name => {
      const fields = { ...(donors[name] as any), ...(crm[name]?.customFields || {}) };
      const legacy = collectLegacyYahrzeits(fields);
      if (!legacy.length) return;
      out.push({
        contact: name,
        members: legacy.map(legacyToFamilyMember),
        columns: legacy.flatMap(l => l.columns),
      });
    });
    return out;
  }, [donors, crm]);

  const allColumns = useMemo(
    () => Array.from(new Set(plan.flatMap(p => p.columns))),
    [plan]
  );
  const totalRecords = plan.reduce((s, p) => s + p.members.length, 0);

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      // קודם הרשומות. אם המחיקה תיכשל אחר כך, המידע כבר נמצא במקום
      // הנכון — והעמודות שנשארו הן לכל היותר כפילות שאפשר להסיר ידנית.
      plan.forEach(p => {
        const existing: FamilyMember[] = crm[p.contact]?.family || [];
        updateCrm(p.contact, { family: [...existing, ...p.members] });
      });

      const res = await apiPost('deleteContactColumns', { columns: allColumns });
      if (res?.error || res?.success === false) {
        setError(`הרשומות הועברו, אבל מחיקת העמודות נכשלה: ${res.error || ''} — אפשר למחוק אותן ידנית בגיליון.`);
      }

      setDone({ contacts: plan.length, records: totalRecords, columns: res?.deleted ?? 0 });
      refresh();
    } catch (e: any) {
      setError(String(e?.message || e));
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl p-5 pb-8 w-full max-w-[520px] max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-3 shrink-0">
          <h2 className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A] flex items-center gap-2">
            <Wand2 size={20} className="text-[#9B7A2F]" /> העברת יארצייטים
          </h2>
          <button onClick={onClose} className="bg-gray-200/50 p-2 rounded-full text-gray-500"><X size={16} /></button>
        </div>

        {done ? (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">
              <div className="font-bold mb-1">הועבר ✓</div>
              <div>{done.records} יארצייטים אצל {done.contacts} אנשי קשר</div>
              <div>{done.columns} עמודות נמחקו מהגיליון</div>
            </div>
            {error && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">{error}</div>}
            <button onClick={onClose} className="w-full bg-[#0D1B2A] text-[#E8C97A] py-2.5 rounded-xl font-bold text-sm">סגור</button>
          </div>
        ) : plan.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 leading-relaxed">
              לא נמצאו יארצייטים במבנה הישן — אין מה להעביר.
            </p>
            <button onClick={onClose} className="w-full bg-[#0D1B2A] text-[#E8C97A] py-2.5 rounded-xl font-bold text-sm">סגור</button>
          </div>
        ) : (
          <>
            <div className="text-[11px] text-gray-500 leading-relaxed mb-3 shrink-0">
              שם הנפטר נשמר עד היום כשם של <b>עמודה</b> בגיליון — ולכן הוא הופיע אצל
              כל אנשי הקשר. כאן הוא עובר לרשומה בכרטיס של האדם הנכון, והעמודות נמחקות.
            </div>

            <div className="bg-white rounded-xl border border-[#EDE6D6] p-3 mb-3 shrink-0 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">אנשי קשר</span><b>{plan.length}</b></div>
              <div className="flex justify-between"><span className="text-gray-500">יארצייטים שיועברו</span><b>{totalRecords}</b></div>
              <div className="flex justify-between"><span className="text-gray-500">עמודות שיימחקו</span><b className="text-red-600">{allColumns.length}</b></div>
            </div>

            <div className="text-xs font-bold text-gray-500 mb-1.5 shrink-0">מה עומד לקרות:</div>
            <div className="flex-1 overflow-y-auto space-y-1.5 mb-3">
              {plan.map(p => (
                <div key={p.contact} className="bg-white rounded-lg border border-[#EDE6D6] px-3 py-2">
                  <div className="text-sm font-bold text-[#0D1B2A]">{p.contact}</div>
                  {p.members.map(m => (
                    <div key={m.id} className="text-[11px] text-gray-600 mt-0.5">
                      🕯️ {familyLabel(m)}
                      {m.yahrzeitHebrew ? ` · ${m.yahrzeitHebrew}` : ''}
                      {m.yahrzeit ? ` · ${m.yahrzeit}` : ''}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 mb-3 text-[11px] text-amber-800 flex gap-2 shrink-0">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>מחיקת עמודות מהגיליון אינה הפיכה. אם לא גיבית — קובץ ← צור עותק, ורק אז המשך.</span>
            </div>

            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 mb-2 text-xs text-red-700">{error}</div>}

            <div className="flex gap-2 shrink-0">
              <button onClick={onClose} disabled={busy} className="px-4 bg-gray-100 rounded-xl text-gray-600 font-bold text-sm disabled:opacity-40">ביטול</button>
              <button onClick={run} disabled={busy}
                className="flex-1 bg-[#0D1B2A] text-[#E8C97A] py-3 rounded-xl font-bold text-sm disabled:opacity-40">
                {busy ? 'מעביר...' : `העבר ${totalRecords} יארצייטים ומחק ${allColumns.length} עמודות`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
