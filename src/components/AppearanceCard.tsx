import React, { useState } from 'react';
import { Check, ChevronUp, ChevronDown, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { THEMES, UI_SIZES, DENSITIES, DEFAULT_SETTINGS } from '../lib/settings';
import { DASH_CARDS, DashCardId, resolveCards, hiddenCards, moveCard, DEFAULT_ORDER } from '../lib/dashboardCards';

// ─────────────────────────────────────────────────────────────────────────────
// מראה ותצוגה.
//
// שלוש הגדרות שאין להן תשובה נכונה אחת: צבע, גודל וצפיפות. הן תלויות
// במסך, בתאורה, בעיניים ובהעדפה — ולכן הן שייכות למשתמש ולא למעצב.
//
// כולן נשמרות **מקומית בלבד**. זה מכוון: מסך גדול בבית ומסך קטן בכיס אינם
// צריכים אותה צפיפות, ואילו סנכרון היה כופה על שניהם את אותה בחירה.
// ─────────────────────────────────────────────────────────────────────────────

export function AppearanceCard() {
  const { settings, updateSettings } = useAppStore();
  const [tab, setTab] = useState<'look' | 'dashboard'>('look');

  const cards = resolveCards(settings.dashboardCards);
  const hidden = hiddenCards(settings.dashboardCards);
  const metaOf = (id: DashCardId) => DASH_CARDS.find(c => c.id === id)!;

  const setCards = (next: DashCardId[]) => updateSettings({ dashboardCards: next });

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">מראה ותצוגה</h3>
        <div className="flex gap-1 bg-[#FAF6EE] rounded-lg p-0.5">
          {([['look', 'עיצוב'], ['dashboard', 'דשבורד']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                tab === id ? 'bg-[#0D1B2A] text-[#C9A84C]' : 'text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'look' ? (
        <>
          {/* ── ערכת צבעים ── */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1.5">ערכת צבעים</label>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map(t => {
                const on = (settings.theme || 'classic') === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => updateSettings({ theme: t.id })}
                    className={`text-right p-2.5 rounded-xl border-2 transition-colors ${
                      on ? 'border-[#C9A84C] bg-[#C9A84C]/5' : 'border-[#EDE6D6] hover:border-[#C9A84C]/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {/* דוגמית הצבעים — מה שבאמת משתנה, ולא רק שם */}
                      <span className="flex rounded-md overflow-hidden shrink-0 border border-black/10">
                        {t.swatch.map(c => (
                          <span key={c} className="w-4 h-4 block" style={{ background: c }} />
                        ))}
                      </span>
                      {on && <Check size={13} className="text-[#9B7A2F]" />}
                    </div>
                    <div className="text-sm font-bold text-[#0D1B2A] truncate">{t.label}</div>
                    <div className="text-[10px] text-gray-400 truncate">{t.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── גודל ── */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1.5">גודל התצוגה</label>
            <div className="grid grid-cols-4 gap-1.5">
              {UI_SIZES.map(x => (
                <button
                  key={x.id}
                  onClick={() => updateSettings({ uiSize: x.id })}
                  className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                    (settings.uiSize || 'normal') === x.id
                      ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]'
                      : 'bg-white text-gray-500 border-[#EDE6D6]'
                  }`}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">משנה גם טקסט וגם מרווחים, כדי שהפרופורציות יישמרו.</p>
          </div>

          {/* ── צפיפות ── */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1.5">צפיפות</label>
            <div className="grid grid-cols-3 gap-1.5">
              {DENSITIES.map(x => (
                <button
                  key={x.id}
                  onClick={() => updateSettings({ density: x.id })}
                  className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                    (settings.density || 'normal') === x.id
                      ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]'
                      : 'bg-white text-gray-500 border-[#EDE6D6]'
                  }`}
                >
                  {x.label}
                  {x.hint && <span className="block text-[9px] font-normal opacity-70">{x.hint}</span>}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
            <span className="min-w-0">
              <span className="block text-sm font-bold text-[#0D1B2A]">רקע מעוצב</span>
              <span className="block text-[10px] text-gray-400">מפריד בעדינות בין המשטח לכרטיסים</span>
            </span>
            <input
              type="checkbox"
              checked={settings.graphics !== false}
              onChange={e => updateSettings({ graphics: e.target.checked })}
              className="w-4 h-4 shrink-0"
            />
          </label>

          <button
            onClick={() => updateSettings({
              theme: DEFAULT_SETTINGS.theme,
              uiSize: DEFAULT_SETTINGS.uiSize,
              density: DEFAULT_SETTINGS.density,
              graphics: DEFAULT_SETTINGS.graphics,
            })}
            className="w-full flex items-center justify-center gap-1.5 border border-[#EDE6D6] text-gray-500 text-xs font-bold py-2 rounded-xl hover:bg-gray-50"
          >
            <RotateCcw size={13} /> חזרה לעיצוב המקורי
          </button>
        </>
      ) : (
        <>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            הדשבורד הוא המסך שנפתח בכל בוקר, ומה שחשוב בו משתנה מאדם לאדם.
            כאן בוחרים מה יופיע ובאיזה סדר. במחשב הכרטיסים מתחלקים לשתי עמודות
            לפי אופיים, והסדר שקבעת נשמר בתוך כל עמודה.
          </p>

          <div className="space-y-1.5">
            {cards.map((id, i) => {
              const m = metaOf(id);
              return (
                <div key={id} className="bg-[#FAF6EE] rounded-xl border border-[#EDE6D6] px-2.5 py-2 flex items-center gap-2">
                  <span className="text-base shrink-0">{m.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-[#0D1B2A] truncate">{m.label}</div>
                    <div className="text-[10px] text-gray-400 truncate">{m.hint}</div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => setCards(moveCard(cards, i, i - 1))}
                      disabled={i === 0}
                      className="p-1 text-gray-400 hover:text-[#9B7A2F] disabled:opacity-25"
                      title="הזז למעלה"
                    ><ChevronUp size={15} /></button>
                    <button
                      onClick={() => setCards(moveCard(cards, i, i + 1))}
                      disabled={i === cards.length - 1}
                      className="p-1 text-gray-400 hover:text-[#9B7A2F] disabled:opacity-25"
                      title="הזז למטה"
                    ><ChevronDown size={15} /></button>
                    <button
                      onClick={() => setCards(cards.filter(x => x !== id))}
                      className="p-1 text-gray-400 hover:text-red-500"
                      title="הסתר"
                    ><EyeOff size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>

          {hidden.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-gray-500 mb-1.5">מוסתרים</div>
              <div className="flex flex-wrap gap-1.5">
                {hidden.map(id => {
                  const m = metaOf(id);
                  return (
                    <button
                      key={id}
                      onClick={() => setCards([...cards, id])}
                      className="text-[11px] bg-white border border-dashed border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-500 hover:border-[#C9A84C] hover:text-[#9B7A2F] flex items-center gap-1"
                    >
                      <Eye size={12} /> {m.icon} {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => setCards([...DEFAULT_ORDER])}
            className="w-full flex items-center justify-center gap-1.5 border border-[#EDE6D6] text-gray-500 text-xs font-bold py-2 rounded-xl hover:bg-gray-50"
          >
            <RotateCcw size={13} /> החזר את כל הכרטיסים לסדר המקורי
          </button>
        </>
      )}
    </div>
  );
}
