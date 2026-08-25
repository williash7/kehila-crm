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
import { ProjectsTab } from './components/ProjectsTab';
import { GuideTab } from './components/GuideTab';
import { TasksTab } from './components/TasksTab';
import { HomeVisitsTab } from './components/HomeVisitsTab';
import { ScoreTab } from './components/ScoreTab';
import { DonationsTab } from './components/DonationsTab';
import { HistoryTab } from './components/HistoryTab';
import { FinanceTab } from './components/FinanceTab';
import { DonationModal } from './components/DonationModal';
import { AllDatesModal } from './components/AllDatesModal';
import { ScriptVersionBanner } from './components/ScriptVersionBanner';
import { PendingWritesBanner } from './components/PendingWritesBanner';
import { ProfileModal } from './components/ProfileModal';
import { SetupWizard } from './components/SetupWizard';
import { SignInScreen } from './components/SignInScreen';
import { isConfigured } from './lib/orgConfig';
import { DataOnboardingWizard } from './components/DataOnboardingWizard';
import { shouldShowDataOnboarding } from './lib/dataOnboarding';
import { GlobalSearchTab } from './components/GlobalSearchTab';
import { GlobalSearchResult } from './lib/globalSearch';
import { OpenTarget } from './lib/openTarget';
import { QuickInboxTab } from './components/QuickInboxTab';
import { DailyReminderAgent } from './components/DailyReminderAgent';

// תווית לכפתור "+" הגלובלי (FAB במובייל, "הוסף X" בסיידבר) לפי המסך הפעיל.
// מסכים שלא ברשימה (דוחות, פוסטר, הגדרות) — אין פעולת "הוספה" משמעותית, הכפתור מוסתר בהם.
const ADD_LABELS: Record<string, string> = {
  home: 'תרומה',
  donors: 'איש קשר',
  tasks: 'משימה',
  events: 'פעילות',
  projects: 'קמפיין',
  calendar: 'חג מותאם',
  homevisits: 'מערך ביקורים',
  donations: 'תרומה',
};

