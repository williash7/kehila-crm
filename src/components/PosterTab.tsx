import React, { useState, useRef, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useAppStore } from '../store/AppContext';
import { HDate } from '@hebcal/core';
import { getOrg, hebcalUrl } from '../lib/orgConfig';
import { POSTER_TEXT, HEBCAL_LANG } from '../lib/posterI18n';

export function PosterTab({ onClose }: { onClose: () => void }) {
  const { shabbat } = useAppStore();

  // כל הטקסטים בפוסטר מגיעים ממילון התרגומים לפי השפה שנבחרה בהגדרות,
  // ופרטי הארגון (שם, כתובת, טלפון) מגיעים מהגדרות הארגון.
  const org = getOrg();
  const T = POSTER_TEXT[org.posterLang] || POSTER_TEXT.he;
  const venue = org.venueName || org.orgName.he;
  const posterRef = useRef<HTMLDivElement>(null);
  const isMevarchimToggled = useRef<boolean>(false);
  
  // Custom states
  const [includeClass, setIncludeClass] = useState(true);
  const [isMevarchim, setIsMevarchim] = useState(false);
  const [halachaTime, setHalachaTime] = useState('18:15');
  const [candleTime, setCandleTime] = useState('18:45');
  const [minchaFriday, setMinchaFriday] = useState('19:00');
  const [kabbalatShabbat, setKabbalatShabbat] = useState('19:35');
  const [kiddush, setKiddush] = useState('20:10');
  const [chassidut, setChassidut] = useState('09:00');
  const [shacharit, setShacharit] = useState('09:30');
  const [minchaShabbat, setMinchaShabbat] = useState('18:45');
  const [havdalah, setHavdalah] = useState('19:54');
  const [subtitle, setSubtitle] = useState('');
  
  const [dateFriday, setDateFriday] = useState('');
  const [dateShabbat, setDateShabbat] = useState('');
  const [parasha, setParasha] = useState('');

  const [bgImage, setBgImage] = useState<string | null>(() => localStorage.getItem('poster_bgImage'));
  const [bgOverlay, setBgOverlay] = useState(() => {
    const saved = localStorage.getItem('poster_bgOverlay');
    return saved !== null ? +saved : 40;
  });
  const bgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('poster_bgOverlay', String(bgOverlay));
  }, [bgOverlay]);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setBgImage(dataUrl);
      try {
        localStorage.setItem('poster_bgImage', dataUrl);
      } catch {
        alert('התמונה גדולה מדי לשמירה — נסה תמונה קטנה יותר');
      }
    };
    reader.readAsDataURL(file);
  };

  const removeBg = () => {
    setBgImage(null);
    localStorage.removeItem('poster_bgImage');
    if (bgInputRef.current) bgInputRef.current.value = '';
  };

  const months = T.months;

  useEffect(() => {
    if (shabbat?.items) {
      const parashaItem = shabbat.items.find((i: any) => i.category === 'parashat');
      const candleItem = shabbat.items.find((i: any) => i.category === 'candles');
      const havdalahItem = shabbat.items.find((i: any) => i.category === 'havdalah');
      
      const paramMevarchim = shabbat.items.find((i: any) => i.category === 'mevarchim');
      if (paramMevarchim && !isMevarchimToggled.current) {
         setIsMevarchim(true);
         setSubtitle(s => s || T.tehillimTitle.split('\n').pop()!.replace(/"/g, ''));
      }
      
      if (parashaItem) {
        // Fetch translated parasha
        // אותה בקשה, בשפת הפוסטר — Hebcal מחזיר את שם הפרשה מתורגם
        fetch(hebcalUrl('shabbat', { lg: HEBCAL_LANG[org.posterLang] }))
          .then(r => r.json())
          .then(data => {
             const translated = data.items?.find((i: any) => i.category === 'parashat');
             const raw = translated?.title || parashaItem.title;
             const name = raw.replace(/^(Parashat|Глава|פרשת)\s+/, '');
             setParasha(`${T.parashaPrefix} ${name}`);
          }).catch(() => {
             setParasha(`${T.parashaPrefix} ${parashaItem.title.replace('Parashat ', '')}`);
          });
      }

      if (candleItem) {
        const d = new Date(candleItem.date);
        setCandleTime(`${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`);
        // calculate default mincha 15m after
        const m = new Date(d.getTime() + 15*60000);
        setMinchaFriday(`${m.getHours()}:${m.getMinutes().toString().padStart(2, '0')}`);
        // kabbalat shabbat 35m later
        const ks = new Date(m.getTime() + 35*60000);
        setKabbalatShabbat(`${ks.getHours()}:${ks.getMinutes().toString().padStart(2, '0')}`);
        // kiddush
        const kd = new Date(ks.getTime() + 35*60000);
        setKiddush(`${kd.getHours()}:${kd.getMinutes().toString().padStart(2, '0')}`);
        
        // Friday Date string
        const hdayFr = new HDate(d);
        setDateFriday(`${T.friday}, ${hdayFr.getDate()} ${translateHebMonth(hdayFr.getMonthName())} / ${d.getDate()} ${months[d.getMonth()]}`);
      }

      if (havdalahItem) {
        const d = new Date(havdalahItem.date);
        setHavdalah(`${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`);
        // Mincha shabbat same as candle lighting approximately
        if (candleItem) {
          const cd = new Date(candleItem.date);
          setMinchaShabbat(`${cd.getHours()}:${cd.getMinutes().toString().padStart(2, '0')}`);
          // Halacha 30m before
          const hd = new Date(cd.getTime() - 30*60000);
          setHalachaTime(`${hd.getHours()}:${hd.getMinutes().toString().padStart(2, '0')}`);
        }
        
        // Shabbat Date string
        const hdShab = new HDate(d);
        setDateShabbat(`${T.saturday}, ${hdShab.getDate()} ${translateHebMonth(hdShab.getMonthName())} / ${d.getDate()} ${months[d.getMonth()]}`);
      }
    }
  }, [shabbat]);

  const translateHebMonth = (m: string) => T.hebMonths[m] || m;

  const handleDownload = async () => {
    if (!posterRef.current) return;
    try {
      // html-to-image uses browser native rendering, ignoring external transforms on parents.
      const dataUrl = await toPng(posterRef.current, { 
        width: 1080,
        height: 1527,
        pixelRatio: 2, 
        backgroundColor: '#FBF9F6',
        fontEmbedCSS: '', // By passing an empty string, it skips the failing font CSS inlining
        style: {
          direction: 'ltr', // Force LTR for the capture root just in case
          transform: 'none', // Prevent inherited scaling issues in clone
          transformOrigin: 'top left',
          margin: '0'
        }
      });
      
      const link = document.createElement("a");
      link.download = "shabbat-times.png";
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
      alert("שגיאה ביצירת התמונה");
    }
  };

  return (
    <div className="fixed inset-0 bg-[#FAF6EE] z-[100] flex flex-col h-full override-rtl" dir="ltr">
      <div className="bg-[#0D1B2A] text-white px-4 py-3 flex items-center justify-between" dir="rtl">
        <h2 className="font-['Frank_Ruhl_Libre'] text-xl font-bold">מחולל זמני שבת</h2>
        <div className="flex gap-2">
          <button onClick={handleDownload} className="bg-[#C9A84C] text-white px-3 py-1.5 rounded-lg flex items-center gap-2 font-bold text-sm">
            <Download size={16} /> הורד
          </button>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full">
            <X size={18} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 pb-20">
        
        {/* Controls */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6 border border-[#EDE6D6]" dir="rtl">
           <h3 className="font-bold text-[#0D1B2A] mb-3">הגדרות מודעה</h3>
           <div className="flex flex-wrap gap-4 mb-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                 <input type="checkbox" checked={includeClass} onChange={(e) => setIncludeClass(e.target.checked)} className="w-4 h-4 text-[#C9A84C]" />
                 כולל שיעור הלכה (מציג את התיבה)
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                 <input type="checkbox" checked={isMevarchim} onChange={(e) => {
                    isMevarchimToggled.current = true;
                    setIsMevarchim(e.target.checked);
                 }} className="w-4 h-4 text-[#C9A84C]" />
                 שבת מברכים (מציג תהילים)
              </label>
           </div>
           <div className="mb-4">
              <label className="block text-xs font-bold text-gray-500 mb-1">כותרת משנה (למשל: שבת מברכים, שבת ראש חודש)</label>
              <input
                type="text"
                value={subtitle}
                onChange={e => setSubtitle(e.target.value)}
                placeholder="השאר ריק אם אין כותרת משנה"
                className="w-full border border-[#EDE6D6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C9A84C]"
              />
           </div>

           {/* Background image upload */}
           <div className="border-t border-[#EDE6D6] pt-4 mt-2">
             <p className="text-sm font-bold text-[#0D1B2A] mb-2">תמונת רקע מותאמת אישית</p>
             <div className="flex items-center gap-3 flex-wrap">
               <button
                 onClick={() => bgInputRef.current?.click()}
                 className="bg-[#0D1B2A] text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-[#1a2d44] transition-colors"
               >
                 📁 העלה תמונה
               </button>
               {bgImage && (
                 <button onClick={removeBg} className="text-red-500 text-sm font-semibold hover:text-red-700">
                   ✕ הסר תמונה
                 </button>
               )}
               <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
               {bgImage
                 ? <span className="text-green-600 text-sm font-semibold">✓ תמונה נטענה</span>
                 : <span className="text-gray-400 text-xs">ללא תמונה — יוצג עיצוב ברירת המחדל</span>
               }
             </div>
             {bgImage && (
               <div className="mt-3 flex items-center gap-3">
                 <label className="text-xs text-gray-500 font-bold whitespace-nowrap">שכבת לובן ({bgOverlay}%)</label>
                 <input
                   type="range" min={0} max={80} value={bgOverlay}
                   onChange={e => setBgOverlay(+e.target.value)}
                   className="flex-1"
                 />
                 <span className="text-xs text-gray-400 whitespace-nowrap">0 = שקוף · 80 = בהיר</span>
               </div>
             )}
           </div>
           <div className="grid grid-cols-2 gap-3" dir="ltr">
              <div className="flex flex-col gap-1">
                 <label className="text-xs text-gray-500 font-bold uppercase">{T.candles}</label>
                 <input type="time" value={candleTime} onChange={e=>setCandleTime(e.target.value)} className="border rounded px-2 py-1" />
              </div>
              <div className="flex flex-col gap-1">
                 <label className="text-xs text-gray-500 font-bold uppercase">{T.minchaEve} — {T.friday}</label>
                 <input type="time" value={minchaFriday} onChange={e=>setMinchaFriday(e.target.value)} className="border rounded px-2 py-1" />
              </div>
              <div className="flex flex-col gap-1">
                 <label className="text-xs text-gray-500 font-bold uppercase">{T.kabbalat}</label>
                 <input type="time" value={kabbalatShabbat} onChange={e=>setKabbalatShabbat(e.target.value)} className="border rounded px-2 py-1" />
              </div>
              <div className="flex flex-col gap-1">
                 <label className="text-xs text-gray-500 font-bold uppercase">{T.kiddushEve}</label>
                 <input type="time" value={kiddush} onChange={e=>setKiddush(e.target.value)} className="border rounded px-2 py-1" />
              </div>
              <div className="flex flex-col gap-1">
                 <label className="text-xs text-gray-500 font-bold uppercase">{T.chassidut}</label>
                  <input type="time" value={chassidut} onChange={e=>setChassidut(e.target.value)} className="border rounded px-2 py-1" />
               </div>
               <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-bold uppercase">{T.shacharit}</label>
                  <input type="time" value={shacharit} onChange={e=>setShacharit(e.target.value)} className="border rounded px-2 py-1" />
               </div>
               <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-bold uppercase">{T.minchaDay} — {T.saturday}</label>
                 <input type="time" value={minchaShabbat} onChange={e=>setMinchaShabbat(e.target.value)} className="border rounded px-2 py-1" />
              </div>
              {includeClass && (
                <div className="flex flex-col gap-1">
                   <label className="text-xs text-gray-500 font-bold uppercase">{T.halachaClass}</label>
                   <input type="time" value={halachaTime} onChange={e=>setHalachaTime(e.target.value)} className="border rounded px-2 py-1" />
                </div>
              )}
              <div className="flex flex-col gap-1">
                 <label className="text-xs text-gray-500 font-bold uppercase">{T.havdalah}</label>
                 <input type="time" value={havdalah} onChange={e=>setHavdalah(e.target.value)} className="border rounded px-2 py-1" />
              </div>
           </div>
        </div>

        {/* Poster Wrapper */}
        <div className="flex justify-center bg-gray-200 py-6 rounded-xl overflow-hidden shadow-inner w-full overflow-x-auto">
          <div className="origin-top-left flex-shrink-0" style={{ transform: 'scale(0.35)', width: '1080px', height: '1527px', marginBottom: '-992px', marginRight: '-702px' }}>
            
            {/* The Poster DOM */}
            <div
              ref={posterRef}
              dir="ltr"
              className="w-[1080px] h-[1527px] bg-white relative overflow-hidden flex flex-col origin-top-left"
              style={{
                fontFamily: '"Times New Roman", Times, serif',
                ...(bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {})
              }}
            >
               {/* Default graphic elements — hidden when custom bg is active */}
               {!bgImage && (
                 <>
                   <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-br from-[#802032] via-[#6B1A28] to-[#450d18]"></div>
                   <svg className="absolute top-0 left-0 w-full h-[500px] opacity-10" viewBox="0 0 1080 500">
                     <pattern id="pattern-circles" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                       <circle cx="20" cy="20" r="1.5" fill="#ffffff" />
                     </pattern>
                     <rect x="0" y="0" width="100%" height="100%" fill="url(#pattern-circles)" />
                   </svg>
                   <svg className="absolute top-[370px] left-0 w-full z-10" viewBox="0 0 1080 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                     <path d="M0,40 Q270,125 540,60 T1080,40 L1080,150 L0,150 Z" fill="#FBF9F6"/>
                     <path d="M0,20 Q270,105 540,40 T1080,20 L1080,150 L0,150 Z" fill="#ffffff" opacity="0.3"/>
                   </svg>
                 </>
               )}

               {/* Body background (default) or white overlay on custom bg for readability */}
               <div
                 className="absolute top-0 left-0 w-full h-full -z-10"
                 style={{ backgroundColor: bgImage ? `rgba(255,255,255,${bgOverlay / 100})` : '#FBF9F6' }}
               ></div>
               
               {/* Content */}
               <div className="relative z-20 w-full h-full flex flex-col pt-10">
                  {/* Top Logos */}
                  <div className="absolute top-0 left-0 w-full flex justify-between items-start px-24 z-30">
                     <div className="text-[#ffffff] opacity-80 text-2xl font-bold tracking-widest mt-8 leading-none">ב"ה</div>
                     <div className="bg-[#ffffff] rounded-b-[2rem] px-8 py-6 pb-8 flex flex-col items-center min-w-[280px]" style={{ boxShadow: '0 12px 30px rgba(0,0,0,0.15)' }}>
                         <div className="w-full h-14 bg-[#6B1A28] mb-3 flex items-center justify-center text-[#ffffff] text-[32px] font-black rounded-tl-2xl rounded-br-2xl border-2 border-[#4A0A16] border-b-[5px] tracking-wider leading-none pb-1 relative overflow-hidden">
                           <div className="absolute inset-0 bg-white opacity-10 rounded-full blur-md -top-6 -left-6 w-20 h-20"></div>
                           <span className="relative z-10">{org.shortName || org.orgName.he}</span>
                         </div>
                         <div className="text-[#1f2937] text-[18px] text-center leading-relaxed font-sans font-medium">
                            {org.orgName.he}<br/>
                            {[org.address, org.city].filter(Boolean).join(', ')}
                            {org.phone && <span className="font-bold text-[22px] mt-2 block text-[#6B1A28]">{org.phone}</span>}
                         </div>
                     </div>
                  </div>

                  {/* כותרת ראשית */}
                  <div className="px-24 mt-8 flex flex-col items-start gap-4">
                     <div className="bg-[#ffffff] px-10 py-3 rounded-lg transform -rotate-2" style={{ boxShadow: '0 8px 25px rgba(0,0,0,0.15)' }}>
                        <h1 className="text-[110px] leading-none font-bold text-[#6B1A28] pb-2" style={{ fontFamily: 'Georgia, serif', fontStyle:'italic' }}>{T.titleLine1}</h1>
                     </div>
                     <div className="bg-[#ffffff] px-10 py-3 rounded-lg transform rotate-1 ml-16" style={{ boxShadow: '0 8px 25px rgba(0,0,0,0.15)' }}>
                        <h1 className="text-[110px] leading-none font-bold text-[#6B1A28] pb-2" style={{ fontFamily: 'Georgia, serif', fontStyle:'italic' }}>{T.titleLine2}</h1>
                     </div>
                  </div>

                  {/* Parasha Banner */}
                  <div className="mt-14 w-full relative">
                     <div className="bg-gradient-to-r from-[#de8824] to-[#f4bc3a] px-16 py-5 inline-block max-w-full rounded-r-3xl" style={{ boxShadow: '0 10px 30px rgba(222,136,36,0.3)' }}>
                        <h2 className="text-[#551120] text-[40px] font-black tracking-wide" style={{ textShadow: "1px 1px 0px rgba(255,255,255,0.4)" }}>
                          {parasha || `${T.parashaPrefix} ...`}
                        </h2>
                     </div>
                     <div className="px-24 mt-6 shrink-0 inline-block w-full">
                        <h3 className="text-[#6B1A28] text-[36px] font-bold leading-tight opacity-90" style={{ textShadow: "0px 1px 2px rgba(0,0,0,0.1)" }}>
                           {T.atVenue(venue)}<br/>
                           {[org.address, org.city].filter(Boolean).join(', ')}
                        </h3>
                        {subtitle && (
                           <div className="mt-3 inline-block bg-[#6B1A28] text-[#f4bc3a] text-[26px] font-black px-6 py-2 rounded-full tracking-wide">
                              {subtitle}
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Schedule Area */}
                  <div className="mt-8 px-24 flex items-start justify-between pb-24 relative z-20">
                     {/* Left Column schedule */}
                     <div className="w-[460px] flex flex-col gap-3">
                        
                        <h3 className="text-[#d78f3c] text-[20px] font-bold mb-1 tracking-widest uppercase text-center">{dateFriday || `${T.friday}...`}</h3>
                        <div className="flex flex-col items-center mb-3 pt-0 bg-white rounded-2xl py-2" style={{ boxShadow: '0 5px 20px rgba(0,0,0,0.06)' }}>
                           <div className="text-[#6B1A28] text-[24px] font-bold leading-none mb-1">{T.candles}</div>
                           <div className="text-[#6B1A28] text-[34px] font-black leading-none tracking-tight">{candleTime}</div>
                        </div>

                        <div className="flex justify-between items-end border-b-[2px] border-[#d1d5db] pb-1 w-[460px]">
                           <span className="text-[22px] text-[#551120] font-bold tracking-wide">{T.minchaEve}</span>
                           <span className="text-[22px] text-[#551120] dotted-leader flex-1 mx-4 border-b-[3px] border-dotted border-[#aaa] opacity-60 mb-2 block"></span>
                           <span className="text-[24px] font-black text-[#1f2937] leading-none mb-1">{minchaFriday}</span>
                        </div>
                        <div className="flex justify-between items-end border-b-[2px] border-[#d1d5db] pb-1 w-[460px]">
                           <span className="text-[22px] text-[#551120] font-bold tracking-wide">{T.kabbalat}</span>
                           <span className="text-[22px] text-[#551120] dotted-leader flex-1 mx-4 border-b-[3px] border-dotted border-[#aaa] opacity-60 mb-2 block"></span>
                           <span className="text-[24px] font-black text-[#1f2937] leading-none mb-1">{kabbalatShabbat}</span>
                        </div>
                        <div className="flex justify-between items-end border-b-[2px] border-[#d1d5db] pb-1 w-[460px]">
                           <span className="text-[22px] text-[#551120] font-bold tracking-wide">{T.kiddushEve}</span>
                           <span className="text-[22px] text-[#551120] dotted-leader flex-1 mx-4 border-b-[3px] border-dotted border-[#aaa] opacity-60 mb-2 block"></span>
                           <span className="text-[24px] font-black text-[#1f2937] leading-none mb-1">{kiddush}</span>
                        </div>

                        <h3 className="text-[#d78f3c] text-[20px] font-bold mt-4 mb-1 tracking-widest uppercase text-center">{dateShabbat || `${T.saturday}...`}</h3>
                        
                        <div className="flex justify-between items-end border-b-[2px] border-[#d1d5db] pb-1 w-[460px]">
                           <span className="text-[22px] text-[#551120] font-bold tracking-wide">{T.chassidut}</span>
                           <span className="text-[22px] text-[#551120] dotted-leader flex-1 mx-4 border-b-[3px] border-dotted border-[#aaa] opacity-60 mb-2 block"></span>
                           <span className="text-[24px] font-black text-[#1f2937] leading-none mb-1">{chassidut}</span>
                        </div>
                        <div className="flex justify-between items-end border-b-[2px] border-[#d1d5db] pb-1 w-[460px]">
                           <span className="text-[22px] text-[#551120] font-bold tracking-wide">{T.shacharit}</span>
                           <span className="text-[22px] text-[#551120] dotted-leader flex-1 mx-4 border-b-[3px] border-dotted border-[#aaa] opacity-60 mb-2 block"></span>
                           <span className="text-[24px] font-black text-[#1f2937] leading-none mb-1">{shacharit}</span>
                        </div>
                        <div className="flex justify-between items-end border-b-[2px] border-[#d1d5db] pb-1 w-[460px]">
                           <span className="text-[22px] text-[#551120] font-bold tracking-wide">{T.minchaDay}</span>
                           <span className="text-[22px] text-[#551120] dotted-leader flex-1 mx-4 border-b-[3px] border-dotted border-[#aaa] opacity-60 mb-2 block"></span>
                           <span className="text-[24px] font-black text-[#1f2937] leading-none mb-1">{minchaShabbat}</span>
                        </div>
                        <div className="flex justify-between items-end w-[460px] mt-1">
                           <span className="text-[22px] text-[#551120] font-bold tracking-wide">{T.nigunim}</span>
                        </div>
                        
                        <div className="flex flex-col items-center mt-3 bg-white rounded-2xl py-2" style={{ boxShadow: '0 5px 20px rgba(0,0,0,0.06)' }}>
                           <div className="text-[#6B1A28] text-[24px] font-bold leading-none mb-1">{T.havdalah}</div>
                           <div className="text-[#6B1A28] text-[34px] font-black leading-none tracking-tight">{havdalah}</div>
                        </div>
                        
                     </div>

                     {/* Right Column widgets */}
                     <div className="w-[300px] flex flex-col gap-6 -mt-20 z-20">
                        
                        {isMevarchim && (
                           <div className="bg-[#DDE4E4] rounded-3xl p-5 flex flex-col items-center justify-center border border-[#e5e7eb] relative overflow-hidden" style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
                              <div className="absolute -top-10 -right-10 w-24 h-24 bg-white opacity-40 rounded-full blur-xl"></div>
                              <div className="text-[#6B1A28] text-[26px] font-bold text-center leading-tight mb-2 relative z-10">{T.tehillimTitle.split('\n').map((l, i) => <React.Fragment key={i}>{i > 0 && <br/>}{l}</React.Fragment>)}</div>
                              <div className="text-[#6B1A28] text-[42px] font-black leading-none relative z-10 tracking-tight">{shacharit === '09:30' ? '07:30' : '07:30'}</div>
                           </div>
                        )}

                        <div className="bg-[#DDE4E4] rounded-[2rem] px-5 py-6 relative flex flex-col items-center justify-center text-center border-2 border-white overflow-hidden" style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
                           <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white opacity-40 rounded-full blur-xl"></div>
                           <div className="text-[#6B1A28] text-[32px] font-bold leading-[1.1] mb-2 relative z-10" style={{ textShadow: "0px 1px 1px rgba(255,255,255,0.5)" }}>{T.kiddushWidget.split('\n').map((l, i) => <React.Fragment key={i}>{i > 0 && <br/>}{l}</React.Fragment>)}</div>
                           <div className="text-[#1f2937] text-[14px] font-black uppercase tracking-widest relative z-10">{T.kiddushWidgetSub}</div>
                        </div>

                        {includeClass && (
                           <div className="bg-[#F8F5EE] rounded-[2rem] px-5 py-6 relative flex flex-col items-center justify-center text-center border-2 border-white overflow-hidden" style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
                              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-white opacity-40 rounded-full blur-xl"></div>
                              <div className="text-[#6B1A28] text-[26px] font-bold leading-none mb-2 relative z-10">{T.halachaClass}</div>
                              <div className="text-[#6B1A28] text-[42px] font-black leading-none relative z-10 tracking-tight" style={{ textShadow: "0px 1px 1px rgba(0,0,0,0.1)" }}>{halachaTime}</div>
                           </div>
                        )}
                        
                     </div>
                  </div>

                  {/* Footer ribbon */}
                  {!bgImage ? (
                    <div className="absolute bottom-0 left-0 w-full bg-[#6B1A28] px-24 py-8 flex justify-end items-center">
                       <svg className="absolute top-[-30px] rotate-180 left-0 w-full z-10" viewBox="0 0 1080 30" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                          <path d="M0,0 Q270,30 540,15 T1080,0 L1080,30 L0,30 Z" fill="#6B1A28"/>
                       </svg>
                       <h1 className="text-[#ffffff] text-[56px] font-bold relative z-20" style={{ fontFamily: 'Georgia, serif', fontStyle:'italic', textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}>{T.farewell}</h1>
                    </div>
                  ) : (
                    <div className="absolute bottom-0 left-0 w-full px-24 py-10 flex justify-end items-center">
                       <h1 className="text-[#6B1A28] text-[56px] font-bold" style={{ fontFamily: 'Georgia, serif', fontStyle:'italic', textShadow: "1px 1px 0px rgba(255,255,255,0.8), 2px 2px 6px rgba(0,0,0,0.15)" }}>{T.farewell}</h1>
                    </div>
                  )}

               </div>
               
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
