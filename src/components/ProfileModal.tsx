import React, { useState } from 'react';
import { useAppStore } from '../store/AppContext';
import { MessageSquare, Phone, X, Edit, Calendar, PlusCircle, ClipboardList, RefreshCw, CalendarDays, MapPin, Navigation } from 'lucide-react';
import { format } from 'date-fns';
import { DonationModal } from './DonationModal';
import { FullScreenView, SiblingItem } from './FullScreenView';
import { CampaignTag } from './CampaignTag';
import { MeetingModal } from './MeetingModal';
import { ThankYouModal } from './ThankYouModal';
import { ThankYouLetterModal } from './ThankYouLetterModal';
import { DateConverterModal } from './DateConverterModal';
import { MergeContactsModal } from './MergeContactsModal';
import { FamilyDatesEditor } from './FamilyDatesEditor';
import { HebrewDatePicker, emptyHebrewDateValue, hebrewDateValueToHDate, hdateToValue, type HebrewDateValue } from './HebrewDatePicker';
import { Link2 } from 'lucide-react';
import {
  isImportantDateKey, isYahrzeitKey, isHebrewStyleDateKey,
  gregorianPairFor, hebrewPairFor, findGregorianBirthday, findHebrewBirthday,
} from '../lib/donorDates';
import { toCanonicalHebrewString, parseCanonicalHebrewString, hebrewToGregorianCompanion, gregorianToHebrewCompanion } from '../lib/hebrewDates';
import { computeLastContactByName, computeLastContactDetailsByName, formatLastContact } from '../lib/contactFocus';
import { computeDonorTotalSince, filterDonationsSince } from '../lib/donationFilter';
import { STANDALONE_TASKS_ID, createMeetingTask } from '../lib/tasks';
import { logAction } from '../lib/score';
import { CalendarPlus } from 'lucide-react';
import { withCity } from '../lib/orgConfig';
import { avatarGradient } from '../lib/donorDisplay';
import { updateDonorFieldQueued, updatePersonalDateQueued } from '../lib/api';

