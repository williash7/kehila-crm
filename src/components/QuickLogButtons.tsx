import React, { useState } from 'react';
import { Phone, MessageSquare } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { logAction } from '../lib/score';

function resolvePhone(donorName: string, donors: Record<string, any>, crm: Record<string, any>): string {
  const donor = donors[donorName] || {};
  const crmData = crm[donorName] || {};
  let raw = String(crmData.phone || donor['טלפון'] || '').replace(/\D/g, '');
  if (raw.startsWith('0')) raw = '972' + raw.substring(1);
  return raw;
}

// שורת פעולות ליצירת קשר עם איש קשר: התקשרות/וואטסאפ ישירים, ושני כפתורי
// תיעוד מהיר (טלפון / מפגש) ששומרים מפגש מיד דרך ה-API הקיים (addMeeting),
// בלי לפתוח שום טופס. משותף לכל מקום שמציג איש קשר שכדאי ליצור איתו קשר
// (אנשי קשר, משימות). personalDateContext אופציונלי: כשמועבר (מ-TasksTab,
// לתזכורת יום הולדת/יארצייט ספציפית) — תיעוד מוצלח גם "סוגר" את התזכורת
// הזו ומציע ליצור משימת המשך (ראה TasksTab.onComplete).
export function QuickLogButtons({ donorName, compact = false, personalDateContext }: { donorName: string; compact?: boolean; personalDateContext?: { onComplete: () => void } }) {
  const { refresh, donors, crm } = useAppStore();
  const [logged, setLogged] = useState<Record<string, number>>({});

  const phone = resolvePhone(donorName, donors, crm);

  const handleQuickLog = async (meetType: 'טלפון' | 'אישית') => {
    setLogged(prev => ({ ...prev, [meetType]: Date.now() }));
    const { apiPost } = await import('../lib/api');
    const dateStr = new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    await apiPost('addMeeting', { name: donorName, date: dateStr, meetType, purpose: '', notes: '' });
    logAction('meeting');
    refresh();
    personalDateContext?.onComplete();
  };

  const isRecent = (meetType: string) => !!logged[meetType] && Date.now() - logged[meetType] < 60000;
  const size = compact ? 'text-[11px] py-1.5' : 'text-xs py-1.5';

  return (
    <div className="flex gap-2">
      {phone && (
        <>
          <a
            href={`tel:${phone}`}
            onClick={e => e.stopPropagation()}
            title="התקשר"
            className="shrink-0 w-9 flex items-center justify-center bg-blue-50 text-blue-700 border border-blue-200 rounded-lg"
          >
            <Phone size={14} />
          </a>
          <a
            href={`https://wa.me/${phone}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            title="WhatsApp"
            className="shrink-0 w-9 flex items-center justify-center bg-green-50 text-green-700 border border-green-200 rounded-lg"
          >
            <MessageSquare size={14} />
          </a>
        </>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); handleQuickLog('טלפון'); }}
        disabled={isRecent('טלפון')}
        className={`flex-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform disabled:opacity-60 ${size}`}
      >
        {isRecent('טלפון') ? '✓ נרשם' : '📞 שוחחתי'}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleQuickLog('אישית'); }}
        disabled={isRecent('אישית')}
        className={`flex-1 bg-green-50 text-green-700 border border-green-200 rounded-lg font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform disabled:opacity-60 ${size}`}
      >
        {isRecent('אישית') ? '✓ נרשם' : '🤝 נפגשנו'}
      </button>
    </div>
  );
}
