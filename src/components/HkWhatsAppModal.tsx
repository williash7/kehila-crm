import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, MessageSquare, Check, RotateCcw, Send, PhoneOff, ImagePlus, X } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { useCloseOnBack } from './FullScreenView';
import { ProfileModal } from './ProfileModal';
import { orgNameIn, signerIn } from '../lib/orgConfig';
import {
  BroadcastKind, BroadcastLang, BROADCAST_KIND_LABEL, PLACEHOLDERS, DEFAULT_TEMPLATES,
  buildRecipients, fillTemplate, waLink, loadSent, saveSent, loadTemplate, saveTemplate, loadLangs, saveLangs,
  loadImage, saveImage, canShareFile,
} from '../lib/hkBroadcast';

// שליחת וואטסאפ לכל בעלי הוראות הקבע — לחיצה אחת לכל אדם.
// כפתור "שלח לבא בתור" פותח את הצ'אט של האדם הבא עם הודעה מוכנה, מסמן
// אותו כנשלח, וכשחוזרים לאפליקציה לוחצים שוב. ההתקדמות נשמרת במכשיר
// לפי חודש, כך שאפשר להפסיק באמצע ולהמשיך אחר כך.

const KINDS: BroadcastKind[] = ['thanks', 'general', 'failure'];

