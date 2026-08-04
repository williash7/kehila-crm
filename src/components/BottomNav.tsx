import React from 'react';
import { Home, Users, CalendarDays, PieChart, CalendarCheck, Settings, ClipboardList, TrendingUp, HandCoins, History, DoorOpen } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  setTab: (tab: string) => void;
}

export function BottomNav({ currentTab, setTab }: BottomNavProps) {
  const navItems = [
    { id: 'home', icon: Home, label: 'דשבורד' },
    { id: 'tasks', icon: ClipboardList, label: 'משימות' },
    { id: 'score', icon: TrendingUp, label: 'פעילות' },
    { id: 'donors', icon: Users, label: 'אנשי קשר' },
    { id: 'homevisits', icon: DoorOpen, label: 'ביקורי בית' },
    { id: 'donations', icon: HandCoins, label: 'תרומות' },
    { id: 'events', icon: CalendarCheck, label: 'אירועים' },
    { id: 'calendar', icon: CalendarDays, label: 'חגים' },
    { id: 'history', icon: History, label: 'היסטוריה' },
    { id: 'reports', icon: PieChart, label: 'דוחות' },
    { id: 'settings', icon: Settings, label: 'הגדרות' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[#0D1B2A] flex overflow-x-auto no-scrollbar py-2 pb-6 z-50 border-t border-[rgba(201,168,76,0.15)]">
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`shrink-0 w-[58px] flex flex-col items-center gap-1 p-1 cursor-pointer bg-transparent border-none text-[10px] font-medium transition-colors ${
              isActive ? 'text-[#C9A84C]' : 'text-white/35'
            }`}
          >
            <Icon size={20} className={`transition-transform ${isActive ? 'scale-110' : ''}`} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
