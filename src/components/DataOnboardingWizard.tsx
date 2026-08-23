import React from 'react';
import {
  Bot, CalendarDays, Check, ChevronLeft, ChevronRight, ListChecks,
  Plus, Rocket, Sparkles, Target, Trash2, X,
} from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import {
  buildOnboardingActivities, buildOnboardingCampaigns, CampaignDraft,
  markDataOnboardingDone, parseTaskLines, RecurringActivityDraft,
  SpecialActivityDraft, todayIso,
} from '../lib/dataOnboarding';
import { STANDALONE_TASKS_ID } from '../lib/tasks';
import { GlobalAIImportModal } from './GlobalAIImportModal';

interface Props {
  onDone: () => void;
}

const blankRecurring = (): RecurringActivityDraft => ({
  name: '', freq: 'weekly', firstDate: todayIso(), time: '', location: '',
});
const blankSpecial = (): SpecialActivityDraft => ({
  name: '', date: todayIso(), time: '', location: '',
});
const blankCampaign = (): CampaignDraft => ({ name: '', goal: '', deadline: '' });

const STEPS = [
  { title: 'פעילות קבועה', icon: CalendarDays },
  { title: 'משימות', icon: ListChecks },
  { title: 'עוד דברים', icon: Target },
  { title: 'שמירה', icon: Check },
];

