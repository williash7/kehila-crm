import React, { useState } from 'react';
import { useAppStore } from '../store/AppContext';
import { Settings as SettingsIcon, RotateCcw, History, Loader2, ChevronDown, ChevronRight, Bot, Rocket } from 'lucide-react';
import { GlobalAIImportModal } from './GlobalAIImportModal';
import { MigrateYahrzeitsModal } from './MigrateYahrzeitsModal';
import { DatesRescueModal } from './DatesRescueModal';
import { SystemStatusCard } from './SystemStatusCard';
import { BackupCard } from './BackupCard';
import { ALL_CIRCLES, CIRCLE_LABELS, DEFAULT_SETTINGS } from '../lib/settings';
import { computeMissingAttendanceContacts } from '../lib/backfillContacts';
import { collectLegacyYahrzeits } from '../lib/family';
import { AppearanceCard } from './AppearanceCard';
import { CardTitle, Explain } from './Explain';
import { addMeetingQueued } from '../lib/api';
import { getOrg, resetOrg } from '../lib/orgConfig';
import { SetupWizard } from './SetupWizard';
import { HolidayCategory, CATEGORY_LABEL, CATEGORY_HINT, groupHolidayNames } from '../lib/holidayFilter';
import { isSignedIn, signOut, currentAccount, isGoogleLoginAvailable } from '../lib/googleAuth';
import { deleteConfigFromDrive } from '../lib/driveConfig';
import { DataOnboardingWizard } from './DataOnboardingWizard';
import { NavigationSettingsCard } from './NavigationSettingsCard';
import { AuditLogCard } from './AuditLogCard';
import { DailyReminderCard } from './DailyReminderCard';
import type { SettingsTarget, SettingsGroupId } from '../lib/featureCatalog';
import { useRevealEntity } from '../lib/openTarget';

// ─────────────────────────────────────────────────────────────────────────────
// בפתיחה מוצגות קטגוריות בלבד. לחיצה נכנסת לעמוד ההגדרות הרלוונטי,
// וכפתור חזרה מחזיר למסך הקטגוריות — בלי רשימה ארוכה ובלי לשוניות צפופות.
// ─────────────────────────────────────────────────────────────────────────────

const SETTINGS_GROUPS: { id: SettingsGroupId; label: string; icon: string; hint: string }[] = [
  { id: 'organization', label: 'ארגון',      icon: '🏠', hint: 'פרטי הארגון, חיבור, תרומות וכספים' },
  { id: 'navigation',   label: 'ניווט',      icon: '🧭', hint: 'הסרגל בטלפון, לוח שנה ותצוגת משימות' },
  { id: 'appearance',   label: 'מראה',       icon: '🎨', hint: 'צבעים, סגנון, גודל וכרטיסי הדשבורד' },
  { id: 'people',       label: 'אנשים',      icon: '👥', hint: 'מעגלי קרבה ומי יוצג ברחבי האפליקציה' },
  { id: 'data',         label: 'מידע וכלים', icon: '🧰', hint: 'גיבוי, ייבוא, אבחון וחיבורים מתקדמים' },
];

export interface SettingsOpenTarget extends SettingsTarget { count: number }