export function HkWhatsAppModal({ onClose, initialKind = 'thanks' }: { onClose: () => void; initialKind?: BroadcastKind }) {
  const { hk, failures, crm, donors, settings, donations } = useAppStore();
  useCloseOnBack(onClose);

  const [kind, setKind] = useState<BroadcastKind>(initialKind);
  const [defaultLang, setDefaultLang] = useState<BroadcastLang>('he');
  const [langs, setLangs] = useState<Record<string, BroadcastLang>>(() => loadLangs());
  const [templates, setTemplates] = useState(() => ({
    he: loadTemplate(initialKind, 'he'),
    ru: loadTemplate(initialKind, 'ru'),
  }));
  const [editLang, setEditLang] = useState<BroadcastLang>('he');
  const [sent, setSent] = useState<Record<string, string>>(() => loadSent(initialKind));
  const [selectedDonor, setSelectedDonor] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // התמונה נשמרת לכל סוג הודעה בנפרד — תמונת סיכום חודש לתודה, אחרת להודעה כללית
  useEffect(() => {
    let alive = true;
    loadImage(kind).then(f => { if (alive) setImage(f); });
    return () => { alive = false; };
  }, [kind]);

  useEffect(() => {
    if (!image) { setImageUrl(''); return; }
    const url = URL.createObjectURL(image);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const pickImage = (file: File | null) => {
    setImage(file);
    saveImage(kind, file);
  };
  const textRef = useRef<HTMLTextAreaElement>(null);

  const threshold = settings.hkExpiringThreshold ?? 2;
  const recipients = useMemo(
    () => buildRecipients(kind, hk, failures, crm, donors, threshold, donations),
    [kind, hk, failures, crm, donors, threshold, donations],
  );
  const withPhone = recipients.filter(r => r.phone);
  const noPhone = recipients.filter(r => !r.phone);
  const sentCount = withPhone.filter(r => sent[r.key]).length;
  const next = withPhone.find(r => !sent[r.key]);

  const switchKind = (k: BroadcastKind) => {
    setKind(k);
    setTemplates({ he: loadTemplate(k, 'he'), ru: loadTemplate(k, 'ru') });
    setSent(loadSent(k));
  };

  const langOf = (key: string): BroadcastLang => langs[key] || defaultLang;

  const toggleLang = (key: string) => {
    const nextLangs = { ...langs, [key]: langOf(key) === 'he' ? 'ru' as const : 'he' as const };
    setLangs(nextLangs);
    saveLangs(nextLangs);
  };

  const updateTemplate = (text: string) => {
    setTemplates(t => ({ ...t, [editLang]: text }));
    saveTemplate(kind, editLang, text);
  };

  const resetTemplate = () => updateTemplate(DEFAULT_TEMPLATES[kind][editLang]);

  const insertToken = (token: string) => {
    const el = textRef.current;
    const text = templates[editLang];
    if (!el) { updateTemplate(text + token); return; }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    updateTemplate(text.slice(0, start) + token + text.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  };

  const messageFor = (r: typeof recipients[number]) => {
    const lang = langOf(r.key);
    return fillTemplate(templates[lang], r, {
      signer: [signerIn(lang), orgNameIn(lang)].filter(Boolean).join('\n'),
      org: orgNameIn(lang),
    });
  };

  const markSent = (key: string, value: boolean) => {
    const updated = { ...sent };
    if (value) updated[key] = new Date().toISOString();
    else delete updated[key];
    setSent(updated);
    saveSent(kind, updated);
  };

  const send = async (r: typeof recipients[number]) => {
    const text = messageFor(r);
    if (image && canShareFile(image)) {
      // גיבוי: הטקסט גם בלוח ההעתקה, למקרה שאפליקציה כלשהי משמיטה את הכיתוב
      navigator.clipboard?.writeText(text).catch(() => {});
      try {
        await navigator.share({ files: [image], text });
        markSent(r.key, true);
      } catch (e: any) {
        // ביטול של המשתמש בתפריט השיתוף — לא מסמנים כנשלח
        if (e?.name !== 'AbortError') alert('השיתוף נכשל: ' + String(e?.message || e));
      }
      return;
    }
    if (image) {
      // מחשב או דפדפן בלי שיתוף קבצים: מורידים את התמונה ופותחים את הצ'אט,
      // ואת התמונה מצרפים ידנית — כמו במכתב התודה
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = image.name || 'image.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    window.open(waLink(r.phone, text), '_blank');
    markSent(r.key, true);
  };

  const resetRound = () => {
    if (!confirm('להתחיל סבב חדש? כל הסימונים "נשלח" של הסבב הזה יימחקו.')) return;
    setSent({});
    saveSent(kind, {});
  };

  const preview = next || withPhone[0] || recipients[0];
  const progress = withPhone.length ? Math.round((sentCount / withPhone.length) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-[#FAF6EE] z-[110] flex flex-col h-full" dir="rtl">
      <div className="bg-[#0D1B2A] text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-md">
        <button onClick={onClose} className="flex items-center gap-1 h-9 px-2.5 -mr-2 rounded-full text-white/80 hover:bg-white/10 transition-colors">
          <ChevronRight size={20} />
          <span className="text-sm font-bold">חזרה</span>
        </button>
        <h2 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#C9A84C]">וואטסאפ להוראות קבע</h2>
        <div className="w-16" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 md:pb-6">
        {/* סוג ההודעה */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {KINDS.map(k => (
            <button
              key={k}
              onClick={() => switchKind(k)}
              className={`py-2 rounded-xl text-xs font-bold border transition-colors ${kind === k ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]' : 'bg-white text-gray-500 border-[#EDE6D6]'}`}
            >
              {BROADCAST_KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
          {kind === 'failure'
            ? 'נשלח רק למי שיש לו כשל חיוב פתוח — כזה שלא נכנס כסף אחריו.'
            : 'נשלח לכל מי שיש לו הוראת קבע פעילה, וגם למי שתרם בתשלומי אשראי שעוד לא הסתיימו (הסכום החודשי). מי שיש לו כמה הוראות מקבל הודעה אחת עם הסכום המצטבר.'}
        </p>

        {/* נוסח ההודעה */}
        <div className="bg-white rounded-2xl border border-[#EDE6D6] p-3 mb-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#0D1B2A]">נוסח ההודעה</span>
            <div className="flex gap-1">
              {(['he', 'ru'] as BroadcastLang[]).map(l => (
                <button
                  key={l}
                  onClick={() => setEditLang(l)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${editLang === l ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : 'bg-white text-gray-500 border-[#EDE6D6]'}`}
                >
                  {l === 'he' ? 'עברית' : 'רוסית'}
                </button>
              ))}
            </div>
          </div>
          <textarea
            ref={textRef}
            value={templates[editLang]}
            onChange={e => updateTemplate(e.target.value)}
            dir={editLang === 'he' ? 'rtl' : 'ltr'}
            rows={7}
            className="w-full bg-[#FAF6EE] border border-[#EDE6D6] rounded-xl p-2.5 text-sm leading-relaxed outline-none focus:border-[#C9A84C]"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {PLACEHOLDERS.filter(p => kind === 'failure' || p.token !== '{סיבה}').map(p => (
              <button key={p.token} onClick={() => insertToken(p.token)} className="px-2 py-1 rounded-lg bg-[#FAF6EE] border border-[#EDE6D6] text-[11px] text-[#9B7A2F] font-semibold">
                + {p.label}
              </button>
            ))}
            <button onClick={resetTemplate} className="px-2 py-1 rounded-lg text-[11px] text-gray-400 underline">נוסח ברירת מחדל</button>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">הנוסח נשמר אוטומטית. השדות בסוגריים מתמלאים לכל אדם בנפרד.</p>
        </div>

        {/* תמונה מצורפת */}
        <div className="bg-white rounded-2xl border border-[#EDE6D6] p-3 mb-3 shadow-sm">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { pickImage(e.target.files?.[0] || null); e.target.value = ''; }} />
          {image ? (
            <div className="flex items-center gap-3">
              <img src={imageUrl} alt="" className="w-16 h-20 object-cover rounded-lg border border-[#EDE6D6]" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-[#0D1B2A]">תמונה מצורפת להודעה</div>
                <div className="text-[11px] text-gray-500 leading-relaxed mt-0.5">
                  בלחיצה על "שלח" ייפתח תפריט השיתוף — בוחרים וואטסאפ ואת השם של האדם. התמונה והטקסט כבר בפנים.
                </div>
                <button onClick={() => fileRef.current?.click()} className="text-[11px] text-[#9B7A2F] font-semibold mt-1">החלף תמונה</button>
              </div>
              <button onClick={() => pickImage(null)} title="הסר תמונה" className="shrink-0 p-1.5 text-gray-400"><X size={16} /></button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-2 text-sm font-bold text-[#9B7A2F]">
              <ImagePlus size={18} /> צרף תמונה להודעה
            </button>
          )}
        </div>

        {/* תצוגה מקדימה */}
        {preview && (
          <div className="mb-3">
            <div className="text-[11px] font-bold text-gray-500 mb-1">כך זה ייראה אצל {preview.name}:</div>
            <div
              dir={langOf(preview.key) === 'he' ? 'rtl' : 'ltr'}
              className="bg-[#DCF8C6] rounded-2xl rounded-tr-sm p-1.5 text-sm whitespace-pre-wrap leading-relaxed text-[#0D1B2A] shadow-sm"
            >
              {imageUrl && <img src={imageUrl} alt="" className="w-full max-h-72 object-cover rounded-xl mb-1" />}
              <div className="p-1.5">{messageFor(preview)}</div>
            </div>
          </div>
        )}

        {/* התקדמות */}
        <div className="bg-white rounded-2xl border border-[#EDE6D6] p-3 mb-3 shadow-sm">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-bold text-[#0D1B2A]">נשלחו {sentCount} מתוך {withPhone.length}</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setDefaultLang(l => (l === 'he' ? 'ru' : 'he'))} className="text-[11px] text-[#9B7A2F] font-semibold">
                שפת ברירת מחדל: {defaultLang === 'he' ? 'עברית' : 'רוסית'}
              </button>
              {sentCount > 0 && (
                <button onClick={resetRound} className="text-[11px] text-gray-400 flex items-center gap-0.5">
                  <RotateCcw size={11} /> סבב חדש
                </button>
              )}
            </div>
          </div>
          <div className="h-2 bg-[#FAF6EE] rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* רשימה */}
        {recipients.length === 0 ? (
          <div className="text-center text-sm text-gray-500 py-8">
            {kind === 'failure' ? 'אין כרגע כשלי חיוב פתוחים 🎉' : 'אין הוראות קבע פעילות.'}
          </div>
        ) : (
          <div className="space-y-2">
            {withPhone.map(r => {
              const done = !!sent[r.key];
              const isNext = next?.key === r.key;
              return (
                <div key={r.key} className={`bg-white rounded-xl p-3 border shadow-sm flex items-center gap-2 ${isNext ? 'border-[#C9A84C]' : 'border-[#EDE6D6]'} ${done ? 'opacity-60' : ''}`}>
                  <div className="min-w-0 flex-1" onClick={() => setSelectedDonor(r.name.split(' / ')[0])}>
                    <div className="text-sm font-bold text-[#0D1B2A] truncate">{r.name}</div>
                    <div className="text-[11px] text-gray-500" dir="rtl">
                      ₪{r.amount.toLocaleString()} לחודש
                      {r.reason ? <span className="text-red-500"> · {r.reason}</span> : null}
                      {r.installments ? <span className="text-indigo-600"> · תשלומים {r.installments.paid}/{r.installments.total}</span> : null}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleLang(r.key)}
                    title="שפת ההודעה לאדם הזה"
                    className="shrink-0 w-9 h-8 rounded-lg border border-[#EDE6D6] text-[11px] font-bold text-gray-500"
                  >
                    {langOf(r.key) === 'he' ? 'עב' : 'RU'}
                  </button>
                  {done ? (
                    <button onClick={() => markSent(r.key, false)} title="בטל סימון" className="shrink-0 h-8 px-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1">
                      <Check size={14} /> נשלח
                    </button>
                  ) : (
                    <button onClick={() => send(r)} className="shrink-0 h-8 px-3 rounded-lg bg-green-600 text-white text-xs font-bold flex items-center gap-1 active:scale-95">
                      <MessageSquare size={14} /> שלח
                    </button>
                  )}
                </div>
              );
            })}

            {noPhone.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1">
                  <PhoneOff size={13} /> חסר טלפון ({noPhone.length}) — לחיצה על שם פותחת את הכרטיס להוספת מספר
                </div>
                <div className="space-y-1.5">
                  {noPhone.map(r => (
                    <button key={r.key} onClick={() => setSelectedDonor(r.name.split(' / ')[0])} className="w-full text-right bg-white/60 rounded-xl px-3 py-2 border border-dashed border-[#EDE6D6] text-sm text-gray-600">
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* כפתור ראשי — הבא בתור */}
      {withPhone.length > 0 && (
        <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-[#FAF6EE] via-[#FAF6EE] to-transparent">
          <button
            onClick={() => next && send(next)}
            disabled={!next}
            className="w-full h-12 rounded-2xl bg-green-600 disabled:bg-gray-300 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
          >
            {next ? <><Send size={16} /> שלח ל{next.name} ({sentCount + 1}/{withPhone.length})</> : <><Check size={16} /> נשלח לכולם</>}
          </button>
        </div>
      )}

      {selectedDonor && <ProfileModal name={selectedDonor} onClose={() => setSelectedDonor(null)} backLabel="וואטסאפ" />}
    </div>
  );
}
