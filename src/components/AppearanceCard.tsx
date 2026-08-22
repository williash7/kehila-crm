import React, { useState } from 'react';
import { Check, ChevronUp, ChevronDown, Eye, EyeOff, RotateCcw, Home, Users, HandCoins } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import {
  THEMES, FINISHES, SURFACES, ICON_STYLES, FONTS,
  UI_SIZES, DENSITIES, DEFAULT_SETTINGS,
} from '../lib/settings';
import { DASH_CARDS, DashCardId, resolveCards, hiddenCards, moveCard, DEFAULT_ORDER } from '../lib/dashboardCards';

// ─────────────────────────────────────────────────────────────────────────────
// מראה ותצוגה.
//
// שבע הגדרות שאין להן תשובה נכונה אחת: צבע, גימור, ניווט, אייקונים, גופן,
// גודל וצפיפות. הן תלויות במסך, בתאורה, בעיניים ובהעדפה — ולכן הן שייכות
// למשתמש ולא למעצב.
//
// כולן נשמרות **מקומית בלבד**. זה מכוון: מסך גדול בבית ומסך קטן בכיס אינם
// צריכים אותה צפיפות, ואילו סנכרון היה כופה על שניהם את אותה בחירה.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * תצוגה מקדימה חיה.
 *
 * הדוגמית הזו אינה איור: היא בנויה מאותן מחלקות שמרכיבות את המסכים
 * האמיתיים — bg-white, rounded-2xl, border, shadow-sm — ולכן כל ציר שמשנה
 * אותן משנה גם אותה. שם של סגנון לא אומר כלום; ההבדל בין "מרחף" ל"מוגדר"
 * הוא דבר שצריך לראות.
 */
function LivePreview() {
  return (
    <div className="rounded-2xl overflow-hidden border border-[#EDE6D6]">
      <div className="flex" style={{ background: 'var(--c-cream)' }}>
        {/* פס ניווט מוקטן */}
        <div className="w-20 shrink-0 nav-bg nav-border border-l p-1.5 space-y-1">
          {[
            { Icon: Home, label: 'דשבורד', on: true },
            { Icon: Users, label: 'קשר', on: false },
            { Icon: HandCoins, label: 'תרומות', on: false },
          ].map(({ Icon, label, on }) => (
            <div
              key={label}
              className={`flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg text-[9px] font-medium ${
                on ? 'nav-active' : 'nav-text'
              }`}
            >
              <Icon size={12} /> {label}
            </div>
          ))}
        </div>

        {/* תוכן */}
        <div className="flex-1 min-w-0 p-2.5 space-y-2">
          <div className="bg-white rounded-2xl border border-[#EDE6D6] shadow-sm p-2.5">
            <div className="font-['Frank_Ruhl_Libre'] text-sm font-bold text-[#0D1B2A]">תרומות החודש</div>
            <div className="font-['Frank_Ruhl_Libre'] text-xl font-black text-[#C9A84C] leading-tight">₪4,280</div>
            <div className="text-[9px] text-gray-400">מתוכן ₪2,400 בהוראות קבע</div>
          </div>
          <div className="flex gap-1.5">
            <div className="bg-[#0D1B2A] text-[#E8C97A] text-[10px] font-bold px-2.5 py-1.5 rounded-xl">כפתור</div>
            <div className="bg-white border border-[#EDE6D6] text-[#0D1B2A] text-[10px] font-bold px-2.5 py-1.5 rounded-xl shadow-sm">משני</div>
            <div className="bg-[#C9A84C]/15 text-[#9B7A2F] text-[10px] font-bold px-2.5 py-1.5 rounded-full">תווית</div>
          </div>
        </div>
      </div>
    </div>
  );
}

type TabId = 'color' | 'finish' | 'size' | 'dashboard';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'color',     label: 'צבע',    icon: '🎨' },
  { id: 'finish',    label: 'סגנון',  icon: '✦' },
  { id: 'size',      label: 'גודל',   icon: '🔍' },
  { id: 'dashboard', label: 'דשבורד', icon: '🏠' },
];

