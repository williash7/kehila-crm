import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/AppContext';
import { computeLastContactByName } from '../lib/contactFocus';
import { getScoreSnapshot, backfillLastWeek, getWeekActivities, getActivityCounts, getActivityHeatmap, SCORE_ACTION_EVENT } from '../lib/score';
import { TrendingUp, Flame, ChevronDown } from 'lucide-react';

const HEATMAP_WEEKS = 12;
// דרגות עוצמה של גוון בודד (זהב המותג) — קידוד רציף לפי כמות, לא צבעים שונים
const HEAT_STEPS = ['bg-[#EDE6D6]', 'bg-[#C9A84C]/25', 'bg-[#C9A84C]/50', 'bg-[#C9A84C]/75', 'bg-[#C9A84C]'];
const HEAT_WEEKDAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

function heatStep(count: number, max: number): string {
  if (count === 0 || max === 0) return HEAT_STEPS[0];
  const ratio = count / max;
  if (ratio > 0.75) return HEAT_STEPS[4];
  if (ratio > 0.5) return HEAT_STEPS[3];
  if (ratio > 0.25) return HEAT_STEPS[2];
  return HEAT_STEPS[1];
}

export function ScoreTab({ onContactClick }: { onContactClick?: (name: string) => void } = {}) {
  const { visibleDonors, donations } = useAppStore();
  const [toast, setToast] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [detailWeek, setDetailWeek] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      setToast(`✓ ${e.detail.label}`);
      setTimeout(() => setToast(null), 2000);
      setTick(t => t + 1);
    };
    window.addEventListener(SCORE_ACTION_EVENT, handler);
    return () => window.removeEventListener(SCORE_ACTION_EVENT, handler);
  }, []);

  // גיבוי חד-פעמי: רושם רטרואקטיבית פעולות (תרומות/מפגשים) מהשבוע האחרון
  // (לא רץ פעם שנייה — הפונקציה עצמה שומרת סימון ב-localStorage). עדיין
  // מבוסס על אותו יומן פעילות פנימי, גם אם לא מוצג יותר כ"ניקוד".
  useEffect(() => {
    const result = backfillLastWeek(donations);
    if (result && result.count > 0) {
      setToast(`עודכן רטרואקטיבית: ${result.count} פעולות מהשבוע האחרון`);
      setTimeout(() => setToast(null), 4000);
      setTick(t => t + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = useMemo(() => new Date(), [tick]);
  const snapshot = useMemo(() => getScoreSnapshot(today), [today]);

  const { streak, thisWeek, lastWeek, bestWeek } = snapshot;

  const weekActivities = useMemo(() => detailWeek ? getWeekActivities(detailWeek) : [], [detailWeek, tick]);

  const activityCounts30 = useMemo(() => getActivityCounts(30), [tick]);
  const heatmap = useMemo(() => getActivityHeatmap(HEATMAP_WEEKS), [tick]);
  const maxHeat = useMemo(() => Math.max(1, ...heatmap.map(h => h.count)), [heatmap]);
  const maxActivityCount = useMemo(() => Math.max(1, ...activityCounts30.map(a => a.count)), [activityCounts30]);

  const weeklyChangePct = lastWeek && lastWeek.actions > 0
    ? Math.round(((thisWeek.actions - lastWeek.actions) / lastWeek.actions) * 100)
    : null;

  const temperature = useMemo(() => {
    const lastContactMap = computeLastContactByName(donations);
    let hot = 0, warm = 0, cold = 0;
    const coldList: { name: string; days: number | null }[] = [];
    Object.keys(visibleDonors).forEach(name => {
      const last = lastContactMap.get(name);
      const days = last ? Math.floor((today.getTime() - last.getTime()) / 86400000) : null;
      if (days === null || days > 30) { cold++; coldList.push({ name, days }); }
      else if (days > 7) warm++;
      else hot++;
    });
    coldList.sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity));
    return { hot, warm, cold, coldest: coldList.slice(0, 3) };
  }, [visibleDonors, donations, today]);

  return (
    <div className="animate-in fade-in pb-24 md:pb-6" dir="rtl">
      <div className="bg-[#0D1B2A] px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="w-9 h-9 bg-gradient-to-br from-[#C9A84C] to-[#9B7A2F] rounded-lg flex items-center justify-center shrink-0 md:hidden">
          <TrendingUp size={20} className="text-white" />
        </div>
        <div className="flex-1 px-3 md:px-0">
          <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#C9A84C]">פעילות</div>
          <div className="text-[11px] text-white/45 mt-[1px]">{thisWeek.actions} פעולות השבוע · {streak} ימים ברצף</div>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-2xl space-y-4">
        {/* קטע 1: הרצף שלך */}
        <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100 text-center">
          <div className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-1">הרצף שלך</div>
          <div className="font-['Frank_Ruhl_Libre'] font-black text-[#C9A84C]" style={{ fontSize: 72, lineHeight: 1 }}>
            {streak}
          </div>
          <div className="text-sm text-gray-500 mt-2">ימים רצופים</div>
          {streak > 30 && (
            <div className="text-xs font-bold text-orange-500 mt-2 flex items-center justify-center gap-1"><Flame size={13} /> מומנטום ×2</div>
          )}
          {streak > 7 && streak <= 30 && (
            <div className="text-xs font-bold text-orange-500 mt-2 flex items-center justify-center gap-1"><Flame size={13} /> מומנטום ×1.5</div>
          )}
        </div>

        {/* קטע 2: ימי פעילות (heatmap) */}
        <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
          <div className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">ימי פעילות — {HEATMAP_WEEKS} שבועות אחרונים</div>
          <div className="overflow-x-auto pb-1">
            <div className="inline-flex gap-[3px]">
              <div className="flex flex-col gap-[3px] ml-0.5">
                {HEAT_WEEKDAY_LABELS.map((w, i) => (
                  <div key={i} className="w-3.5 h-3.5 flex items-center justify-center text-[8px] text-gray-400">{i % 2 === 1 ? w : ''}</div>
                ))}
              </div>
              {Array.from({ length: HEATMAP_WEEKS }, (_, w) => (
                <div key={w} className="flex flex-col gap-[3px]">
                  {Array.from({ length: 7 }, (_, dRow) => {
                    const idx = w * 7 + dRow;
                    const day = heatmap[idx];
                    if (!day) return <div key={dRow} className="w-3.5 h-3.5 rounded-sm" />;
                    return (
                      <div
                        key={dRow}
                        title={`${day.date} · ${day.count} פעולות`}
                        className={`w-3.5 h-3.5 rounded-sm ${heatStep(day.count, maxHeat)}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-400">
            <span>פחות</span>
            {HEAT_STEPS.map((s, i) => <div key={i} className={`w-2.5 h-2.5 rounded-sm ${s}`} />)}
            <span>יותר</span>
          </div>
        </div>

        {/* קטע 2.5: פעילות לפי סוג (30 יום אחרונים) */}
        <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
          <div className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">פעילות לפי סוג — 30 יום אחרונים</div>
          {activityCounts30.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">אין עדיין פעילות מתועדת</div>
          ) : (
            <div className="space-y-2.5">
              {activityCounts30.map(a => (
                <div key={a.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#0D1B2A] flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${a.category === 'execution' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                      {a.label}
                    </span>
                    <span className="text-xs font-bold text-[#0D1B2A]">{a.count}</span>
                  </div>
                  <div className="w-full h-2 bg-[#FAF6EE] rounded-full overflow-hidden">
                    <div className="h-full bg-[#C9A84C] rounded-full" style={{ width: `${(a.count / maxActivityCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* קטע 3: סיכום שבועי */}
        <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
          <div className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">סיכום שבועי</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => setDetailWeek(v => v === thisWeek.week ? null : thisWeek.week)}
              disabled={thisWeek.actions === 0}
              className={`rounded-xl p-3 text-center transition-colors disabled:cursor-default ${detailWeek === thisWeek.week ? 'bg-[#C9A84C]/15 border border-[#C9A84C]/40' : 'bg-[#FAF6EE] border border-transparent'}`}
            >
              <div className="font-['Frank_Ruhl_Libre'] font-black text-[#0D1B2A] text-xl">{thisWeek.actions}</div>
              <div className="text-[11px] text-gray-500 mt-0.5 flex items-center justify-center gap-1">
                השבוע · פעולות
                {thisWeek.actions > 0 && <ChevronDown size={11} className={`transition-transform ${detailWeek === thisWeek.week ? 'rotate-180' : ''}`} />}
              </div>
            </button>
            <button
              onClick={() => lastWeek && setDetailWeek(v => v === lastWeek.week ? null : lastWeek.week)}
              disabled={!lastWeek || lastWeek.actions === 0}
              className={`rounded-xl p-3 text-center transition-colors disabled:cursor-default ${lastWeek && detailWeek === lastWeek.week ? 'bg-[#C9A84C]/15 border border-[#C9A84C]/40' : 'bg-[#FAF6EE] border border-transparent'}`}
            >
              <div className="font-['Frank_Ruhl_Libre'] font-black text-[#0D1B2A] text-xl">{lastWeek?.actions ?? '—'}</div>
              <div className="text-[11px] text-gray-500 mt-0.5 flex items-center justify-center gap-1">
                שבוע שעבר · פעולות
                {lastWeek && lastWeek.actions > 0 && <ChevronDown size={11} className={`transition-transform ${detailWeek === lastWeek.week ? 'rotate-180' : ''}`} />}
              </div>
            </button>
          </div>

          {detailWeek && weekActivities.length > 0 && (
            <div className="space-y-1.5 mb-3 border-t border-dashed border-gray-100 pt-3">
              {weekActivities.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-2 bg-[#FAF6EE] rounded-lg px-3 py-1.5">
                  <span className="text-xs text-[#0D1B2A]">{a.label}</span>
                  <span className="shrink-0 text-[10px] text-gray-400">{a.date.split('-').reverse().slice(0, 2).join('/')}</span>
                </div>
              ))}
            </div>
          )}

          <div className="text-sm font-bold text-center mb-2">
            {!lastWeek ? (
              <span className="text-gray-400">שבוע ראשון!</span>
            ) : weeklyChangePct !== null && weeklyChangePct >= 0 ? (
              <span className="text-green-500">↑ {weeklyChangePct}% מהשבוע שעבר</span>
            ) : (
              <span className="text-red-500">↓ {Math.abs(weeklyChangePct ?? 0)}% מהשבוע שעבר</span>
            )}
          </div>
          {bestWeek && (
            <div className="text-[11px] text-gray-400 text-center border-t border-dashed border-gray-100 pt-2">
              שיא: {bestWeek.actions} פעולות בשבוע {bestWeek.week}
            </div>
          )}
        </div>

        {/* קטע 4: חם/קר */}
        <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
          <div className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">חם / קר — אנשי קשר</div>
          <div className="flex items-center justify-center gap-4 text-sm font-bold mb-3">
            <span>🟢 {temperature.hot}</span>
            <span>🟡 {temperature.warm}</span>
            <span>🔴 {temperature.cold}</span>
          </div>
          {temperature.coldest.length > 0 && (
            <div className="space-y-2">
              {temperature.coldest.map(c => (
                <div key={c.name} className="flex items-center justify-between gap-2 bg-[#FAF6EE] rounded-xl p-2.5 border border-[#EDE6D6]">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#0D1B2A] truncate">{c.name}</div>
                    <div className="text-[11px] text-gray-500">{c.days === null ? 'לא תועד קשר עדיין' : `${c.days} ימים בלי יצירת קשר`}</div>
                  </div>
                  <button
                    onClick={() => onContactClick?.(c.name)}
                    className="shrink-0 bg-[#0D1B2A] text-[#E8C97A] text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
                  >
                    חזור
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[#0D1B2A] text-[#C9A84C] font-bold px-6 py-3 rounded-full shadow-xl z-50 text-lg animate-bounce">
          {toast}
        </div>
      )}
    </div>
  );
}