export function DataOnboardingWizard({ onDone }: Props) {
  const {
    eventsData, updateEventsData, projects, updateProjects,
    holidayExtras, updateHolidayExtras,
  } = useAppStore();
  const [mode, setMode] = React.useState<'welcome' | 'guided'>('welcome');
  const [step, setStep] = React.useState(0);
  const [recurring, setRecurring] = React.useState<RecurringActivityDraft[]>([blankRecurring()]);
  const [tasksText, setTasksText] = React.useState('');
  const [special, setSpecial] = React.useState<SpecialActivityDraft[]>([]);
  const [campaigns, setCampaigns] = React.useState<CampaignDraft[]>([]);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [aiImported, setAiImported] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const taskCount = parseTaskLines(tasksText).length;
  const recurringCount = recurring.filter(row => row.name.trim()).length;
  const specialCount = special.filter(row => row.name.trim()).length;
  const campaignCount = campaigns.filter(row => row.name.trim()).length;
  const totalCount = recurringCount + specialCount + campaignCount + taskCount;

  const finishWithoutData = () => {
    markDataOnboardingDone();
    onDone();
  };

  const saveGuided = () => {
    if (saving) return;
    setSaving(true);
    const newActivities = buildOnboardingActivities(recurring, special);
    const newCampaigns = buildOnboardingCampaigns(campaigns);
    const newTasks = parseTaskLines(tasksText);

    if (newActivities.length) updateEventsData([...(eventsData as any[]), ...newActivities]);
    if (newCampaigns.length) updateProjects([...(projects as any[]), ...newCampaigns] as any);
    if (newTasks.length) {
      const existing = holidayExtras[STANDALONE_TASKS_ID]?.tasks || [];
      updateHolidayExtras(STANDALONE_TASKS_ID, { tasks: [...existing, ...newTasks] });
    }
    markDataOnboardingDone();
    onDone();
  };

  const updateRecurring = (index: number, patch: Partial<RecurringActivityDraft>) =>
    setRecurring(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const updateSpecial = (index: number, patch: Partial<SpecialActivityDraft>) =>
    setSpecial(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const updateCampaign = (index: number, patch: Partial<CampaignDraft>) =>
    setCampaigns(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row));

  return (
    <div className="fixed inset-0 z-[190] bg-[#0D1B2A] overflow-y-auto" dir="rtl">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 text-[#C9A84C] mb-1">
              <Rocket size={22} />
              <span className="text-xs font-bold">התחלה מהירה</span>
            </div>
            <h1 className="font-['Frank_Ruhl_Libre'] text-2xl md:text-3xl text-white font-bold">
              בוא נכניס את מה שכבר ידוע
            </h1>
            <p className="text-sm text-white/50 mt-1">אפשר למלא מעט עכשיו, להוסיף הרבה בעזרת AI, או לחזור לכאן אחר כך.</p>
          </div>
          <button onClick={finishWithoutData} aria-label="סגור" className="p-2 rounded-full bg-white/10 text-white/60 hover:bg-white/15">
            <X size={18} />
          </button>
        </div>

        {mode === 'welcome' ? (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <button onClick={() => setMode('guided')} className="text-right bg-white rounded-2xl p-5 border-2 border-transparent hover:border-[#C9A84C] transition-colors shadow-sm">
                <span className="w-11 h-11 rounded-xl bg-[#C9A84C]/15 text-[#9B7A2F] flex items-center justify-center mb-4"><ListChecks size={22} /></span>
                <span className="block text-lg font-bold text-[#0D1B2A]">ענה על כמה שאלות קצרות</span>
                <span className="block text-sm text-gray-500 mt-1 leading-relaxed">פעילויות קבועות, משימות, אירועים קרובים וקמפיינים. כל שלב אופציונלי.</span>
                <span className="flex items-center gap-1 text-xs font-bold text-[#9B7A2F] mt-4">התחל למלא <ChevronLeft size={14} /></span>
              </button>

              <button onClick={() => setAiOpen(true)} className="text-right bg-white rounded-2xl p-5 border-2 border-transparent hover:border-purple-400 transition-colors shadow-sm">
                <span className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-4"><Bot size={22} /></span>
                <span className="block text-lg font-bold text-[#0D1B2A]">אסוף הכול בשיחה עם AI</span>
                <span className="block text-sm text-gray-500 mt-1 leading-relaxed">מקבלים פרומפט, פותחים שיחה, מצרפים אקסל, תמונות או מסמכים ומדביקים כאן את התוצאה.</span>
                <span className="flex items-center gap-1 text-xs font-bold text-purple-700 mt-4">צור פרומפט לשיחה <Sparkles size={14} /></span>
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white/55 leading-relaxed">
              הייבוא בעזרת AI יודע לקלוט יחד אנשי קשר, תרומות, הוראות קבע, פעילויות, קמפיינים, חגים, רשימות התרמה ומשימות. אין צורך לסדר את הקבצים מראש.
            </div>
            <button onClick={finishWithoutData} className="w-full py-3 text-sm font-bold text-white/55 hover:text-white">לא עכשיו — אכנס לאפליקציה</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5 overflow-x-auto gap-2">
              {STEPS.map((item, index) => {
                const Icon = item.icon;
                return (
                  <React.Fragment key={item.title}>
                    <button onClick={() => setStep(index)} className="flex flex-col items-center gap-1 shrink-0">
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center ${index === step ? 'bg-[#C9A84C] text-[#0D1B2A]' : index < step ? 'bg-[#C9A84C]/25 text-[#C9A84C]' : 'bg-white/10 text-white/35'}`}>
                        {index < step ? <Check size={15} /> : <Icon size={15} />}
                      </span>
                      <span className={`text-[10px] ${index === step ? 'text-[#C9A84C]' : 'text-white/40'}`}>{item.title}</span>
                    </button>
                    {index < STEPS.length - 1 && <span className={`h-px flex-1 min-w-5 mb-4 ${index < step ? 'bg-[#C9A84C]/35' : 'bg-white/10'}`} />}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="bg-[#FAF6EE] rounded-3xl p-4 md:p-6 min-h-[430px]">
              {step === 0 && (
                <section>
                  <StepHeading title="אילו פעילויות מתקיימות בקביעות?" hint="למשל תפילת שבת, שיעור שבועי או מניין קבוע. אפשר להשאיר שורה ריקה." />
                  <div className="space-y-3">
                    {recurring.map((row, index) => (
                      <div key={index} className="bg-white border border-[#EDE6D6] rounded-2xl p-3 space-y-3">
                        <div className="flex gap-2">
                          <Field label="שם הפעילות" wide><input value={row.name} onChange={e => updateRecurring(index, { name: e.target.value })} placeholder="שיעור תורה" className={INPUT} /></Field>
                          {recurring.length > 1 && <button onClick={() => setRecurring(rows => rows.filter((_, i) => i !== index))} className="self-end h-10 px-2 text-red-300 hover:text-red-500"><Trash2 size={16} /></button>}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <Field label="חוזר"><select value={row.freq} onChange={e => updateRecurring(index, { freq: e.target.value as RecurringActivityDraft['freq'] })} className={INPUT}><option value="weekly">כל שבוע</option><option value="biweekly">כל שבועיים</option><option value="monthly">כל חודש</option></select></Field>
                          <Field label="המפגש הקרוב"><input type="date" value={row.firstDate} onChange={e => updateRecurring(index, { firstDate: e.target.value })} className={INPUT} /></Field>
                          <Field label="שעה"><input type="time" value={row.time} onChange={e => updateRecurring(index, { time: e.target.value })} className={INPUT} /></Field>
                          <Field label="מקום"><input value={row.location} onChange={e => updateRecurring(index, { location: e.target.value })} placeholder="בית חב״ד" className={INPUT} /></Field>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setRecurring(rows => [...rows, blankRecurring()])} className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#9B7A2F]"><Plus size={14} /> הוסף פעילות קבועה</button>
                </section>
              )}

              {step === 1 && (
                <section>
                  <StepHeading title="מה כבר צריך לעשות?" hint="כל שורה תהפוך למשימה נפרדת. אחר כך אפשר להוסיף תאריך, שעה ושיוך." />
                  <textarea value={tasksText} onChange={e => setTasksText(e.target.value)} rows={12} className={`${INPUT} resize-none leading-7`} placeholder={'להכין רשימת מוזמנים\nלהזמין כיבוד לשיעור\nלהתקשר לתורמים'} />
                  <div className="text-[11px] text-gray-400 mt-2">זוהו {taskCount} משימות</div>
                </section>
              )}

              {step === 2 && (
                <section className="space-y-5">
                  <div>
                    <StepHeading title="יש אירועים מיוחדים שכבר ידועים?" hint="לא חובה. אפשר להוסיף התוועדות, ערב נשים, סיור או אירוע אחר." />
                    <div className="space-y-2">
                      {special.map((row, index) => (
                        <div key={index} className="grid grid-cols-2 md:grid-cols-[1.5fr_1fr_0.8fr_1fr_auto] gap-2 bg-white p-3 rounded-xl border border-[#EDE6D6]">
                          <input value={row.name} onChange={e => updateSpecial(index, { name: e.target.value })} placeholder="שם האירוע" className={INPUT} />
                          <input type="date" value={row.date} onChange={e => updateSpecial(index, { date: e.target.value })} className={INPUT} />
                          <input type="time" value={row.time} onChange={e => updateSpecial(index, { time: e.target.value })} className={INPUT} />
                          <input value={row.location} onChange={e => updateSpecial(index, { location: e.target.value })} placeholder="מקום" className={INPUT} />
                          <button onClick={() => setSpecial(rows => rows.filter((_, i) => i !== index))} className="text-red-300 hover:text-red-500"><Trash2 size={15} /></button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setSpecial(rows => [...rows, blankSpecial()])} className="mt-2 flex items-center gap-1 text-xs font-bold text-[#9B7A2F]"><Plus size={13} /> הוסף אירוע מיוחד</button>
                  </div>

                  <div className="border-t border-[#EDE6D6] pt-4">
                    <StepHeading title="יש קמפיין גיוס פעיל או מתוכנן?" hint="לא חובה. מספיק שם; יעד ותאריך אפשר להשלים אחר כך." />
                    <div className="space-y-2">
                      {campaigns.map((row, index) => (
                        <div key={index} className="grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_auto] gap-2 bg-white p-3 rounded-xl border border-[#EDE6D6]">
                          <input value={row.name} onChange={e => updateCampaign(index, { name: e.target.value })} placeholder="שם הקמפיין" className={INPUT} />
                          <input type="number" value={row.goal} onChange={e => updateCampaign(index, { goal: e.target.value })} placeholder="יעד ₪" className={INPUT} />
                          <input type="date" value={row.deadline} onChange={e => updateCampaign(index, { deadline: e.target.value })} className={INPUT} />
                          <button onClick={() => setCampaigns(rows => rows.filter((_, i) => i !== index))} className="text-red-300 hover:text-red-500"><Trash2 size={15} /></button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setCampaigns(rows => [...rows, blankCampaign()])} className="mt-2 flex items-center gap-1 text-xs font-bold text-[#9B7A2F]"><Plus size={13} /> הוסף קמפיין</button>
                  </div>
                </section>
              )}

              {step === 3 && (
                <section>
                  <StepHeading title="הכול מוכן לשמירה" hint="רק שורות שמילאת יישמרו. מידע קיים אינו נמחק או משתנה." />
                  <div className="grid grid-cols-2 gap-3 my-5">
                    <Summary label="פעילויות קבועות" count={recurringCount} />
                    <Summary label="משימות" count={taskCount} />
                    <Summary label="אירועים מיוחדים" count={specialCount} />
                    <Summary label="קמפיינים" count={campaignCount} />
                  </div>
                  <button onClick={saveGuided} disabled={saving || totalCount === 0} className="w-full bg-[#0D1B2A] text-[#E8C97A] rounded-xl py-3.5 font-bold disabled:opacity-40">
                    {saving ? 'שומר...' : `שמור עכשיו ${totalCount} פריטים`}
                  </button>
                  {totalCount === 0 && <p className="text-xs text-center text-gray-400 mt-2">לא מולא מידע. אפשר לחזור או להמשיך בלי להזין.</p>}
                </section>
              )}
            </div>

            <div className="flex items-center gap-2 mt-4">
              <button onClick={() => step === 0 ? setMode('welcome') : setStep(step - 1)} className="px-4 py-3 rounded-xl bg-white/10 text-white/70 text-sm font-bold flex items-center gap-1"><ChevronRight size={15} /> חזרה</button>
              {step < STEPS.length - 1 ? (
                <button onClick={() => setStep(step + 1)} className="flex-1 py-3 rounded-xl bg-[#C9A84C] text-[#0D1B2A] text-sm font-bold flex items-center justify-center gap-1">המשך <ChevronLeft size={15} /></button>
              ) : (
                <button onClick={finishWithoutData} className="flex-1 py-3 rounded-xl bg-white/10 text-white/70 text-sm font-bold">סיים בלי לשמור</button>
              )}
            </div>
          </>
        )}
      </div>

      {aiOpen && (
        <GlobalAIImportModal
          onClose={() => {
            setAiOpen(false);
            if (aiImported) onDone();
          }}
          saveImmediately
          onImported={() => {
            markDataOnboardingDone();
            setAiImported(true);
          }}
        />
      )}
    </div>
  );
}

const INPUT = 'w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C]';

function StepHeading({ title, hint }: { title: string; hint: string }) {
  return <div className="mb-4"><h2 className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A]">{title}</h2><p className="text-xs text-gray-500 mt-1">{hint}</p></div>;
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={wide ? 'flex-1' : ''}><span className="block text-[10px] font-bold text-gray-500 mb-1">{label}</span>{children}</label>;
}

function Summary({ label, count }: { label: string; count: number }) {
  return <div className="bg-white border border-[#EDE6D6] rounded-xl p-4"><div className="text-2xl font-bold text-[#0D1B2A]">{count}</div><div className="text-xs text-gray-500">{label}</div></div>;
}