export function AppearanceCard() {
  const { settings, updateSettings } = useAppStore();
  // חמישה צירים, שתים־עשרה ערכות ושלושה בוררי תצוגה בטור אחד הפכו את
  // הכרטיס למסך גלילה. כל ציר מקבל לשונית משלו: בכל רגע רואים החלטה אחת,
  // ומעליה תמיד את התצוגה המקדימה שמראה מה היא עשתה.
  const [tab, setTab] = useState<TabId>('color');

  const cards = resolveCards(settings.dashboardCards);
  const hidden = hiddenCards(settings.dashboardCards);
  const metaOf = (id: DashCardId) => DASH_CARDS.find(c => c.id === id)!;

  const setCards = (next: DashCardId[]) => updateSettings({ dashboardCards: next });

  /** בורר ציר אחד: כמה אפשרויות שוות בשורה, עם רמז מתחת לכל אחת. */
  const Axis = <T extends string>({ label, options, value, onPick, cols = 3 }: {
    label: string;
    options: { id: T; label: string; hint?: string }[];
    value: T;
    onPick: (id: T) => void;
    cols?: number;
  }) => (
    <div>
      <label className="block text-[11px] font-bold text-gray-600 mb-1.5">{label}</label>
      <div className={`grid gap-1.5 ${cols === 4 ? 'grid-cols-4' : cols === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {options.map(o => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            className={`py-2 px-1 rounded-lg text-xs font-bold border transition-colors ${
              value === o.id
                ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]'
                : 'bg-white text-gray-500 border-[#EDE6D6] hover:border-[#C9A84C]'
            }`}
          >
            {o.label}
            {o.hint && <span className="block text-[9px] font-normal opacity-70 leading-tight mt-0.5">{o.hint}</span>}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">מראה ותצוגה</h3>
      </div>

      <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              tab === t.id
                ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]'
                : 'bg-white text-gray-500 border-[#EDE6D6] hover:border-[#C9A84C]'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* התצוגה המקדימה נשארת מעל כל לשונית שנוגעת בעיצוב — אין טעם לבחור
          גימור בלי לראות אותו. */}
      {tab !== 'dashboard' && <LivePreview />}

      {tab === 'color' && (
        <>
          <div>
            <p className="text-[11px] text-gray-400 leading-relaxed mb-2">
              כל ערכה קובעת גם את <b>מבנה</b> הניווט, לא רק את הגוון: יש ערכות
              עם סרגל לבן, עם סרגל צבעוני מלא, ועם סרגל כהה.
            </p>
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
        </>
      )}

      {tab === 'finish' && (
        <>
          <Axis
            label="גימור — פינות, גבולות וצללים"
            options={FINISHES}
            value={settings.finish || 'float'}
            onPick={finish => updateSettings({ finish })}
            cols={4}
          />
          <p className="text-[11px] text-gray-400 leading-relaxed">
            הגימור משנה יותר מהצבע. <b>מרחף</b> מוותר על גבולות ונשען על עומק,
            <b> מוגדר</b> עושה בדיוק את ההפך, ו<b>חד</b> מוותר על עיגול — נוח
            למי שסורק מסך מהר.
          </p>

          <Axis
            label="משטחים כהים — סרגל, פס עליון, כפתורים"
            options={SURFACES}
            value={settings.surface || 'auto'}
            onPick={surface => updateSettings({ surface })}
            cols={4}
          />

          <Axis
            label="אייקונים וסימון הפריט הפעיל"
            options={ICON_STYLES}
            value={settings.icons || 'thin'}
            onPick={icons => updateSettings({ icons })}
          />

          <Axis
            label="גופנים"
            options={FONTS}
            value={settings.font || 'classic'}
            onPick={font => updateSettings({ font })}
          />
        </>
      )}

      {tab === 'size' && (
        <>
          <Axis
            label="גודל התצוגה"
            options={UI_SIZES}
            value={settings.uiSize || 'normal'}
            onPick={uiSize => updateSettings({ uiSize })}
            cols={4}
          />

          <Axis
            label="צפיפות"
            options={DENSITIES}
            value={settings.density || 'normal'}
            onPick={density => updateSettings({ density })}
          />

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
              finish: DEFAULT_SETTINGS.finish,
              surface: DEFAULT_SETTINGS.surface,
              icons: DEFAULT_SETTINGS.icons,
              font: DEFAULT_SETTINGS.font,
              uiSize: DEFAULT_SETTINGS.uiSize,
              density: DEFAULT_SETTINGS.density,
              graphics: DEFAULT_SETTINGS.graphics,
            })}
            className="w-full flex items-center justify-center gap-1.5 border border-[#EDE6D6] text-gray-500 text-xs font-bold py-2 rounded-xl hover:bg-gray-50"
          >
            <RotateCcw size={13} /> חזרה לברירת המחדל
          </button>
        </>
      )}

      {tab === 'dashboard' && (
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
