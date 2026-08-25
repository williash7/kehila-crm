import React from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useAppStore } from '../store/AppContext';

export function DailyReminderCard() {
  const { settings, updateSettings } = useAppStore();
  const supported = typeof Notification !== 'undefined';
  const [message, setMessage] = React.useState('');

  const toggle = async () => {
    if (settings.dailyReminderEnabled) {
      updateSettings({ dailyReminderEnabled: false });
      setMessage('התזכורת כובתה במכשיר הזה.');
      return;
    }
    if (!supported) {
      setMessage('הדפדפן הזה אינו תומך בהתראות. אפשר לנסות לאחר התקנת האפליקציה במסך הבית.');
      return;
    }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') {
      setMessage('לא ניתנה הרשאת התראות. אפשר לשנות זאת בהגדרות האתר או הטלפון.');
      return;
    }
    updateSettings({ dailyReminderEnabled: true });
    setMessage('התזכורת הופעלה במכשיר הזה.');
  };

  return <section className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
    <div className="flex items-start gap-3">
      <span className="w-10 h-10 rounded-xl bg-[#FAF6EE] text-[#9B7A2F] flex items-center justify-center shrink-0">
        {settings.dailyReminderEnabled ? <Bell size={19} /> : <BellOff size={19} />}
      </span>
      <div className="min-w-0">
        <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">תזכורת יומית מרוכזת</h3>
        <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">התראה אחת ורק כשיש כשל חיוב, משימה שהגיעה למועד או הוראת קבע שמסתיימת. כבוי כברירת מחדל ונשמר במכשיר הזה בלבד.</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <button onClick={() => void toggle()} className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${settings.dailyReminderEnabled ? 'bg-red-50 text-red-600' : 'bg-[#0D1B2A] text-white'}`}>
        {settings.dailyReminderEnabled ? 'כבה תזכורת' : 'הפעל תזכורת במכשיר'}
      </button>
      <input type="time" value={settings.dailyReminderTime} onChange={event => updateSettings({ dailyReminderTime: event.target.value || '08:00' })} aria-label="שעת התזכורת" className="w-28 py-2.5 px-3 rounded-xl border border-[#EDE6D6] text-sm" />
    </div>
    <p className="text-[10px] text-amber-700 bg-amber-50 rounded-lg p-2 leading-relaxed">בלי שירות התראות מרכזי, הדפדפן אינו מבטיח להעיר אפליקציה שסגורה לגמרי. ההתראה מוצגת כשהאפליקציה פעילה או כשהמכשיר מעיר אותה ברקע.</p>
    {message && <div className="text-[11px] text-[#0D1B2A] bg-[#FAF6EE] rounded-lg p-2">{message}</div>}
  </section>;
}
