import React, { useMemo, useState } from 'react';
import { Explain } from './Explain';
import { Bot, X, Copy, Check, Sparkles, Trash2, Undo2, Download, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store/AppContext';
import { buildHolidayList } from '../lib/holidayList';
import { getCustomHols, saveCustomHols, apiPost } from '../lib/api';
import { emptyProject, SOLICITATION_ORDER, SOLICITATION_LABEL, normalizeStatus, Solicitation } from '../lib/projects';
import { stampCreated, STANDALONE_TASKS_ID } from '../lib/tasks';
import { getOrg } from '../lib/orgConfig';

// ─────────────────────────────────────────────────────────────────────────────
// ייבוא דרך בינה מלאכותית — לכל סוגי המידע.
//
// הבעיה: למי שמעביר רשימות מנייר, מאקסל או מאפליקציה אחרת אין מייל מספק
// סליקה שייקלט לבד, והקלדה ידנית של מאתיים אנשים היא לא פתרון.
//
// הפתרון עוקף את הצורך שהאפליקציה תדע לקרוא קבצים: היא מייצרת פרומפט
// שכולל את ההקשר שלה (החגים, האירועים ואנשי הקשר הקיימים) ואת מבנה ה-JSON
// המדויק שהיא יודעת לקלוט. המשתמש מדביק את הפרומפט בצ'אט AI יחד עם הקובץ
// או הרשימה שלו, ומחזיר הנה את ה-JSON. ה-AI עושה את העבודה הקשה — לזהות
// עמודות, לנקות פורמטים של תאריכים, להפריד שם מטלפון.
//
// **שום דבר לא נשמר לפני מסך אישור.** זה מכוון: פלט של מודל שפה הוא ניחוש
// מושכל, לא מקור אמת, ובמידע כספי הבדל בין ניחוש לאמת עולה כסף.
// ─────────────────────────────────────────────────────────────────────────────

type TargetKind = 'holiday' | 'event' | 'project' | 'homeVisit' | 'contact' | 'standalone';

interface ParsedItem {
  key: string;
  text: string;
  targetKind: TargetKind;
  targetId: string; // holiday id / event id / round id / contact name — empty for standalone
}

interface SheetRow {
  key: string;
  data: Record<string, any>;
}

const KIND_LABELS: Record<TargetKind, string> = {
  holiday: '📅 חג',
  event: '📌 אירוע',
  project: '🎯 פרויקט',
  homeVisit: '🏠 ביקורי בית (הכנה)',
  contact: '👤 אדם פרטי',
  standalone: '📋 משימה חד-פעמית',
};

// ערכים שהאפליקציה מכירה. ה-AI מקבל אותם בפרומפט, וכל ערך אחר נופל
// לברירת המחדל — עדיף אירוע עם סוג לא מדויק על אירוע שנזרק.
const EVENT_TYPES = ['shabbat', 'minyan', 'class', 'other'];
const EVENT_FREQS = ['weekly', 'biweekly', 'monthly', 'oneoff'];

// מוצא את ההתאמה הכי טובה לתווית חופשית שה-AI החזיר מתוך רשימת מועמדים אמיתיים —
// קודם התאמה מדויקת (אחרי נרמול רווחים/אותיות), ואז הכלה חלקית בכל כיוון.
function bestMatch(label: string, candidates: { id: string; label: string }[]): string {
  if (!label) return candidates[0]?.id || '';
  const norm = (s: string) => s.trim().toLowerCase();
  const nLabel = norm(label);
  const exact = candidates.find(c => norm(c.label) === nLabel);
  if (exact) return exact.id;
  const partial = candidates.find(c => norm(c.label).includes(nLabel) || nLabel.includes(norm(c.label)));
  if (partial) return partial.id;
  return candidates[0]?.id || '';
}

// שדות שמוצגים בתצוגה המקדימה של כל סוג. מה שה-AI החזיר מעבר להם עדיין
// נשלח לשרת (עמודה חדשה נוצרת לבד) — פשוט לא מוצג כאן כדי לא להציף.
const PREVIEW_FIELDS: Record<string, string[]> = {
  contacts: ['שם מלא', 'טלפון', 'כתובת', 'בן/בת זוג', 'הערות'],
  donations: ['name', 'amount', 'date', 'method', 'purpose'],
  standingOrders: ['name', 'amount', 'startDate', 'payments', 'campaign'],
  events: ['name', 'type', 'freq', 'date', 'time'],
  projects: ['name', 'kind', 'goal', 'deadline'],
  holidays: ['name', 'date', 'desc'],
  solicitations: ['project', 'name', 'ask', 'status', 'notes'],
};

const SECTION_LABELS: Record<string, string> = {
  contacts: '👥 אנשי קשר',
  donations: '💰 תרומות',
  standingOrders: '🔄 הוראות קבע',
  events: '📌 אירועים',
  projects: '🎯 פרויקטים',
  holidays: '📅 חגים ותאריכים',
  solicitations: '📊 רשימת התרמה לקמפיין',
};

/**
 * ── בחירת נושאים ──────────────────────────────────────────────────────────
 *
 * ההנחיה שנבנתה קודם כללה תמיד את כל שבעת הנושאים ואת כל ההקשר — מאות
 * שמות, כל החגים, כל האירועים. כשמעלים קובץ שהוא רשימת התרמה אחת, רוב
 * ההנחיה היא רעש: היא מבזבזת את תשומת הלב של המודל, ומזמינה אותו להמציא
 * אירועים ומשימות מתוך טבלה שאין בה כאלה.
 *
 * לכן בוחרים מראש במה הקובץ נוגע, וההנחיה נבנית סביב זה בלבד — כולל
 * ההקשר שנשלח: אין טעם לשלוח רשימת חגים כשמייבאים אנשי קשר.
 */
const TOPIC_HINTS: Record<string, string> = {
  contacts: 'רשימת שמות, טלפונים, כתובות',
  donations: 'תרומות שכבר התקבלו',
  standingOrders: 'הוראות קבע — סכום חודשי ומספר תשלומים',
  events: 'מניינים, שיעורים, סעודות — עם שעה ומקום',
  projects: 'קמפיינים ופרויקטי גיוס עם יעד',
  holidays: 'תאריכים בלוח השנה',
  solicitations: 'טבלת קמפיין: ממי לבקש, כמה, ומה הסטטוס',
};

import { findDuplicates } from '../lib/importDupes';

/** מה נכתב לגיליון דרך השרת, ומה נשמר בענן האפליקציה */
const SHEET_SECTIONS = ['contacts', 'donations', 'standingOrders'] as const;
const APP_SECTIONS = ['events', 'projects', 'holidays', 'solicitations'] as const;
const ALL_SECTIONS = [...SHEET_SECTIONS, ...APP_SECTIONS];

export function GlobalAIImportModal({ onClose }: { onClose: () => void }) {
  const {
    holidays, eventsData, homeVisits, donors, holidayExtras, projects, donations,
    updateHolidayExtras, updateEventsData, updateHomeVisitRoundMeta, updateProjects, refresh,
  } = useAppStore();
  const [step, setStep] = useState<'prompt' | 'review' | 'done'>('prompt');
  const [prompt, setPrompt] = useState('');
  // ברירת המחדל: הכול. מי שיודע מה יש לו בקובץ מכבה את השאר ומקבל
  // הנחיה קצרה ומדויקת יותר.
  const [topics, setTopics] = useState<string[]>([...ALL_SECTIONS, 'items']);
  const [copied, setCopied] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parseError, setParseError] = useState('');
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [rows, setRows] = useState<Record<string, SheetRow[]>>(
    () => Object.fromEntries(ALL_SECTIONS.map(s => [s, []])) as Record<string, SheetRow[]>
  );
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [undone, setUndone] = useState(false);

  const holidayOptions = useMemo(() => buildHolidayList(holidays, getCustomHols(), new Date()).filter(h => h.daysAway >= 0).map(h => ({ id: h.id, label: `${h.emoji} ${h.name} (בעוד ${h.daysAway} ימים)` })), [holidays]);
  const roundOptions = useMemo(() => (homeVisits.rounds || []).filter((r: any) => r.status === 'active').map((r: any) => ({
    id: r.id,
    label: r.purpose || `מערך מ-${new Date(r.createdAt).toLocaleDateString('he-IL')}`,
  })), [homeVisits]);
  const contactNames = useMemo(() => Object.keys(donors).sort(), [donors]);

  // אירוע או פרויקט שנוצרים באותו ייבוא הם יעד חוקי למשימה שבאה איתם.
  // הם מקבלים מזהה זמני, ובשמירה הוא מוחלף במזהה האמיתי — כך "לארגן
  // כיבוד" נוחתת על האירוע שנוצר לידה ולא נופלת למשימות הכלליות.
  const eventOptions = useMemo(() => [
    ...(eventsData as any[]).map(e => ({ id: e.id, label: e.name })),
    ...rows.events.map(r => ({ id: r.key, label: `🆕 ${r.data.name}` })),
  ], [eventsData, rows.events]);

  const projectOptions = useMemo(() => [
    ...(projects as any[]).map(p => ({ id: p.id, label: p.name })),
    ...rows.projects.map(r => ({ id: r.key, label: `🆕 ${r.data.name}` })),
  ], [projects, rows.projects]);

  const buildPrompt = () => {
    const on = (t: string) => topics.includes(t);
    const parts: string[] = [];
    const chosen = [...ALL_SECTIONS.filter(on), ...(on('items') ? ['items'] : [])];

    parts.push(`אני מנהל את ${getOrg().orgName.he || 'הארגון'} ומשתמש באפליקציית ניהול קהילה. יש לי מידע שאני צריך להכניס אליה — רשימה, קובץ אקסל, צילום של דף, או סתם טקסט חופשי. אני אצרף אותו בהודעה הבאה. תפקידך להמיר אותו למבנה JSON מדויק שהאפליקציה יודעת לקלוט.`);

    // ── רק מה שנבחר ───────────────────────────────────────────────────────
    const names: string[] = [
      ...ALL_SECTIONS.filter(on).map(t => SECTION_LABELS[t].replace(/^\S+\s/, '')),
      ...(on('items') ? ['משימות'] : []),
    ];
    parts.push(`\nהפעם אני מייבא **רק** את הסוגים האלה: ${names.join(' · ')}.`);
    parts.push('אל תייצר שום סוג אחר, גם אם נראה לך שהוא מסתתר בקובץ. אם משהו בקובץ אינו שייך לסוגים האלה — התעלם ממנו.');

    // ההבחנה נחוצה רק כשיותר מאחד מהמבלבלים נבחר
    const confusing = ['events', 'holidays', 'projects', 'items'].filter(on);
    if (confusing.length > 1) {
      parts.push('\nההבחנה בין אלה שמתבלבלים הכי הרבה:');
      if (on('events')) parts.push('· **אירוע** = התכנסות עם שעה ומקום, שחוזרת או חד-פעמית. השאלה שהוא עונה עליה: "מי הגיע?"');
      if (on('holidays')) parts.push('· **חג** = תאריך בלוח השנה. אף אחד לא "מגיע לחנוכה" — מגיעים למסיבה שבחנוכה.');
      if (on('projects')) parts.push('· **פרויקט** = גיוס כסף מאנשים מול יעד בשקלים. השאלה: "כמה גויס?"');
      if (on('items')) parts.push('· אם משהו הוא רק דבר לעשות ולא אחד מאלה — הוא **משימה**.');
    }

    // ── הקשר, גם הוא לפי הנבחר ────────────────────────────────────────────
    const ctx: string[] = [];
    const needsNames = ['contacts', 'donations', 'standingOrders', 'solicitations'].some(on);
    if (needsNames && contactNames.length) {
      ctx.push(`אנשי קשר קיימים (אם שם במידע שלי הוא אחד מהם — כתוב אותו בדיוק כך): ${contactNames.slice(0, 150).join(', ')}`);
    }
    if (on('holidays') && holidayOptions.length) ctx.push(`חגים קרובים: ${holidayOptions.map(h => h.label).join(', ')}`);
    if ((on('events') || on('items')) && eventsData.length) ctx.push(`אירועים קיימים: ${(eventsData as any[]).map(e => e.name).join(', ')}`);
    if ((on('projects') || on('items') || on('solicitations') || on('donations')) && projects.length) {
      ctx.push(`פרויקטים קיימים: ${(projects as any[]).map(p => p.name).join(', ')}`);
    }
    if (on('items') && roundOptions.length) ctx.push(`מערכי ביקורי בית פעילים: ${roundOptions.map(r => r.label).join(', ')}`);
    if (ctx.length) {
      parts.push('\nהקשר קיים אצלי, כדי שתשייך אליו במקום להמציא שמות חדשים:');
      ctx.forEach(c => parts.push(c));
      parts.push('אל תיצור מחדש משהו שכבר קיים ברשימות האלה — שייך אליו.');
    }

    // ── כללים, גם הם לפי הנבחר ────────────────────────────────────────────
    parts.push('\nכללים שחשוב לשמור עליהם:');
    parts.push('· תאריכים בפורמט dd/MM/yyyy בלבד. אם התאריך במקור חלקי או לא ברור — השאר את השדה ריק, אל תנחש.');
    parts.push('· סכומים כמספר בלבד, בלי ₪ ובלי פסיקים.');
    parts.push('· אל תמציא נתונים שלא כתובים אצלי. שדה שאין לו מקור — פשוט אל תכלול אותו.');
    if (on('donations')) parts.push('· "אפיק גבייה" (method) הוא אחד מ: מזומן, ביט/פייבוקס, העברה בנקאית, קישור ישיר, הוראת קבע, צ\'ק.');
    if (on('standingOrders')) parts.push('· בהוראת קבע: amount הוא הסכום **החודשי**, payments מספר החיובים. אם כתוב "ללא הגבלה" — כתוב payments: "ללא הגבלה".');
    if (on('events')) parts.push(`· באירוע: type אחד מתוך ${EVENT_TYPES.join('/')} (שבת/מניין/שיעור/אחר), freq אחד מתוך ${EVENT_FREQS.join('/')} (שבועי/דו-שבועי/חודשי/חד-פעמי). date בפורמט yyyy-MM-dd, time בפורמט HH:mm.`);
    if (on('projects')) parts.push('· בפרויקט: kind הוא "project" או "campaign", goal הוא היעד בשקלים כמספר, deadline בפורמט yyyy-MM-dd.');
    if (on('holidays')) parts.push('· בחג מותאם: date בפורמט yyyy-MM-dd (לועזי).');
    if (on('solicitations')) {
      parts.push(`· ברשימת ההתרמה: project הוא שם הקמפיין שהשורה שייכת אליו. ask = כמה מתכוונים לבקש. status הוא **אחד מהערכים האלה בדיוק**: ${SOLICITATION_ORDER.map(o => SOLICITATION_LABEL[o]).join(' / ')}.`);
      parts.push('· אם בטבלה שלי יש עמודה כמו "פוטנציאל תרומה" או "צפי" — זה ה-ask. עמודה כמו "כסף ביד" היא תרומה שכבר נכנסה, ואותה כתוב תחת donations ולא כאן.');
      parts.push('· אל תכתוב ב-ask סכום שכבר נתרם. ask הוא מה שעוד מתכוונים לבקש.');
    }
    // ── מזהה מקור ──────────────────────────────────────────────────────
    //
    // בלי זה, ייבוא חוזר של אותו קובץ יוצר כפילות: השרת נופל למזהה שנגזר
    // מחותמת זמן, והיא חדשה בכל ייבוא. עם מספר קבלה או אישור אמיתי הכתיבה
    // אידמפוטנטית לחלוטין.
    //
    // ההוראה "אל תמציא" אינה מנומסות. מזהה מומצא גרוע ממזהה חסר: הוא
    // *נראה* יציב, ולכן ייבוא שני של אותו קובץ ייצר מזהה אחר ויכפיל —
    // בלי שאיש יבחין. כשאין מזהה, השרת יודע לבנות חתימה יציבה בעצמו.
    if (on('donations') || on('standingOrders')) {
      parts.push('· אם יש בקובץ מספר קבלה, מספר אישור, מספר עסקה או מספר הוראה — ' +
        'כתוב אותו בשדה id. **אל תמציא מזהה ואל תמספר שורות מעצמך**: ' +
        'אם אין מספר כזה בקובץ, פשוט השמט את השדה id לגמרי.');
    }

    if (on('items')) parts.push('· לכל משימה כתוב שיוך (targetKind) אחד מתוך: "holiday", "event", "project", "homeVisit", "contact" (עם שם האדם ב-targetLabel), "standalone". ב-targetLabel כתוב את שם החג/האירוע/הפרויקט — **גם אם הוא כזה שאתה יוצר עכשיו באותה תשובה**.');

    // ── הסכימה, רק לנבחרים ────────────────────────────────────────────────
    const schema: Record<string, any> = {};
    if (on('contacts')) schema.contacts = [{ 'שם מלא': 'ישראל ישראלי', 'טלפון': '050-1234567', 'כתובת': 'הרצל 5', 'בן/בת זוג': 'שרה', 'הערות': '' }];
    if (on('donations')) schema.donations = [{ id: '12345', name: 'ישראל ישראלי', amount: 500, date: '15/05/2026', method: 'מזומן', purpose: 'תרומה כללית', notes: '' }];
    if (on('standingOrders')) schema.standingOrders = [{ id: '1866314', name: 'דוד כהן', amount: 100, startDate: '01/09/2025', payments: 12, phone: '', campaign: '' }];
    if (on('events')) schema.events = [{ name: 'סעודת שבת', type: 'shabbat', freq: 'weekly', date: '2026-08-14', time: '19:30' }];
    if (on('projects')) schema.projects = [{ name: 'הדפסת לוח שנה', kind: 'project', goal: 12000, deadline: '2026-09-01', notes: '' }];
    if (on('holidays')) schema.holidays = [{ name: 'יום השנה לסבא', date: '2026-10-05', desc: '' }];
    if (on('solicitations')) schema.solicitations = [
      { project: 'הדפסת לוח שנה', name: 'ישראל ישראלי', ask: 1200, status: 'לחזור אליו', notes: 'לחזור בחודש 9' },
      { project: 'הדפסת לוח שנה', name: 'דוד כהן', ask: 3600, status: 'תורם', notes: '' },
    ];
    if (on('items')) schema.items = [
      ...(on('holidays') ? [{ text: 'משימה הקשורה לחג', targetKind: 'holiday', targetLabel: 'שם החג' }] : []),
      ...(on('events') ? [{ text: 'לארגן כיבוד', targetKind: 'event', targetLabel: 'סעודת שבת' }] : []),
      ...(on('projects') ? [{ text: 'לאשר עיצוב', targetKind: 'project', targetLabel: 'הדפסת לוח שנה' }] : []),
      { text: 'משימה כללית', targetKind: 'standalone' },
    ];

    parts.push('\nכשסיימנו, החזר בלוק קוד JSON יחיד במבנה הזה בדיוק, בלי טקסט נוסף בתוך הבלוק:');
    parts.push('```json');
    parts.push(JSON.stringify(schema, null, 2));
    parts.push('```');
    parts.push(`\nהמפתחות המותרים בתשובה: ${chosen.join(', ')}. מפתח שאין לו נתונים — פשוט אל תכלול אותו.`);

    setPrompt(parts.join('\n'));
  };

  // ── גיבוי מלא, באותה תבנית בדיוק ─────────────────────────────────────────
  //
  // הקובץ שיוצא מכאן הוא בדיוק המבנה שהמסך הזה קולט. זה נשמע מיותר עד
  // שמנסים: ייצוא ל-CSV מאבד חצי מהשדות ואת כל הקשרים, וקובץ שלא חוזר
  // פנימה הוא לא גיבוי אלא דוח.
  //
  // אפשר להדביק אותו כאן ישירות בלי AI, ואפשר לתת אותו ל-AI יחד עם מידע
  // נוסף ולבקש שימזג — וזה בדיוק מה ש-AI טוב בו.
  const downloadBackup = () => {
    const backup = {
      contacts: Object.values(donors).map((d: any) => {
        const out: Record<string, any> = { 'שם מלא': d.name };
        const c = (donors as any)[d.name] || {};
        Object.keys(c).forEach(k => {
          if (['name', 'donations', 'total', 'lastDate'].includes(k)) return;
          if (c[k] !== undefined && c[k] !== '') out[k] = c[k];
        });
        return out;
      }),
      events: (eventsData as any[]).map(e => ({
        name: e.name, type: e.type, freq: e.freq, date: e.date, time: e.time,
      })),
      projects: (projects as any[]).map(p => ({
        name: p.name, kind: p.kind, goal: p.goal, deadline: p.deadline || '', notes: p.notes || '',
      })),
      holidays: getCustomHols().map((h: any) => ({ name: h.name, date: h.date, desc: h.desc || '' })),
      items: Object.entries(holidayExtras).flatMap(([id, extra]: any) =>
        (extra?.tasks || []).filter((t: any) => !t.done).map((t: any) => ({
          text: t.text,
          targetKind: id === STANDALONE_TASKS_ID ? 'standalone' : 'holiday',
          targetLabel: id === STANDALONE_TASKS_ID ? '' : id,
        }))
      ),
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `גיבוי-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setParseError('ההעתקה האוטומטית לא עבדה — סמן/י את הטקסט והעתק/י ידנית.');
    }
  };

  const parsePasted = () => {
    setParseError('');
    const fenceMatch = pasteText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = (fenceMatch ? fenceMatch[1] : pasteText).trim();
    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      setParseError('לא הצלחתי לקרוא את הטקסט כ-JSON תקין. ודא/י שהדבקת בדיוק את בלוק הקוד שה-AI החזיר.');
      return;
    }

    // ── רשומות ──────────────────────────────────────────────────────────
    // מסננים לפי השדה שבלעדיו הרשומה חסרת משמעות, כדי ששורה ריקה שה-AI
    // השאיר לא תיווצר כאיש קשר בשם ריק.
    const pick = (arr: any, keyField: string, prefix: string): SheetRow[] =>
      (Array.isArray(arr) ? arr : [])
        .filter((r: any) => r && String(r[keyField] || '').trim())
        .map((r: any, i: number) => ({ key: `${prefix}_${i}`, data: r }));

    const nextRows: Record<string, SheetRow[]> = {
      contacts: pick(parsed.contacts, 'שם מלא', 'c'),
      donations: pick(parsed.donations, 'name', 'd'),
      standingOrders: pick(parsed.standingOrders, 'name', 'h'),
      events: pick(parsed.events, 'name', 'newev'),
      projects: pick(parsed.projects, 'name', 'newproj'),
      holidays: pick(parsed.holidays, 'name', 'newhol'),
      solicitations: pick(parsed.solicitations, 'name', 'sol'),
    };

    // ── משימות ──────────────────────────────────────────────────────────
    // רשימות היעדים כוללות גם את מה שנוצר עכשיו — משימה שהגיעה יחד עם
    // האירוע שלה צריכה לנחות עליו, לא ליפול למשימות הכלליות.
    const evOpts = [
      ...(eventsData as any[]).map(e => ({ id: e.id, label: e.name })),
      ...nextRows.events.map(r => ({ id: r.key, label: String(r.data.name) })),
    ];
    const projOpts = [
      ...(projects as any[]).map(p => ({ id: p.id, label: p.name })),
      ...nextRows.projects.map(r => ({ id: r.key, label: String(r.data.name) })),
    ];

    const rawItems: any[] = Array.isArray(parsed.items) ? parsed.items : [];
    const validItems = rawItems.filter(it => it && typeof it.text === 'string' && it.text.trim());
    const resolvedItems: ParsedItem[] = validItems.map((it, i) => {
      const kind: TargetKind = ['holiday', 'event', 'project', 'homeVisit', 'contact'].includes(it.targetKind) ? it.targetKind : 'standalone';
      const label = typeof it.targetLabel === 'string' ? it.targetLabel : '';
      let targetId = '';
      if (kind === 'holiday') targetId = bestMatch(label, holidayOptions);
      else if (kind === 'event') targetId = bestMatch(label, evOpts);
      else if (kind === 'project') targetId = bestMatch(label, projOpts);
      else if (kind === 'homeVisit') targetId = bestMatch(label, roundOptions);
      else if (kind === 'contact') targetId = bestMatch(label, contactNames.map(n => ({ id: n, label: n })));
      return { key: `item_${i}`, text: it.text.trim(), targetKind: kind, targetId };
    });

    const total = resolvedItems.length + ALL_SECTIONS.reduce((s, k) => s + nextRows[k].length, 0);
    if (total === 0) {
      setParseError('ה-JSON נקרא בהצלחה, אבל לא נמצאה בו אף רשומה תקינה. ודא/י שהעתקת את כל בלוק הקוד.');
      return;
    }

    setItems(resolvedItems);
    setRows(nextRows);
    setStep('review');
  };

  const patchItem = (key: string, patch: Partial<ParsedItem>) => {
    setItems(prev => prev.map(it => it.key === key ? { ...it, ...patch } : it));
  };
  const removeItem = (key: string) => setItems(prev => prev.filter(it => it.key !== key));
  const removeRow = (section: string, key: string) =>
    setRows(prev => ({ ...prev, [section]: prev[section].filter(r => r.key !== key) }));

  const sheetRowCount = SHEET_SECTIONS.reduce((s, k) => s + rows[k].length, 0);
  const appRowCount = APP_SECTIONS.reduce((s, k) => s + rows[k].length, 0);
  const totalCount = items.length + sheetRowCount + appRowCount;

  // ── מה כבר קיים ביומן ──────────────────────────────────────────────────
  //
  // מחושב מחדש בכל שינוי ברשימה, כדי שהסרת שורה תעדכן מיד את הספירה.
  // ההשוואה מנרמלת תאריך, שם וסכום — בגיליון יושבים שני פורמטים של תאריך
  // זה לצד זה, והשוואה גולמית הייתה מפספסת בדיוק את מה שהיא מחפשת.
  const dupes = React.useMemo(
    () => findDuplicates(
      rows.donations.map(r => ({ ...r, ...r.data })),
      donations || []
    ),
    [rows.donations, donations]
  );

  /** מסיר מהרשימה את השורות שכבר קיימות ביומן. */
  const removeExistingDonations = () => {
    const drop = new Set(dupes.existing.map((r: any) => r.key));
    setRows(prev => ({ ...prev, donations: prev.donations.filter(r => !drop.has(r.key)) }));
  };

  const commit = async () => {
    if (totalCount === 0) return;
    setSaving(true);

    // ── אירועים, פרויקטים וחגים ──────────────────────────────────────────
    //
    // נוצרים **ראשונים**, כי משימות שהגיעו איתם מצביעות אליהם במזהה זמני
    // שצריך להחליף במזהה האמיתי. idMap הוא הגשר בין השניים.
    const idMap: Record<string, string> = {};

    const newEvents = rows.events.map(r => {
      const d = r.data;
      const id = `ev_${Date.now()}_${r.key}`;
      idMap[r.key] = id;
      return {
        id,
        name: String(d.name).trim(),
        type: EVENT_TYPES.includes(d.type) ? d.type : 'other',
        freq: EVENT_FREQS.includes(d.freq) ? d.freq : 'weekly',
        date: d.date || new Date().toISOString().split('T')[0],
        time: d.time || '',
        attendance: {},
        tasks: [],
        performers: [],
      };
    });

    const newProjects = rows.projects.map(r => {
      const d = r.data;
      const base = emptyProject(String(d.name).trim());
      const id = `proj_${Date.now()}_${r.key}`;
      idMap[r.key] = id;
      return {
        ...base,
        id,
        kind: d.kind === 'campaign' ? 'campaign' : 'project',
        goal: Number(d.goal) || '',
        deadline: d.deadline || undefined,
        notes: d.notes || '',
      };
    });

    if (newEvents.length) updateEventsData([...(eventsData as any[]), ...newEvents]);
    if (newProjects.length) updateProjects([...(projects as any[]), ...newProjects] as any);

    // ── רשימת התרמה ──────────────────────────────────────────────────────
    //
    // רצה **אחרי** יצירת הפרויקטים החדשים, כי שורה יכולה להצביע על קמפיין
    // שנוצר באותו ייבוא. השיוך לפי שם, עם אותה התאמה מקורבת שמשמשת את
    // המשימות — "לוחות שנה תשפ״ז" ו"הדפסת לוחות שנה תשפ״ז" הם אותו דבר.
    const solRows = rows.solicitations || [];
    if (solRows.length) {
      const allProjects = [...(projects as any[]), ...newProjects];
      const projOpts = allProjects.map(p => ({ id: p.id, label: p.name }));
      const byProj = new Map<string, Solicitation[]>();

      solRows.forEach(r => {
        const d = r.data;
        const name = String(d.name || '').trim();
        if (!name) return;
        const pid = bestMatch(String(d.project || '').trim(), projOpts);
        if (!pid) return;
        const list = byProj.get(pid) || [];
        list.push({
          name,
          status: normalizeStatus(d.status),
          ask: d.ask === undefined || d.ask === '' ? undefined : Number(d.ask) || undefined,
          notes: d.notes ? String(d.notes) : undefined,
        });
        byProj.set(pid, list);
      });

      if (byProj.size) {
        updateProjects(allProjects.map((p: any) => {
          const incoming = byProj.get(p.id);
          if (!incoming) return p;
          // שם שכבר ברשימה מתעדכן ולא משוכפל
          const existing: Solicitation[] = p.solicitations || [];
          const byName = new Map(existing.map(x => [x.name.trim(), x]));
          incoming.forEach(x => {
            const prev = byName.get(x.name.trim());
            byName.set(x.name.trim(), prev ? { ...prev, ...x } : x);
          });
          return { ...p, solicitations: Array.from(byName.values()) };
        }) as any);
      }
    }

    if (rows.holidays.length) {
      const existing = getCustomHols();
      saveCustomHols([
        ...existing,
        ...rows.holidays.map(r => ({
          name: String(r.data.name).trim(),
          date: r.data.date || '',
          desc: r.data.desc || '',
        })),
      ]);
    }

    // ── משימות: נשמרות מקומית, בדיוק כמו קודם ────────────────────────────
    const byHoliday = new Map<string, ParsedItem[]>();
    const byEvent = new Map<string, ParsedItem[]>();
    const byProject = new Map<string, ParsedItem[]>();
    const byRound = new Map<string, ParsedItem[]>();
    const contactItems: ParsedItem[] = [];
    const standaloneItems: ParsedItem[] = [];

    items.forEach(raw => {
      // מזהה זמני של אירוע/פרויקט שנוצר עכשיו → המזהה האמיתי שלו
      const it = idMap[raw.targetId] ? { ...raw, targetId: idMap[raw.targetId] } : raw;

      if (it.targetKind === 'holiday' && it.targetId) {
        if (!byHoliday.has(it.targetId)) byHoliday.set(it.targetId, []);
        byHoliday.get(it.targetId)!.push(it);
      } else if (it.targetKind === 'event' && it.targetId) {
        if (!byEvent.has(it.targetId)) byEvent.set(it.targetId, []);
        byEvent.get(it.targetId)!.push(it);
      } else if (it.targetKind === 'project' && it.targetId) {
        if (!byProject.has(it.targetId)) byProject.set(it.targetId, []);
        byProject.get(it.targetId)!.push(it);
      } else if (it.targetKind === 'homeVisit' && it.targetId) {
        if (!byRound.has(it.targetId)) byRound.set(it.targetId, []);
        byRound.get(it.targetId)!.push(it);
      } else if (it.targetKind === 'contact' && it.targetId) {
        contactItems.push(it);
      } else {
        standaloneItems.push(it);
      }
    });

    byHoliday.forEach((its, id) => {
      const existing = holidayExtras[id]?.tasks || [];
      updateHolidayExtras(id, { tasks: [...existing, ...its.map(it => stampCreated({ text: it.text, done: false }))] });
    });
    if (byEvent.size > 0) {
      // כולל האירועים שנוצרו לפני רגע — לכן מתחילים מהרשימה המאוחדת
      updateEventsData([...(eventsData as any[]), ...newEvents].map((e: any) => byEvent.has(e.id)
        ? { ...e, tasks: [...(e.tasks || []), ...byEvent.get(e.id)!.map(it => stampCreated({ text: it.text, done: false }))] }
        : e));
    }
    if (byProject.size > 0) {
      updateProjects([...(projects as any[]), ...newProjects].map((p: any) => byProject.has(p.id)
        ? { ...p, tasks: [...(p.tasks || []), ...byProject.get(p.id)!.map(it => stampCreated({ text: it.text, done: false }))] }
        : p) as any);
    }
    byRound.forEach((its, id) => {
      const round = (homeVisits.rounds || []).find((r: any) => r.id === id);
      updateHomeVisitRoundMeta(id, { prepTasks: [...(round?.prepTasks || []), ...its.map(it => ({ text: it.text, done: false }))] });
    });
    if (contactItems.length > 0 || standaloneItems.length > 0) {
      const existing = holidayExtras[STANDALONE_TASKS_ID]?.tasks || [];
      const newContactTasks = contactItems.map(it => stampCreated({ text: `👤 ${it.targetId}: ${it.text}`, done: false, personName: it.targetId }));
      const newStandaloneTasks = standaloneItems.map(it => stampCreated({ text: it.text, done: false }));
      updateHolidayExtras(STANDALONE_TASKS_ID, { tasks: [...existing, ...newContactTasks, ...newStandaloneTasks] });
    }

    // ── אנשי קשר / תרומות / הוראות קבע: נכתבים לגיליון ────────────────────
    let sheetResult: any = null;
    if (sheetRowCount > 0) {
      sheetResult = await apiPost('importRows', {
        contacts: rows.contacts.map(r => r.data),
        donations: rows.donations.map(r => r.data),
        standingOrders: rows.standingOrders.map(r => r.data),
      });
    }

    setSaving(false);
    setResult({ tasks: items.length, sheet: sheetResult,
      events: newEvents.length, projects: newProjects.length, holidays: rows.holidays.length });
    setStep('done');
    if (sheetRowCount > 0) refresh();
  };

  const undo = async () => {
    if (!result?.sheet?.tag) return;
    setSaving(true);
    await apiPost('undoImport', { tag: result.sheet.tag });
    setSaving(false);
    setUndone(true);
    refresh();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl p-5 pb-8 w-full max-w-[480px] max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A] flex items-center gap-2">
            <Bot size={20} className="text-purple-700" /> ייבוא מידע מבינה מלאכותית
          </h2>
          <button onClick={onClose} className="bg-gray-200/50 p-2 rounded-full text-gray-500 hover:bg-gray-200"><X size={16} /></button>
        </div>

        {step === 'prompt' && (
          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3">
            <p className="text-[11px] text-gray-500 leading-relaxed">
              יש לך רשימה, אקסל, או צילום של דף? צור פרומפט, הדבק אותו בצ'אט AI יחד עם הקובץ,
              והחזר הנה את ה-JSON שקיבלת. בחר קודם במה הקובץ נוגע — ההנחיה תיבנה
              סביב זה בלבד, ותצא קצרה ומדויקת יותר. לפני השמירה תראה בדיוק
              מה עומד להיכנס, ולאן.
            </p>
            {!prompt ? (
              <>
                {/* ── במה הקובץ נוגע ──────────────────────────────────
                    ההנחיה נבנית סביב הבחירה הזו בלבד. פחות נושאים =
                    הנחיה קצרה יותר, ופחות הזמנה למודל להמציא דברים
                    שאין בקובץ. */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-gray-600">במה הקובץ שלך נוגע?</label>
                    <div className="flex gap-2">
                      <button onClick={() => setTopics([...ALL_SECTIONS, 'items'])}
                              className="text-[10px] font-bold text-purple-700 hover:underline">הכל</button>
                      <button onClick={() => setTopics([])}
                              className="text-[10px] font-bold text-gray-400 hover:underline">נקה</button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {[...ALL_SECTIONS, 'items'].map(t => {
                      const on = topics.includes(t);
                      const label = t === 'items' ? '📋 משימות' : SECTION_LABELS[t];
                      const hint = t === 'items' ? 'דברים לעשות' : TOPIC_HINTS[t];
                      return (
                        <button
                          key={t}
                          onClick={() => setTopics(prev => on ? prev.filter(x => x !== t) : [...prev, t])}
                          className={`w-full text-right px-3 py-2 rounded-xl border transition-colors flex items-center gap-2.5 ${
                            on ? 'bg-purple-50 border-purple-300' : 'bg-white border-[#EDE6D6]'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
                            on ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300'
                          }`}>
                            {on && <Check size={11} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-[#0D1B2A] truncate">{label}</span>
                            <span className="block text-[10px] text-gray-400 truncate">{hint}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button onClick={buildPrompt} disabled={!topics.length}
                        className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white text-sm font-bold py-2.5 rounded-xl active:scale-95 transition-transform disabled:opacity-40">
                  <Sparkles size={15} /> צור פרומפט ל-{topics.length} נושאים
                </button>
                <button onClick={downloadBackup} className="w-full flex items-center justify-center gap-2 border border-[#EDE6D6] text-gray-600 text-xs font-bold py-2 rounded-xl hover:bg-gray-50">
                  <Download size={14} /> הורד גיבוי מלא (JSON)
                </button>
                <div className="flex justify-end">
                  <Explain label="מה זה הגיבוי">
                    הגיבוי יוצא בדיוק באותה תבנית שהמסך הזה קולט — אפשר להדביק אותו
                    כאן בחזרה בלי AI, או לתת אותו ל-AI יחד עם מידע נוסף ולבקש שימזג.
                  </Explain>
                </div>
              </>
            ) : (
              <>
                <button onClick={() => setPrompt('')} className="text-[11px] text-gray-400 hover:text-[#9B7A2F] font-bold">
                  ← שנה את הנושאים ובנה מחדש
                </button>
                <div className="relative">
                  <textarea readOnly value={prompt} rows={7} className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 text-[11px] leading-relaxed outline-none resize-none" dir="rtl" />
                  <button onClick={copyPrompt} className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-md flex items-center gap-1">
                    {copied ? <><Check size={12} /> הועתק</> : <><Copy size={12} /> העתק</>}
                  </button>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">הדביקו כאן את פלט ה-JSON שקיבלתם מה-AI:</label>
                  <textarea
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    rows={6}
                    className="w-full bg-white border border-[#EDE6D6] rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-400 resize-none"
                    placeholder='{"contacts": [...], "donations": [...]}'
                    dir="ltr"
                  />
                </div>
                <button onClick={parsePasted} disabled={!pasteText.trim()} className="w-full bg-[#0D1B2A] text-[#E8C97A] text-sm font-bold py-2.5 rounded-xl disabled:opacity-40">
                  המשך לאישור
                </button>
                {parseError && <div className="text-xs rounded-lg p-2.5 bg-red-50 text-red-700">{parseError}</div>}
              </>
            )}
          </div>
        )}

        {step === 'review' && (
          <>
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3 mb-3">
              <p className="text-[11px] text-gray-500">
                עברו על הכל לפני השמירה. אפשר להסיר כל שורה, ולתקן את השיוך של כל משימה.
              </p>

              {/* ── שורות שכבר נמצאות ביומן ──────────────────────────────
                  זו אזהרה, לא סינון. ההגנה האמיתית מפני כפילות יושבת
                  בשרת; כאן רק אומרים למשתמש מה הוא עומד לעשות, כדי
                  שלא יגלה את זה אחרי השמירה. */}
              {dupes.existing.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed">
                  <div className="font-bold mb-1 flex items-center gap-1.5">
                    <AlertTriangle size={13} className="shrink-0" />
                    {dupes.existing.length} מתוך {rows.donations.length} התרומות כבר קיימות ביומן
                  </div>
                  <div className="mb-2">
                    השרת לא יכתוב אותן פעמיים, אז אפשר להמשיך בלי חשש. אם תסיר אותן
                    כאן, הרשימה שתישמר תהיה קצרה וברורה יותר.
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-0.5 mb-2">
                    {dupes.existing.slice(0, 12).map((r: any) => (
                      <div key={r.key} className="opacity-80">
                        · {r.data.name} · {r.data.date} · ₪{r.data.amount}
                      </div>
                    ))}
                    {dupes.existing.length > 12 && <div className="opacity-60">ועוד {dupes.existing.length - 12}…</div>}
                  </div>
                  <button
                    onClick={removeExistingDonations}
                    className="bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg px-2.5 py-1 font-bold transition-colors"
                  >
                    הסר את {dupes.existing.length} השורות הקיימות
                  </button>
                </div>
              )}

              {dupes.repeatedInFile.length > 0 && (
                <div className="bg-white border border-[#EDE6D6] rounded-xl p-3 text-[11px] text-gray-600 leading-relaxed">
                  <b>{dupes.repeatedInFile.length} שורות חוזרות על עצמן בתוך הקובץ.</b> אם אלה
                  תרומות אמיתיות ונפרדות — הכול בסדר, שתיהן יישמרו. אם זו טעות בקובץ,
                  כדאי להסיר עכשיו.
                </div>
              )}

              {/* שורות שנכתבות לגיליון */}
              {ALL_SECTIONS.map(section => rows[section].length > 0 && (
                <div key={section}>
                  <div className="text-xs font-bold text-[#0D1B2A] mb-1.5">
                    {SECTION_LABELS[section]} ({rows[section].length})
                  </div>
                  <div className="space-y-1.5">
                    {rows[section].map(r => (
                      <div key={r.key} className="bg-white rounded-lg p-2.5 border border-[#EDE6D6] flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 text-[11px] leading-relaxed">
                          {PREVIEW_FIELDS[section].map(f => r.data[f] !== undefined && String(r.data[f]).trim() !== '' && (
                            <span key={f} className="text-gray-600">
                              <span className="text-gray-400">{f}:</span> <b className="text-[#0D1B2A]">{String(r.data[f])}</b>{'  '}
                            </span>
                          ))}
                        </div>
                        <button onClick={() => removeRow(section, r.key)} className="text-red-300 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* משימות */}
              {items.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-[#0D1B2A] mb-1.5">📋 משימות ({items.length})</div>
                  <div className="space-y-2">
                    {items.map(it => (
                      <div key={it.key} className="bg-white rounded-xl p-3 shadow-sm border border-[#EDE6D6] space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm text-[#0D1B2A] flex-1">{it.text}</span>
                          <button onClick={() => removeItem(it.key)} className="text-red-300 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
                        </div>
                        <div className="flex gap-1.5">
                          <select
                            value={it.targetKind}
                            onChange={e => patchItem(it.key, { targetKind: e.target.value as TargetKind, targetId: '' })}
                            className="flex-1 bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#C9A84C]"
                          >
                            {(Object.keys(KIND_LABELS) as TargetKind[]).map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                          </select>
                          {it.targetKind === 'holiday' && (
                            <select value={it.targetId} onChange={e => patchItem(it.key, { targetId: e.target.value })} className="flex-1 bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#C9A84C]">
                              {holidayOptions.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
                            </select>
                          )}
                          {it.targetKind === 'event' && (
                            <select value={it.targetId} onChange={e => patchItem(it.key, { targetId: e.target.value })} className="flex-1 bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#C9A84C]">
                              {eventOptions.map(ev => <option key={ev.id} value={ev.id}>{ev.label}</option>)}
                            </select>
                          )}
                          {it.targetKind === 'project' && (
                            <select value={it.targetId} onChange={e => patchItem(it.key, { targetId: e.target.value })} className="flex-1 bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#C9A84C]">
                              {projectOptions.length === 0 && <option value="">אין פרויקט</option>}
                              {projectOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                          )}
                          {it.targetKind === 'homeVisit' && (
                            <select value={it.targetId} onChange={e => patchItem(it.key, { targetId: e.target.value })} className="flex-1 bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#C9A84C]">
                              {roundOptions.length === 0 && <option value="">אין מערך פעיל</option>}
                              {roundOptions.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                            </select>
                          )}
                          {it.targetKind === 'contact' && (
                            <>
                              <input
                                list="global-ai-import-contacts"
                                value={it.targetId}
                                onChange={e => patchItem(it.key, { targetId: e.target.value })}
                                className="flex-1 bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#C9A84C]"
                                placeholder="שם איש הקשר"
                              />
                              <datalist id="global-ai-import-contacts">
                                {contactNames.map(n => <option key={n} value={n} />)}
                              </datalist>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {totalCount === 0 && <div className="text-center text-gray-400 text-sm py-6">הכל הוסר</div>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setStep('prompt')} disabled={saving} className="px-4 bg-gray-100 rounded-xl text-gray-500 font-bold text-sm disabled:opacity-40">חזרה</button>
              <button onClick={commit} disabled={totalCount === 0 || saving} className="flex-1 bg-gradient-to-br from-[#0D1B2A] to-[#1A2E45] text-white rounded-xl py-3 font-bold shadow-md disabled:opacity-40">
                {saving ? 'שומר...' : `שמור ${totalCount} רשומות`}
              </button>
            </div>
          </>
        )}

        {step === 'done' && result && (
          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3">
            {result.sheet?.error ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                השמירה לגיליון נכשלה: {result.sheet.error}
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800 space-y-1">
                <div className="font-bold">נשמר ✓</div>
                {result.tasks > 0 && <div>{result.tasks} משימות</div>}
                {result.sheet?.added?.contacts > 0 && <div>{result.sheet.added.contacts} אנשי קשר</div>}
                {result.sheet?.added?.donations > 0 && <div>{result.sheet.added.donations} תרומות</div>}
                {result.sheet?.added?.standingOrders > 0 && <div>{result.sheet.added.standingOrders} הוראות קבע</div>}
                {result.events > 0 && <div>{result.events} אירועים</div>}
                {result.projects > 0 && <div>{result.projects} פרויקטים</div>}
                {result.holidays > 0 && <div>{result.holidays} חגים ותאריכים</div>}
              </div>
            )}

            {/* ── מה דולג, ולמה ────────────────────────────────────────────
                מונה אמת לבדו אינו מספיק: מי שייבא חמישים הוראות ורואה
                שתים־עשרה יחשוב שהייבוא נשבר. מספר קטן ממה שציפית, בלי
                הסבר, נראה בדיוק כמו באג.

                השדה תוספתי — גיליון שעדיין מריץ קוד ישן פשוט לא מחזיר
                אותו, והמסך נראה כמו קודם. */}
            {(() => {
              const rej = [
                ...(result.sheet?.rejected?.donations || []),
                ...(result.sheet?.rejected?.standingOrders || []),
              ];
              if (!rej.length) return null;
              return (
                <div className="bg-white border border-[#EDE6D6] rounded-xl p-3 text-[11px] text-gray-600 leading-relaxed">
                  <div className="font-bold text-[#0D1B2A] mb-1.5">
                    {rej.length} שורות דולגו
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {rej.map((r: any, i: number) => (
                      <div key={(r.id || '') + i} className="flex gap-1.5">
                        <span className="text-gray-400 shrink-0">·</span>
                        <span className="min-w-0">
                          <b className="text-[#0D1B2A]">{r.name || r.id}</b>
                          {r.reason && <span className="text-gray-500"> — {r.reason}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">
                    דילוג אינו שגיאה: ברוב המקרים השורה כבר קיימת בגיליון,
                    והמערכת מונעת כפילות.
                  </p>
                </div>
              );
            })()}

            {result.sheet?.tag && !undone && (
              <>
                <button
                  onClick={undo}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 border border-orange-200 text-orange-700 text-sm font-bold py-2.5 rounded-xl hover:bg-orange-50 disabled:opacity-40"
                >
                  <Undo2 size={15} /> {saving ? 'מבטל...' : 'בטל את הייבוא הזה'}
                </button>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  הביטול מסיר את <b>התרומות</b> שיובאו בפעולה הזו בלבד. אנשי קשר והוראות קבע
                  נשארים — הם כבר עשויים להיות מקושרים לנתונים אחרים, ולכן מסירים אותם ידנית
                  מהגיליון אם צריך.
                </p>
              </>
            )}
            {undone && <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-800">הייבוא בוטל.</div>}

            <button onClick={onClose} className="w-full bg-[#0D1B2A] text-[#E8C97A] text-sm font-bold py-2.5 rounded-xl">סגור</button>
          </div>
        )}
      </div>
    </div>
  );
}
