import React from 'react';
import { Home, Users, CalendarDays, PieChart, CalendarCheck, Settings, ClipboardList, TrendingUp, HandCoins, History, DoorOpen, Target, Image as ImageIcon, BookOpen, CalendarHeart} from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  setTab: (tab: string) => void;
}

// הסרגל נגלל אופקית, ולכן אין תקרה למספר המסכים. חשוב מכך: כל מסך שקיים
// בסיידבר של המחשב חייב להיות גם כאן — מסך שאי אפשר להגיע אליו מהטלפון
// הוא מסך שלא קיים, וזה בדיוק מה שקרה לפרויקטים, לפוסטר ולמדריך.
export function BottomNav({ currentTab, setTab }: BottomNavProps) {
  const navItems = [
    { id: 'home', icon: Home, label: 'דשבורד' },
    { id: 'tasks', icon: ClipboardList, label: 'משימות' },
    { id: 'score', icon: TrendingUp, label: 'פעילות' },
    { id: 'donors', icon: Users, label: 'אנשי קשר' },
    { id: 'homevisits', icon: DoorOpen, label: 'ביקורי בית' },
    { id: 'donations', icon: HandCoins, label: 'תרומות' },
    { id: 'events', icon: CalendarCheck, label: 'אירועים' },
    { id: 'projects', icon: Target, label: 'פרויקטים' },
    { id: 'calendar', icon: CalendarDays, label: 'חגים' },
    { id: 'dates', icon: CalendarHeart, label: 'תאריכים' },
    { id: 'history', icon: History, label: 'היסטוריה' },
    { id: 'reports', icon: PieChart, label: 'דוחות' },
    { id: 'poster', icon: ImageIcon, label: 'פוסטר' },
    { id: 'guide', icon: BookOpen, label: 'מדריך' },
    { id: 'settings', icon: Settings, label: 'הגדרות' },
  ];

  return (
    // הצבעים כאן סמנטיים (nav-bg, nav-text) ולא קשיחים. זה ההבדל בין סרגל
    // שמתחלף עם הערכה לבין סרגל שמקבל "עוד שכבה" מעל אותו כחול.
    <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] nav-bg nav-border flex overflow-x-auto no-scrollbar py-2 pb-6 z-50 border-t">
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`shrink-0 w-[58px] flex flex-col items-center gap-1 p-1 cursor-pointer bg-transparent border-none text-[10px] font-medium transition-colors ${
              isActive ? 'nav-text-strong' : 'nav-text opacity-70'
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