export function SettingsTab({ openTarget, onOpenTargetConsumed }: {
  openTarget?: SettingsOpenTarget | null;
  onOpenTargetConsumed?: () => void;
} = {}) {
  const [group, setGroup] = useState<SettingsGroupId | null>(null);
  const currentGroup = SETTINGS_GROUPS.find(item => item.id === group);

  const { settings, updateSettings, donors, visibleDonors, eventsData, holidayExtras, donations, crm, refresh, holidays, summary } = useAppStore();
  const org = getOrg();
  const vis = settings.holidayVisibility;
  const [openCat, setOpenCat] = useState<HolidayCategory | null>(null);
  const holidayNames = React.useMemo(() => groupHolidayNames(holidays), [holidays]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [dataWizardOpen, setDataWizardOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [migrateOpen, setMigrateOpen] = useState(false);
  const [rescueOpen, setRescueOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  React.useEffect(() => {
    if (openTarget?.group) setGroup(openTarget.group);
  }, [openTarget?.group, openTarget?.count]);

  useRevealEntity(
    openTarget ? { id: `settings-${openTarget.section}`, count: openTarget.count } : null,
    !!openTarget?.section,
    onOpenTargetConsumed,
  );

  // ── מה מהכלים המתקדמים בכלל רלוונטי כאן ואיפה ──────────────────────────
  //
  // חלק מהמסכים באפליקציה נולדו מתקלה ספציפית ולא ממשהו שמשתמש חדש צריך:
  // העברת היארצייטים למבנה החדש, האבחון "איפה התאריכים שלי", והשלמת
  // נוכחויות עבר. הם לא מיותרים — הם פשוט לא רלוונטיים לרוב המסכים ולרוב
  // הזמן, ובהגדרות הם תפסו שלושה כרטיסים במשקל שווה לכל השאר.
  //
  // הפתרון: הם מופיעים **רק כשיש להם מה לעשות**, ומה שנשאר יושב תחת סעיף
  // מקופל. שום פונקציונליות לא נמחקה.
  const legacyYahrzeitCount = React.useMemo(() => {
    let n = 0;
    Object.keys(donors).forEach(name => {
      const fields = { ...(donors[name] as any), ...((crm as any)[name]?.customFields || {}) };
      n += collectLegacyYahrzeits(fields).length;
    });
    return n;
  }, [donors, crm]);

  const missingAttendance = React.useMemo(
    () => computeMissingAttendanceContacts(eventsData, holidayExtras, donations).length,
    [eventsData, holidayExtras, donations]
  );

  const runAttendanceBackfill = async () => {
    const missing = computeMissingAttendanceContacts(eventsData, holidayExtras, donations);
    if (missing.length === 0) {
      setSyncResult('לא נמצאו רשומות נוכחות חסרות — הכול כבר מסונכרן.');
      return;
    }
    const confirmed = window.confirm(
      `נמצאו ${missing.length} רשומות נוכחות (מאירועים וחגים) שעדיין אין להן רישום "יצירת קשר" תואם.\n\nלרשום את כולן עכשיו כיצירת קשר? הפעולה עלולה לקחת כמה רגעים.`
    );
    if (!confirmed) return;

    setIsSyncing(true);
    setSyncResult(null);
    setSyncProgress({ done: 0, total: missing.length });
    let successCount = 0;
    // מי שנכנס לתור נספר בנפרד. מסך שמדווח „נוצרו 40 רשומות” חייב לומר
    // את האמת: 40 **אושרו**, ועוד כמה ממתינות לשליחה. ערבוב השניים היה
    // הופך את המספר המדווח למספר שאי אפשר לסמוך עליו.
    let queuedCount = 0;
    const failedNames: string[] = [];

    // רץ ברצף (לא במקביל) כדי לא להעמיס על ה-Apps Script שמריץ בקשה אחת בכל פעם.
    for (let i = 0; i < missing.length; i++) {
      const m = missing[i];
      try {
        const outcome = await addMeetingQueued({
          name: m.name,
          date: m.date,
          meetType: m.meetType,
          purpose: m.purpose,
          notes: m.notes,
          nextMeet: ''
        });
        if (outcome.status === 'failed') failedNames.push(`${m.name} (${m.date})`);
        else if (outcome.status === 'queued') queuedCount++;
        else successCount++;
      } catch {
        failedNames.push(`${m.name} (${m.date})`);
      }
      setSyncProgress({ done: i + 1, total: missing.length });
    }

    refresh();
    setIsSyncing(false);
    const waiting = queuedCount > 0 ? ` ${queuedCount} ממתינות לשליחה ויישלחו לבד.` : '';
    setSyncResult(
      failedNames.length === 0
        ? `✓ הושלם: נוצרו ${successCount} רשומות יצירת קשר חדשות.${waiting}`
        : `נוצרו ${successCount} רשומות.${waiting} לא נשמרו ${failedNames.length}: ${failedNames.slice(0, 10).join(', ')}${failedNames.length > 10 ? '...' : ''}`
    );
  };

  const toggleCircle = (circle: string) => {
    const has = settings.visibleCircles.includes(circle);
    const next = has
      ? settings.visibleCircles.filter(c => c !== circle)
      : [...settings.visibleCircles, circle];
    updateSettings({ visibleCircles: next });
  };

  const total = Object.keys(donors).length;
  const visible = Object.keys(visibleDonors).length;

  const toggles: { key: keyof typeof settings; label: string; hint: string }[] = [
    { key: 'addressOnly', label: 'רק עם כתובת', hint: 'מציג רק אנשי קשר שיש להם כתובת מלאה — שימושי במיוחד למפה ולתכנון מסלולים' },
    { key: 'phoneOnly', label: 'רק עם טלפון', hint: 'מציג רק אנשי קשר עם מספר טלפון — שימושי לפני קמפיין שיחות/וואטסאפ' },
    { key: 'donorsOnly', label: 'רק מי שתרם בפועל', hint: 'מסתיר אנשי קשר שנוספו למערכת אך מעולם לא תרמו' },
    { key: 'targetOnly', label: 'רק מסומנים "🎯 להקרב"', hint: 'מציג רק אנשי קשר שסימנת שברצונך להתקרב אליהם' },
  ];

  return (
    <div className="animate-in fade-in pb-24 md:pb-6">
      {/* Topbar */}
      <div className="bg-[#0D1B2A] px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="w-9 h-9 bg-gradient-to-br from-[#C9A84C] to-[#9B7A2F] rounded-lg flex items-center justify-center shrink-0 md:hidden">
          <SettingsIcon size={20} className="text-white" />
        </div>
        <div className="flex-1 px-3 md:px-0">
          <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#C9A84C]">הגדרות</div>
          <div className="text-[11px] text-white/45 mt-[1px]">קובעות מה יוצג בכל מסכי האפליקציה</div>
        </div>
        <button
          onClick={() => updateSettings(DEFAULT_SETTINGS)}
          className="flex items-center gap-1.5 px-3 h-9 bg-white/10 text-white/80 rounded-full text-xs font-bold shrink-0 hover:bg-white/20 transition-colors"
        >
          <RotateCcw size={13} /> איפוס
        </button>
      </div>

      <div className="p-4 md:p-6 max-w-2xl space-y-5">
        {group === null ? (
          <div>
            <div className="mb-4">
              <h2 className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A]">מה ברצונך להגדיר?</h2>
              <p className="text-xs text-gray-500 mt-1">בחר קטגוריה. במסך הבא יופיעו רק ההגדרות ששייכות אליה.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {SETTINGS_GROUPS.map(item => (
                <button key={item.id} onClick={() => setGroup(item.id)} className="bg-white rounded-2xl border border-[#EDE6D6] p-4 text-right shadow-sm hover:border-[#C9A84C] transition-colors flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl bg-[#FAF6EE] flex items-center justify-center text-xl shrink-0">{item.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">{item.label}</span>
                    <span className="block text-[11px] text-gray-500 leading-relaxed mt-0.5">{item.hint}</span>
                  </span>
                  <ChevronRight size={17} className="text-gray-300 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (<>
        <div className="sticky top-[60px] z-40 bg-[#FAF6EE]/95 backdrop-blur border-b border-[#EDE6D6] -mx-4 md:-mx-6 px-4 md:px-6 py-3 flex items-center gap-3">
          <button onClick={() => setGroup(null)} className="w-9 h-9 rounded-full bg-white border border-[#EDE6D6] flex items-center justify-center text-[#0D1B2A] shrink-0" aria-label="חזרה לקטגוריות"><ChevronRight size={18} /></button>
          <div>
            <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">{currentGroup?.icon} {currentGroup?.label}</div>
            <div className="text-[10px] text-gray-500">{currentGroup?.hint}</div>
          </div>
        </div>

        {group === 'organization' && (<>
        {/* התשובה ל"האם הכול מעודכן?" — ראשונה, כי זו השאלה הראשונה
            שנשאלת כשמשהו לא מתנהג כמצופה */}
        <div data-entity-id="settings-system-status"><SystemStatusCard /></div>
        <div data-entity-id="settings-daily-reminder"><DailyReminderCard /></div>
        {/* פרטי הארגון — נקבעים באשף ההגדרה, וניתנים לעריכה כאן בכל עת */}
        <div data-entity-id="settings-organization" className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6]">
          <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] mb-1">הארגון שלי</h3>
          <div className="text-sm text-gray-600 leading-relaxed mb-3">
            <div><b>{org.orgName.he || '— לא הוגדר —'}</b></div>
            {org.city && <div className="text-xs text-gray-400">{[org.address, org.city].filter(Boolean).join(', ')}</div>}
            <div className="text-xs text-gray-400 mt-1">
              {org.gsUrl ? '✓ מחובר לגיליון Google' : '⚠ לא מחובר לגיליון — הנתונים לא נשמרים'}
            </div>
            {/* גרסת הסקריפט שהגיליון באמת מריץ.
                Apps Script מגיש תמונת מצב מרגע הפריסה, ולכן קוד שנשמר אבל
                לא נפרס נראה מעודכן בעורך ומיושן בפועל. כאן רואים את האמת. */}
            {summary?.codeVersion && (
              <div className="text-xs text-gray-400 mt-0.5">
                גרסת הסקריפט בגיליון: <b className="text-gray-500">{summary.codeVersion}</b>
              </div>
            )}
            {isGoogleLoginAvailable() && (
              <div className="text-xs text-gray-400 mt-0.5">
                {isSignedIn()
                  ? `✓ מחובר כ-${currentAccount() || 'חשבון גוגל'} · ההגדרות נשמרות לחשבון`
                  : '○ לא מחובר לחשבון גוגל — במכשיר חדש תצטרך להגדיר שוב'}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setWizardOpen(true)}
              className="flex-1 py-2 rounded-xl bg-[#0D1B2A] text-white text-sm font-bold hover:bg-[#1a2d44] transition-colors"
            >
              ערוך פרטי ארגון
            </button>
            <button
              onClick={() => {
                if (window.confirm('לנתק את האפליקציה מהארגון הנוכחי?\n\nההגדרות יימחקו מהמכשיר הזה ומחשבון הגוגל, והאפליקציה תחזור למסך הכניסה. הנתונים בגיליון Google לא יימחקו.')) {
                  // מנקים גם את ההגדרות ששמורות בחשבון, אחרת כניסה חוזרת
                  // הייתה מחזירה אותן מיד ו"ניתוק" לא היה מנתק כלום.
                  const done = () => { resetOrg(); signOut(); window.location.reload(); };
                  if (isSignedIn()) deleteConfigFromDrive().then(done, done);
                  else done();
                }
              }}
              className="px-4 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-bold hover:bg-red-100 transition-colors"
            >
              נתק
            </button>
          </div>
        </div>
        <div data-entity-id="settings-data-onboarding" className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-[#C9A84C]/15 text-[#9B7A2F] flex items-center justify-center shrink-0"><Rocket size={18} /></span>
            <CardTitle title="קליטת נתוני התחלה">
              חוזרים לאשף השאלות או מכינים שיחת AI עם קבצים. אפשר להשתמש בו גם בהמשך כדי להוסיף מידע חדש; מידע קיים אינו נמחק.
            </CardTitle>
          </div>
          <button onClick={() => setDataWizardOpen(true)} className="w-full bg-[#0D1B2A] text-white rounded-xl py-2.5 text-sm font-bold">
            פתח את אשף קליטת הנתונים
          </button>
        </div>
        <div data-entity-id="settings-donation-range" className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
          <CardTitle title="טווח תאריכים לסכומי תרומות">
            קובע מאיזה תאריך סופרים תרומות בכל הסכומים באפליקציה — בדשבורד, אצל אנשי
            הקשר ובדוחות. השארה ריקה = מתחילת השנה הנוכחית.
          </CardTitle>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={settings.donationsSinceDate}
              onChange={e => updateSettings({ donationsSinceDate: e.target.value })}
              className="flex-1 bg-gray-50 border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C]"
            />
            {settings.donationsSinceDate && (
              <button
                onClick={() => updateSettings({ donationsSinceDate: '' })}
                className="shrink-0 px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors"
              >
                נקה (מתחילת השנה)
              </button>
            )}
          </div>
          {settings.donationsSinceDate ? (
            <div className="text-[11px] text-[#9B7A2F] font-semibold">
              ✓ כרגע מוצגות תרומות מ-{new Date(settings.donationsSinceDate).toLocaleDateString('he-IL')} ואילך בלבד
            </div>
          ) : (
            <div className="text-[11px] text-[#9B7A2F] font-semibold">
              ✓ כרגע מוצגות תרומות מתחילת {new Date().getFullYear()} ואילך (ברירת מחדל)
            </div>
          )}
        </div>
        <div data-entity-id="settings-payment-statuses" className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
          <CardTitle title="מצבי תשלום והתאמה חודשית">
            מוסיף למסך התרומות תצוגת בקרה לקריאות בלבד: התקבל, עתידי, נכשל ומבוטל,
            וכלי להשוואת דוח חודשי מנדרים. הסכומים והדוחות הקיימים אינם משתנים.
          </CardTitle>
          <button
            type="button"
            onClick={() => updateSettings({ showPaymentStatuses: !settings.showPaymentStatuses })}
            className="w-full flex items-center justify-between gap-3 text-right"
            aria-pressed={settings.showPaymentStatuses}
          >
            <span className="min-w-0">
              <span className="block text-sm font-bold text-[#0D1B2A]">
                {settings.showPaymentStatuses ? 'התצוגה פעילה' : 'הצג תצוגת בקרה בתרומות'}
              </span>
              <span className="block text-[11px] text-gray-500 mt-0.5">
                כבוי כברירת מחדל ונשמר במכשיר הזה בלבד
              </span>
            </span>
            <span className={`w-[46px] h-[26px] rounded-full relative transition-colors shrink-0 ${settings.showPaymentStatuses ? 'bg-[#C9A84C]' : 'bg-[#EDE6D6]'}`}>
              <span className={`w-[22px] h-[22px] bg-white rounded-full absolute top-[2px] shadow transition-all ${settings.showPaymentStatuses ? 'left-[2px]' : 'right-[2px]'}`} />
            </span>
          </button>
        </div>
        <div data-entity-id="settings-finance-center" className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
          <CardTitle title="מרכז כספי">
            מסך נפרד לניהול הוצאות, התחייבויות, תזרים, התחשבנות אישית ותקציבי
            אירועים. הפעלתו אינה משנה את התרומות, התקציבים או הדוחות הקיימים.
          </CardTitle>
          <button
            type="button"
            onClick={() => updateSettings({ showFinanceCenter: !settings.showFinanceCenter })}
            className="w-full flex items-center justify-between gap-3 text-right"
            aria-pressed={settings.showFinanceCenter}
          >
            <span className="min-w-0">
              <span className="block text-sm font-bold text-[#0D1B2A]">
                {settings.showFinanceCenter ? 'המרכז הכספי פעיל' : 'הצג מרכז כספי'}
              </span>
              <span className="block text-[11px] text-gray-500 mt-0.5">
                כבוי כברירת מחדל; כשהוא פעיל נוסף פריט „כספים” בניווט
              </span>
            </span>
            <span className={`w-[46px] h-[26px] rounded-full relative transition-colors shrink-0 ${settings.showFinanceCenter ? 'bg-[#C9A84C]' : 'bg-[#EDE6D6]'}`}>
              <span className={`w-[22px] h-[22px] bg-white rounded-full absolute top-[2px] shadow transition-all ${settings.showFinanceCenter ? 'left-[2px]' : 'right-[2px]'}`} />
            </span>
          </button>
        </div>
        </>)}

        {group === 'appearance' && (<>
        <div data-entity-id={`settings-${openTarget?.section === 'dashboard-cards' ? 'dashboard-cards' : 'appearance'}`}>
          <AppearanceCard targetSection={openTarget?.section} />
        </div>
        </>)}

        {group === 'navigation' && (<>
        <div data-entity-id="settings-bottom-navigation"><NavigationSettingsCard /></div>
        {/* אילו חגים מוצגים בלוח */}
        <div data-entity-id="settings-holiday-visibility" className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6]">
          <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] mb-1">חגים ותאריכים בלוח</h3>
          <div className="flex justify-end">
            <Explain>
              מכבים קטגוריה שלמה, ובתוך קטגוריה דלוקה אפשר לכבות תאריך בודד.
              כיבוי מסתיר מהתצוגה בלבד — שום נתון שרשמת לא נמחק.
            </Explain>
          </div>

          <div className="space-y-2">
            {(Object.keys(CATEGORY_LABEL) as HolidayCategory[]).map(cat => {
              const on = vis.categories?.[cat] !== false;
              const names = holidayNames[cat] || [];
              const expanded = openCat === cat;
              return (
                <div key={cat} className="border border-[#EDE6D6] rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 p-3">
                    <button
                      onClick={() => updateSettings({
                        holidayVisibility: { ...vis, categories: { ...vis.categories, [cat]: !on } },
                      })}
                      className={`w-10 h-6 rounded-full shrink-0 transition-colors relative ${on ? 'bg-[#C9A84C]' : 'bg-gray-200'}`}
                      aria-label={CATEGORY_LABEL[cat]}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${on ? 'right-0.5' : 'right-4.5'}`} />
                    </button>
                    <button
                      onClick={() => setOpenCat(expanded ? null : cat)}
                      className="flex-1 text-right min-w-0"
                      disabled={!on || names.length === 0}
                    >
                      <div className={`text-sm font-bold ${on ? 'text-[#0D1B2A]' : 'text-gray-400'}`}>
                        {CATEGORY_LABEL[cat]}
                        {names.length > 0 && <span className="text-[10px] font-normal text-gray-400"> · {names.length}</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">{CATEGORY_HINT[cat]}</div>
                    </button>
                    {on && names.length > 0 && (
                      <ChevronDown size={15} className={`text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    )}
                  </div>

                  {expanded && on && (
                    <div className="border-t border-[#EDE6D6] bg-[#FAF6EE] p-2 flex flex-wrap gap-1.5">
                      {names.map(name => {
                        const hidden = (vis.hiddenNames || []).includes(name);
                        return (
                          <button
                            key={name}
                            onClick={() => updateSettings({
                              holidayVisibility: {
                                ...vis,
                                hiddenNames: hidden
                                  ? vis.hiddenNames.filter(n => n !== name)
                                  : [...(vis.hiddenNames || []), name],
                              },
                            })}
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                              hidden ? 'bg-white text-gray-300 line-through border border-[#EDE6D6]' : 'bg-[#C9A84C]/15 text-[#9B7A2F]'
                            }`}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div data-entity-id="settings-task-view" className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
          <div>
            <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">תצוגת ברירת מחדל למשימות</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">איזו תצוגה נפתחת כשנכנסים לטאב "משימות"</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'grouped', label: '📁 לפי קטגוריה' },
              { key: 'flat', label: '📋 רשימה אחת' },
              { key: 'calendar', label: '📆 לוח שנה' },
            ] as const).map(o => (
              <button
                key={o.key}
                onClick={() => updateSettings({ defaultTaskView: o.key })}
                className={`p-2.5 rounded-xl border-2 text-center text-xs font-semibold transition-colors ${
                  settings.defaultTaskView === o.key ? 'bg-[#D1FAE5] border-[#10B981] text-[#0D1B2A]' : 'bg-white border-[#EDE6D6] text-gray-400'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        </>)}

        {group === 'people' && (<>
        <div data-entity-id="settings-people-filters" className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6]">
          <div className="text-sm text-gray-600">
            מציג <span className="font-bold text-[#0D1B2A]">{visible}</span> מתוך <span className="font-bold text-[#0D1B2A]">{total}</span> אנשי קשר
          </div>
          <div className="flex justify-end">
            <Explain label="על מה ההגדרות האלה משפיעות">
              קובעות אילו אנשי קשר מופיעים ברשימות ובהמלצות בכל האפליקציה. הן
              <b> לא</b> משפיעות על סכומי הכסף בדוחות, ולא על מסכי הוספת תרומה
              או מפגש — שם תמיד אפשר למצוא כל אחד.
            </Explain>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6]">
          <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] mb-1">מעגל קרבה</h3>
          <p className="text-[11px] text-gray-400 mb-3">אילו רמות קשר להציג</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALL_CIRCLES.map(circle => {
              const active = settings.visibleCircles.includes(circle);
              return (
                <button
                  key={circle}
                  onClick={() => toggleCircle(circle)}
                  className={`p-3 rounded-xl border-2 text-center text-sm font-semibold transition-colors ${
                    active ? 'bg-[#D1FAE5] border-[#10B981] text-[#0D1B2A]' : 'bg-white border-[#EDE6D6] text-gray-400'
                  }`}
                >
                  {CIRCLE_LABELS[circle]}
                </button>
              );
            })}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-4">
          <div>
            <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">סינונים נוספים</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">כמה רעיונות נוספים שיכולים לעזור</p>
          </div>
          {toggles.map(t => (
            <div key={t.key as string} onClick={() => updateSettings({ [t.key]: !settings[t.key] } as any)} className="flex items-center justify-between gap-3 cursor-pointer">
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#0D1B2A]">{t.label}</div>
                <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{t.hint}</div>
              </div>
              <div className={`w-[46px] h-[26px] rounded-full relative transition-colors shrink-0 ${settings[t.key] ? 'bg-[#C9A84C]' : 'bg-[#EDE6D6]'}`}>
                <div className={`w-[22px] h-[22px] bg-white rounded-full absolute top-[2px] shadow flex transition-all ${settings[t.key] ? 'left-[2px]' : 'right-[2px]'}`} />
              </div>
            </div>
          ))}
        </div>
        </>)}

        {group === 'data' && (<>
        <div data-entity-id="settings-backup"><BackupCard /></div>

        <div data-entity-id="settings-audit-log"><AuditLogCard /></div>

        <div data-entity-id="settings-ai-import" className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
          <CardTitle title="ייבוא מידע קיים">
            יש לך רשימת אנשים, קובץ אקסל של תרומות, או דף מודפס? האפליקציה תכין הנחיה
            שתדביק בצ'אט AI יחד עם הקובץ, ותקלוט בחזרה את התוצאה. לפני השמירה תראה
            בדיוק מה נכנס ולאן.
          </CardTitle>
          <button
            onClick={() => setImportOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white text-sm font-bold py-2.5 rounded-xl active:scale-95 transition-transform"
          >
            <Bot size={15} /> פתח ייבוא
          </button>
        </div>
        {/* ── כלים מתקדמים ─────────────────────────────────────────────
            מה שיושב כאן אינו מיותר — הוא פשוט לא נחוץ ברוב הימים. מסך
            שנולד מתקלה ספציפית ומופיע לנצח במשקל שווה לכל השאר הופך את
            ההגדרות לרשימת דברים שאי אפשר להבין. */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#EDE6D6] overflow-hidden">
          <button
            onClick={() => setAdvancedOpen(v => !v)}
            className="w-full flex items-center justify-between gap-2 p-4 text-right"
          >
            <div className="min-w-0">
              <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">כלים מתקדמים</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {legacyYahrzeitCount > 0 || missingAttendance > 0
                  ? `יש כאן ${[legacyYahrzeitCount > 0 ? 'יארצייטים להעברה' : '', missingAttendance > 0 ? 'נוכחויות להשלמה' : ''].filter(Boolean).join(' ו')}`
                  : 'אבחון, תיקונים והשלמות. אין כרגע משהו שדורש טיפול.'}
              </p>
            </div>
            <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          </button>

          {advancedOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-[#EDE6D6] pt-3">
              {/* מוצג רק כשבאמת יש יארצייטים במבנה הישן */}
              {legacyYahrzeitCount > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
          <div>
            <CardTitle title="העברת יארצייטים למבנה החדש">
            עד היום שם הנפטר נשמר כשם של <b>עמודה</b> בגיליון — ולכן כל יארצייט
              שהוספת הופיע אצל כל אנשי הקשר. הפעולה הזו מעבירה אותם לרשומות בכרטיס
              של האדם הנכון ומנקה את העמודות. תראה בדיוק מה עומד לקרות לפני האישור.
          </CardTitle>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMigrateOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-[#0D1B2A] text-[#E8C97A] text-sm font-bold py-2.5 rounded-xl active:scale-95 transition-transform"
            >
              העבר {legacyYahrzeitCount} יארצייטים
            </button>
          </div>
        </div>
              )}

              {/* מוצג רק כשבאמת חסרות רשומות */}
              {missingAttendance > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
          <div className="flex items-center gap-2">
            <History size={18} className="text-[#9B7A2F] shrink-0" />
            <CardTitle title="השלמת נוכחויות עבר">
              סימון נוכחות באירוע או בחג נרשם מעכשיו אוטומטית כ"יצירת קשר". הכפתור
              הזה משלים למפרע את מה שסומן לפני העדכון. אפשר להריץ כמה פעמים — לא
              ייווצרו כפילויות. הזמנות לחג שסומנו כ"בוצע" אינן נכללות, כי לא נשמר
              להן תאריך מדויק.
            </CardTitle>
          </div>
          <button
            onClick={runAttendanceBackfill}
            disabled={isSyncing}
            className="w-full bg-[#0D1B2A] hover:bg-[#16283d] disabled:opacity-60 text-white rounded-xl py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <History size={16} />}
            {isSyncing && syncProgress ? `מסנכרן... (${syncProgress.done}/${syncProgress.total})` : `השלם ${missingAttendance} רשומות`}
          </button>
          {syncResult && (
            <div className="text-[11px] text-[#0D1B2A] bg-[#FAF6EE] rounded-lg p-2.5 leading-relaxed">{syncResult}</div>
          )}
        </div>
              )}

              {/* האבחון זמין תמיד — הוא הדבר שמחפשים כשמשהו נעלם */}
              <button
                onClick={() => setRescueOpen(true)}
                className="w-full border border-[#EDE6D6] text-[#0D1B2A] text-sm font-bold py-2.5 rounded-xl hover:border-[#C9A84C] transition-colors"
              >
                איפה התאריכים שלי?
              </button>
            </div>
          )}
        </div>
        <div data-entity-id="settings-facebook" className="bg-white rounded-xl p-4 border border-[#EDE6D6] space-y-3">
          <div className="text-sm font-bold text-[#0D1B2A] flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
            הגדרות פייסבוק
          </div>
          <div className="flex justify-end">
            <Explain label="איך משיגים את הפרטים">
              developers.facebook.com ← צור אפליקציה חינמית ← קבל Page Access Token
              עבור הדף שלך. הטוקן נשמר רק בדפדפן הזה ולא בענן, ולכן במכשיר נוסף
              יש להזין אותו שוב.
            </Explain>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">מזהה דף (Page ID)</label>
            <input
              value={settings.fbPageId}
              onChange={e => updateSettings({ fbPageId: e.target.value })}
              placeholder="למשל: 123456789"
              className="w-full bg-gray-50 border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C]"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">טוקן גישה (Access Token)</label>
            <input
              value={settings.fbAccessToken}
              onChange={e => updateSettings({ fbAccessToken: e.target.value })}
              type="password"
              placeholder="EAAxxxxx..."
              className="w-full bg-gray-50 border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C]"
              dir="ltr"
            />
          </div>
          {settings.fbPageId && settings.fbAccessToken && (
            <div className="text-[11px] text-green-600 font-bold">✓ פייסבוק מוגדר ומוכן לפרסום</div>
          )}
        </div>
        </>)}
        </>)}

        {wizardOpen && (
          <SetupWizard
            onDone={() => window.location.reload()}
            onCancel={() => setWizardOpen(false)}
          />
        )}
        {dataWizardOpen && <DataOnboardingWizard onDone={() => setDataWizardOpen(false)} />}
      </div>

      {importOpen && <GlobalAIImportModal onClose={() => setImportOpen(false)} />}
      {migrateOpen && <MigrateYahrzeitsModal onClose={() => setMigrateOpen(false)} />}
      {rescueOpen && <DatesRescueModal onClose={() => setRescueOpen(false)} />}
    </div>
  );
}