function AppContent() {
  const { loading, loadingText, apiError } = useAppStore();
  const [activeTab, setActiveTab] = useState('home');
  const [isDonationOpen, setIsDonationOpen] = useState(false);
  // מי פתח את כרטיס איש הקשר — כדי שכפתור החזרה יאמר את האמת.
  //
  // המצב הזה נוצר במקור עבור מסך הניקוד, והתווית הייתה מקובעת ל„ניקוד”.
  // כשהחיפוש התחיל להשתמש בו מחדש, מי שהגיע לכרטיס מהחיפוש קיבל הצעה
  // לחזור למסך שלא היה בו מעולם.
  const [openContact, setOpenContact] = useState<{ name: string; from: 'score' | 'search' } | null>(null);
  const [openTarget, setOpenTarget] = useState<OpenTarget | null>(null);
  const [dataOnboardingOpen, setDataOnboardingOpen] = useState(() => shouldShowDataOnboarding());
  // { tab, count } — לחיצה על "+" הגלובלי מעדכנת את זה, וכל מסך שמאזין (donors/tasks/events/calendar)
  // פותח את מודל ההוספה שלו כשה-tab תואם לו. count משתנה בכל לחיצה כדי שאפשר יהיה לפתוח שוב אחרי סגירה.
  const [addTrigger, setAddTrigger] = useState<{ tab: string; count: number }>({ tab: '', count: 0 });

  const requestAdd = () => {
    if (activeTab === 'home' || activeTab === 'donations') { setIsDonationOpen(true); return; }
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

  // ── מתוצאת חיפוש אל הפריט עצמו ──
  //
  // הגרסה הראשונה החליפה לשונית וזרקה את `entityId`, כך שלחיצה על תרומה
  // הביאה את המשתמש לרשימת התרומות **בלי סינון ובלי סימון** — והוא היה
  // צריך לחפש אותה שוב. כאן המזהה עובר הלאה, ועם המשימה גם ה-`parentId`
  // כדי שההקשר (חג או פעילות) יישמר.
  const TARGET_TABS: Record<string, string> = {
    donations: 'donations', activities: 'events', campaigns: 'projects', tasks: 'tasks',
  };

  const openSearchResult = (result: GlobalSearchResult) => {
    if (result.kind === 'contact') {
      setOpenContact({ name: result.target.entityId, from: 'search' });
      return;
    }
    const tab = TARGET_TABS[result.target.tab];
    if (!tab) return;   // סוג לא מוכר — עדיף לא לזוז מאשר לזרוק את המשתמש לדשבורד
    setActiveTab(tab);
    setOpenTarget({ id: result.target.entityId, parentId: result.target.parentId, count: Date.now() });
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

      <PendingWritesBanner />

      <DailyReminderAgent />

      <ScriptVersionBanner />

      {/* md+: flex row — in RTL the sidebar (first child) appears on the RIGHT */}
      <div className="md:flex min-h-screen">
        <SideNav currentTab={activeTab} setTab={setActiveTab} onDonationClick={requestAdd} addLabel={ADD_LABELS[activeTab]} />

        <main className="flex-1 min-w-0 pb-20 md:pb-6">
          {activeTab === 'home' && <HomeTab setTab={setActiveTab} onDonationClick={() => setIsDonationOpen(true)} onQuickAdd={requestAddFor} />}
          {activeTab === 'search' && <GlobalSearchTab onNavigate={openSearchResult} />}
          {activeTab === 'inbox' && <QuickInboxTab />}
          {activeTab === 'donors' && <DonorsTab addTrigger={addTrigger} />}
          {activeTab === 'homevisits' && <HomeVisitsTab addTrigger={addTrigger} />}
          {activeTab === 'donations' && <DonationsTab onAddDonation={() => setIsDonationOpen(true)} openTarget={openTarget} />}
          {activeTab === 'finance' && <FinanceTab />}
          {activeTab === 'events' && <EventsTab addTrigger={addTrigger} openTarget={openTarget} />}
          {activeTab === 'calendar' && <CalendarTab addTrigger={addTrigger} />}
          {/* "תאריכים" הוא מסך מלא בפני עצמו — נפתח כטאב, ונסגר חזרה לדשבורד */}
          {activeTab === 'dates' && <AllDatesModal onClose={() => setActiveTab('home')} />}
          {activeTab === 'history' && <HistoryTab />}
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'poster' && <PosterTab onClose={() => setActiveTab('home')} />}
          {/*
            משימות מקבלות ניווט ללשונית בלבד, בכוונה.
            ─────────────────────────────────────────────────────────────────
            למשימה אין מזהה יציב: `globalSearch` נופל ל-`${parent.id}:${index}`
            כשאין `id`, ומיקום ברשימה משתנה בכל סינון או מיון. סימון לפי מזהה
            כזה היה מדגיש **את המשימה הלא נכונה** — וזה גרוע יותר מלא להדגיש
            כלום.
            דיווחתי ליוסי; מזהה יציב למשימה הוא תנאי מקדים.
          */}
          {activeTab === 'tasks' && <TasksTab setTab={setActiveTab} addTrigger={addTrigger} />}
          {activeTab === 'score' && <ScoreTab onContactClick={name => setOpenContact({ name, from: 'score' })} />}
          {activeTab === 'projects' && <ProjectsTab addTrigger={addTrigger} openTarget={openTarget} />}
          {activeTab === 'guide' && <GuideTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav currentTab={activeTab} setTab={setActiveTab} />

      {isDonationOpen && <DonationModal onClose={() => setIsDonationOpen(false)} />}
      {openContact && (
        <ProfileModal
          name={openContact.name}
          onClose={() => setOpenContact(null)}
          backLabel={openContact.from === 'search' ? 'חיפוש' : 'ניקוד'}
        />
      )}
      {dataOnboardingOpen && <DataOnboardingWizard onDone={() => setDataOnboardingOpen(false)} />}
    </div>
  );
}

export default function App() {
  // שלושה מצבים לפני שהאפליקציה נטענת:
  //   1. יש הגדרות תקינות → ישר לאפליקציה
  //   2. אין הגדרות ומחובר לגוגל → הן ייטענו מהחשבון, בלי אשף
  //   3. אין כלום → מסך כניסה, ואז האשף
  //
  // ה-AppProvider מתחיל לטעון נתונים רק כשיש הגדרות, כדי שלא ננסה לפנות
  // לגיליון שעדיין לא הוגדר.
  const [stage, setStage] = useState<'signin' | 'wizard' | 'ready'>(
    () => (isConfigured() ? 'ready' : 'signin')
  );

  if (stage === 'signin') {
    return (
      <SignInScreen
        onReady={() => window.location.reload()}
        onManual={() => setStage('wizard')}
      />
    );
  }

  if (stage === 'wizard') {
    return <SetupWizard onDone={() => window.location.reload()} />;
  }

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
