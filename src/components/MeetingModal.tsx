import React, { useState } from 'react';
import { useAppStore } from '../store/AppContext';
import { X, Calendar, ClipboardList } from 'lucide-react';
import { logAction } from '../lib/score';

export function MeetingModal({ donorName, onClose }: { donorName?: string; onClose: () => void }) {
  const { donors, refresh } = useAppStore();
  const [name, setName] = useState(donorName || '');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [meetType, setMeetType] = useState('אישית');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [nextMeet, setNextMeet] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const saveMeeting = async () => {
    if (!name.trim()) {
      alert('נא להזין שם תורם');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { addMeetingQueued } = await import('../lib/api');

      const dateStr = new Date(date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const nextStr = nextMeet ? new Date(nextMeet).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

      const outcome = await addMeetingQueued({
        name: name.trim(),
        date: dateStr,
        meetType: meetType,
        purpose: purpose.trim(),
        notes: notes.trim(),
        nextMeet: nextStr
      });

      if (outcome.status === 'failed') {
        alert('המפגש לא נשמר: ' + outcome.error);
      } else {
        // גם `queued` סוגר את החלון. המפגש התקבל, והפס העליון כבר מדווח
        // שהוא ממתין לשליחה — אין סיבה להשאיר את אשר מול טופס פתוח.
        logAction('meeting');
        refresh();
        onClose();
      }
    } catch (e: any) {
      alert('שגיאה בתקשורת: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const types = [
    { id: 'אישית', icon: '🏛️', label: 'במשרד' },
    { id: 'ביקור בית', icon: '🏠', label: 'ביקור בית' },
    { id: 'טלפון', icon: '📞', label: 'טלפון' },
    { id: 'זום', icon: '💻', label: 'זום' }
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-end justify-center p-0 md:p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl p-5 pb-8 w-full max-w-[430px] animate-in slide-in-from-bottom duration-300">
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-['Frank_Ruhl_Libre'] text-2xl font-bold text-[#0D1B2A] flex items-center gap-2">
            <ClipboardList className="text-[#C9A84C]" />
            רישום מפגש
          </h2>
          <button onClick={onClose} className="p-2 bg-gray-200/50 rounded-full text-gray-500 hover:bg-gray-200">
            <X size={16}/>
          </button>
        </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">שם תורם</label>
          <input 
            type="text" 
            list="donor-names"
            value={name} 
            onChange={e => setName(e.target.value)}
            className="w-full border-2 border-[#EDE6D6] rounded-xl px-4 py-3 focus:border-[#C9A84C] outline-none transition-colors" 
            placeholder="הזן שם תורם..."
          />
          <datalist id="donor-names">
            {Object.keys(donors).map(n => <option key={n} value={n} />)}
          </datalist>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">תאריך</label>
          <input 
            type="date" 
            value={date} 
            onChange={e => setDate(e.target.value)}
            className="w-full border-2 border-[#EDE6D6] rounded-xl px-4 py-3 focus:border-[#C9A84C] outline-none transition-colors text-[#0D1B2A] font-bold" 
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">סוג מפגש</label>
          <div className="grid grid-cols-2 gap-2">
            {types.map(m => (
              <button 
                key={m.id}
                onClick={() => setMeetType(m.id)}
                className={`border-2 rounded-xl py-3 flex flex-col items-center justify-center gap-1 transition-all ${
                  meetType === m.id ? 'bg-[#0D1B2A] border-[#0D1B2A] text-[#C9A84C]' : 'border-[#EDE6D6] bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                <span className="text-xl">{m.icon}</span>
                <span className="text-xs font-bold">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
           <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">מטרת המפגש</label>
           <input 
             type="text" 
             value={purpose} 
             onChange={e => setPurpose(e.target.value)}
             className="w-full border-2 border-[#EDE6D6] rounded-xl px-4 py-3 focus:border-[#C9A84C] outline-none transition-colors"
             placeholder="שיחת רב, הנחת תפילין..."
           />
        </div>

        <div>
           <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">סיכום ותובנות</label>
           <textarea 
             rows={3}
             value={notes} 
             onChange={e => setNotes(e.target.value)}
             className="w-full border-2 border-[#EDE6D6] rounded-xl px-4 py-3 focus:border-[#C9A84C] outline-none transition-colors resize-none"
             placeholder="מה דיברנו, איך הגיב..."
           ></textarea>
        </div>

        <div>
           <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">מפגש הבא מתוכנן</label>
           <input 
             type="date" 
             value={nextMeet} 
             onChange={e => setNextMeet(e.target.value)}
             className="w-full border-2 border-[#EDE6D6] rounded-xl px-4 py-3 focus:border-[#C9A84C] outline-none transition-colors"
           />
        </div>

        <button 
          onClick={saveMeeting}
          disabled={isSubmitting || !name}
          className="w-full bg-[#0D1B2A] text-[#E8C97A] py-4 rounded-xl font-bold text-sm shadow-xl active:scale-[0.98] transition-transform disabled:opacity-50 mt-2"
        >
          {isSubmitting ? 'שומר...' : 'שמור מפגש'}
        </button>
      </div>
    </div>
  </div>
  );
}
