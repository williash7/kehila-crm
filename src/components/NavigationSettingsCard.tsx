import React from 'react';
import { ArrowDown, ArrowUp, Eye, MoreHorizontal, RotateCcw } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import {
  availableNavigationItems, DEFAULT_BOTTOM_NAV_ORDER, DEFAULT_BOTTOM_NAV_PRIMARY,
  MAX_BOTTOM_NAV_PRIMARY, NavItemId, normalizeBottomNavOrder, normalizeBottomNavPrimary,
} from '../lib/navigation';

export function NavigationSettingsCard() {
  const { settings, updateSettings } = useAppStore();
  const available = availableNavigationItems(settings.showFinanceCenter);
  const availableIds = new Set(available.map(item => item.id));
  const fullOrder = normalizeBottomNavOrder(settings.bottomNavOrder);
  const order = fullOrder.filter(id => availableIds.has(id));
  const primary = normalizeBottomNavPrimary(settings.bottomNavPrimary, fullOrder).filter(id => availableIds.has(id));

  const togglePrimary = (id: NavItemId) => {
    if (primary.includes(id)) {
      updateSettings({ bottomNavPrimary: primary.filter(item => item !== id) });
      return;
    }
    if (primary.length >= MAX_BOTTOM_NAV_PRIMARY) return;
    updateSettings({ bottomNavPrimary: [...primary, id] });
  };

  const move = (id: NavItemId, delta: -1 | 1) => {
    const visibleIndex = order.indexOf(id);
    const otherId = order[visibleIndex + delta];
    if (!otherId) return;
    const next = [...fullOrder];
    const a = next.indexOf(id);
    const b = next.indexOf(otherId);
    [next[a], next[b]] = [next[b], next[a]];
    updateSettings({ bottomNavOrder: next });
  };

  const itemById = new Map(available.map(item => [item.id, item]));
  const orderedPrimary = order.filter(id => primary.includes(id));

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">סרגל הניווט בטלפון</h3>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">בחר עד ארבעה מסכים שיופיעו ישירות. כל השאר נשארים בתפריט „עוד”. החצים קובעים את הסדר.</p>
        </div>
        <button onClick={() => updateSettings({ bottomNavOrder: [...DEFAULT_BOTTOM_NAV_ORDER], bottomNavPrimary: [...DEFAULT_BOTTOM_NAV_PRIMARY] })} className="p-2 text-gray-400 hover:text-[#0D1B2A]" title="איפוס ניווט"><RotateCcw size={15} /></button>
      </div>

      <div className="rounded-xl nav-bg nav-border border px-2 py-2 flex">
        {orderedPrimary.map(id => (
          <div key={id} className="flex-1 min-w-0 text-center text-[10px] nav-text-strong font-bold truncate px-0.5">{itemById.get(id)?.label}</div>
        ))}
        <div className="flex-1 min-w-0 text-center text-[10px] nav-text-strong font-bold flex items-center justify-center gap-1"><MoreHorizontal size={14} /> עוד</div>
      </div>

      <div className="space-y-1.5">
        {order.map((id, index) => {
          const item = itemById.get(id)!;
          const shown = primary.includes(id);
          const limitReached = !shown && primary.length >= MAX_BOTTOM_NAV_PRIMARY;
          return (
            <div key={id} className="flex items-center gap-2 border border-[#EDE6D6] rounded-xl px-2.5 py-2 bg-[#FAF6EE]">
              <div className="flex flex-col shrink-0">
                <button onClick={() => move(id, -1)} disabled={index === 0} aria-label={`העבר את ${item.label} למעלה`} className="text-gray-400 disabled:opacity-20 hover:text-[#0D1B2A]"><ArrowUp size={14} /></button>
                <button onClick={() => move(id, 1)} disabled={index === order.length - 1} aria-label={`העבר את ${item.label} למטה`} className="text-gray-400 disabled:opacity-20 hover:text-[#0D1B2A]"><ArrowDown size={14} /></button>
              </div>
              <span className="flex-1 text-sm font-bold text-[#0D1B2A]">{item.label}</span>
              <button onClick={() => togglePrimary(id)} disabled={limitReached} aria-pressed={shown} title={limitReached ? `אפשר להציג עד ${MAX_BOTTOM_NAV_PRIMARY} פריטים` : undefined} className={`min-w-[92px] rounded-lg px-2.5 py-1.5 text-[11px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-35 ${shown ? 'bg-emerald-100 text-emerald-800' : 'bg-white border border-[#EDE6D6] text-gray-500'}`}>
                {shown ? <><Eye size={13} /> בסרגל</> : <><MoreHorizontal size={13} /> תחת עוד</>}
              </button>
            </div>
          );
        })}
      </div>
      {primary.length >= MAX_BOTTOM_NAV_PRIMARY && <p className="text-[10px] text-gray-400">כדי להציג מסך אחר בסרגל, העבר קודם אחד מהארבעה לתפריט „עוד”.</p>}
    </div>
  );
}
