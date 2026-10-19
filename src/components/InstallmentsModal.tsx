import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronLeft, MessageSquare } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { useCloseOnBack } from './FullScreenView';
import { EmptyState } from './EmptyState';
import { ProfileModal } from './ProfileModal';
import { HkWhatsAppModal } from './HkWhatsAppModal';
import { installmentRows } from '../lib/hkBroadcast';

// תשלומי אשראי פעילים — חלון נפרד ממסך הוראות הקבע.
//
// מבחינת התורם זה כמו הוראת קבע (סכום שיורד לו כל חודש), אבל בכספים זו
// תרומה אחת שכבר רשומה בסכום המלא. לכן המסך הזה **לקריאה בלבד** ולא נכנס
// לספירות, לתחזית או לדוחות — אחרת הכסף היה נספר פעמיים.

export function InstallmentsModal({ onClose }: { onClose: () => void }) {
  const { donations } = useAppStore();
  useCloseOnBack(onClose);
  const [showDone, setShowDone] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<string | null>(null);
  const [waOpen, setWaOpen] = useState(false);

  const rows = useMemo(() => installmentRows(donations), [donations]);
  const active = rows.filter(r => !r.done);
  const done = rows.filter(r => r.done);
  const monthlyTotal = active.reduce((s, r) => s + r.monthly, 0);
  const endingSoon = active.filter(r => r.total - r.paid <= 1).length;
  const list = showDone ? rows : active;

  return (
    <div className="fixed inset-0 bg-[#FAF6EE] z-[100] flex flex-col h-full" dir="rtl">
      <div className="bg-[#0D1B2A] text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-md">
        <button onClick={onClose} className="flex items-center gap-1 h-9 px-2.5 -mr-2 rounded-full text-white/80 hover:bg-white/10 transition-colors">
          <ChevronRight size={20} />
          <span className="text-sm font-bold">חזרה</span>
        </button>
        <h2 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#C9A84C]">תשלומי אשראי</h2>
        <button onClick={() => setWaOpen(true)} className="p-2 -m-1 text-white/60 hover:text-white transition-colors" title="וואטסאפ">
          <MessageSquare size={19} />
        </button>
      </div>

      <div className="px-4 pt-4 pb-2 shrink-0">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-white rounded-xl p-2.5 text-center border border-[#EDE6D6] shadow-sm">
            <div className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-indigo-600">{active.length}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">פעילים</div>
          </div>
          <div className="bg-white rounded-xl p-2.5 text-center border border-[#EDE6D6] shadow-sm">
            <div className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#9B7A2F]">₪{monthlyTotal.toLocaleString()}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">לחודש</div>
          </div>
          <div className="bg-white rounded-xl p-2.5 text-center border border-amber-200 shadow-sm">
            <div className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-amber-600">{endingSoon}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">מסתיימים החודש</div>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 leading-relaxed">
          תרומות שנפרסו לתשלומי אשראי. מבחינת התורם זה כמו הוראת קבע, ולכן הם מקבלים גם את הודעות הוואטסאפ החודשיות.
          בדוחות ובכספים כל תרומה כזו נספרת פעם אחת, בסכום המלא — המסך הזה רק להצגה.
        </p>
        {done.length > 0 && (
          <button onClick={() => setShowDone(v => !v)} className="mt-1.5 text-[11px] text-[#9B7A2F] font-semibold underline">
            {showDone ? 'הסתר תשלומים שהסתיימו' : `הצג גם ${done.length} שהסתיימו`}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 md:pb-6">
        {list.length === 0 ? (
          <EmptyState icon="💳" title="אין תשלומי אשראי פעילים" hint="תרומה בתשלומים מופיעה כאן כשהיא נקלטת ממייל של נדרים פלוס." />
        ) : (
          <div className="space-y-2">
            {list.map((r, i) => {
              const left = r.total - r.paid;
              return (
                <div key={i} onClick={() => setSelectedDonor(r.name)} className={`bg-white rounded-xl p-3 border border-[#EDE6D6] shadow-sm cursor-pointer hover:border-[#C9A84C] transition-colors ${r.done ? 'opacity-60' : ''}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#0D1B2A] truncate flex items-center gap-1">{r.name} <ChevronLeft size={12} className="text-gray-300" /></div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        נתרם: {r.date} · ₪{r.amount.toLocaleString()} ב-{r.total} תשלומים
                      </div>
                      <div className="text-[11px] text-gray-500">תשלום אחרון: {r.endsMonth}</div>
                      {r.purpose && <div className="text-[10px] text-gray-400 mt-0.5">{r.purpose}</div>}
                    </div>
                    <div className="text-left shrink-0">
                      <div className="font-['Frank_Ruhl_Libre'] text-base font-bold text-[#9B7A2F]">₪{r.monthly.toLocaleString()}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">לחודש</div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="h-1.5 bg-[#FAF6EE] rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${Math.round((r.paid / r.total) * 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] mt-1">
                      <span className="text-gray-500">תשלום {r.paid} מתוך {r.total}</span>
                      <span className={r.done ? 'text-gray-400' : left <= 1 ? 'text-amber-600 font-bold' : 'text-gray-400'}>
                        {r.done ? 'הסתיים' : left === 0 ? 'תשלום אחרון החודש' : `נותרו ${left}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {waOpen && <HkWhatsAppModal onClose={() => setWaOpen(false)} />}
      {selectedDonor && <ProfileModal name={selectedDonor} onClose={() => setSelectedDonor(null)} backLabel="תשלומי אשראי" />}
    </div>
  );
}
