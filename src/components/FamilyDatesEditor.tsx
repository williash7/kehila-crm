import React, { useState } from 'react';
import { EmptyState } from './EmptyState';
import { PlusCircle, X, Pencil, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { HDate } from '@hebcal/core';
import {
  FamilyMember, newFamilyId, familyDisplayName, familyLabel,
} from '../lib/family';
import {
  toCanonicalHebrewString, gregorianToHebrewCompanion,
  parseCanonicalHebrewString, hebrewToGregorianCompanion,
} from '../lib/hebrewDates';

// ─────────────────────────────────────────────────────────────────────────────
// בני משפחה, ימי הולדת ויארצייטים.
//
// כל בן משפחה הוא **רשומה בכרטיס**, לא עמודה בגיליון. זה ההבדל שמאפשר
// לתת שם מלא ("פנחס בן לייב") בלי שהשם הזה יופיע אצל כל שאר אנשי הקשר,
// ולרשום כמה נפטרים לאותו אדם בלי להוסיף עמודה לכל אחד.
//
// שני הלוחות נשמרים יחד, וכפתור אחד ממיר ביניהם. התאריך העברי הוא זה
// שקובע את מועד הציון בפועל; הלועזי הוא העוגן שממנו הוא חושב, ושימושי
// כשמישהו זוכר רק אותו.
// ─────────────────────────────────────────────────────────────────────────────

const RELATIONS = ['אבא', 'אמא', 'בעל', 'אישה', 'בן', 'בת', 'אח', 'אחות', 'סבא', 'סבתא'];

function toISO(d?: string): string {
  if (!d) return '';
  const m = String(d).match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
}
function fromISO(d: string): string {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

export function FamilyDatesEditor({ name }: { name: string }) {
  const { crm, donors, updateCrm } = useAppStore();
  const list: FamilyMember[] = crm[name]?.family || [];

  const [editing, setEditing] = useState<FamilyMember | null>(null);
  const [isNew, setIsNew] = useState(false);

  const save = (member: FamilyMember) => {
    const next = list.some(f => f.id === member.id)
      ? list.map(f => (f.id === member.id ? member : f))
      : [...list, member];
    updateCrm(name, { family: next });
    setEditing(null);
  };

  const remove = (id: string) => {
    if (!window.confirm('למחוק את בן המשפחה הזה, כולל התאריכים שלו?')) return;
    updateCrm(name, { family: list.filter(f => f.id !== id) });
  };

  const startNew = () => {
    setIsNew(true);
    setEditing({ id: newFamilyId(), relation: '' });
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">👪 משפחה ותאריכים</h3>
        <button
          onClick={startNew}
          className="bg-[#C9A84C]/10 text-[#9B7A2F] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-[#C9A84C]/20"
        >
          <PlusCircle size={14} /> הוסף
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon="👪"
          title="עוד לא נרשמו בני משפחה"
          hint="כאן נרשמים ימי הולדת ויארצייטים — עם שם מלא, ובשני הלוחות."
        />
      ) : (
        <div className="space-y-2">
          {list.map(f => (
            <div key={f.id} className="bg-[#FAF6EE] rounded-xl p-2.5 border border-[#EDE6D6]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#0D1B2A] truncate flex items-center gap-1.5">
                    {familyDisplayName(f) || f.relation || '—'}
                    {f.linkedName && (
                      <span className="text-[9px] font-normal bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full shrink-0">מקושר</span>
                    )}
                  </div>
                  {f.relation && familyDisplayName(f) && (
                    <div className="text-[10px] text-gray-400 font-bold">{f.relation}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setIsNew(false); setEditing(f); }} className="text-gray-400 hover:text-[#9B7A2F] p-1"><Pencil size={13} /></button>
                  <button onClick={() => remove(f.id)} className="text-red-300 hover:text-red-500 p-1"><X size={14} /></button>
                </div>
              </div>

              {(f.birthday || f.birthdayHebrew) && (
                <div className="text-[11px] text-gray-600 mt-1">
                  🎂 {f.birthdayHebrew || '—'}{f.birthday ? <span className="text-gray-400"> · {f.birthday}</span> : null}
                </div>
              )}
              {(f.yahrzeit || f.yahrzeitHebrew) && (
                <div className="text-[11px] text-gray-600 mt-0.5">
                  🕯️ {f.yahrzeitHebrew || '—'}{f.yahrzeit ? <span className="text-gray-400"> · {f.yahrzeit}</span> : null}
                </div>
              )}
              {f.notes && <div className="text-[11px] text-gray-400 mt-0.5">{f.notes}</div>}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <MemberForm
          member={editing}
          isNew={isNew}
          donorNames={Object.keys(donors)}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function MemberForm({ member, isNew, donorNames, onSave, onCancel }: {
  member: FamilyMember;
  isNew: boolean;
  donorNames: string[];
  onSave: (m: FamilyMember) => void;
  onCancel: () => void;
}) {
  const [m, setM] = useState<FamilyMember>(member);
  const set = (patch: Partial<FamilyMember>) => setM(prev => ({ ...prev, ...patch }));

  // ── המרה בין הלוחות ────────────────────────────────────────────────────
  // לחיצה אחת לכל כיוון. אין המרה אוטומטית תוך כדי הקלדה: תאריך חלקי היה
  // מייצר המרה שגויה ומוחק את מה שכבר הוקלד בצד השני.
  const toHebrew = (field: 'birthday' | 'yahrzeit') => {
    const greg = m[field];
    if (!greg) return;
    const h = gregorianToHebrewCompanion(greg);
    if (h) set({ [`${field}Hebrew`]: toCanonicalHebrewString(h) } as any);
  };

  const toGregorian = (field: 'birthday' | 'yahrzeit') => {
    const heb = m[`${field}Hebrew` as 'birthdayHebrew' | 'yahrzeitHebrew'];
    if (!heb) return;
    const h: HDate | null = parseCanonicalHebrewString(heb);
    if (h) set({ [field]: hebrewToGregorianCompanion(h) } as any);
  };

  const field = 'w-full border-[1.5px] border-[#EDE6D6] rounded-xl py-2 px-3 text-sm focus:border-[#C9A84C] outline-none';
  const label = 'block text-[11px] font-bold text-gray-500 mb-1';

  const DateRow = ({ kind, icon, title }: { kind: 'birthday' | 'yahrzeit'; icon: string; title: string }) => (
    <div className="border border-[#EDE6D6] rounded-xl p-2.5">
      <div className="text-xs font-bold text-[#0D1B2A] mb-2">{icon} {title}</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label}>לועזי</label>
          <input type="date" value={toISO(m[kind])} onChange={e => set({ [kind]: fromISO(e.target.value) } as any)} className={field} />
        </div>
        <div>
          <label className={label}>עברי</label>
          <input
            type="text" dir="rtl" placeholder="כ״ה אייר תשנ״ו"
            value={m[`${kind}Hebrew` as 'birthdayHebrew' | 'yahrzeitHebrew'] || ''}
            onChange={e => set({ [`${kind}Hebrew`]: e.target.value } as any)}
            className={field}
          />
        </div>
      </div>
      <div className="flex gap-1.5 mt-2">
        <button type="button" onClick={() => toHebrew(kind)} disabled={!m[kind]}
          className="flex-1 text-[11px] font-bold py-1.5 rounded-lg border border-[#EDE6D6] text-gray-600 hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center gap-1">
          <RefreshCw size={11} /> חשב עברי מהלועזי
        </button>
        <button type="button" onClick={() => toGregorian(kind)}
          disabled={!m[`${kind}Hebrew` as 'birthdayHebrew' | 'yahrzeitHebrew']}
          className="flex-1 text-[11px] font-bold py-1.5 rounded-lg border border-[#EDE6D6] text-gray-600 hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center gap-1">
          <RefreshCw size={11} /> חשב לועזי מהעברי
        </button>
      </div>
    </div>
  );

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-gray-200 space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label}>שם</label>
          <input
            list="family-contact-names"
            value={m.linkedName || m.freeName || ''}
            onChange={e => {
              const v = e.target.value;
              // שם שקיים כאיש קשר — נשמר כקישור, כך שכל מה שיתעדכן בכרטיס
              // שלו יופיע גם כאן ולא ייווצר כפל רשומות
              if (donorNames.indexOf(v) >= 0) set({ linkedName: v, freeName: undefined });
              else set({ freeName: v, linkedName: undefined });
            }}
            placeholder="פנחס"
            className={field}
          />
          <datalist id="family-contact-names">
            {donorNames.map(n => <option key={n} value={n} />)}
          </datalist>
        </div>
        <div>
          <label className={label}>שם האב <span className="font-normal text-gray-400">(לא חובה)</span></label>
          <input value={m.fatherName || ''} onChange={e => set({ fatherName: e.target.value })} placeholder="לייב" className={field} />
        </div>
      </div>

      <div>
        <label className={label}>קרבה</label>
        <input list="family-relations" value={m.relation} onChange={e => set({ relation: e.target.value })} placeholder="אבא" className={field} />
        <datalist id="family-relations">
          {RELATIONS.map(r => <option key={r} value={r} />)}
        </datalist>
      </div>

      {familyDisplayName(m) && (
        <p className="text-[11px] text-gray-400">יוצג כ: <b className="text-gray-600">{familyLabel(m)}</b></p>
      )}

      <DateRow kind="birthday" icon="🎂" title="יום הולדת" />
      <DateRow kind="yahrzeit" icon="🕯️" title="יארצייט" />

      <div>
        <label className={label}>הערה <span className="font-normal text-gray-400">(לא חובה)</span></label>
        <input value={m.notes || ''} onChange={e => set({ notes: e.target.value })} className={field} />
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm">ביטול</button>
        <button
          onClick={() => onSave(m)}
          disabled={!(m.linkedName || m.freeName || m.relation).trim()}
          className="flex-1 bg-[#0D1B2A] text-[#E8C97A] py-2.5 rounded-xl font-bold text-sm disabled:opacity-40"
        >
          {isNew ? 'הוסף' : 'שמור שינויים'}
        </button>
      </div>
    </div>
  );
}
