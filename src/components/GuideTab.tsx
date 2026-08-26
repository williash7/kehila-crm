import React, { useMemo, useState } from 'react';
import { BookOpen, Printer, ChevronDown, Search, Settings, ArrowLeft } from 'lucide-react';
import { buildGuide, Block, GuideSection } from '../lib/guideContent';
import { getOrg } from '../lib/orgConfig';
import {
  FEATURE_CATALOG, FEATURE_CATEGORIES, type FeatureDefinition, type SettingsTarget,
} from '../lib/featureCatalog';
import type { NavItemId } from '../lib/navigation';

// ─────────────────────────────────────────────────────────────────────────────
// מסך המדריך.
//
// אותו תוכן בדיוק (lib/guideContent.ts) מוצג כאן ויוצא להדפסה — אין שתי
// גרסאות שיכולות להתפצל.
//
// ההורדה כ-PDF נעשית דרך חלון ההדפסה של הדפדפן ולא דרך ספריית PDF, מסיבה
// מעשית: ספריות PDF דורשות הטמעת גופן עברי ומטפלות גרוע בכיווניות RTL,
// בעוד שהדפדפן כבר יודע לסדר עברית בצורה מושלמת. "שמור כ-PDF" בחלון
// ההדפסה נותן קובץ נקי, בלי תלות נוספת ובלי סיכון לג'יבריש.
// ─────────────────────────────────────────────────────────────────────────────

