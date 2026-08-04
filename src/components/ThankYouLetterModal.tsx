import React, { useRef, useState } from 'react';
import { X, Download, MessageSquare, Mail, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { LocalizedName, orgNameIn, signerIn } from '../lib/orgConfig';

interface Props {
  donorName: string;
  amount: number;
  date: string;
  phone?: string;
  email?: string;
  onClose: () => void;
}

type Lang = 'he' | 'en' | 'ru';
type Gender = 'm' | 'f';

// שם החותם ושם הארגון נלקחים מהגדרות הארגון (אשף ההגדרה / מסך ההגדרות),
// כך שהמכתב יוצא בשם הארגון והחותם של כל משתמש.
const SIGNER: LocalizedName = { get he() { return signerIn('he'); }, get en() { return signerIn('en'); }, get ru() { return signerIn('ru'); } };
const ORG: LocalizedName = { get he() { return orgNameIn('he'); }, get en() { return orgNameIn('en'); }, get ru() { return orgNameIn('ru'); } };

// טקסטים מתורגמים לתוכן המכתב עצמו (כרטיס העיצוב + הודעת השיתוף). ממשק
// המודל (כפתורים, תוויות השדות) נשאר בעברית בכוונה, כמו בשאר האפליקציה —
// רק תוכן המכתב שנשלח לתורם משתנה לפי השפה הנבחרת. ברוסית יש גם בחירת
// פנייה בזכר/נקבה, כי לשון הפנייה שונה משמעותית ("Уважаемый" מול "Уважаемая").
const LETTER_TEXT: Record<Lang, {
  dir: 'rtl' | 'ltr';
  locale: string;
  certTitle: string;
  toLabel: (g: Gender) => string;
  thanksLine: string;
  regards: string;
  body: (donorName: string, amount: number, date: string, g: Gender) => string;
}> = {
  he: {
    dir: 'rtl',
    locale: 'he-IL',
    certTitle: 'תעודת הוקרה ותודה',
    toLabel: () => 'לכבוד',
    thanksLine: `על תרומתך הנדיבה, המוקדשת מעומק הלב לטובת פעילות ${ORG.he} והקהילה`,
    regards: 'בברכה,',
    body: (donorName, amount, date) =>
      `לכבוד ${donorName},\n\nברצוני להביע תודה עמוקה על תרומתך הנדיבה בסך ₪${amount.toLocaleString()}, שהתקבלה בתאריך ${date}.\nתרומתך תורמת רבות לפעילות ${ORG.he} ולקהילה כולה.\nיהי רצון שתתברך/י בכל הברכות הטובות!\n\nבברכה,\n${SIGNER.he}\n${ORG.he}`,
  },
  en: {
    dir: 'ltr',
    locale: 'en-US',
    certTitle: 'Certificate of Appreciation',
    toLabel: () => 'Dear',
    thanksLine: `For your generous donation, given wholeheartedly in support of ${ORG.en} and our community`,
    regards: 'Warm regards,',
    body: (donorName, amount, date) =>
      `Dear ${donorName},\n\nI want to express my deep gratitude for your generous donation of ₪${amount.toLocaleString()}, received on ${date}.\nYour contribution greatly supports the activities of ${ORG.en} and the entire community.\nMay you be blessed with all good blessings!\n\nWarm regards,\n${SIGNER.en}\n${ORG.en}`,
  },
  ru: {
    dir: 'ltr',
    locale: 'ru-RU',
    certTitle: 'Благодарственная грамота',
    toLabel: (g) => (g === 'f' ? 'Уважаемая' : 'Уважаемый'),
    thanksLine: `За ваше щедрое пожертвование от всего сердца в поддержку ${ORG.ru} и нашей общины`,
    regards: 'С уважением,',
    body: (donorName, amount, date, g) =>
      `${g === 'f' ? 'Уважаемая' : 'Уважаемый'} ${donorName},\n\nЯ хочу выразить глубокую благодарность за ваше щедрое пожертвование в размере ₪${amount.toLocaleString()}, полученное ${date}.\nВаш вклад значительно поддерживает деятельность ${ORG.ru} и всей общины.\nПусть вас благословят во всём!\n\nС уважением,\n${SIGNER.ru}\n${ORG.ru}`,
  },
};

// מכתב תודה מעוצב (תעודת הוקרה) לתרומה ספציפית — שם, סכום ותאריך מתעדכנים
// אוטומטית מהתרומה שממנה נפתח. אפשר לבחור שפת תוכן (עברית/אנגלית/רוסית;
// ברוסית גם זכר/נקבה), להוריד כתמונה, לשתף בוואטסאפ או לשלוח במייל.
//
// וואטסאפ: התמונה תמיד יורדת למכשיר קודם (קישורי wa.me לא תומכים בצירוף
// קובץ), ואז נפתח קישור wa.me עם הטקסט מוכן מראש — לצ'אט של המספר שהוזן,
// או לבחירת איש קשר ידנית אם לא הוזן טלפון.
//
// לוגו: כדי להציג תמונת לוגו במקום העיגול עם "ח", יש לשמור קובץ תמונה
// בשם "logo.png" בתיקיית public/ (כלומר בנתיב public/logo.png). האפליקציה
// טוענת אותו אוטומטית תוך התחשבות בנתיב הבסיס של האתר (import.meta.env.BASE_URL,
// למשל "/my-app/logo.png" בפריסה ב-GitHub Pages); אם הקובץ לא קיים,
// מוצג העיגול הדקורטיבי הרגיל כברירת מחדל.
export function ThankYouLetterModal({ donorName, amount, date, phone, email, onClose }: Props) {
  const letterRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'download' | 'whatsapp' | 'email' | null>(null);
  const [emailInput, setEmailInput] = useState(email || '');
  const [phoneInput, setPhoneInput] = useState(phone || '');
  const [downloaded, setDownloaded] = useState(false);
  const [lang, setLang] = useState<Lang>('he');
  const [gender, setGender] = useState<Gender>('m');
  const [logoOk, setLogoOk] = useState(true);

  const t = LETTER_TEXT[lang];
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;

  const today = new Date();
  const displayDate = date || today.toLocaleDateString(t.locale);

  const bodyText = t.body(donorName, amount, displayDate, gender);

  const renderImage = async (): Promise<string> => {
    if (!letterRef.current) throw new Error('no ref');
    // חשוב: לא להעביר width/height כאן — אלו אפשרויות של html-to-image
    // שמאלצות שינוי גודל בפועל של האלמנט *לפני* הצילום (לא רק גודל הפלט),
    // מה שגרם למכתב להיראות זעיר עם המסגרת "בורחת" הצידה. pixelRatio לבדו
    // מספיק כדי לקבל תמונה חדה, בהתאם לגודל האמיתי של האלמנט (450x638).
    return toPng(letterRef.current, {
      pixelRatio: 2,
      backgroundColor: '#FAF6EE',
      style: { transform: 'none', margin: '0' },
    });
  };

  const downloadImage = async () => {
    setBusy('download');
    try {
      const dataUrl = await renderImage();
      const link = document.createElement('a');
      link.download = `מכתב-תודה-${donorName}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloaded(true);
    } catch (e) {
      console.error(e);
      alert('שגיאה ביצירת התמונה');
    } finally {
      setBusy(null);
    }
  };

  const sendWhatsapp = async () => {
    setBusy('whatsapp');
    try {
      const dataUrl = await renderImage();

      let p = (phoneInput || '').replace(/\D/g, '');
      if (p && p.startsWith('0')) p = '972' + p.substring(1);

      // מוריד את התמונה לגלריה — המשתמש יצרף אותה ידנית בוואטסאפ
      const link = document.createElement('a');
      link.download = `מכתב-תודה-${donorName}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloaded(true);

      // פותח ישירות את הצ'אט של התורם (אם יש טלפון) עם טקסט מוכן
      window.open(
        p
          ? `https://wa.me/${p}?text=${encodeURIComponent(bodyText)}`
          : `https://wa.me/?text=${encodeURIComponent(bodyText)}`,
        '_blank'
      );
    } catch (e) {
      console.error(e);
      alert('שגיאה בשיתוף');
    } finally {
      setBusy(null);
    }
  };

  const sendEmail = async () => {
    setBusy('email');
    try {
      await downloadImage();
      const subject = encodeURIComponent(`מכתב תודה — ${donorName}`);
      const body = encodeURIComponent(`${bodyText}\n\n(התמונה המעוצבת ירדה למכשיר — יש לצרף אותה להודעה)`);
      window.location.href = `mailto:${emailInput || ''}?subject=${subject}&body=${body}`;
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0D1B2A]/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-[#FAF6EE] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex justify-between items-center p-4 bg-white border-b border-[#EDE6D6] shrink-0">
          <h2 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">מכתב תודה מעוצב</h2>
          <button onClick={onClose} className="p-2 -m-2 text-gray-400 hover:text-gray-600 rounded-full transition-colors active:scale-95">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Language selector */}
          <div className="mb-3">
            <label className="block text-[11px] font-bold text-gray-500 mb-1">שפת המכתב</label>
            <div className="flex gap-2">
              <button
                onClick={() => setLang('he')}
                className={`flex-1 py-2 px-3 rounded-xl border text-sm font-bold transition-colors ${lang === 'he' ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : 'bg-white text-gray-600 border-[#EDE6D6] hover:border-[#C9A84C]'}`}
              >
                עברית
              </button>
              <button
                onClick={() => setLang('en')}
                className={`flex-1 py-2 px-3 rounded-xl border text-sm font-bold transition-colors ${lang === 'en' ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : 'bg-white text-gray-600 border-[#EDE6D6] hover:border-[#C9A84C]'}`}
              >
                English
              </button>
              <button
                onClick={() => setLang('ru')}
                className={`flex-1 py-2 px-3 rounded-xl border text-sm font-bold transition-colors ${lang === 'ru' ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : 'bg-white text-gray-600 border-[#EDE6D6] hover:border-[#C9A84C]'}`}
              >
                Русский
              </button>
            </div>
          </div>

          {/* Russian gender selector — only relevant when Russian is selected */}
          {lang === 'ru' && (
            <div className="mb-3">
              <label className="block text-[11px] font-bold text-gray-500 mb-1">פנייה (זכר / נקבה)</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setGender('m')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-sm font-bold transition-colors ${gender === 'm' ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : 'bg-white text-gray-600 border-[#EDE6D6] hover:border-[#C9A84C]'}`}
                >
                  זכר — Уважаемый
                </button>
                <button
                  onClick={() => setGender('f')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-sm font-bold transition-colors ${gender === 'f' ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : 'bg-white text-gray-600 border-[#EDE6D6] hover:border-[#C9A84C]'}`}
                >
                  נקבה — Уважаемая
                </button>
              </div>
            </div>
          )}

          {/* Letter preview / capture target */}
          <div className="rounded-2xl overflow-hidden border border-[#EDE6D6] shadow-sm">
            <div
              ref={letterRef}
              style={{ width: 450, height: 638, direction: t.dir }}
              className="relative bg-[#FAF6EE] flex flex-col items-center justify-between p-8 mx-auto overflow-hidden"
            >
              {/* Decorative border */}
              <div className="absolute inset-3 border-2 border-[#C9A84C] rounded-xl pointer-events-none" />
              <div className="absolute inset-5 border border-[#C9A84C]/40 rounded-lg pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center pt-4">
                {logoOk ? (
                  <img
                    src={logoSrc}
                    alt="לוגו"
                    onError={() => setLogoOk(false)}
                    className="w-14 h-14 rounded-full object-cover shadow-md"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-14 h-14 bg-gradient-to-br from-[#C9A84C] to-[#9B7A2F] rounded-full flex items-center justify-center font-['Frank_Ruhl_Libre'] text-2xl text-white font-black shadow-md">
                    ח
                  </div>
                )}
                <div className="font-['Frank_Ruhl_Libre'] text-sm font-bold text-[#9B7A2F] mt-2">{ORG[lang]}</div>
              </div>

              <div className="relative z-10 text-center flex-1 flex flex-col items-center justify-center gap-4 px-2">
                <div className="font-['Frank_Ruhl_Libre'] text-2xl font-black text-[#0D1B2A]">{t.certTitle}</div>
                <div className="text-sm text-[#3a3a3a] leading-relaxed">
                  {t.toLabel(gender)}<br />
                  <span className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A] block mt-1 break-words max-w-[320px] mx-auto">{donorName}</span>
                </div>
                <div className="text-xs text-[#5a5a5a] leading-relaxed max-w-[320px]">
                  {t.thanksLine}
                </div>
                <div className="font-['Frank_Ruhl_Libre'] text-3xl font-black text-[#C9A84C] mt-1">₪{amount.toLocaleString()}</div>
                <div className="text-[11px] text-[#8a8a8a]">{displayDate}</div>
              </div>

              <div className="relative z-10 text-center pb-2">
                <div className="text-xs text-[#5a5a5a]">{t.regards}</div>
                <div className="font-['Frank_Ruhl_Libre'] text-sm font-bold text-[#0D1B2A]">{SIGNER[lang]}</div>
                <div className="text-[10px] text-[#8a8a8a] mt-0.5">{ORG[lang]}</div>
              </div>
            </div>
          </div>

          {/* Recipient fields */}
          <div className="mt-4 space-y-2">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">טלפון לוואטסאפ (אופציונלי)</label>
              <input
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value)}
                placeholder="050-000-0000"
                dir="ltr"
                className="w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">אימייל (אופציונלי)</label>
              <input
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="name@example.com"
                dir="ltr"
                className="w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C]"
              />
            </div>
            {downloaded && (
              <div className="text-[11px] text-emerald-600 font-semibold">✓ התמונה ירדה למכשיר — ניתן לצרף אותה ידנית להודעה</div>
            )}
          </div>
        </div>

        <div className="p-4 bg-white border-t border-[#EDE6D6] shrink-0 space-y-2">
          <button
            onClick={sendWhatsapp}
            disabled={busy !== null}
            className="w-full bg-[#25D366] hover:bg-[#20BE5C] disabled:opacity-60 text-white rounded-xl p-3 font-['Frank_Ruhl_Libre'] font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {busy === 'whatsapp' ? <Loader2 size={18} className="animate-spin" /> : <MessageSquare size={18} />}
            שליחה ב-WhatsApp
          </button>
          <div className="flex gap-2">
            <button
              onClick={sendEmail}
              disabled={busy !== null}
              className="flex-1 bg-[#0D1B2A] hover:bg-[#16283d] disabled:opacity-60 text-white rounded-xl p-3 text-sm font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {busy === 'email' ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              שליחה במייל
            </button>
            <button
              onClick={downloadImage}
              disabled={busy !== null}
              className="flex-1 bg-white border border-[#EDE6D6] hover:border-[#C9A84C] disabled:opacity-60 text-[#0D1B2A] rounded-xl p-3 text-sm font-bold transition-all flex items-center justify-center gap-2"
            >
              {busy === 'download' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              הורדה
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
