import React, { useEffect, useRef, useState } from 'react';
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
  blessing: string;
  amountLabel: string;
  regards: string;
  body: (donorName: string, amount: number, date: string, g: Gender) => string;
}> = {
  he: {
    dir: 'rtl',
    locale: 'he-IL',
    certTitle: 'מכתב תודה והוקרה',
    toLabel: () => 'לכבוד',
    thanksLine: `תודה מעומק הלב על השותפות והתמיכה בפעילות ${ORG.he} ובקהילה שלנו.`,
    blessing: 'יהי רצון שתזכו לשפע ברכה והצלחה, לבריאות, לנחת ולכל טוב בגשמיות וברוחניות.',
    amountLabel: 'סכום התרומה',
    regards: 'בהערכה ובתודה,',
    body: (name, amount, date) =>
      `לכבוד ${name},\n\nתודה מעומק הלב על תרומתך בסך ${amount.toLocaleString('he-IL')} ₪ מתאריך ${date}, ועל השותפות בפעילות ${ORG.he} ובקהילה שלנו.\nיהי רצון שתזכו לשפע ברכה והצלחה, לבריאות, לנחת ולכל טוב בגשמיות וברוחניות.\n\nבהערכה ובתודה,\n${SIGNER.he}\n${ORG.he}`,
  },
  en: {
    dir: 'ltr',
    locale: 'en-US',
    certTitle: 'A Letter of Thanks',
    toLabel: () => 'Dear',
    thanksLine: `Thank you from the heart for your generosity and for supporting ${ORG.en} and our community.`,
    blessing: 'May you and your loved ones be blessed with health, joy, and success in all your good endeavors.',
    amountLabel: 'Your donation',
    regards: 'With heartfelt thanks,',
    body: (name, amount, date) =>
      `Dear ${name},\n\nThank you from the heart for your donation of ₪${amount.toLocaleString('en-US')} on ${date}, and for supporting ${ORG.en} and our community.\nMay you and your loved ones be blessed with health, joy, and success in all your good endeavors.\n\nWith heartfelt thanks,\n${SIGNER.en}\n${ORG.en}`,
  },
  ru: {
    dir: 'ltr',
    locale: 'ru-RU',
    certTitle: 'Благодарственное письмо',
    toLabel: (g) => (g === 'f' ? 'Уважаемая' : 'Уважаемый'),
    thanksLine: `От всего сердца благодарим Вас за щедрую поддержку ${ORG.ru} и нашей общины.`,
    blessing: 'Пусть Всевышний благословит Вас и Ваших близких здоровьем, радостью и успехом во всех добрых делах!',
    amountLabel: 'Ваше пожертвование',
    regards: 'С благодарностью,',
    body: (name, amount, date, g) =>
      `${g === 'f' ? 'Уважаемая' : 'Уважаемый'} ${name},\n\nОт всего сердца благодарим Вас за пожертвование в размере ${amount.toLocaleString('ru-RU')} ₪ от ${date} и за поддержку ${ORG.ru} и нашей общины.\nПусть Всевышний благословит Вас и Ваших близких здоровьем, радостью и успехом во всех добрых делах!\n\nС благодарностью,\n${SIGNER.ru}\n${ORG.ru}`,
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
  const previewRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'download' | 'whatsapp' | 'email' | null>(null);
  const [emailInput, setEmailInput] = useState(email || '');
  const [phoneInput, setPhoneInput] = useState(phone || '');
  const [downloaded, setDownloaded] = useState(false);
  const [lang, setLang] = useState<Lang>('he');
  const [gender, setGender] = useState<Gender>('m');
  const [logoOk, setLogoOk] = useState(true);
  const [recipientNames, setRecipientNames] = useState<Partial<Record<Lang, string>>>({});
  const [previewScale, setPreviewScale] = useState(0.7);

  // Keep the exported letter at a stable 450 × 638 size while fitting the preview to narrow phones.
  useEffect(() => {
    const element = previewRef.current;
    if (!element) return;
    const updateScale = () => setPreviewScale(Math.min(1, element.clientWidth / 450));
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const t = LETTER_TEXT[lang];
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;

  const today = new Date();
  const displayDate = date || today.toLocaleDateString(t.locale);

  const recipientName = recipientNames[lang]?.trim() || donorName;
  const needsLocalizedName = lang !== 'he' && /[\u0590-\u05FF]/.test(recipientName);
  const recipientFontSize = recipientName.length > 34 ? 18 : recipientName.length > 23 ? 21 : 26;
  const bodyText = t.body(recipientName, amount, displayDate, gender);

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
      const subject = encodeURIComponent(`${t.certTitle} — ${recipientName}`);
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

          {/* Editable display name prevents Hebrew donor names from breaking Russian/English letters. */}
          <div className="mb-3">
            <label className="block text-[11px] font-bold text-gray-500 mb-1">שם התורם כפי שיופיע במכתב</label>
            <input
              value={recipientNames[lang] ?? donorName}
              onChange={e => setRecipientNames(current => ({ ...current, [lang]: e.target.value }))}
              dir={t.dir}
              className="w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A84C]"
            />
            {needsLocalizedName && (
              <p className="mt-1 text-[11px] text-amber-700">
                השם עדיין בעברית — מומלץ לרשום אותו {lang === 'ru' ? 'ברוסית' : 'באנגלית'} לפני שליחת המכתב.
              </p>
            )}
          </div>

          {/* Always capture a fixed-size letter. Only its on-screen preview is scaled. */}
          <div className="rounded-2xl border border-[#EDE6D6] shadow-sm bg-white overflow-hidden">
            <div
              ref={previewRef}
              className="w-full overflow-hidden flex justify-center"
              style={{ height: Math.ceil(638 * previewScale) }}
            >
              <div
                ref={letterRef}
                dir={t.dir}
                style={{
                  width: 450,
                  height: 638,
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top center',
                  fontFamily: lang === 'he' ? 'Arial, sans-serif' : 'Georgia, "Times New Roman", serif',
                }}
                className="relative shrink-0 bg-[#FCFAF5] overflow-hidden flex flex-col items-center text-center"
              >
                <div className="absolute inset-[14px] border border-[#C9A84C] rounded-[18px] pointer-events-none" />
                <div className="relative w-full shrink-0 flex flex-col items-center pt-9 px-9">
                  {logoOk ? (
                    <img
                      src={logoSrc}
                      alt="לוגו"
                      onError={() => setLogoOk(false)}
                      className="w-[68px] h-[68px] rounded-full object-contain bg-white"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-[68px] h-[68px] rounded-full bg-[#C9A84C] flex items-center justify-center text-white text-3xl font-bold">ח</div>
                  )}
                  <div className="mt-2 max-w-[335px] text-[14px] font-bold leading-snug text-[#9B7A2F] break-words" style={{ overflowWrap: 'anywhere' }}>
                    {ORG[lang]}
                  </div>
                </div>

                <div className="relative w-full flex-1 min-h-0 flex flex-col justify-center items-center px-12 gap-[11px]">
                  <div className="w-14 h-px bg-[#C9A84C]" />
                  <h3 className="font-bold text-[27px] leading-[1.22] text-[#0D1B2A] max-w-[350px]">
                    {t.certTitle}
                  </h3>
                  <div className="w-full">
                    <p className="text-[15px] text-[#525964] leading-snug">{t.toLabel(gender)}</p>
                    <div
                      dir={t.dir}
                      className="mt-1 mx-auto max-w-[342px] font-bold text-[#0D1B2A] leading-[1.22] break-words"
                      style={{ fontSize: recipientFontSize, overflowWrap: 'anywhere' }}
                    >
                      {recipientName}
                    </div>
                  </div>
                  <p className="text-[14px] leading-[1.52] text-[#4C5159] max-w-[335px]">{t.thanksLine}</p>
                  <div className="flex flex-col gap-[3px]">
                    <span className="text-[11px] tracking-wide font-semibold text-[#9B7A2F]">{t.amountLabel}</span>
                    <span className="font-bold text-[33px] leading-none text-[#B28B37]" dir="ltr">
                      {amount.toLocaleString(t.locale)} ₪
                    </span>
                  </div>
                  <p className="text-[13px] leading-[1.48] text-[#4C5159] max-w-[338px]">{t.blessing}</p>
                </div>

                <div className="relative w-full shrink-0 flex flex-col items-center px-10 pb-9">
                  <div className="w-14 h-px bg-[#C9A84C] mb-3" />
                  <p className="text-[12px] text-[#5F6268]">{t.regards}</p>
                  <p className="text-[16px] font-bold text-[#0D1B2A] leading-snug mt-1 max-w-[350px] break-words">{SIGNER[lang]}</p>
                  <p className="text-[11px] text-[#888888] mt-1" dir="ltr">{displayDate}</p>
                </div>
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
