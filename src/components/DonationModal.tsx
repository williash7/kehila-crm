import React, { useState } from 'react';
import { FullScreenView } from './FullScreenView';
import { useAppStore } from '../store/AppContext';
import { apiPost } from '../lib/api';
import { ThankYouModal } from './ThankYouModal';
import { activeProjects } from '../lib/projects';
import { CashDestination } from '../types';
import { CASH_DESTINATION_OPTIONS, cleanPaymentMethod, isCashPaymentMethod } from '../lib/cashDonations';

interface DonationModalProps {
  onClose: () => void;
  defaultName?: string;
}

export function DonationModal({ onClose, defaultName = '' }: DonationModalProps) {
  const { donors, refresh, crm, addManualDonation, projects, eventsData } = useAppStore();
  const openProjects = activeProjects(projects);
  const [name, setName] = useState(defaultName);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [purpose, setPurpose] = useState('');
  const [method, setMethod] = useState('קישור ישיר');
  const [cashDestination, setCashDestination] = useState<CashDestination | ''>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [sendWa, setSendWa] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const methods = ['🔗 קישור ישיר', '💵 מזומן', '🏦 העברה בנקאית', '📱 ביט/פייבוקס', '🔄 הוראת קבע', '🌐 אתר תרומות'];

  const handleSave = async () => {
    if (!name || (!amount && amount !== '0')) {
      alert('נא למלא שם וסכום');
      return;
    }
    setLoading(true);
    const dateStr = date ? new Date(date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    
    const cleanMethod = cleanPaymentMethod(method);
    if (isCashPaymentMethod(cleanMethod) && !cashDestination) {
      alert('נא לבחור היכן נמצא המזומן בפועל');
      setLoading(false);
      return;
    }
    
    const res = await apiPost('addDonation', {
      name: name.trim(),
      date: dateStr,
      amount: parseFloat(amount),
      purpose: purpose.trim(),
      method: cleanMethod,
      cashDestination: isCashPaymentMethod(cleanMethod) ? cashDestination : '',
      notes: notes.trim()
    });

    setLoading(false);
    if (!res.error) {
      addManualDonation({
        name: name.trim(),
        date: dateStr,
        amount: parseFloat(amount),
        purpose: purpose.trim(),
        method: cleanMethod,
        cashDestination: isCashPaymentMethod(cleanMethod) ? cashDestination || undefined : undefined,
        notes: notes.trim(),
      });
      refresh();

      if (sendWa && amount) {
         setShowThankYou(true);
      } else {
         onClose();
      }
    } else {
      alert('שגיאה בהוספת תרומה: ' + res.error);
    }
  };

  return (
    <FullScreenView
      eyebrow="תרומה"
      title="הוספת תרומה"
      backLabel="חזרה"
      onClose={onClose}
      footer={
        <button
          disabled={loading}
          onClick={handleSave}
          className={`w-full text-white rounded-xl p-3.5 font-['Frank_Ruhl_Libre'] text-lg font-bold shadow-md active:scale-95 transition-all disabled:opacity-60 disabled:pointer-events-none ${sendWa ? 'bg-[#059669]' : 'bg-gradient-to-br from-[#C9A84C] to-[#9B7A2F]'}`}
        >
          {loading ? 'שומר בגיליון...' : (sendWa ? '✓ שמור ושלח WhatsApp' : '✓ שמור תרומה בגיליון')}
        </button>
      }
    >
      <>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">שם תורם</label>
            <input 
              type="text" 
              list="donors-list"
              className="w-full bg-white border-[1.5px] border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#C9A84C]"
              placeholder="שם..."
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <datalist id="donors-list">
              {Object.keys(donors).map(d => <option key={d} value={d} />)}
            </datalist>
          </div>
          
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">סכום (₪)</label>
            <input 
              type="number" 
              className="w-full bg-white border-[1.5px] border-[#EDE6D6] rounded-xl px-3 py-3 font-['Frank_Ruhl_Libre'] text-2xl font-bold text-[#0D1B2A] outline-none focus:border-[#C9A84C]"
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">תאריך</label>
            <input 
              type="date" 
              className="w-full bg-white border-[1.5px] border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#C9A84C]"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">מטרה</label>

            {/* בחירת פרויקט מייצרת את הקישור לבד: הייעוד נכתב בדיוק כמו
                שהפרויקט מצפה לו, בלי סיכון לשגיאת כתיב. */}
            {openProjects.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] text-gray-400 mb-1">קמפיינים</div>
                <div className="flex flex-wrap gap-1.5">
                {openProjects.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPurpose(purpose === p.purposeTag ? '' : p.purposeTag)}
                    className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                      purpose === p.purposeTag
                        ? 'bg-[#0D1B2A] text-[#C9A84C]'
                        : 'bg-[#C9A84C]/10 text-[#9B7A2F]'
                    }`}
                  >
                    🎯 {p.name}
                  </button>
                ))}
                </div>
              </div>
            )}

            {eventsData.length > 0 && (
              <details className="mb-2">
                <summary className="text-[10px] font-bold text-[#9B7A2F] cursor-pointer">קישור לפעילות — אופציונלי</summary>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {eventsData.map(activity => (
                    <button
                      key={activity.id}
                      type="button"
                      onClick={() => setPurpose(purpose === activity.purposeTag ? '' : activity.purposeTag)}
                      className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                        purpose === activity.purposeTag
                          ? 'bg-[#0D1B2A] text-[#C9A84C]'
                          : 'bg-purple-50 text-purple-700'
                      }`}
                    >
                      📅 {activity.name}
                    </button>
                  ))}
                </div>
              </details>
            )}

            <input
              type="text"
              className="w-full bg-white border-[1.5px] border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#C9A84C]"
              placeholder="ייעוד התרומה..."
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">אפיק גבייה</label>
            <div className="grid grid-cols-2 gap-2">
              {methods.map(m => (
                <button 
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`border-[1.5px] rounded-xl py-2.5 px-2 text-center text-xs font-medium transition-colors ${method === m ? 'bg-[#0D1B2A] border-[#0D1B2A] text-[#C9A84C]' : 'bg-white border-[#EDE6D6] text-gray-500'}`}
                >
                  <span className="block text-xl mb-1">{m.split(' ')[0]}</span>
                  {m.substring(m.indexOf(' ') + 1)}
                </button>
              ))}
            </div>
          </div>

          {isCashPaymentMethod(method) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <label className="block text-[11px] font-bold text-amber-900 mb-2">היכן המזומן נמצא בפועל?</label>
              <div className="space-y-1.5">
                {CASH_DESTINATION_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCashDestination(option.value)}
                    className={`w-full text-right rounded-lg border px-3 py-2 transition-colors ${cashDestination === option.value ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]' : 'bg-white text-gray-700 border-amber-200'}`}
                  >
                    <b className="block text-xs">{option.label}</b>
                    <span className="text-[10px] opacity-75">{option.hint}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-amber-800 mt-2">אפיק הגבייה אינו קובע בעלות. הבחירה הזו מונעת רישום שגוי בחשבון בינך לבין הפעילות.</p>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">הערות</label>
            <input 
              type="text" 
              className="w-full bg-white border-[1.5px] border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#C9A84C]"
              placeholder="מספר אישור..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="bg-green-50 border border-green-100 rounded-xl p-4 mt-2">
             <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input 
                type="checkbox" 
                checked={sendWa} 
                onChange={(e) => setSendWa(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm font-bold text-green-800 flex items-center gap-1.5">
               <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.487-1.761-1.66-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
               שלח הודעת תודה אחרי השמירה
              </span>
            </label>
          </div>

        </div>
      </>
      {showThankYou && (
        <ThankYouModal 
          donorName={name.trim()} 
          amount={parseFloat(amount) || 0} 
          phone={(crm[name.trim()] || {}).phone || ''} 
          onClose={() => {
            setShowThankYou(false);
            onClose();
          }} 
        />
      )}
    </FullScreenView>
  );
}
