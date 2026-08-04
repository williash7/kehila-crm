import React, { useState, useEffect } from 'react';
import { X, MessageSquare } from 'lucide-react';
import { orgNameIn } from '../lib/orgConfig';

export function ThankYouModal({ donorName, amount, phone, onClose }: { donorName: string, amount: number, phone: string, onClose: () => void }) {
  const [language, setLanguage] = useState<'he' | 'en' | 'ru'>('he');
  const fn = donorName.trim().split(' ')[0] || donorName;
  
  const templates = {
    he: `שלום ${fn},\nרצינו לומר תודה רבה על תרומתך בסך ${amount} ₪! ${orgNameIn('he')} מעריכים את התמיכה שלך מאוד. שיעמוד לך ולבני משפחתך לטובה ולברכה מרובה ברוחניות ובגשמיות!`,
    en: `Dear ${fn},\nThank you so much for your generous donation of ₪${amount}! ${orgNameIn('en')} deeply appreciates your support. May it bring you and your family abundant blessings both spiritually and materially!`,
    ru: `Здравствуйте ${fn},\nОгромное спасибо за ваше щедрое пожертвование в размере ₪${amount}! ${orgNameIn('ru')} глубоко ценит вашу поддержку. Пусть это принесет вам и вашей семье огромные благословения во всем!`
  };

  const [message, setMessage] = useState(templates[language]);

  useEffect(() => {
    setMessage(templates[language]);
  }, [language, fn, amount]);

  const handleSend = () => {
    let p = phone.replace(/\D/g, '');
    if (p && p.startsWith('0')) p = '972' + p.substring(1);
    const url = p ? `https://wa.me/${p}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#0D1B2A]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-[#FAF6EE] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 bg-white border-b border-[#EDE6D6]">
          <h2 className="font-['Frank_Ruhl_Libre'] text-2xl font-bold text-[#0D1B2A] flex items-center gap-2">
            <MessageSquare size={24} className="text-[#C9A84C]" />
            הודעת תודה שנקבעה
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors active:scale-95">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">בחר שפה</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setLanguage('he')}
                className={`flex-1 py-2 px-3 rounded-xl border text-sm font-bold transition-colors ${language === 'he' ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : 'bg-white text-gray-600 border-[#EDE6D6] hover:border-[#C9A84C]'}`}
              >
                עברית
              </button>
              <button 
                onClick={() => setLanguage('en')}
                className={`flex-1 py-2 px-3 rounded-xl border text-sm font-bold transition-colors ${language === 'en' ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : 'bg-white text-gray-600 border-[#EDE6D6] hover:border-[#C9A84C]'}`}
              >
                English
              </button>
              <button 
                onClick={() => setLanguage('ru')}
                className={`flex-1 py-2 px-3 rounded-xl border text-sm font-bold transition-colors ${language === 'ru' ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : 'bg-white text-gray-600 border-[#EDE6D6] hover:border-[#C9A84C]'}`}
              >
                Русский
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">ערוך הודעה</label>
            <textarea
              className="w-full bg-white border border-[#EDE6D6] rounded-xl p-3 text-sm min-h-[150px] outline-none focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] resize-y"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              dir={language === 'he' ? 'rtl' : 'ltr'}
            />
          </div>
        </div>

        <div className="p-5 bg-white border-t border-[#EDE6D6]">
          <button 
            onClick={handleSend}
            className="w-full bg-[#25D366] hover:bg-[#20BE5C] text-white rounded-xl p-3.5 font-['Frank_Ruhl_Libre'] text-lg font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <MessageSquare size={20} />
            שליחת הודעה ב-WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
