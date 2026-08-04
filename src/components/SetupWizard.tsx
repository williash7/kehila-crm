import React, { useState } from 'react';
import {
  ChevronLeft, ChevronRight, Check, Loader2, Copy, ExternalLink,
  Building2, MapPin, Database, Sparkles, AlertCircle,
} from 'lucide-react';
import { OrgConfig, getOrg, saveOrg } from '../lib/orgConfig';

// ─────────────────────────────────────────────────────────────────────────────
// אשף ההגדרה הראשוני.
//
// זה המסך הראשון שכל משתמש חדש רואה. הוא אוסף את פרטי הארגון, מאתר את
// המיקום לחישוב זמני שבת, ומוליך את המשתמש צעד-אחר-צעד ביצירת גיליון
// Google משלו — כך שאף אחד לא צריך לגעת בקוד כדי להתחיל להשתמש.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  /** נקרא כשהאשף הסתיים בהצלחה */
  onDone: () => void;
  /** מצב עריכה — נכנסים לאשף מתוך ההגדרות, אז מותר לבטל */
  onCancel?: () => void;
}

const STEPS = [
  { key: 'org',     title: 'פרטי הארגון',  icon: Building2 },
  { key: 'place',   title: 'מיקום ומנהג',  icon: MapPin },
  { key: 'sheet',   title: 'חיבור הנתונים', icon: Database },
  { key: 'content', title: 'תוכן ופרסום',   icon: Sparkles },
] as const;