export function GuideTab({ onOpenTab, onOpenSettings }: {
  onOpenTab?: (tab: NavItemId) => void;
  onOpenSettings?: (target: SettingsTarget) => void;
} = {}) {
  const sections = useMemo(() => buildGuide(), []);
  const [openId, setOpenId] = useState<string | null>('start');
  const [featureSearch, setFeatureSearch] = useState('');
  const org = getOrg();
  const visibleFeatures = useMemo(() => {
    const q = featureSearch.trim().toLocaleLowerCase('he');
    if (!q) return FEATURE_CATALOG;
    return FEATURE_CATALOG.filter(feature => [
      feature.title, feature.summary, feature.practical,
      ...(feature.keywords || []), ...feature.data,
    ].join(' ').toLocaleLowerCase('he').includes(q));
  }, [featureSearch]);

  return (
    <div className="animate-in fade-in pb-24 md:pb-6">
      <style>{PRINT_CSS}</style>

      <div className="bg-[#0D1B2A] px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md no-print">
        <div className="w-9 h-9 bg-gradient-to-br from-[#C9A84C] to-[#9B7A2F] rounded-lg flex items-center justify-center shrink-0 md:hidden">
          <BookOpen size={18} className="text-white" />
        </div>
        <div className="flex-1 px-3 md:px-0">
          <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#C9A84C]">מדריך</div>
          <div className="text-[11px] text-white/45 mt-[1px]">כל הפיצ׳רים, עם דוגמאות</div>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 h-9 bg-[#C9A84C] text-[#0D1B2A] rounded-full text-xs font-bold shrink-0"
        >
          <Printer size={14} /> הורד PDF
        </button>
      </div>

      <div className="p-4 md:p-6 max-w-3xl guide-print flex flex-col">
        {/* כותרת שמופיעה רק בהדפסה */}
        <div className="print-only mb-6 order-1">
          <h1 className="font-['Frank_Ruhl_Libre'] text-3xl font-bold text-[#0D1B2A]">מדריך למשתמש</h1>
          <p className="text-sm text-gray-500 mt-1">{org.orgName.he || 'לוח בקרה קהילתי'}</p>
        </div>

        <p className="text-sm text-gray-500 mt-5 mb-4 no-print leading-relaxed order-3">
          לחיצה על "הורד PDF" פותחת את חלון ההדפסה — בוחרים שם <b>"שמור כ-PDF"</b> ומקבלים את החוברת המלאה כקובץ.
        </p>

        <section className="mb-5 no-print order-4">
          <div className="mb-3">
            <h1 className="font-['Frank_Ruhl_Libre'] text-2xl font-bold text-[#0D1B2A]">מפת כל הפונקציות</h1>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              כאן רואים מה כל פעולה עושה, מה היא עוזרת בפועל, היכן משתמשים בה ומה נשמר בגיבוי.
            </p>
          </div>
          <label className="h-11 bg-white border border-[#EDE6D6] rounded-xl flex items-center gap-2 px-3 mb-3 shadow-sm">
            <Search size={17} className="text-gray-400" />
            <input
              value={featureSearch}
              onChange={event => setFeatureSearch(event.target.value)}
              placeholder="חיפוש פונקציה, למשל תרומה, מיזוג או תזרים"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm"
            />
          </label>
          <div className="space-y-3">
            {FEATURE_CATEGORIES.map(category => {
              const features = visibleFeatures.filter(feature => feature.category === category.id);
              if (!features.length) return null;
              return (
                <div key={category.id} className="bg-white rounded-2xl border border-[#EDE6D6] p-3">
                  <div className="flex items-start gap-2 mb-2.5">
                    <span className="text-lg">{category.icon}</span>
                    <div>
                      <h2 className="font-bold text-[#0D1B2A]">{category.title}</h2>
                      <p className="text-[11px] text-gray-400">{category.hint}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {features.map(feature => (
                      <FeatureCard
                        key={feature.id}
                        feature={feature}
                        onOpenTab={onOpenTab}
                        onOpenSettings={onOpenSettings}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {!visibleFeatures.length && (
              <div className="text-center text-sm text-gray-400 py-8">לא נמצאה פונקציה מתאימה.</div>
            )}
          </div>
        </section>

        <div className="print-only mb-4 order-4">
          <h2 className="font-['Frank_Ruhl_Libre'] text-2xl font-bold text-[#0D1B2A]">מפת כל הפונקציות</h2>
          {FEATURE_CATEGORIES.map(category => (
            <section key={category.id} className="guide-section mt-3">
              <h3 className="font-bold text-lg">{category.icon} {category.title}</h3>
              {FEATURE_CATALOG.filter(feature => feature.category === category.id).map(feature => (
                <div key={feature.id} className="mt-2">
                  <div className="font-bold">{feature.icon} {feature.title}</div>
                  <p className="text-sm text-gray-700">{feature.summary} <b>בפועל:</b> {feature.practical}</p>
                  <p className="text-xs text-gray-500">נשמר בגיבוי: {feature.data.join(' · ')}</p>
                </div>
              ))}
            </section>
          ))}
        </div>

        <div className="space-y-2.5 order-2">
          {sections.map(sec => (
            <SectionCard
              key={sec.id}
              section={sec}
              open={openId === sec.id}
              onToggle={() => setOpenId(openId === sec.id ? null : sec.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ feature, onOpenTab, onOpenSettings }: {
  key?: React.Key;
  feature: FeatureDefinition;
  onOpenTab?: (tab: NavItemId) => void;
  onOpenSettings?: (target: SettingsTarget) => void;
}) {
  return (
    <article className="rounded-xl bg-[#FAF6EE] border border-[#EDE6D6] p-3">
      <div className="flex items-start gap-2">
        <span className="text-lg shrink-0">{feature.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-[#0D1B2A]">{feature.title}</h3>
          <p className="text-xs text-gray-600 leading-relaxed mt-0.5">{feature.summary}</p>
          <p className="text-xs text-[#7A5D18] leading-relaxed mt-1"><b>מה זה עוזר:</b> {feature.practical}</p>
          <details className="mt-1.5">
            <summary className="text-[11px] text-gray-500 cursor-pointer">מה נשמר בגיבוי</summary>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{feature.data.join(' · ')}</p>
          </details>
        </div>
      </div>
      {(feature.tab || feature.settings) && (
        <div className="flex flex-wrap gap-2 mt-2.5 pr-7">
          {feature.tab && onOpenTab && (
            <button
              onClick={() => onOpenTab(feature.tab!)}
              className="h-8 px-3 rounded-full bg-white border border-[#E4DCCB] text-[11px] font-bold flex items-center gap-1"
            >
              פתח מסך <ArrowLeft size={12} />
            </button>
          )}
          {feature.settings && onOpenSettings && (
            <button
              onClick={() => onOpenSettings(feature.settings!)}
              className="h-8 px-3 rounded-full bg-[#0D1B2A] text-[#E8C97A] text-[11px] font-bold flex items-center gap-1"
            >
              <Settings size={12} /> ההגדרה של הפונקציה
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function SectionCard({ section, open, onToggle }: { key?: React.Key; section: GuideSection; open: boolean; onToggle: () => void }) {
  return (
    <section className="bg-white rounded-2xl border border-[#EDE6D6] overflow-hidden guide-section">
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-right">
        <span className="text-xl shrink-0">{section.icon}</span>
        <h2 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] flex-1">{section.title}</h2>
        <ChevronDown size={16} className={`text-gray-400 shrink-0 no-print transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <div className={`${open ? 'block' : 'hidden'} print-block px-4 pb-4 space-y-3`}>
        {section.blocks.map((b, i) => <BlockView key={i} block={b} />)}
      </div>
    </section>
  );
}

function BlockView({ block }: { key?: React.Key; block: Block }) {
  switch (block.t) {
    case 'p':
      return <p className="text-sm text-gray-700 leading-relaxed">{block.text}</p>;

    case 'steps':
      return (
        <ol className="space-y-1.5">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-gray-700 leading-relaxed">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[#C9A84C]/15 text-[#9B7A2F] text-[11px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span>{it}</span>
            </li>
          ))}
        </ol>
      );

    case 'bullets':
      return (
        <ul className="space-y-1">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
              <span className="text-[#C9A84C] shrink-0">•</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      );

    case 'example':
      return (
        <div className="bg-[#FAF6EE] border-r-[3px] border-[#C9A84C] rounded-lg p-3">
          <div className="text-[11px] font-bold text-[#9B7A2F] mb-1">דוגמה · {block.title}</div>
          <p className="text-sm text-gray-700 leading-relaxed">{block.text}</p>
        </div>
      );

    case 'note':
      return (
        <div className="bg-[#0D1B2A]/[0.04] rounded-lg p-3 text-sm text-gray-600 leading-relaxed">
          {block.text}
        </div>
      );

    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#0D1B2A] text-[#C9A84C]">
                {block.head.map((h, i) => (
                  <th key={i} className="text-right font-bold px-3 py-1.5 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r, i) => (
                <tr key={i} className="border-b border-[#EDE6D6]">
                  {r.map((c, j) => (
                    <td key={j} className={`px-3 py-1.5 ${j === 0 ? 'font-bold text-[#0D1B2A]' : 'text-gray-600'}`}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/**
 * בהדפסה: כל הסעיפים נפתחים (גם אלה שסגורים על המסך), הניווט והכפתורים
 * נעלמים, וסעיף לא נחתך באמצע בין עמודים.
 */
const PRINT_CSS = `
.print-only { display: none; }
@media print {
  @page { margin: 14mm; }
  body { background: #fff !important; }
  .no-print, nav, aside, header { display: none !important; }
  .print-only { display: block !important; }
  .print-block { display: block !important; }
  .guide-print { max-width: none !important; padding: 0 !important; }
  .guide-section {
    break-inside: avoid;
    page-break-inside: avoid;
    border: none !important;
    border-bottom: 1px solid #EDE6D6 !important;
    border-radius: 0 !important;
    margin-bottom: 8px;
  }
}
`;
