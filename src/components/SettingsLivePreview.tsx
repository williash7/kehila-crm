import React from 'react';
import { Eye, EyeOff, MoreHorizontal } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { DASH_CARDS, resolveCards } from '../lib/dashboardCards';
import { availableNavigationItems, normalizeBottomNavOrder, normalizeBottomNavPrimary } from '../lib/navigation';

/** חלון אחד שמראה בזמן אמת את כל שינויי המראה והניווט. */
export function SettingsLivePreview({ group }: { group: 'appearance' | 'navigation' }) {
  const { settings } = useAppStore();
  const [visible, setVisible] = React.useState(true);

  const navigation = availableNavigationItems(settings.showFinanceCenter);
  const itemById = new Map(navigation.map(item => [item.id, item]));
  const availableIds = new Set(navigation.map(item => item.id));
  const fullOrder = normalizeBottomNavOrder(settings.bottomNavOrder);
  const primary = normalizeBottomNavPrimary(settings.bottomNavPrimary, fullOrder)
    .filter(id => availableIds.has(id));
  const orderedPrimary = fullOrder.filter(id => primary.includes(id) && availableIds.has(id));
  const hasMore = fullOrder.some(id => availableIds.has(id) && !primary.includes(id));
  const cards = resolveCards(settings.dashboardCards)
    .map(id => DASH_CARDS.find(card => card.id === id))
    .filter(Boolean)
    .slice(0, 4);

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="w-full md:fixed md:left-4 md:top-20 md:w-auto md:z-40 bg-white border border-[#EDE6D6] shadow-sm rounded-xl px-3 py-2 text-xs font-bold text-[#0D1B2A] flex items-center justify-center gap-2"
      >
        <Eye size={15} /> הצג תצוגה מקדימה
      </button>
    );
  }

  return (
    <aside className="w-full md:fixed md:left-4 md:top-20 md:w-[300px] md:max-h-[calc(100vh-96px)] md:overflow-y-auto md:z-40 bg-white rounded-2xl border border-[#EDE6D6] shadow-lg overflow-hidden">
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-[#EDE6D6]">
        <div>
          <div className="text-sm font-bold text-[#0D1B2A]">תצוגה מקדימה</div>
          <div className="text-[9px] text-gray-400">מתעדכנת מיד עם כל שינוי</div>
        </div>
        <button onClick={() => setVisible(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50" aria-label="הסתר תצוגה מקדימה">
          <EyeOff size={15} />
        </button>
      </div>

      <div className="p-3" style={{ background: 'var(--c-cream)' }}>
        <div className="bg-[#0D1B2A] rounded-xl px-3 py-2 mb-2 text-right">
          <div className="text-[9px] text-white/50">דשבורד</div>
          <div className="font-['Frank_Ruhl_Libre'] text-sm font-bold text-[#E8C97A]">
            {group === 'appearance' ? 'כך ייראה העיצוב' : 'כך ייראה הניווט'}
          </div>
        </div>

        <div className="space-y-1.5 mb-2.5">
          {cards.map(card => card && (
            <div key={card.id} className="bg-white rounded-xl border border-[#EDE6D6] shadow-sm px-2.5 py-2 flex items-center gap-2">
              <span className="text-sm">{card.icon}</span>
              <span className="min-w-0">
                <span className="block text-[10px] font-bold text-[#0D1B2A] truncate">{card.label}</span>
                <span className="block text-[8px] text-gray-400 truncate">{card.hint}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="nav-bg nav-border border rounded-xl px-1.5 py-2 flex gap-1 overflow-hidden">
          {orderedPrimary.slice(0, 5).map((id, index) => (
            <div key={id} className={`min-w-0 flex-1 text-center rounded-lg px-1 py-1 text-[8px] font-bold truncate ${index === 0 ? 'nav-active' : 'nav-text'}`}>
              <span className="block text-[10px] leading-none mb-1">{index === 0 ? '⌂' : '•'}</span>
              {itemById.get(id)?.label}
            </div>
          ))}
          {(hasMore || orderedPrimary.length > 5) && (
            <div className="min-w-0 flex-1 text-center rounded-lg px-1 py-1 text-[8px] font-bold nav-text">
              <MoreHorizontal size={12} className="mx-auto mb-0.5" />עוד
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
