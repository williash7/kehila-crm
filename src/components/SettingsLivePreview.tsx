import React from 'react';
import { Eye, EyeOff, MoreHorizontal } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { DASH_CARDS, DashCardMeta, resolveCards } from '../lib/dashboardCards';
import { availableNavigationItems, normalizeBottomNavOrder, normalizeBottomNavPrimary } from '../lib/navigation';

const NAV_ICONS: Record<string, string> = {
  home: '⌂', search: '⌕', inbox: '▣', tasks: '☑', score: '↗', donors: '♙',
  homevisits: '⌂', donations: '₪', finance: '▤', events: '◈', projects: '◎',
  calendar: '▦', dates: '◷', history: '↶', reports: '▥', poster: '▧', guide: '?', settings: '⚙',
};

function MiniCard({ card }: { card: DashCardMeta }) {
  if (card.id === 'hero') return (
    <div className="bg-gradient-to-br from-[#0D1B2A] to-[#1A2E45] rounded-xl p-3 text-white shadow-sm">
      <div className="text-[8px] text-white/55">תרומות החודש</div>
      <div className="font-['Frank_Ruhl_Libre'] text-2xl font-black text-[#E8C97A]">₪8,071</div>
      <div className="text-[8px] text-white/45 mb-2">12 אנשי קשר תרמו החודש</div>
      <div className="flex flex-wrap gap-1">
        {['אשראי ₪3,200', 'העברה ₪2,870', 'מזומן ₪2,001'].map(item =>
          <span key={item} className="bg-white/10 rounded-full px-1.5 py-0.5 text-[7px]">{item}</span>)}
      </div>
    </div>
  );

  if (card.id === 'stats') return (
    <div className="grid grid-cols-3 gap-1">
      {[['₪34,820', 'תרומות'], ['42', 'תורמים'], ['18', 'הו״ק']].map(([value, label]) => (
        <div key={label} className="bg-white rounded-xl border border-[#EDE6D6] shadow-sm px-1 py-2 text-center">
          <div className="font-['Frank_Ruhl_Libre'] text-xs font-black text-[#0D1B2A]">{value}</div>
          <div className="text-[7px] text-gray-400">{label}</div>
        </div>
      ))}
    </div>
  );

  if (card.id === 'quick') return (
    <div className="bg-white rounded-xl border border-[#EDE6D6] shadow-sm p-2">
      <div className="text-[9px] font-bold text-[#0D1B2A] mb-1.5">⚡ פעולות מהירות</div>
      <div className="grid grid-cols-4 gap-1">
        {['+ תרומה', '+ איש', '+ משימה', '+ פעילות'].map(item =>
          <div key={item} className="bg-[#FAF6EE] rounded-lg py-1.5 text-center text-[7px] font-bold text-[#9B7A2F]">{item}</div>)}
      </div>
    </div>
  );

  if (card.id === 'recent') return (
    <div className="bg-white rounded-xl border border-[#EDE6D6] shadow-sm p-2">
      <div className="text-[9px] font-bold text-[#0D1B2A] mb-1">🧾 תרומות אחרונות</div>
      {[['ישראל ישראלי', '₪360'], ['שרה כהן', '₪180']].map(([name, amount]) => (
        <div key={name} className="flex justify-between border-t border-[#EDE6D6] py-1 text-[8px]">
          <span className="text-gray-500">{name}</span><b className="text-[#9B7A2F]">{amount}</b>
        </div>
      ))}
    </div>
  );

  if (card.id === 'shabbat') return (
    <div className="bg-white rounded-xl border border-[#EDE6D6] shadow-sm p-2.5 flex items-center justify-between">
      <div><div className="text-[9px] font-bold text-[#0D1B2A]">🕯️ זמני שבת</div><div className="text-[7px] text-gray-400">פרשת השבוע</div></div>
      <div className="text-left text-[8px] text-[#9B7A2F]"><b>18:12</b><br />19:08</div>
    </div>
  );

  if (card.id === 'tasks' || card.id === 'activityReadiness') return (
    <div className="bg-white rounded-xl border border-[#EDE6D6] shadow-sm p-2.5">
      <div className="flex justify-between text-[9px] font-bold text-[#0D1B2A]"><span>{card.icon} {card.label}</span><span>3 פתוחות</span></div>
      <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden"><div className="h-full w-2/3 bg-[#C9A84C] rounded-full" /></div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-[#EDE6D6] shadow-sm p-2.5 flex gap-2 items-center">
      <span className="w-7 h-7 rounded-lg bg-[#C9A84C]/15 flex items-center justify-center text-sm">{card.icon}</span>
      <span className="min-w-0 flex-1"><b className="block text-[9px] text-[#0D1B2A] truncate">{card.label}</b><span className="block text-[7px] text-gray-400 truncate">{card.hint}</span></span>
      <span className="text-[#9B7A2F] text-xs">‹</span>
    </div>
  );
}

/** הדמיה חיה של מסך אמיתי — לא רשימת שמות של האפשרויות. */
export function SettingsLivePreview({ group }: { group: 'appearance' | 'navigation' }) {
  const { settings } = useAppStore();
  const [visible, setVisible] = React.useState(true);
  const navigation = availableNavigationItems(settings.showFinanceCenter);
  const itemById = new Map(navigation.map(item => [item.id, item]));
  const availableIds = new Set(navigation.map(item => item.id));
  const fullOrder = normalizeBottomNavOrder(settings.bottomNavOrder);
  const primary = normalizeBottomNavPrimary(settings.bottomNavPrimary, fullOrder).filter(id => availableIds.has(id));
  const orderedPrimary = fullOrder.filter(id => primary.includes(id) && availableIds.has(id));
  const hasMore = fullOrder.some(id => availableIds.has(id) && !primary.includes(id));
  const cards = resolveCards(settings.dashboardCards)
    .map(id => DASH_CARDS.find(card => card.id === id))
    .filter((card): card is DashCardMeta => !!card);

  if (!visible) return (
    <button onClick={() => setVisible(true)} className="w-full md:fixed md:left-4 md:top-20 md:w-auto md:z-40 bg-white border border-[#EDE6D6] shadow-sm rounded-xl px-3 py-2 text-xs font-bold text-[#0D1B2A] flex items-center justify-center gap-2">
      <Eye size={15} /> הצג תצוגה מקדימה
    </button>
  );

  return (
    <aside className="w-full md:fixed md:left-4 md:top-20 md:w-[340px] md:max-h-[calc(100vh-96px)] md:overflow-y-auto md:z-40 bg-white rounded-2xl border border-[#EDE6D6] shadow-lg overflow-hidden">
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-[#EDE6D6]">
        <div><div className="text-sm font-bold text-[#0D1B2A]">תצוגה מקדימה חיה</div><div className="text-[9px] text-gray-400">מסך מוקטן של האפליקציה · מתעדכנת מיד עם כל שינוי</div></div>
        <button onClick={() => setVisible(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50" aria-label="הסתר תצוגה מקדימה"><EyeOff size={15} /></button>
      </div>

      <div className="p-2.5" style={{ background: 'var(--c-cream)' }}>
        <div className="rounded-[18px] overflow-y-auto max-h-[480px] border-2 border-[#0D1B2A]/10 bg-[#FAF6EE] shadow-inner">
          <div className="bg-[#0D1B2A] px-3 py-2.5 flex justify-between items-center">
            <div><div className="font-['Frank_Ruhl_Libre'] text-sm font-bold text-[#E8C97A]">דשבורד</div><div className="text-[7px] text-white/45">י״ט באלול תשפ״ו</div></div>
            <div className="w-7 h-7 rounded-lg bg-[#C9A84C] text-white flex items-center justify-center text-xs">ח</div>
          </div>

          <div className={`p-2 space-y-1.5 ${group === 'navigation' ? 'opacity-70' : ''}`}>
            {cards.map(card => <React.Fragment key={card.id}><MiniCard card={card} /></React.Fragment>)}
          </div>

          <div className={`nav-bg nav-border border-t px-1.5 py-1.5 flex gap-0.5 sticky bottom-0 ${group === 'navigation' ? 'ring-2 ring-[#C9A84C]/40' : ''}`}>
            {orderedPrimary.slice(0, 5).map((id, index) => (
              <div key={id} className={`min-w-0 flex-1 text-center rounded-lg px-0.5 py-1 text-[7px] font-bold truncate ${index === 0 ? 'nav-active' : 'nav-text'}`}>
                <span className="block text-[12px] leading-none mb-1">{NAV_ICONS[id] || '•'}</span>{itemById.get(id)?.label}
              </div>
            ))}
            {(hasMore || orderedPrimary.length > 5) && <div className="min-w-0 flex-1 text-center rounded-lg px-0.5 py-1 text-[7px] font-bold nav-text"><MoreHorizontal size={13} className="mx-auto mb-0.5" />עוד</div>}
          </div>
        </div>
      </div>
    </aside>
  );
}