export function SetupWizard({ onDone, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState<OrgConfig>(() => ({ ...getOrg() }));
  const [geoState, setGeoState] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle');
  const [testState, setTestState] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const set = (patch: Partial<OrgConfig>) => setCfg(prev => ({ ...prev, ...patch }));

  // ── איתור קואורדינטות העיר (Nominatim, בלי מפתח API) ──────────────────────
  const locateCity = async () => {
    if (!cfg.city.trim()) return;
    setGeoState('loading');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(cfg.city)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        set({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
        setGeoState('ok');
      } else {
        setGeoState('fail');
      }
    } catch {
      setGeoState('fail');
    }
  };

  // ── בדיקת חיבור לגיליון ────────────────────────────────────────────────────
  const testConnection = async () => {
    const url = cfg.gsUrl.trim();
    if (!url) return;
    setTestState('loading');
    setTestMsg('');
    try {
      const res = await fetch(`${url}?action=ping`);
      const data = await res.json();
      if (data.ok) {
        setTestState('ok');
        setTestMsg(data.sheet ? `מחובר לגיליון "${data.sheet}"` : 'החיבור תקין');
      } else {
        setTestState('fail');
        setTestMsg(data.error || 'הכתובת ענתה, אבל לא בפורמט הצפוי. ודא שהדבקת את הקוד המלא ופרסמת מחדש.');
      }
    } catch (e: any) {
      setTestState('fail');
      setTestMsg('לא הצלחתי להתחבר. ודא שבחרת "Who has access: Anyone" ושהכתובת מסתיימת ב-/exec');
    }
  };

  const copyScript = async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}apps-script.txt`);
      await navigator.clipboard.writeText(await res.text());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.open(`${import.meta.env.BASE_URL}apps-script.txt`, '_blank');
    }
  };

  const finish = () => {
    saveOrg({
      ...cfg,
      configured: true,
      shortName: cfg.shortName.trim() || cfg.orgName.he.trim(),
      venueName: cfg.venueName.trim() || cfg.orgName.he.trim(),
      orgName: {
        he: cfg.orgName.he.trim(),
        en: cfg.orgName.en.trim() || cfg.orgName.he.trim(),
        ru: cfg.orgName.ru.trim() || cfg.orgName.he.trim(),
      },
      signerName: {
        he: cfg.signerName.he.trim(),
        en: cfg.signerName.en.trim() || cfg.signerName.he.trim(),
        ru: cfg.signerName.ru.trim() || cfg.signerName.he.trim(),
      },
    });
    onDone();
  };

  // ── תקינות לכל שלב ─────────────────────────────────────────────────────────
  const canAdvance = (() => {
    if (step === 0) return !!cfg.orgName.he.trim();
    if (step === 1) return !!cfg.city.trim();
    if (step === 2) return !!cfg.gsUrl.trim();
    return true;
  })();

  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[1000] bg-[#0D1B2A] overflow-y-auto" dir="rtl">
      <div className="max-w-2xl mx-auto px-5 py-8 md:py-14">

        {/* כותרת */}
        <div className="text-center mb-8">
          <div className="font-['Frank_Ruhl_Libre'] text-5xl text-[#C9A84C] mb-3">✦</div>
          <h1 className="font-['Frank_Ruhl_Libre'] text-2xl text-white mb-1">
            {getOrg().configured ? 'עריכת הגדרות הארגון' : 'ברוכים הבאים'}
          </h1>
          <p className="text-sm text-white/50">
            {getOrg().configured
              ? 'שינויים כאן משפיעים על כל האפליקציה'
              : 'כמה שאלות קצרות, ומתחילים לעבוד'}
          </p>
        </div>

        {/* פס התקדמות */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <React.Fragment key={s.key}>
                <button
                  onClick={() => i < step && setStep(i)}
                  className="flex flex-col items-center gap-1.5 shrink-0"
                  disabled={i > step}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    active ? 'bg-[#C9A84C] text-[#0D1B2A]'
                    : done ? 'bg-[#C9A84C]/25 text-[#C9A84C]'
                    : 'bg-white/10 text-white/30'
                  }`}>
                    {done ? <Check size={16} /> : <Icon size={16} />}
                  </div>
                  <span className={`text-[10px] ${active ? 'text-[#C9A84C]' : 'text-white/35'}`}>
                    {s.title}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-1 mb-4 ${i < step ? 'bg-[#C9A84C]/40' : 'bg-white/10'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* גוף האשף */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 md:p-7 min-h-[380px]">

          {/* ── שלב 1: פרטי הארגון ─────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <Field label="שם הארגון" hint="יופיע בכותרות, בדוחות ובמכתבי התודה" required>
                <Input value={cfg.orgName.he} onChange={v => set({ orgName: { ...cfg.orgName, he: v } })}
                       placeholder="למשל: בית חב״ד רמת גן" />
              </Field>

              <Field label="שם קצר" hint="לניווט ולמסך הפתיחה. ריק = השם המלא">
                <Input value={cfg.shortName} onChange={v => set({ shortName: v })} placeholder="רמת גן" />
              </Field>

              <Field label="שם החותם על מכתבי תודה">
                <Input value={cfg.signerName.he} onChange={v => set({ signerName: { ...cfg.signerName, he: v } })}
                       placeholder="למשל: הרב ישראל כהן" />
              </Field>

              <details className="group">
                <summary className="text-xs text-[#C9A84C]/70 cursor-pointer select-none py-1">
                  תרגומים לאנגלית ורוסית (למכתבי תודה לתורמים דוברי שפות אחרות) ›
                </summary>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Field label="שם הארגון · English">
                    <Input dir="ltr" value={cfg.orgName.en} onChange={v => set({ orgName: { ...cfg.orgName, en: v } })} />
                  </Field>
                  <Field label="שם החותם · English">
                    <Input dir="ltr" value={cfg.signerName.en} onChange={v => set({ signerName: { ...cfg.signerName, en: v } })} />
                  </Field>
                  <Field label="שם הארגון · Русский">
                    <Input dir="ltr" value={cfg.orgName.ru} onChange={v => set({ orgName: { ...cfg.orgName, ru: v } })} />
                  </Field>
                  <Field label="שם החותם · Русский">
                    <Input dir="ltr" value={cfg.signerName.ru} onChange={v => set({ signerName: { ...cfg.signerName, ru: v } })} />
                  </Field>
                </div>
              </details>
            </div>
          )}

          {/* ── שלב 2: מיקום ומנהג ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <Field label="עיר" hint="משמשת לזמני שבת, לחיפוש כתובות ולמפת אנשי הקשר" required>
                <div className="flex gap-2">
                  <Input value={cfg.city} onChange={v => { set({ city: v }); setGeoState('idle'); }}
                         onBlur={locateCity} placeholder="למשל: רמת גן" />
                  <button onClick={locateCity} disabled={!cfg.city.trim() || geoState === 'loading'}
                          className="px-3 rounded-lg bg-[#C9A84C]/15 text-[#C9A84C] text-xs whitespace-nowrap disabled:opacity-40 hover:bg-[#C9A84C]/25">
                    {geoState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : 'אתר'}
                  </button>
                </div>
              </Field>

              {geoState === 'ok' && (
                <Note tone="ok">נמצא: {cfg.lat.toFixed(4)}, {cfg.lon.toFixed(4)} — זמני השבת יחושבו לפי המיקום הזה</Note>
              )}
              {geoState === 'fail' && (
                <Note tone="warn">לא מצאתי את העיר. אפשר להזין קואורדינטות ידנית למטה, או להמשיך ולתקן אחר כך בהגדרות.</Note>
              )}

              <Field label="כתובת המקום" hint="רחוב ומספר — מופיע בפוסטר השבועי">
                <Input value={cfg.address} onChange={v => set({ address: v })} placeholder="למשל: ביאליק 12" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="הדלקת נרות" hint="דקות לפני השקיעה">
                  <Input type="number" value={String(cfg.candleMinutes)}
                         onChange={v => set({ candleMinutes: parseInt(v, 10) || 18 })} />
                </Field>
                <Field label="צאת השבת" hint="דקות אחרי השקיעה. ריק = צאת הכוכבים">
                  <Input type="number" value={cfg.havdalahMinutes == null ? '' : String(cfg.havdalahMinutes)}
                         onChange={v => set({ havdalahMinutes: v === '' ? null : parseInt(v, 10) })}
                         placeholder="צאת הכוכבים" />
                </Field>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-white/70 cursor-pointer pt-1">
                <input type="checkbox" checked={cfg.israelHolidays}
                       onChange={e => set({ israelHolidays: e.target.checked })}
                       className="w-4 h-4 accent-[#C9A84C]" />
                נוהגים כמנהג ארץ ישראל (יום טוב אחד)
              </label>

              <details>
                <summary className="text-xs text-[#C9A84C]/70 cursor-pointer select-none py-1">
                  קואורדינטות ואזור זמן ידניים ›
                </summary>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <Field label="קו רוחב">
                    <Input dir="ltr" type="number" value={String(cfg.lat)} onChange={v => set({ lat: parseFloat(v) || 0 })} />
                  </Field>
                  <Field label="קו אורך">
                    <Input dir="ltr" type="number" value={String(cfg.lon)} onChange={v => set({ lon: parseFloat(v) || 0 })} />
                  </Field>
                  <Field label="אזור זמן">
                    <Input dir="ltr" value={cfg.tzid} onChange={v => set({ tzid: v })} />
                  </Field>
                </div>
              </details>
            </div>
          )}

          {/* ── שלב 3: חיבור הגיליון ──────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-white/60 leading-relaxed">
                כל הנתונים שלך יישמרו בגיליון Google פרטי שלך — לא אצלנו ולא אצל אף אחד אחר.
                ההגדרה חד-פעמית ולוקחת כחמש דקות.
              </p>

              <ol className="space-y-3 text-sm text-white/75">
                <Step n={1}>
                  פותחים גיליון חדש:{' '}
                  <a href="https://sheets.new" target="_blank" rel="noreferrer"
                     className="text-[#C9A84C] underline inline-flex items-center gap-1">
                    sheets.new <ExternalLink size={12} />
                  </a>
                </Step>
                <Step n={2}>בתפריט: <b>תוספים ← Apps Script</b>, ומוחקים את כל מה שכתוב שם</Step>
                <Step n={3}>
                  <button onClick={copyScript}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C] text-[#0D1B2A] text-xs font-bold hover:brightness-110">
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? 'הקוד הועתק' : 'העתק את הקוד'}
                  </button>
                  <span className="mx-2">ומדביקים בעורך. שומרים.</span>
                </Step>
                <Step n={4}>בוחרים בתפריט הפונקציות את <b>setupSheet</b> ולוחצים <b>Run</b> (מאשרים הרשאות)</Step>
                <Step n={5}>
                  <b>Deploy ← New deployment ← Web app</b><br />
                  <span className="text-white/50 text-xs">
                    Execute as: <b className="text-white/70">Me</b> · Who has access: <b className="text-white/70">Anyone</b>
                  </span>
                </Step>
                <Step n={6}>מעתיקים את הכתובת שמסתיימת ב-<code className="text-[#C9A84C]">/exec</code> ומדביקים כאן:</Step>
              </ol>

              <Field label="כתובת ה-Web App" required>
                <Input dir="ltr" value={cfg.gsUrl}
                       onChange={v => { set({ gsUrl: v.trim() }); setTestState('idle'); }}
                       placeholder="https://script.google.com/macros/s/.../exec" />
              </Field>

              <button onClick={testConnection} disabled={!cfg.gsUrl.trim() || testState === 'loading'}
                      className="w-full py-2.5 rounded-lg bg-white/10 text-white text-sm font-bold hover:bg-white/15 disabled:opacity-40 flex items-center justify-center gap-2">
                {testState === 'loading' ? <Loader2 size={15} className="animate-spin" /> : null}
                בדוק חיבור
              </button>

              {testState === 'ok' && <Note tone="ok">{testMsg}</Note>}
              {testState === 'fail' && <Note tone="warn">{testMsg}</Note>}
            </div>
          )}

          {/* ── שלב 4: תוכן ─────────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-white/60 leading-relaxed">
                שני פרטים אחרונים, לעוזר יצירת התוכן ולפוסטר השבועי. אפשר לדלג ולשנות מאוחר יותר.
              </p>

              <Field label="קהל היעד" hint="נכנס לתוך ההנחיות שהאפליקציה מכינה לכתיבת פוסטים">
                <Input value={cfg.audience} onChange={v => set({ audience: v })}
                       placeholder="למשל: משפחות צעירות בשכונה, דוברי רוסית, סטודנטים" />
              </Field>

              <Field label="שפת הפרסומים ברשתות">
                <Input value={cfg.postLanguage} onChange={v => set({ postLanguage: v })} placeholder="עברית" />
              </Field>

              <Field label="שפת הפוסטר השבועי">
                <div className="flex gap-2">
                  {(['he', 'ru', 'en'] as const).map(l => (
                    <button key={l} onClick={() => set({ posterLang: l })}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                              cfg.posterLang === l ? 'bg-[#C9A84C] text-[#0D1B2A]' : 'bg-white/10 text-white/60 hover:bg-white/15'
                            }`}>
                      {l === 'he' ? 'עברית' : l === 'ru' ? 'Русский' : 'English'}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="שם המקום בפוסטר" hint="בית הכנסת / המרכז. ריק = שם הארגון">
                <Input value={cfg.venueName} onChange={v => set({ venueName: v })} />
              </Field>
            </div>
          )}
        </div>

        {/* ניווט */}
        <div className="flex items-center gap-3 mt-6">
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)}
                    className="px-4 py-2.5 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/15 flex items-center gap-1">
              <ChevronRight size={16} /> חזרה
            </button>
          ) : onCancel ? (
            <button onClick={onCancel} className="px-4 py-2.5 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/15">
              ביטול
            </button>
          ) : <div />}

          <div className="flex-1" />

          {!isLast ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canAdvance}
                    className="px-6 py-2.5 rounded-lg bg-[#C9A84C] text-[#0D1B2A] text-sm font-bold hover:brightness-110 disabled:opacity-30 flex items-center gap-1">
              המשך <ChevronLeft size={16} />
            </button>
          ) : (
            <button onClick={finish}
                    className="px-6 py-2.5 rounded-lg bg-[#C9A84C] text-[#0D1B2A] text-sm font-bold hover:brightness-110 flex items-center gap-1.5">
              <Check size={16} /> סיום
            </button>
          )}
        </div>

        {step === 2 && !cfg.gsUrl.trim() && (
          <p className="text-center text-xs text-white/30 mt-4">
            אין לך אפשרות להגדיר גיליון עכשיו? אפשר להמשיך בלי — האפליקציה תעבוד עם נתוני הדגמה.
          </p>
        )}
      </div>
    </div>
  );
}

// ── רכיבי עזר קטנים ─────────────────────────────────────────────────────────

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-white/70 mb-1.5">
        {label} {required && <span className="text-[#C9A84C]">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-white/35 mt-1">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, onBlur, placeholder, type = 'text', dir }: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  dir?: string;
}) {
  return (
    <input
      type={type}
      dir={dir}
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className="w-full bg-white/[0.06] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#C9A84C]/60"
    />
  );
}

function Note({ tone, children }: { tone: 'ok' | 'warn'; children: React.ReactNode }) {
  const ok = tone === 'ok';
  return (
    <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2.5 ${
      ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
    }`}>
      {ok ? <Check size={14} className="shrink-0 mt-0.5" /> : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-5 h-5 rounded-full bg-white/10 text-[#C9A84C] text-[11px] font-bold flex items-center justify-center mt-0.5">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
