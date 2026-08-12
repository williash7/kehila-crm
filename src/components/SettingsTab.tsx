import React, { useState } from 'react';
import { useAppStore } from '../store/AppContext';
import { Settings as SettingsIcon, RotateCcw, History, Loader2, ChevronDown, Bot } from 'lucide-react';
import { GlobalAIImportModal } from './GlobalAIImportModal';
import { ALL_CIRCLES, CIRCLE_LABELS, DEFAULT_SETTINGS } from '../lib/settings';
import { computeMissingAttendanceContacts } from '../lib/backfillContacts';
import { apiPost } from '../lib/api';
import { getOrg, resetOrg } from '../lib/orgConfig';
import { SetupWizard } from './SetupWizard';
import { HolidayCategory, CATEGORY_LABEL, CATEGORY_HINT, groupHolidayNames } from '../lib/holidayFilter';
import { isSignedIn, signOut, currentAccount, isGoogleLoginAvailable } from '../lib/googleAuth';
import { deleteConfigFromDrive } from '../lib/driveConfig';

export function SettingsTab() {
  const { settings, updateSettings, donors, visibleDonors, eventsData, holidayExtras, donations, refresh, holidays } = useAppStore();
  const org = getOrg();
  const vis = settings.holidayVisibility;
  const [openCat, setOpenCat] = useState<HolidayCategory | null>(null);
  const holidayNames = React.useMemo(() => groupHolidayNames(holidays), [holidays]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

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
    const failedNames: string[] = [];

    // רץ ברצף (לא במקביל) כדי לא להעמיס על ה-Apps Script שמריץ בקשה אחת בכל פעם.
    for (let i = 0; i < missing.length; i++) {
      const m = missing[i];
      try {
        const res = await apiPost('addMeeting', {
          name: m.name,
          date: m.date,
          meetType: m.meetType,
          purpose: m.purpose,
          notes: m.notes,
          nextMeet: ''
        });
        if (res?.error) {
          failedNames.push(`${m.name} (${m.date})`);
        } else {
          successCount++;
        }
      } catch {
        failedNames.push(`${m.name} (${m.date})`);
      }
      setSyncProgress({ done: i + 1, total: missing.length });
    }

    refresh();
    setIsSyncing(false);
    setSyncResult(
      failedNames.length === 0
        ? `✓ הושלם: נוצרו ${successCount} רשומות יצירת קשר חדשות.`
        : `נוצרו ${successCount} רשומות. נכשלו ${failedNames.length}: ${failedNames.slice(0, 10).join(', ')}${failedNames.length > 10 ? '...' : ''}`
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
        {/* פרטי הארגון — נקבעים באשף ההגדרה, וניתנים לעריכה כאן בכל עת */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6]">
          <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] mb-1">הארגון שלי</h3>
          <div className="text-sm text-gray-600 leading-relaxed mb-3">
            <div><b>{org.orgName.he || '— לא הוגדר —'}</b></div>
            {org.city && <div className="text-xs text-gray-400">{[org.address, org.city].filter(Boolean).join(', ')}</div>}
            <div className="text-xs text-gray-400 mt-1">
              {org.gsUrl ? '✓ מחובר לגיליון Google' : '⚠ לא מחובר לגיליון — הנתונים לא נשמרים'}
            </div>
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

        {wizardOpen && (
          <SetupWizard
            onDone={() => window.location.reload()}
            onCancel={() => setWizardOpen(false)}
          />
        )}

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6]">
          <div className="text-sm text-gray-600">
            מציג <span className="font-bold text-[#0D1B2A]">{visible}</span> מתוך <span className="font-bold text-[#0D1B2A]">{total}</span> אנשי קשר
          </div>
          <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
            ההגדרות האלה קובעות אילו אנשי קשר מופיעים ברשימות ובהמלצות בכל האפליקציה (אנשי קשר, דשבורד, דוחות, הזמנות לחג, נוכחות באירועים). הן <b>לא</b> משפיעות על הסכומים הכספיים והדוחות, ותמיד אפשר למצוא כל איש קשר בעת הוספת תרומה או מפגש.
          </p>
        </div>

        {/* אילו חגים מוצגים בלוח */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6]">
          <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] mb-1">חגים ותאריכים בלוח</h3>
          <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
            מכבים קטגוריה שלמה, ובתוך קטגוריה דלוקה אפשר לכבות תאריך בודד.
            כיבוי מסתיר מהתצוגה בלבד — שום נתון שרשמת לא נמחק.
          </p>

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

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
          <div>
            <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">ייבוא מידע קיים</h3>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
              יש לך רשימת אנשים, קובץ אקסל של תרומות, או דף מודפס? האפליקציה תכין הנחיה
              שתדביק בצ'אט AI יחד עם הקובץ, ותקלוט בחזרה את התוצאה. אנשי קשר, תרומות,
              הוראות קבע ומשימות — לפני השמירה תראה בדיוק מה נכנס.
            </p>
          </div>
          <button
            onClick={() => setImportOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white text-sm font-bold py-2.5 rounded-xl active:scale-95 transition-transform"
          >
            <Bot size={15} /> פתח ייבוא
          </button>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
          <div>
            <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">טווח תאריכים לסכומי תרומות</h3>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
              קובע מאיזה תאריך סופרים תרומות בכל הסכומים המוצגים באפליקציה — בדשבורד ("תרומות מתחילת שנה"), אצל אנשי הקשר (כמה כל אחד תרם) ובדוחות. השארה ריקה = מתחילת השנה הנוכחית.
            </p>
          </div>
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

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
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

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
          <div className="flex items-center gap-2">
            <History size={18} className="text-[#9B7A2F]" />
            <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">סנכרון נוכחויות עבר כיצירת קשר</h3>
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            סימון נוכחות באירוע/חג נרשם מעכשיו אוטומטית כ"יצירת קשר" עבור אותו אדם. הכפתור הזה סורק את <b>כל</b> הנוכחויות שכבר סומנו בעבר (לפני העדכון) ומשלים למפרע רישום יצירת קשר לכל מי שעדיין חסר לו. אפשר להריץ כמה פעמים — לא ייווצרו כפילויות.
          </p>
          <p className="text-[10px] text-gray-400 leading-relaxed">
            הערה: הזמנות לחג שסומנו כ"בוצע" (ולא נוכחות בפועל) לא נכללות כאן, כי לא נשמר להן תאריך מדויק בעבר.
          </p>
          <button
            onClick={runAttendanceBackfill}
            disabled={isSyncing}
            className="w-full bg-[#0D1B2A] hover:bg-[#16283d] disabled:opacity-60 text-white rounded-xl py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <History size={16} />}
            {isSyncing && syncProgress ? `מסנכרן... (${syncProgress.done}/${syncProgress.total})` : 'הרץ סנכרון עכשיו'}
          </button>
          {syncResult && (
            <div className="text-[11px] text-[#0D1B2A] bg-[#FAF6EE] rounded-lg p-2.5 leading-relaxed">{syncResult}</div>
          )}
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#EDE6D6] space-y-3">
          <div className="text-sm font-bold text-[#0D1B2A] flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
            הגדרות פייסבוק
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            למילוי שדות אלה: כנס ל-developers.facebook.com, צור אפליקציה חינמית, קבל Page Access Token עבור הדף שלך. הטוקן נשמר רק בדפדפן הזה (לא בענן) — אם משתמשים במספר מכשירים, יהיה צריך להזין בכל אחד בנפרד.
          </p>
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
      </div>

      {importOpen && <GlobalAIImportModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}
