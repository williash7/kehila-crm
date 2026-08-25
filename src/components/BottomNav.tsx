import React from 'react';
import {
  Home, Users, CalendarDays, PieChart, CalendarCheck, Settings, ClipboardList,
  TrendingUp, HandCoins, History, DoorOpen, Target, Image as ImageIcon,
  BookOpen, CalendarHeart, WalletCards, MoreHorizontal, Search, Inbox,
} from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import {
  availableNavigationItems, NavItemId, normalizeBottomNavOrder,
  normalizeBottomNavPrimary,
} from '../lib/navigation';

interface BottomNavProps {
  currentTab: string;
  setTab: (tab: string) => void;
}

const ICONS: Record<NavItemId, React.ComponentType<{ size?: number; className?: string }>> = {
  home: Home,
  search: Search,
  inbox: Inbox,
  tasks: ClipboardList,
  score: TrendingUp,
  donors: Users,
  homevisits: DoorOpen,
  donations: HandCoins,
  finance: WalletCards,
  events: CalendarCheck,
  projects: Target,
  calendar: CalendarDays,
  dates: CalendarHeart,
  history: History,
  reports: PieChart,
  poster: ImageIcon,
  guide: BookOpen,
  settings: Settings,
};

export function BottomNav({ currentTab, setTab }: BottomNavProps) {
  const { settings } = useAppStore();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const navRef = React.useRef<HTMLElement>(null);
  const available = availableNavigationItems(settings.showFinanceCenter);
  const availableIds = new Set(available.map(item => item.id));
  const order = normalizeBottomNavOrder(settings.bottomNavOrder).filter(id => availableIds.has(id));
  const primaryIds = normalizeBottomNavPrimary(settings.bottomNavPrimary, order).filter(id => availableIds.has(id));
  const primary = primaryIds.map(id => available.find(item => item.id === id)!).filter(Boolean);
  const hidden = order.filter(id => !primaryIds.includes(id)).map(id => available.find(item => item.id === id)!).filter(Boolean);
  const activeInMore = hidden.some(item => item.id === currentTab);
  const navItemCount = primary.length + (hidden.length > 0 ? 1 : 0);
  const itemWidth = navItemCount <= 5 ? 'flex-1 min-w-0' : 'shrink-0 w-[20%]';

  React.useEffect(() => {
    const activeId = primaryIds.includes(currentTab as NavItemId) ? currentTab : activeInMore ? 'more' : '';
    if (!activeId) return;
    const frame = window.requestAnimationFrame(() => {
      navRef.current?.querySelector<HTMLElement>(`[data-nav-id="${activeId}"]`)?.scrollIntoView({
        behavior: 'smooth', block: 'nearest', inline: 'center',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentTab, activeInMore, primaryIds.join('|')]);

  const navigate = (id: string) => {
    setMoreOpen(false);
    setTab(id);
  };

  return (
    <>
      {moreOpen && hidden.length > 0 && (
        <>
          <button aria-label="סגור את תפריט עוד" onClick={() => setMoreOpen(false)} className="md:hidden fixed inset-0 z-40 bg-black/35" />
          <div className="md:hidden fixed bottom-[78px] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-24px)] max-w-[406px] max-h-[62vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-[#EDE6D6] p-3" dir="rtl">
            <div className="flex items-center justify-between px-1 pb-2 mb-2 border-b border-[#EDE6D6]">
              <div>
                <div className="font-bold text-[#0D1B2A]">עוד מסכים</div>
                <div className="text-[10px] text-gray-400">אפשר לשנות את הסרגל בהגדרות ← ניווט</div>
              </div>
              <MoreHorizontal size={20} className="text-[#9B7A2F]" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {hidden.map(item => {
                const Icon = ICONS[item.id];
                const active = currentTab === item.id;
                return (
                  <button key={item.id} onClick={() => navigate(item.id)} className={`rounded-xl border p-3 flex flex-col items-center gap-1.5 text-xs font-bold transition-colors ${active ? 'bg-[#0D1B2A] text-[#E8C97A] border-[#0D1B2A]' : 'bg-[#FAF6EE] text-[#0D1B2A] border-[#EDE6D6]'}`}>
                    <Icon size={20} />
                    <span className="text-center leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <nav ref={navRef} className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] nav-bg nav-border flex overflow-x-auto no-scrollbar snap-x snap-mandatory py-2 pb-6 z-50 border-t">
        {primary.map(item => {
          const Icon = ICONS[item.id];
          const isActive = currentTab === item.id;
          return (
            <button key={item.id} data-nav-id={item.id} onClick={() => navigate(item.id)} className={`${itemWidth} snap-start flex flex-col items-center gap-1 p-1 cursor-pointer bg-transparent border-none text-[10px] font-medium transition-colors ${isActive ? 'nav-text-strong' : 'nav-text opacity-70'}`}>
              <Icon size={20} className={`transition-transform ${isActive ? 'scale-110' : ''}`} />
              <span className="truncate max-w-full px-0.5">{item.label}</span>
            </button>
          );
        })}
        {hidden.length > 0 && (
          <button data-nav-id="more" onClick={() => setMoreOpen(open => !open)} aria-expanded={moreOpen} className={`${itemWidth} snap-start flex flex-col items-center gap-1 p-1 cursor-pointer bg-transparent border-none text-[10px] font-medium transition-colors ${moreOpen || activeInMore ? 'nav-text-strong' : 'nav-text opacity-70'}`}>
            <MoreHorizontal size={20} className={moreOpen || activeInMore ? 'scale-110' : ''} />
            עוד
          </button>
        )}
      </nav>
    </>
  );
}