export function ProfileModal({ name, onClose, backLabel, siblings, onSelectSibling }: {
  name: string;
  onClose: () => void;
  /** מאיפה נפתח הכרטיס — מופיע ליד חץ החזרה */
  backLabel?: string;
  /** שאר אנשי הקשר ברשימה שממנה נפתח, לדילוג ישיר ביניהם */
  siblings?: SiblingItem[];
  onSelectSibling?: (name: string) => void;
}) {
  const { donors, crm, donations, updateCrm, settings, holidayExtras, updateHolidayExtras } = useAppStore();
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [isEditingFields, setIsEditingFields] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});
  const [pendingFieldWrites, setPendingFieldWrites] = useState<Array<{ action: 'updateDonorField' | 'updatePersonalDate'; data: any }>>([]);
  const [hebrewPickerValues, setHebrewPickerValues] = useState<Record<string, HebrewDateValue>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDonationOpen, setIsDonationOpen] = useState(false);
  const [isMeetingOpen, setIsMeetingOpen] = useState(false);
  const [isMeetingTaskOpen, setIsMeetingTaskOpen] = useState(false);
  const [meetingTaskDate, setMeetingTaskDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [meetingTaskTime, setMeetingTaskTime] = useState('');
  const [isDateConverterOpen, setIsDateConverterOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [thankYouInfo, setThankYouInfo] = useState<{amount: number} | null>(null);
  const [letterInfo, setLetterInfo] = useState<{amount: number, date: string} | null>(null);

  const donor = donors[name] || { name, total: 0, donations: [], lastDate: '' };
  const crmData = crm[name] || { circle: 'far', target: false, phone: '' };
  // "סה"כ" ו"מספר תרומות" בכרטיס — מסונן לפי טווח התאריכים הגלובלי מההגדרות (אם הוגדר)
  const displayTotal = React.useMemo(() => computeDonorTotalSince(donor.donations, settings.donationsSinceDate), [donor.donations, settings.donationsSinceDate]);
  const displayDonationsCount = React.useMemo(
    () => filterDonationsSince((donor.donations || []).filter((d: any) => (d.amount || 0) > 0), settings.donationsSinceDate).length,
    [donor.donations, settings.donationsSinceDate]
  );
  const lastContactDate = React.useMemo(() => computeLastContactByName(donations).get(name), [donations, name]);
  const lastContactDetails = React.useMemo(() => computeLastContactDetailsByName(donations).get(name), [donations, name]);

  const donorNameList = React.useMemo(() => Object.keys(donors).filter(n => n !== name).sort((a, b) => a.localeCompare(b, 'he')), [donors, name]);

  // מוסיף בן משפחה — או מקושר לאיש קשר אמיתי (קיים ברשימת אנשי הקשר), או רק שם חופשי בלי כרטיס
  // יוצר משימת "פגישה עם X" עתידית (חד-פעמית, מופיעה בכרטיסיית "משימות") —
  // בשונה מכפתור "מפגש" (MeetingModal) שמתעד מפגש שכבר קרה.
  const addMeetingTask = () => {
    const task = createMeetingTask(name, meetingTaskDate || undefined, meetingTaskTime || undefined);
    const tasks = [...(holidayExtras[STANDALONE_TASKS_ID]?.tasks || []), task];
    updateHolidayExtras(STANDALONE_TASKS_ID, { tasks });
    logAction('task_create');
    setIsMeetingTaskOpen(false);
    setMeetingTaskTime('');
  };


  const getHebrewPickerValue = (key: string): HebrewDateValue => {
    if (hebrewPickerValues[key]) return hebrewPickerValues[key];
    const parsed = editedFields[key] ? parseCanonicalHebrewString(editedFields[key]) : null;
    return parsed ? hdateToValue(parsed) : emptyHebrewDateValue();
  };

  // שומר שדה עברי + הלועזי המקביל לו יחד, לפי ערך שנבחר בבורר
  const saveHebrewFieldPair = (key: string) => {
    const value = getHebrewPickerValue(key);
    const hdate = hebrewDateValueToHDate(value);
    if (!hdate) {
      alert('נא למלא יום, חודש ושנה עבריים תקינים');
      return;
    }
    const gregKey = gregorianPairFor(key);
    setEditedFields(prev => ({
      ...prev,
      [key]: toCanonicalHebrewString(hdate),
      [gregKey]: hebrewToGregorianCompanion(hdate),
    }));
  };

  // שומר שדה לועזי + העברי המקביל לו יחד, לפי מה שהוקלד בשדה הלועזי
  const saveGregorianFieldPair = (key: string) => {
    const hdate = gregorianToHebrewCompanion(editedFields[key]);
    if (!hdate) {
      alert('נא להזין תאריך לועזי תקין');
      return;
    }
    const hebKey = hebrewPairFor(key);
    setEditedFields(prev => ({
      ...prev,
      [hebKey]: toCanonicalHebrewString(hdate),
      [key]: hebrewToGregorianCompanion(hdate),
    }));
    setHebrewPickerValues(prev => ({ ...prev, [hebKey]: hdateToValue(hdate) }));
  };

  const addYahrzeit = () => {
    const label = prompt('עבור מי היארצייט? (למשל: אב, אם, בעל, אישה)');
    if (!label || !label.trim()) return;
    const key = `יארצייט (${label.trim()})`;
    const gregKey = gregorianPairFor(key);
    // מוסיפים גם את השדה העברי וגם את הלועזי המקביל יחד, כדי שאפשר יהיה
    // להזין ישר מכל כיוון (עברי או לועזי) בלי צעד נוסף.
    setEditedFields(prev => ({
      ...prev,
      [key]: prev[key] ?? '',
      [gregKey]: prev[gregKey] ?? '',
    }));
  };

  // מאפשר לתת שם מלא ("פלוני בן פלוני") לכל שדה יארצייט — כולל השדה הכללי
  // שקיים כברירת מחדל — ומעביר את הערך (עברי+לועזי) לשם החדש יחד.
  const renameYahrzeitField = (currentKey: string) => {
    const existingLabelMatch = currentKey.match(/\(([^)]+)\)\s*(?:\(לועזי\))?$/);
    const existingLabel = existingLabelMatch && existingLabelMatch[1] !== 'לועזי' ? existingLabelMatch[1] : '';
    const existingParts = existingLabel.match(/^(.+?)\s+בן\s+(.+)$/);
    const existingName = existingParts ? existingParts[1] : existingLabel;
    const existingFather = existingParts ? existingParts[2] : '';

    const deceasedName = prompt('שם הנפטר/ת (עבור מי היארצייט)? (למשל: אב, אם, או שם פרטי)', existingName);
    if (deceasedName === null || !deceasedName.trim()) return;
    const fatherName = prompt('שם אביו/אביה של הנפטר/ת (לא חובה — לצורך "פלוני בן פלוני")', existingFather);
    const label = fatherName && fatherName.trim() ? `${deceasedName.trim()} בן ${fatherName.trim()}` : deceasedName.trim();

    const isHeb = isHebrewStyleDateKey(currentKey);
    const hebKey = isHeb ? currentKey : hebrewPairFor(currentKey);
    const gregKey = isHeb ? gregorianPairFor(currentKey) : currentKey;
    const newHebKey = `יארצייט (${label.trim()})`;
    const newGregKey = gregorianPairFor(newHebKey);
    if (newHebKey === hebKey) return;

    setEditedFields(prev => {
      const next = { ...prev };
      const hebValue = next[hebKey] || '';
      const gregValue = next[gregKey] || '';
      delete next[hebKey];
      delete next[gregKey];
      next[newHebKey] = hebValue;
      next[newGregKey] = gregValue;
      return next;
    });
    setHebrewPickerValues(prev => {
      if (!prev[hebKey]) return prev;
      const next = { ...prev };
      const val = next[hebKey];
      delete next[hebKey];
      next[newHebKey] = val;
      return next;
    });
  };

  const toISOInputValue = (ddmmyyyy: string): string => {
    const m = String(ddmmyyyy || '').match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
    if (!m) return '';
    const [, d, mo, y] = m;
    const yyyy = y.length === 2 ? `20${y}` : y;
    return `${yyyy}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  };

  const fromISOInputValue = (iso: string): string => {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  };

  const handleFieldSave = async () => {
    setIsSaving(true);
    try {
      let changed = false;
      const reverseMapRaw = localStorage.getItem('reverseHeaderMap');
      const reverseHeaderMap = reverseMapRaw ? JSON.parse(reverseMapRaw) : {};
      const newCustomFields = { ...(crmData.customFields || {}) };
      let specs = [...pendingFieldWrites];
      const addSpec = (spec: { action: 'updateDonorField' | 'updatePersonalDate'; data: any }) => {
        // אם המשתמש שינה שוב שדה שניסיון קודם שלו נכשל, הערך החדש מחליף
        // את הישן. אסור לשלוח את שניהם במקביל ולתת לישן להגיע אחרון.
        specs = specs.filter(existing => !(existing.action === spec.action
          && existing.data.name === spec.data.name && existing.data.field === spec.data.field));
        specs.push(spec);
      };

      for (const [field, value] of Object.entries(editedFields)) {
         const originalValue = newCustomFields[field] ?? (donor as any)[field] ?? '';
         if (originalValue !== value) {
            newCustomFields[field] = value;
            changed = true;

            // Still attempt to save to google sheets if it has a mapping
            if (reverseHeaderMap[field]) {
                const backendFieldKey = reverseHeaderMap[field];
                addSpec({ action: 'updateDonorField', data: { name, field: backendFieldKey, value } });
            }

            // Update personal details sheet for dates
            if (isImportantDateKey(field)) {
                addSpec({ action: 'updatePersonalDate', data: { name, field, value } });
            }
         }
      }

      if (changed) {
         // העותק המקומי מתעדכן לפני הרשת. אין refresh מיידי שעלול להחזיר
         // מהשרת את הערך הישן בזמן שהשמירה עדיין ממתינה בתור.
         updateCrm(name, { customFields: newCustomFields });
      }
      const outcomes = await Promise.all(specs.map(spec => spec.action === 'updateDonorField'
        ? updateDonorFieldQueued(spec.data)
        : updatePersonalDateQueued(spec.data)));
      const failedSpecs = specs.filter((_, index) => outcomes[index].status === 'failed');
      setPendingFieldWrites(failedSpecs);
      if (failedSpecs.length) {
        alert(`הפרטים נשמרו בכרטיס המקומי, אך ${failedSpecs.length} עדכונים לא נשמרו בגיליון. אפשר ללחוץ שוב על שמירה כדי לנסות מחדש.`);
        return;
      }
      setIsEditingFields(false);
    } catch (error: any) {
      alert('לא ניתן לשמור את הפרטים: ' + String(error?.message || error));
    } finally {
      setIsSaving(false);
    }
  };

  const setCircle = (circle: string) => {
    updateCrm(name, { circle });
  };

  const toggleTarget = () => {
    updateCrm(name, { target: !crmData.target });
  };

  const savePhone = async () => {
    // Strip non-digits
    let cleanPhone = phoneInput.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '972' + cleanPhone.substring(1);
    }
    updateCrm(name, { phone: cleanPhone });
    const reverseMapRaw = localStorage.getItem('reverseHeaderMap');
    const reverseHeaderMap = reverseMapRaw ? JSON.parse(reverseMapRaw) : {};
    const backendFieldKey = reverseHeaderMap['טלפון'] || 'טלפון';
    const outcome = await updateDonorFieldQueued({ name, field: backendFieldKey, value: cleanPhone });
    if (outcome.status === 'failed') {
      alert('הטלפון נשמר בכרטיס המקומי, אך לא נשמר בגיליון: ' + outcome.error);
      return;
    }
    setEditingPhone(false);
  };

  const resolvedPhone = (() => {
    const raw = crmData.phone || (donor as any)['טלפון'] || '';
    let n = String(raw).replace(/\D/g, '');
    if (n.startsWith('0')) n = '972' + n.substring(1);
    return n;
  })();

  const openWhatsApp = () => {
    if (!resolvedPhone) {
      setPhoneInput('');
      setEditingPhone(true);
      return;
    }
    window.open(`https://wa.me/${resolvedPhone}`, '_blank');
  };

  return (
    <FullScreenView
      title={name}
      backLabel={backLabel || 'חזרה'}
      onClose={onClose}
      siblings={siblings}
      layout="wide"
      siblingsTitle="אנשי קשר נוספים"
      activeSiblingId={name}
      onSelectSibling={onSelectSibling}
      actions={
        <button
          onClick={() => setIsMergeOpen(true)}
          className="flex items-center gap-1.5 h-9 px-3 rounded-full text-white/70 hover:bg-white/10 text-xs font-bold transition-colors"
          title="חיבור עם איש קשר כפול"
        >
          <Link2 size={14} /> <span className="hidden md:inline">מזג עם איש קשר אחר</span>
        </button>
      }
    >
      <>
        {/* Profile Header */}
        <div className="flex flex-col items-center mb-6">
          <div 
            className="w-[76px] h-[76px] rounded-full flex items-center justify-center font-['Frank_Ruhl_Libre'] text-3xl font-bold text-white mb-3"
            style={{ background: avatarGradient(name) }}
          >
            {name.charAt(0)}
          </div>
          <h2 className="font-['Frank_Ruhl_Libre'] text-2xl font-bold text-[#0D1B2A]">{name}</h2>
          
          <div className="flex gap-2 mt-3 flex-wrap justify-center">
            {crmData.circle === 'close' && <span className="bg-green-100 text-green-800 rounded-full px-3 py-1 text-xs border border-green-200">⭐ קרוב</span>}
            {crmData.circle === 'approach' && <span className="bg-amber-100 text-amber-800 rounded-full px-3 py-1 text-xs border border-amber-200">🔄 מתקרב</span>}
            {crmData.circle === 'third' && <span className="bg-purple-100 text-purple-800 rounded-full px-3 py-1 text-xs border border-purple-200">⭕ מעגל שלישי</span>}
            {crmData.target && <span className="bg-blue-100 text-blue-800 rounded-full px-3 py-1 text-xs border border-blue-200">🎯 להקרב</span>}
            {donor.total > 5000 && <span className="bg-purple-100 text-purple-800 rounded-full px-3 py-1 text-xs border border-purple-200">💎 VIP</span>}
          </div>
        </div>

        {/* במסך רחב הכרטיס נפרש לשתי עמודות: מימין מי הוא ומתי מציינים אותו,
            משמאל מה עושים איתו ומה ההיסטוריה. בנייד זו נשארת עמודה אחת. */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
        <div className="min-w-0">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 bg-white rounded-2xl p-4 shadow-sm mb-5 divide-x-reverse divide-[#EDE6D6] divide-x">
          <div className="text-center px-2">
            <div className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A]">₪{displayTotal.toLocaleString()}</div>
            <div className="text-[10px] text-gray-500">{settings.donationsSinceDate ? `סהכ מ-${new Date(settings.donationsSinceDate).toLocaleDateString('he-IL')}` : 'סהכ'}</div>
          </div>
          <div className="text-center px-2">
            <div className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A]">{displayDonationsCount}</div>
            <div className="text-[10px] text-gray-500">תרומות</div>
          </div>
          <div className="text-center px-2">
            <div className="font-['Frank_Ruhl_Libre'] text-sm font-bold text-[#0D1B2A] mt-1 line-clamp-1">{donor.lastDate || '—'}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">תרומה אחרונה</div>
          </div>
        </div>

        {/* Last contact */}
        <div className="bg-white rounded-xl p-3 shadow-sm mb-5">
          <div className="flex items-center justify-center gap-2">
            <span className="text-base">🕐</span>
            <span className="text-xs text-gray-500">יצירת קשר אחרונה:</span>
            <span className="text-xs font-bold text-[#0D1B2A]">{formatLastContact(lastContactDate, new Date())}</span>
          </div>
          {lastContactDetails && (lastContactDetails.meetType || lastContactDetails.purpose) && (
            <div className="text-[10px] text-gray-400 text-center mt-1">
              {[lastContactDetails.meetType, lastContactDetails.purpose].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>

        {/* Important dates: birthdays + parents' yahrzeits */}
        {(() => {
          const combined = { ...donor, ...(crmData.customFields || {}) };
          const dateKeys = Object.keys(combined).filter(k => isImportantDateKey(k) && (combined as any)[k]);
          if (dateKeys.length === 0) return null;
          return (
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-5">
              <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] mb-3">📅 תאריכים חשובים</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {dateKeys.map(key => (
                  <div key={key} className="flex items-center gap-2.5 bg-[#FAF6EE] rounded-xl p-3 border border-[#EDE6D6]">
                    <span className="text-xl shrink-0">{isYahrzeitKey(key) ? '🕯️' : '🎂'}</span>
                    <div className="min-w-0">
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide truncate">{key}</div>
                      <div className="text-sm font-bold text-[#0D1B2A] truncate">{(combined as any)[key]}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* בני משפחה, ימי הולדת ויארצייטים — רשומות בכרטיס, לא עמודות בגיליון */}
        <FamilyDatesEditor name={name} />

        </div>
        <div className="min-w-0">

        {/* Circles */}
        <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] mb-3">מעגל קשר</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <button 
            onClick={() => setCircle('close')}
            className={`p-3 rounded-xl border-2 text-center transition-colors ${crmData.circle === 'close' ? 'bg-[#D1FAE5] border-[#10B981]' : 'bg-white border-[#EDE6D6]'}`}
          >
            <span className="block text-xl mb-1">⭐</span>
            <span className="text-xs font-semibold text-[#0D1B2A]">קרוב</span>
          </button>
          <button 
            onClick={() => setCircle('approach')}
            className={`p-3 rounded-xl border-2 text-center transition-colors ${crmData.circle === 'approach' ? 'bg-[#FEF3C7] border-[#F59E0B]' : 'bg-white border-[#EDE6D6]'}`}
          >
            <span className="block text-xl mb-1">🔄</span>
            <span className="text-xs font-semibold text-[#0D1B2A]">מתקרב</span>
          </button>
          <button 
            onClick={() => setCircle('third')}
            className={`p-3 rounded-xl border-2 text-center transition-colors ${crmData.circle === 'third' ? 'bg-[#EDE9FE] border-[#8B5CF6]' : 'bg-white border-[#EDE6D6]'}`}
          >
            <span className="block text-xl mb-1">⭕</span>
            <span className="text-xs font-semibold text-[#0D1B2A]">מעגל 3</span>
          </button>
          <button 
            onClick={() => setCircle('far')}
            className={`p-3 rounded-xl border-2 text-center transition-colors ${crmData.circle === 'far' ? 'bg-[#F3F4F6] border-[#9CA3AF]' : 'bg-white border-[#EDE6D6]'}`}
          >
            <span className="block text-xl mb-1">○</span>
            <span className="text-xs font-semibold text-[#0D1B2A]">רחוק</span>
          </button>
        </div>

        {/* Target Toggle */}
        <div 
          onClick={toggleTarget}
          className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between mb-5 cursor-pointer"
        >
           <div>
             <div className="text-sm font-bold text-[#0D1B2A]">🎯 רוצה להקרב</div>
             <div className="text-[11px] text-gray-500 mt-0.5">המערכת תייצר משימות ותזכורות אוטומטיות לחיזוק הקשר</div>
           </div>
           <div className={`w-[46px] h-[26px] rounded-full relative transition-colors shrink-0 ${crmData.target ? 'bg-[#C9A84C]' : 'bg-[#EDE6D6]'}`}>
             <div className={`w-[22px] h-[22px] bg-white rounded-full absolute top-[2px] shadow flex transition-all ${crmData.target ? 'left-[2px]' : 'right-[2px]'}`} />
           </div>
        </div>

        {/* Actions */}
        {(() => {
          const address = (donor as any)['כתובת'] || crmData.customFields?.['כתובת'] || '';
          const mapsUrl = address
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(withCity(address))}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(withCity(name))}`;
          return (
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button onClick={openWhatsApp} className="bg-green-50 text-green-700 border border-green-200 rounded-xl p-3 flex flex-col items-center justify-center gap-1 font-semibold text-sm">
                <MessageSquare size={18} />
                WhatsApp
              </button>
              <button onClick={() => resolvedPhone ? window.open(`tel:${resolvedPhone}`) : setEditingPhone(true)} className="bg-blue-50 text-blue-700 border border-blue-200 rounded-xl p-3 flex flex-col items-center justify-center gap-1 font-semibold text-sm">
                <Phone size={18} />
                התקשר
              </button>
              <button onClick={() => setIsDonationOpen(true)} className="bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] rounded-xl p-3 flex flex-col items-center justify-center gap-1 font-semibold text-sm">
                <PlusCircle size={18} />
                תרומה
              </button>
              <button onClick={() => setIsMeetingOpen(true)} className="bg-purple-50 text-purple-700 border border-purple-200 rounded-xl p-3 flex flex-col items-center justify-center gap-1 font-semibold text-sm">
                <ClipboardList size={18} />
                מפגש
              </button>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl p-3 flex items-center justify-center gap-2 font-semibold text-sm hover:bg-blue-100 transition-colors"
              >
                <Navigation size={18} />
                {address ? `נווט לכתובת: ${address}` : 'חיפוש כתובת במפה'}
              </a>
              <button
                onClick={() => setIsMeetingTaskOpen(o => !o)}
                className="col-span-2 bg-[#FAF6EE] text-[#9B7A2F] border border-[#EDE6D6] rounded-xl p-3 flex items-center justify-center gap-2 font-semibold text-sm"
              >
                <CalendarPlus size={18} />
                קבע משימת פגישה
              </button>
              {isMeetingTaskOpen && (
                <div className="col-span-2 bg-white border border-[#EDE6D6] rounded-xl p-3 flex gap-2">
                  <input
                    value={meetingTaskDate}
                    onChange={e => setMeetingTaskDate(e.target.value)}
                    type="date"
                    className="flex-1 bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-2 text-xs outline-none focus:border-[#C9A84C]"
                  />
                  <input
                    value={meetingTaskTime}
                    onChange={e => setMeetingTaskTime(e.target.value)}
                    type="time"
                    className="flex-1 bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-2 text-xs outline-none focus:border-[#C9A84C]"
                  />
                  <button onClick={addMeetingTask} className="bg-[#0D1B2A] text-[#E8C97A] rounded-lg px-3 text-xs font-bold shrink-0">הוסף</button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Dynamic Fields Details */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A]">פרטים ומידע מלאים</h3>
            <button 
              onClick={() => {
                const init: Record<string, string> = {};
                const combined = { ...donor, ...(crmData.customFields || {}) };
                Object.keys(combined).filter(k => !['name','total','donations','lastDate'].includes(k) && !/^\d+$/.test(k)).forEach(k => {
                  init[k] = (combined as any)[k] || '';
                });
                // Ensure common fields are at least suggested if missing
                const common = ['טלפון', 'כתובת', 'תאריך לידה', 'תאריך לידה עברי', 'יארצייט', 'יארצייט (לועזי)', 'שם זוג', 'תפילין', 'מזוזות'];
                common.forEach(c => {
                  if (init[c] === undefined) init[c] = '';
                });
                setEditedFields(init);
                setHebrewPickerValues({});
                setIsEditingFields(true);
              }}
              className="bg-[#C9A84C]/10 text-[#9B7A2F] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors hover:bg-[#C9A84C]/20"
            >
              <Edit size={14} /> ערוך הכל
            </button>
          </div>
          <div className="grid grid-cols-1 gap-y-3">
            {(() => {
               const combined = { ...donor, ...(crmData.customFields || {}) };
               // תאריכי לידה/יארצייט כבר מוצגים למעלה בכרטיס "תאריכים חשובים" — לא כופלים אותם כאן
               const keys = Object.keys(combined).filter(k => !['name','total','donations','lastDate'].includes(k) && !/^\d+$/.test(k) && !isImportantDateKey(k));
               const isAddressKey = (k: string) => ['כתובת', 'address', 'רחוב', 'עיר'].some(t => k.toLowerCase().includes(t));
               const openInMaps = (addr: string) => {
                 window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(withCity(addr))}`, '_blank');
               };
               if (keys.length > 0) {
                 return keys.map(key => {
                   const val = (combined as any)[key] || '';
                   const isAddr = isAddressKey(key);
                   return (
                     <div key={key} className="flex flex-col border-b border-gray-50 pb-2.5 last:border-0 last:pb-0">
                       <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">{key}</span>
                       <div className="flex items-center justify-between gap-2">
                         <span className="text-[13px] font-medium text-[#0D1B2A] leading-relaxed flex-1">{val || '—'}</span>
                         {isAddr && val && (
                           <button
                             onClick={() => openInMaps(val)}
                             className="shrink-0 flex items-center gap-1 bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg text-[11px] font-bold hover:bg-blue-100 transition-colors"
                           >
                             <MapPin size={12} /> מפה
                           </button>
                         )}
                       </div>
                     </div>
                   );
                 });
               } else {
                 return (
                   <div className="text-center py-6">
                     <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-2 text-gray-300">
                       <Calendar size={20} />
                     </div>
                     <p className="text-xs text-gray-400">אין עדיין מידע נוסף בגיליון.<br/>לחץ על ערוך כדי להוסיף.</p>
                   </div>
                 );
               }
            })()}
          </div>
        </div>

        {/* Dynamic Fields Edit Modal */}
        {isEditingFields && (
          <div className="fixed inset-0 bg-black/60 z-[220] flex items-center justify-center p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setIsEditingFields(false)}>
            <div className="bg-white rounded-2xl p-5 w-full max-w-sm max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-xl text-[#0D1B2A]">עריכת מידע מלא</h3>
                <button onClick={() => setIsEditingFields(false)} className="text-gray-400 p-1 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              
              <div className="overflow-y-auto flex-1 pr-1 space-y-4 mb-5 custom-scrollbar">
                {Object.keys(editedFields).map(key => {
                  const isDateField = isImportantDateKey(key);
                  const isHebrewField = isDateField && isHebrewStyleDateKey(key);
                  const isGregorianField = isDateField && !isHebrewField;
                  return (
                  <div key={key} className="flex flex-col group">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide group-focus-within:text-[#C9A84C] transition-colors">
                        {key} {isDateField && (isYahrzeitKey(key) ? '🕯️' : '🎂')}
                      </label>
                      <div className="flex items-center gap-2 shrink-0">
                        {isYahrzeitKey(key) && (
                          <button
                            onClick={() => renameYahrzeitField(key)}
                            title="לשנות עבור מי היארצייט הזה"
                            className="text-[10px] text-[#9B7A2F] hover:text-[#0D1B2A]"
                          >✏️ של מי</button>
                        )}
                        {/* Only allow deleting non-standard fields in UI if they are empty */}
                        {!editedFields[key] && !['טלפון', 'כתובת'].includes(key) && (
                          <button
                            onClick={() => {
                              const next = { ...editedFields };
                              delete next[key];
                              setEditedFields(next);
                            }}
                            className="text-[10px] text-red-300 hover:text-red-500"
                          >מחק</button>
                        )}
                      </div>
                    </div>

                    {isHebrewField ? (
                      <div className="bg-[#FAF6EE] rounded-xl p-3 border-[1.5px] border-[#EDE6D6]">
                        <HebrewDatePicker
                          value={getHebrewPickerValue(key)}
                          onChange={v => setHebrewPickerValues(prev => ({ ...prev, [key]: v }))}
                        />
                        <button
                          onClick={() => saveHebrewFieldPair(key)}
                          className="w-full mt-2 flex items-center justify-center gap-1.5 bg-[#0D1B2A] text-[#E8C97A] text-xs font-bold py-2 rounded-lg"
                        >
                          <RefreshCw size={13} /> שמור (עברי + לועזי יחושב אוטומטית)
                        </button>
                        {editedFields[key] && (
                          <div className="text-[11px] text-gray-500 mt-2 text-center">
                            נשמר כרגע: <b>{editedFields[key]}</b>
                            {editedFields[gregorianPairFor(key)] && <> · לועזי: <b>{editedFields[gregorianPairFor(key)]}</b></>}
                          </div>
                        )}
                      </div>
                    ) : isGregorianField ? (
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={toISOInputValue(editedFields[key] || '')}
                          onChange={e => setEditedFields(prev => ({ ...prev, [key]: fromISOInputValue(e.target.value) }))}
                          className="flex-1 border-[1.5px] border-[#EDE6D6] rounded-xl py-2.5 px-3 text-sm focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/20 outline-none transition-all"
                        />
                        <button
                          onClick={() => saveGregorianFieldPair(key)}
                          title="חשב ושמור גם עברי"
                          disabled={!editedFields[key]}
                          className="shrink-0 flex items-center gap-1 bg-[#0D1B2A] text-[#E8C97A] text-xs font-bold px-3 rounded-lg disabled:opacity-40"
                        >
                          <RefreshCw size={13} /> עברי
                        </button>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={editedFields[key] || ''}
                        onChange={e => setEditedFields(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full border-[1.5px] border-[#EDE6D6] rounded-xl py-2.5 px-3.5 text-sm focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/20 outline-none transition-all"
                        placeholder={`הזן ${key}...`}
                      />
                    )}
                  </div>
                  );
                })}

                <div className="pt-2 border-t border-dashed border-gray-100 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      const name = prompt('שם השדה החדש (למשל: יום הולדת, שם האישה...):');
                      if (name && !editedFields[name]) {
                        setEditedFields(prev => ({ ...prev, [name]: '' }));
                      }
                    }}
                    className="flex items-center gap-2 text-xs font-bold text-[#9B7A2F] py-2 w-full justify-center bg-[#EDE6D6]/30 rounded-xl hover:bg-[#EDE6D6]/50 transition-colors"
                  >
                    + הוסף שדה חדש שלא מופיע
                  </button>
                  <button
                    onClick={addYahrzeit}
                    className="flex items-center gap-2 text-xs font-bold text-[#9B7A2F] py-2 w-full justify-center bg-[#EDE6D6]/30 rounded-xl hover:bg-[#EDE6D6]/50 transition-colors"
                  >
                    🕯️ + הוסף יארצייט נוסף
                  </button>
                  <button
                    onClick={() => setIsDateConverterOpen(true)}
                    className="flex items-center gap-2 text-xs font-bold text-[#0D1B2A] py-2 w-full justify-center bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    <CalendarDays size={14} /> מחשבון משוכלל להמרת תאריכים
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                 <button 
                   onClick={handleFieldSave} 
                   disabled={isSaving}
                   className="w-full bg-[#0D1B2A] text-[#E8C97A] py-3.5 rounded-xl font-bold text-sm shadow-lg active:scale-[0.98] transition-transform disabled:opacity-70 flex items-center justify-center gap-2"
                 >
                   {isSaving ? (
                     <>
                       <RefreshCw className="animate-spin" size={16} /> שומר שינויים...
                     </>
                   ) : 'שמור את כל השינויים'}
                 </button>
                 <button onClick={() => setIsEditingFields(false)} className="w-full py-2.5 rounded-xl text-gray-400 text-sm font-medium">
                   חזור ללא שמירה
                 </button>
              </div>
            </div>
          </div>
        )}

        {/* History / Timeline */}
        {(() => {
          const events: any[] = [];
          // חשוב: donor.meetings אף פעם לא מאוכלס בפועל באפליקציה — כל
          // הרשומות (תרומות וגם מפגשים/נוכחות) נמצאות יחד במערך
          // donor.donations, כאשר amount===0 מסמן רשומת "מפגש" (בדיוק כמו
          // ב-computeLastContactByName/ReportsTab). בעבר זה גרם לכל רשומת
          // מפגש/נוכחות להיראות כ"תרומה" מבלבלת על סך ₪0 — עכשיו מסווגים
          // לפי הסכום בפועל, לא לפי מערך המקור.
          (donor.donations || []).forEach((don: any) => {
            if ((don.amount || 0) === 0) {
              events.push({ type: 'meeting', date: don.date || don.meetDate, data: don });
            } else {
              events.push({ type: 'donation', date: don.date, data: don });
            }
          });
          (donor.meetings || []).forEach((m: any) => events.push({ type: 'meeting', date: m.date, data: m }));
          
          events.sort((a, b) => {
            const dA = a.date ? new Date(a.date.split('/').reverse().join('-')) : new Date(0);
            const dB = b.date ? new Date(b.date.split('/').reverse().join('-')) : new Date(0);
            return dB.getTime() - dA.getTime();
          });

          if (events.length === 0) return null;

          return (
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-5 relative">
              <h3 className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] mb-4">היסטוריה מלאה</h3>
              <div className="relative pr-5">
                <div className="absolute right-2.5 top-0 bottom-0 w-0.5 bg-[#EDE6D6]" />
                <div className="space-y-4">
                  {events.map((e, i) => (
                    <div key={i} className="relative">
                      <div className={`absolute -right-5 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-[0_0_0_3px_rgba(201,168,76,0.2)] ${e.type === 'donation' ? 'bg-[#C9A84C]' : 'bg-[#3B82F6]'}`} />
                      <div className="bg-white border border-[#EDE6D6] rounded-xl p-3 shadow-sm">
                        {e.type === 'donation' ? (
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-sm font-semibold text-[#0D1B2A]">💰 {e.data.purpose || 'תרומה'}</div>
                              <div className="text-[11px] text-gray-500 mt-1">{e.date} · {e.data.method} {e.data.notes ? `· ${e.data.notes}` : ''}</div>
                              <div className="font-['Frank_Ruhl_Libre'] font-bold text-[#9B7A2F] mt-1.5">₪{(e.data.amount || 0).toLocaleString()}</div>
                            </div>
                            <div className="flex flex-col gap-1.5 shrink-0">
                              <button 
                                onClick={() => {
                                  setThankYouInfo({ amount: e.data.amount || 0 });
                                }}
                                className="text-green-600 bg-green-50 p-2 text-xs rounded-lg border border-green-100 hover:bg-green-100 transition-colors flex items-center gap-1 font-bold"
                                title="שלח הודעת הוקרה"
                              >
                                <MessageSquare size={14} /> הודעת תודה
                              </button>
                              <button
                                onClick={() => {
                                  setLetterInfo({ amount: e.data.amount || 0, date: e.date || '' });
                                }}
                                className="text-amber-700 bg-amber-50 p-2 text-xs rounded-lg border border-amber-100 hover:bg-amber-100 transition-colors flex items-center gap-1 font-bold"
                                title="מכתב תודה מעוצב"
                              >
                                📜 מכתב מעוצב
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm font-semibold text-[#0D1B2A]">📝 מפגש — {e.data.meetType || ''}</div>
                            <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
                              <span>{e.date}</span>
                              <CampaignTag value={e.data.purpose} size="xs" />
                            </div>
                            {e.data.notes && <div className="text-xs text-[#3B82F6] mt-1.5 leading-snug">{e.data.notes}</div>}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        </div>
        </div>

        {/* WhatsApp Phone Modal */}
        {editingPhone && (
          <div className="fixed inset-0 bg-black/50 z-[210] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
              <h3 className="font-bold text-lg mb-2">מספר טלפון ל-WhatsApp</h3>
              <p className="text-sm text-gray-500 mb-4">הכנס את מספר הטלפון פעם אחת (יישמר באפליקציה).</p>
              <input 
                type="tel"
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value)}
                placeholder="050-000-0000"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 mb-4 text-left"
                dir="ltr"
              />
              <div className="flex justify-end gap-2">
                 <button onClick={() => setEditingPhone(false)} className="px-4 py-2 rounded-lg text-gray-500">ביטול</button>
                 <button onClick={savePhone} className="bg-[#C9A84C] text-white px-4 py-2 rounded-lg font-bold">שמור</button>
              </div>
            </div>
          </div>
        )}

      </>

      {isDonationOpen && <DonationModal onClose={() => setIsDonationOpen(false)} defaultName={name} />}
      {isMeetingOpen && <MeetingModal onClose={() => setIsMeetingOpen(false)} donorName={name} />}
      {isDateConverterOpen && <DateConverterModal onClose={() => setIsDateConverterOpen(false)} />}
      {isMergeOpen && <MergeContactsModal onClose={() => setIsMergeOpen(false)} presetName={name} onMerged={onClose} />}
      {thankYouInfo && <ThankYouModal donorName={name} amount={thankYouInfo.amount} phone={crmData.phone || (donor as any)['טלפון'] || ''} onClose={() => setThankYouInfo(null)} />}
      {letterInfo && (
        <ThankYouLetterModal
          donorName={name}
          amount={letterInfo.amount}
          date={letterInfo.date}
          phone={crmData.phone || (donor as any)['טלפון'] || ''}
          onClose={() => setLetterInfo(null)}
        />
      )}
    </FullScreenView>
  );
}
