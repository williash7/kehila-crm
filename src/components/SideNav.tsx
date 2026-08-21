import React from 'react';
import { Home, Users, CalendarDays, PieChart, CalendarCheck, Plus, ImageIcon, RefreshCw, Settings, ClipboardList, TrendingUp, HandCoins, History, DoorOpen, Target, BookOpen } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { getOrg } from '../lib/orgConfig';

interface SideNavProps {
  currentTab: string;
  setTab: (tab: string) => void;
  onDonationClick: () => void;
  addLabel?: string;
}

export function SideNav({ currentTab, setTab, onDonationClick, addLabel }: SideNavProps) {
  const { hebrewDate, effectiveSummary, refresh } = useAppStore();

  const org = getOrg();
  const orgTitle = org.shortName || org.orgName.he;
  const orgInitial = orgTitle.replace(/["'׳״]/g, '').trim().charAt(0) || '✦';

  const navItems = [
    { id: 'home',      icon: Home,         label: 'דשבורד' },
    { id: 'tasks',     icon: ClipboardList, label: 'משימות' },
    { id: 'score',     icon: TrendingUp,    label: 'פעילות' },
    { id: 'donors',    icon: Users,         label: 'אנשי קשר' },
    { id: 'homevisits',icon: DoorOpen,      label: 'ביקורי בית' },
    { id: 'donations', icon: HandCoins,     label: 'תרומות' },
    { id: 'events',    icon: CalendarCheck, label: 'אירועים' },
    { id: 'projects',  icon: Target,        label: 'פרויקטים' },
    { id: 'calendar',  icon: CalendarDays,  label: 'חגים' },
    { id: 'history',   icon: History,       label: 'היסטוריה' },
    { id: 'reports',   icon: PieChart,      label: 'דוחות' },
    { id: 'poster',    icon: ImageIcon,     label: 'פוסטר שבת' },
    { id: 'guide',     icon: BookOpen,      label: 'מדריך' },
    { id: 'settings',  icon: Settings,      label: 'הגדרות' },
  ];

  return (
    <aside className="hidden md:block w-60 shrink-0 nav-bg nav-border border-l">
      <div className="sticky top-0 h-screen flex flex-col overflow-y-auto">
      {/* Branding */}
      <div className="p-5 border-b nav-border">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-[#C9A84C] to-[#9B7A2F] rounded-xl flex items-center justify-center font-['Frank_Ruhl_Libre'] text-2xl text-white font-black shrink-0">
            {orgInitial}
          </div>
          <div className="min-w-0">
            <div className="font-['Frank_Ruhl_Libre'] text-sm font-bold nav-text-strong leading-tight">{orgTitle}</div>
            <div className="text-[10px] nav-text mt-0.5 truncate opacity-80">{hebrewDate}</div>
          </div>
        </div>

        {/* Quick summary */}
        {effectiveSummary && (
          <div className="mt-4 nav-surface nav-border rounded-xl p-3 border">
            <div className="text-[10px] nav-text uppercase tracking-wide mb-1 opacity-80">סה"כ תרומות</div>
            <div className="font-['Frank_Ruhl_Libre'] text-xl font-bold nav-text-strong">
              ₪{effectiveSummary.total?.toLocaleString() || 0}
            </div>
            <div className="text-[10px] nav-text opacity-70 mt-0.5">החודש: ₪{effectiveSummary.thisMonthTotal?.toLocaleString() || 0}</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'nav-active border nav-border'
                  : 'nav-text nav-item border border-transparent'
              }`}
            >
              <Icon size={17} />
              {item.label}
              {item.id === 'home' && isActive && (
                <span className="mr-auto w-1.5 h-1.5 rounded-full nav-surface" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="p-4 border-t nav-border space-y-2">
        {addLabel && (
          <button
            onClick={onDonationClick}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-[#C9A84C] to-[#9B7A2F] text-white font-bold py-2.5 rounded-xl text-sm shadow-lg hover:opacity-90 active:scale-95 transition-all"
          >
            <Plus size={16} />
            הוסף {addLabel}
          </button>
        )}
        <button
          onClick={() => refresh()}
          className="w-full flex items-center justify-center gap-2 nav-text opacity-70 hover:opacity-100 py-1.5 rounded-xl text-xs transition-opacity"
        >
          <RefreshCw size={12} />
          רענן נתונים
        </button>
      </div>
      </div>
    </aside>
  );
}
