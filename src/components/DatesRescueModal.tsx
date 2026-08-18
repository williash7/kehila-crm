import React, { useMemo, useRef, useState } from 'react';
import { X, Search, Upload, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { FamilyMember, familyLabel } from '../lib/family';
import { isImportantDateKey } from '../lib/donorDates';

// ─────────────────────────────────────────────────────────────────────────────
// "איפה התאריך שלי?"
//
// תאריכים אישיים יושבים היום בשני מקומות: עמודות בגיליון (המבנה הישן) ורשומות
// משפחה בכרטיס (החדש). כשמשהו לא מוצג, השאלה הראשונה היא באיזה מהם הוא נמצא —
// ועל זה אי אפשר לענות מהמסך הרגיל, כי הוא מציג רק את מה שהוא מזהה.
//
// המסך הזה מציג את **הגלם**: כל עמודה שנראית כמו תאריך, כמה אנשים יש בה ערך,
// וכמה רשומות משפחה קיימות. הוא לא מתקן כלום — הוא נותן לך לראות.
// ─────────────────────────────────────────────────────────────────────────────

interface ColumnInfo {
  key: string;
  count: number;
  examples: { name: string; value: string }[];
}

export function DatesRescueModal({ onClose }: { onClose: () => void }) {
  const { donors, crm, updateCrmMany, refresh } = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoreMsg, setRestoreMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const columns = useMemo<ColumnInfo[]>(() => {
    const map: Record<string, ColumnInfo> = {};
    Object.keys(donors).forEach(name => {
      const fields = { ...(donors[name] as any), ...(crm[name]?.customFields || {}) };
      Object.keys(fields).forEach(k => {
        if (!isImportantDateKey(k)) return;
        const value = String(fields[k] ?? '').trim();
        if (!value) return;
        const info = map[k] || (map[k] = { key: k, count: 0, examples: [] });
        info.count++;
        if (info.examples.length < 4) info.examples.push({ name, value });
      });
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [donors, crm]);

  const familyRows = useMemo(() => {
    const rows: { name: string; members: FamilyMember[] }[] = [];
    Object.keys(crm).forEach(name => {
      const fam: FamilyMember[] = crm[name]?.family || [];
      if (fam.length) rows.push({ name, members: fam });
    });
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }, [crm]);

  const familyCount = familyRows.reduce((s, r) => s + r.members.length, 0);

  const restoreFromBackup = async (file: File) => {
    setBusy(true);
    setRestoreMsg('');
    try {
      const parsed = JSON.parse(await file.text());
      const plan = parsed?.plan;
      if (!Array.isArray(plan)) throw new Error('הקובץ אינו גיבוי יארצייטים');

      const updates: Record<string, any> = {};
      let added = 0;
      plan.forEach((p: any) => {
        const contact = String(p?.contact || '');
        const members: FamilyMember[] = p?.members || [];
        if (!contact || !members.length) return;
        const existing: FamilyMember[] = crm[contact]?.family || [];
        // לא משכפלים רשומה שכבר חזרה — משווים לפי מי ומתי, כי המזהה
        // נוצר מחדש בכל ריצה ואינו יציב בין קובץ לגיליון.
        const fresh = members.filter(m => !existing.some(e =>
          familyLabel(e) === familyLabel(m) &&
          (e.yahrzeitHebrew || '') === (m.yahrzeitHebrew || '') &&
          (e.yahrzeit || '') === (m.yahrzeit || '')
        ));
        if (!fresh.length) return;
        updates[contact] = { family: [...existing, ...fresh] };
        added += fresh.length;
      });

      if (!added) { setRestoreMsg('כל הרשומות שבגיבוי כבר קיימות — אין מה לשחזר.'); setBusy(false); return; }

      const ok = await updateCrmMany(updates);
      setRestoreMsg(ok
        ? `✓ שוחזרו ${added} רשומות אצל ${Object.keys(updates).length} אנשי קשר.`
        : 'השחזור לא אושר על ידי הגיליון. נסה שוב.');
      if (ok) refresh();
    } catch (e: any) {
      setRestoreMsg(`לא הצלחתי לקרוא את הקובץ: ${e?.message || e}`);
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[210] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl p-5 pb-8 w-full max-w-[560px] max-h-[90vh] flex flex-col" dir="rtl">
        <div className="flex justify-between items-center mb-3 shrink-0">
          <h2 className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A] flex items-center gap-2">
            <Search size={20} className="text-[#9B7A2F]" /> איפה התאריכים שלי
          </h2>
          <button onClick={onClose} className="bg-gray-200/50 p-2 rounded-full text-gray-500"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* ── עמודות בגיליון ── */}
          <section>
            <h3 className="text-sm font-bold text-[#0D1B2A] mb-1">עמודות תאריך בגיליון</h3>
            <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">
              המבנה הישן. כל שורה כאן היא עמודה בלשונית אנשי הקשר שיש בה ערך אצל מישהו.
            </p>
            {columns.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#EDE6D6] p-3 text-xs text-gray-500">
                אין אף עמודת תאריך עם ערכים. אם היו לך כאלה והן נעלמו, אפשר להחזיר אותן
                דרך <b>קובץ ← היסטוריית גרסאות</b> בגיליון Google, ולבחור גרסה מלפני ההעברה.
              </div>
            ) : (
              <div className="space-y-1.5">
                {columns.map(c => (
                  <div key={c.key} className="bg-white rounded-xl border border-[#EDE6D6] px-3 py-2">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-sm font-bold text-[#0D1B2A] truncate">{c.key}</span>
                      <span className="text-[11px] text-gray-400 shrink-0">{c.count} אנשי קשר</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {c.examples.map(e => `${e.name}: ${e.value}`).join(' · ')}
                      {c.count > c.examples.length ? ' …' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── רשומות בכרטיסים ── */}
          <section>
            <h3 className="text-sm font-bold text-[#0D1B2A] mb-1">רשומות משפחה בכרטיסים</h3>
            <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">
              המבנה החדש. {familyCount} רשומות אצל {familyRows.length} אנשי קשר.
            </p>
            {familyRows.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#EDE6D6] p-3 text-xs text-gray-500">
                אין עדיין אף רשומת משפחה.
              </div>
            ) : (
              <div className="space-y-1.5">
                {familyRows.map(r => (
                  <div key={r.name} className="bg-white rounded-xl border border-[#EDE6D6] px-3 py-2">
                    <div className="text-sm font-bold text-[#0D1B2A]">{r.name}</div>
                    {r.members.map(m => (
                      <div key={m.id} className="text-[11px] text-gray-500 mt-0.5">
                        {m.yahrzeit || m.yahrzeitHebrew ? '🕯️' : '🎂'} {familyLabel(m)}
                        {m.yahrzeitHebrew || m.birthdayHebrew ? ` · ${m.yahrzeitHebrew || m.birthdayHebrew}` : ''}
                        {m.yahrzeit || m.birthday ? ` · ${m.yahrzeit || m.birthday}` : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── שחזור מגיבוי ── */}
          <section>
            <h3 className="text-sm font-bold text-[#0D1B2A] mb-1">שחזור מקובץ גיבוי</h3>
            <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">
              הקובץ שההעברה מורידה לפני שהיא רצה. רשומה שכבר קיימת לא תשוכפל.
            </p>
            <input
              ref={fileRef} type="file" accept=".json,application/json" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) restoreFromBackup(f); e.target.value = ''; }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-white border border-[#EDE6D6] hover:border-[#C9A84C] text-[#0D1B2A] text-sm font-bold py-2.5 rounded-xl disabled:opacity-40"
            >
              <Upload size={15} /> {busy ? 'משחזר...' : 'בחר קובץ גיבוי'}
            </button>
            {restoreMsg && (
              <div className={`mt-2 rounded-xl p-2.5 text-xs border ${
                restoreMsg.startsWith('✓')
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>{restoreMsg}</div>
            )}
          </section>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-800 flex gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              הגיליון שומר היסטוריית גרסאות מלאה. גם בלי גיבוי מהאפליקציה אפשר לחזור
              לכל מצב קודם: קובץ ← היסטוריית גרסאות ← הצג היסטוריית גרסאות.
            </span>
          </div>
        </div>

        <button onClick={onClose} className="w-full bg-[#0D1B2A] text-[#E8C97A] py-2.5 rounded-xl font-bold text-sm mt-3 shrink-0">סגור</button>
      </div>
    </div>
  );
}
