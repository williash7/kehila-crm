import { useState } from 'react';
import { AppProvider, useAppStore } from './store/AppContext';
import { BottomNav } from './components/BottomNav';
import { SideNav } from './components/SideNav';
import { LoadingScreen } from './components/LoadingScreen';
import { HomeTab } from './components/HomeTab';
import { DonorsTab } from './components/DonorsTab';
import { CalendarTab } from './components/CalendarTab';
import { EventsTab } from './components/EventsTab';
import { ReportsTab } from './components/ReportsTab';
import { PosterTab } from './components/PosterTab';
import { SettingsTab } from './components/SettingsTab';
import { TasksTab } from './components/TasksTab';
import { HomeVisitsTab } from './components/HomeVisitsTab';
import { ScoreTab } from './components/ScoreTab';
import { DonationsTab } from './components/DonationsTab';
import { HistoryTab } from './components/HistoryTab';
import { DonationModal } from './components/DonationModal';
import { ProfileModal } from './components/ProfileModal';
import { SetupWizard } from './components/SetupWizard';
import { isConfigured } from './lib/orgConfig';

// תווית לכפתור "+" הגלובלי (FAB במובייל, "הוסף X" בסיידבר) לפי המסך הפעיל.
// מסכים שלא ברשימה (דוחות, פוסטר, הגדרות) — אין פעולת "הוספה" משמעותית, הכפתור מוסתר בהם.
const ADD_LABELS: Record<string, string> = {
  home: 'תרומה',
  donors: 'איש קשר',
  tasks: 'משימה',
  events: 'אירוע',
  calendar: 'חג מותאם',
  homevisits: 'מערך ביקורים',
};

function AppContent() {
  const { loading, loadingText, apiError } = useAppStore();
  const [activeTab, setActiveTab] = useState('home');
  const [isDonationOpen, setIsDonationOpen] = useState(false);
  const [scoreOpenContact, setScoreOpenContact] = useState<string | null>(null);
  // { tab, count } — לחיצה על "+" הגלובלי מעדכנת את זה, וכל מסך שמאזין (donors/tasks/events/calendar)
  // פותח את מודל ההוספה שלו כשה-tab תואם לו. count משתנה בכל לחיצה כדי שאפשר יהיה לפתוח שוב אחרי סגירה.
  const [addTrigger, setAddTrigger] = useState<{ tab: string; count: number }>({ tab: '', count: 0 });

  const requestAdd = () => {
    if (activeTab === 'home') { setIsDonationOpen(true); return; }
    if (!(activeTab in ADD_LABELS)) return;
    setAddTrigger({ tab: activeTab, count: Date.now() });
  };

  // כמו requestAdd אבל לטאב נתון בלי קשר לטאב הפעיל כרגע — לשימוש בכפתורי
  // "פעולות מהירות" בדשבורד, שצריכים לנווט לטאב היעד ולפתוח את מודל ההוספה
  // שלו בפעולה אחת.
  const requestAddFor = (tab: string) => {
    if (tab === 'home') { setIsDonationOpen(true); return; }
    setActiveTab(tab);
    setAddTrigger({ tab, count: Date.now() });
  };

  if (loading) {
    return <LoadingScreen text={loadingText} />;
  }

  return (
    <div className="min-h-screen font-sans bg-[#FAF6EE]" dir="rtl">
      {apiError && (
        <div className="bg-red-500 text-white p-3 text-sm font-bold text-center w-full z-50 shadow-md">
          ⚠️ שגיאת חיבור לסנכרון נתונים
          <div className="text-xs font-normal mt-1 bg-red-600 p-2 rounded-md opacity-90">{apiError}</div>
          <div className="text-xs font-normal mt-1 opacity-90">האפליקציה פועלת במצב מידע הדגמה חלקי מקומי.</div>
        </div>
      )}

      {/* md+: flex row — in RTL the sidebar (first child) appears on the RIGHT */}
      <div className="md:flex min-h-screen">
        <SideNav currentTab={activeTab} setTab={setActiveTab} onDonationClick={requestAdd} addLabel={ADD_LABELS[activeTab]} />

        <main className="flex-1 min-w-0 pb-20 md:pb-6">
          {activeTab === 'home' && <HomeTab setTab={setActiveTab} onDonationClick={() => setIsDonationOpen(true)} onQuickAdd={requestAddFor} />}
          {activeTab === 'donors' && <DonorsTab addTrigger={addTrigger} />}
          {activeTab === 'homevisits' && <HomeVisitsTab addTrigger={addTrigger} />}
          {activeTab === 'donations' && <DonationsTab />}
          {activeTab === 'events' && <EventsTab addTrigger={addTrigger} />}
          {activeTab === 'calendar' && <CalendarTab addTrigger={addTrigger} />}
          {activeTab === 'history' && <HistoryTab />}
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'poster' && <PosterTab onClose={() => setActiveTab('home')} />}
          {activeTab === 'tasks' && <TasksTab setTab={setActiveTab} addTrigger={addTrigger} />}
          {activeTab === 'score' && <ScoreTab onContactClick={setScoreOpenContact} />}
          {activeTab === 'settings' && <SettingsTab />}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav currentTab={activeTab} setTab={setActiveTab} />

      {isDonationOpen && <DonationModal onClose={() => setIsDonationOpen(false)} />}
      {scoreOpenContact && <ProfileModal name={scoreOpenContact} onClose={() => setScoreOpenContact(null)} />}
    </div>
  );
}

export default function App() {
  // בכניסה ראשונה (או אחרי איפוס הגדרות) מציגים את אשף ההגדרה במקום
  // האפליקציה. רק כשיש הגדרות ארגון תקינות ה-AppProvider מתחיל לטעון
  // נתונים — כדי שלא ננסה לפנות לגיליון שעדיין לא הוגדר.
  if (!isConfigured()) {
    return <SetupWizard onDone={() => window.location.reload()} />;
  }

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}


