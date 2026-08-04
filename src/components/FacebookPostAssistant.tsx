import React, { useState } from 'react';
import { ChevronDown, Sparkles, Copy, Check } from 'lucide-react';
import { logAction } from '../lib/score';
import { getOrg } from '../lib/orgConfig';

interface FacebookPostAssistantProps {
  event: {
    name: string;
    type: string;   // 'shabbat' | 'minyan' | 'class' | 'other'
    date: string;    // ISO: '2025-07-22'
    time: string;    // '20:30'
    freq: string;    // 'weekly' | 'oneoff' | ...
  };
  fbPageId: string;
  fbAccessToken: string;
}

const FacebookIcon = ({ size = 18, color = '#1877F2' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
);

// עוזר יצירת תוכן לפייסבוק: יוצר פרומפט (הזמנה לפני האירוע / סיכום אחריו),
// מאפשר להעתיק ל-AI חיצוני, להדביק בחזרה פוסט ברוסית + סטטוס קצר בעברית,
// ולפרסם ישירות לדף הפייסבוק דרך ה-Graph API (עם Page Access Token מההגדרות).
export function FacebookPostAssistant({ event, fbPageId, fbAccessToken }: FacebookPostAssistantProps) {
  const [mode, setMode] = useState<'pre' | 'post'>('pre');
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState('');
  const [highlight, setHighlight] = useState('');
  const [pastedFb, setPastedFb] = useState('');
  const [pastedStatus, setPastedStatus] = useState('');
  const [postStatus, setPostStatus] = useState<null | { ok: boolean; msg: string }>(null);
  const [statusStatus, setStatusStatus] = useState<null | { ok: boolean; msg: string }>(null);

  const buildPrompt = () => {
    const typeMap: Record<string, string> = {
      shabbat: 'סעודת שבת / קבלת שבת',
      minyan: 'מניין תפילה',
      class: 'שיעור תורה',
      other: 'אירוע קהילתי',
    };
    const eventType = typeMap[event.type] || event.type;
    const dateObj = new Date(event.date);
    const dateStr = dateObj.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

    // שם הארגון, קהל היעד ושפת הפרסום מגיעים מהגדרות הארגון —
    // כך שאותו עוזר תוכן עובד לכל קהילה, בכל שפה.
    const org = getOrg();
    const orgLabel = org.orgName.he || org.shortName || 'הארגון';
    const place = org.city ? ` ב${org.city}` : '';
    const lang = org.postLanguage || 'עברית';

    let p = '';
    if (mode === 'pre') {
      p = `אתה מנהל תוכן עבור ${orgLabel}${place}. קהל היעד: ${org.audience}.

כתוב עבורי שני טקסטים נפרדים:

1. **פוסט לרשת חברתית ב${lang}** (שפה: ${lang} בלבד):
   - ארוך, חם, מזמין
   - הכנס: שם האירוע: "${event.name}", סוג: ${eventType}, יום ושעה: ${dateStr} בשעה ${event.time || 'לפרט'}
   - הוסף קריאה לפעולה בסוף (להגיע, לשתף)
   - טון: חם ויהודי, לא פורמלי מדי

2. **סטטוס קצר בעברית** (שפה: עברית בלבד):
   - 2-3 שורות בלבד
   - תאריך + שעה + קריאה קצרה להגיע
   - אמוג'ים מתאימים

החזר בדיוק בפורמט JSON הבא (בלוק קוד אחד בלבד, בלי טקסט נוסף חוץ מהבלוק):
\`\`\`json
{
  "facebook_ru": "הפוסט ב${lang} כאן",
  "status_he": "הסטטוס בעברית כאן"
}
\`\`\``;
    } else {
      p = `אתה מנהל תוכן עבור ${orgLabel}${place}. קהל היעד: ${org.audience}.

האירוע "${event.name}" (${eventType}) התקיים ב-${dateStr}.
${attendeeCount ? `השתתפו: ${attendeeCount} אנשים.` : ''}
${highlight ? `הדגש: ${highlight}` : ''}

כתוב עבורי שני טקסטים לפרסום לאחר האירוע:

1. **פוסט לרשת חברתית ב${lang}** (שפה: ${lang} בלבד):
   - חם, מודה למשתתפים, מזמין לבא
   - ציין את מספר המשתתפים אם יש
   - אורך: 4-6 משפטים

2. **סטטוס קצר בעברית** (שפה: עברית בלבד):
   - 2-3 שורות, תודה קצרה, הזמנה לפעם הבאה

החזר בדיוק בפורמט:
\`\`\`json
{
  "facebook_ru": "הפוסט ב${lang} כאן",
  "status_he": "הסטטוס בעברית כאן"
}
\`\`\``;
    }
    setPrompt(p);
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // אם ההעתקה האוטומטית נכשלת, הטקסט עדיין גלוי בתיבה להעתקה ידנית
    }
  };

  const postToFacebook = async (message: string, label: string, setSt: (s: any) => void) => {
    if (!message.trim()) {
      setSt({ ok: false, msg: 'אין טקסט להדביק' });
      return;
    }
    if (!fbPageId || !fbAccessToken) {
      setSt({ ok: false, msg: 'חסר מזהה דף או טוקן גישה — הגדר בהגדרות' });
      return;
    }
    setSt({ ok: true, msg: 'מפרסם...' });
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${fbPageId}/feed`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: message.trim(), access_token: fbAccessToken }),
        }
      );
      const data = await res.json();
      if (data.id) {
        setSt({ ok: true, msg: `✓ ${label} פורסם בהצלחה!` });
        logAction('facebook_post');
      } else {
        setSt({ ok: false, msg: `שגיאת פייסבוק: ${data.error?.message || 'לא ידוע'}` });
      }
    } catch {
      setSt({ ok: false, msg: 'שגיאת רשת — בדוק חיבור לאינטרנט' });
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-500/5 to-blue-700/5 border border-blue-200 rounded-xl overflow-hidden mt-3">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <FacebookIcon />
          <span className="text-sm font-bold text-[#0D1B2A]">פרסום לפייסבוק</span>
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="p-3 pt-0 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => { setMode('pre'); setPrompt(''); }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border ${mode === 'pre' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}
            >
              📣 לפני האירוע
            </button>
            <button
              onClick={() => { setMode('post'); setPrompt(''); }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border ${mode === 'post' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}
            >
              ✅ אחרי האירוע
            </button>
          </div>

          {mode === 'post' && (
            <div className="space-y-2">
              <input
                value={attendeeCount}
                onChange={e => setAttendeeCount(e.target.value)}
                type="number"
                placeholder="כמה אנשים השתתפו?"
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
              <input
                value={highlight}
                onChange={e => setHighlight(e.target.value)}
                type="text"
                placeholder="משפט אחד על האירוע (למשל: ערב מרגש עם שיעור מעמיק)"
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
          )}

          {!prompt ? (
            <button
              onClick={buildPrompt}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-bold py-2.5 rounded-xl active:scale-95 transition-transform"
            >
              <Sparkles size={15} /> צור פרומפט לפוסט
            </button>
          ) : (
            <>
              <p className="text-[11px] text-gray-500">העתק את הפרומפט → הדבק ב-Claude/ChatGPT → קבל פוסט → הדבק בחזרה למטה</p>

              <div className="relative">
                <textarea
                  readOnly
                  value={prompt}
                  rows={5}
                  className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-[11px] leading-relaxed outline-none resize-none"
                  dir="rtl"
                />
                <button
                  onClick={copyPrompt}
                  className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-md flex items-center gap-1"
                >
                  {copied ? <><Check size={12} /> הועתק</> : <><Copy size={12} /> העתק</>}
                </button>
              </div>

              <div className="bg-white rounded-xl p-3 border border-blue-100 space-y-2">
                <div className="text-[11px] font-bold text-blue-700">📘 פוסט פייסבוק — רוסית</div>
                <textarea
                  value={pastedFb}
                  onChange={e => setPastedFb(e.target.value)}
                  rows={5}
                  placeholder="הדבק כאן את הפוסט ברוסית שקיבלת מה-AI..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
                  dir="auto"
                />
                <button
                  onClick={() => postToFacebook(pastedFb, 'פוסט ברוסית', setPostStatus)}
                  disabled={!pastedFb.trim()}
                  className="w-full bg-blue-600 text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <FacebookIcon size={14} color="white" />
                  פרסם לפייסבוק
                </button>
                {postStatus && (
                  <div className={`text-xs rounded-lg p-2 ${postStatus.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {postStatus.msg}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl p-3 border border-green-100 space-y-2">
                <div className="text-[11px] font-bold text-green-700">💬 סטטוס קצר — עברית</div>
                <textarea
                  value={pastedStatus}
                  onChange={e => setPastedStatus(e.target.value)}
                  rows={3}
                  placeholder="הדבק כאן את הסטטוס בעברית..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400 resize-none"
                  dir="rtl"
                />
                <button
                  onClick={() => postToFacebook(pastedStatus, 'סטטוס בעברית', setStatusStatus)}
                  disabled={!pastedStatus.trim()}
                  className="w-full bg-green-600 text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-40"
                >
                  פרסם סטטוס
                </button>
                {statusStatus && (
                  <div className={`text-xs rounded-lg p-2 ${statusStatus.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {statusStatus.msg}
                  </div>
                )}
              </div>

              <button
                onClick={() => { setPrompt(''); setPastedFb(''); setPastedStatus(''); setPostStatus(null); setStatusStatus(null); }}
                className="text-xs text-gray-400 underline w-full text-center"
              >
                התחל מחדש
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
