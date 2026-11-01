// שליחת וואטסאפ לבעלי הוראות קבע — הלוגיקה הטהורה (בלי React), כדי שאפשר
// יהיה לבדוק אותה.
//
// השליחה עצמה היא קישור wa.me לכל אדם: ההודעה נפתחת מוכנה בוואטסאפ של
// המשתמש, והוא לוחץ "שלח". אין שרת, אין עלות ואין סיכון שהמספר ייחסם על
// שליחה המונית — כל הודעה יוצאת מהטלפון שלו כמו הודעה רגילה.

import { HkEntry, ChargeFailure, getHkStatus, indexFailures, openFailureFor } from './standingOrders';
import { normalizePhone, contactPhone } from './contactPhone';

export { normalizePhone };

export type BroadcastKind = 'thanks' | 'general' | 'failure';
export type BroadcastLang = 'he' | 'ru';

export const BROADCAST_KIND_LABEL: Record<BroadcastKind, string> = {
  thanks: 'תודה חודשית',
  general: 'הודעה כללית',
  failure: 'חיוב שנכשל',
};

export interface Recipient {
  /** מפתח יציב לסימון "נשלח" — הטלפון, או השם כשאין טלפון */
  key: string;
  name: string;
  /** בפורמט בינלאומי בלי + (972...), ריק אם אין */
  phone: string;
  /** סך החיוב החודשי בכל ההוראות הפעילות של אותו אדם */
  amount: number;
  /** סיבת הכשל — לניתוח פנימי בלבד, לא משולבת בהודעה כברירת מחדל */
  reason: string;
  /** תאריך כשל החיוב, אם קיים מועד יחיד. */
  failureDate?: string;
  /** מספר החיובים שעדיין פתוחים עבור אותו נמען. */
  failureCount?: number;
  orderIds: string[];
  /** תרומה בתשלומי אשראי (לא הוראת קבע) — כמה תשלומים עברו מתוך כמה */
  installments?: { paid: number; total: number };
}

/** מציג תאריך ISO בפורמט DD/MM/YYYY במכתב, ללא שינוי הנתונים במאגר. */
function failureDateDisplay(value: string): string {
  const raw = String(value || '').trim();
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return iso ? `${iso[3].padStart(2, '0')}/${iso[2].padStart(2, '0')}/${iso[1]}` : raw;
}

/** ההודעה על כשל חיוב זמינה מיום הכשל ועד סוף היום ה-14, לפי תאריך מקומי.
 * נתון ללא תאריך תקין או מתאריך עתידי אינו מאפשר משלוח הודעת גבייה.
 * משתמשים בימי לוח (UTC date-only), כדי שמעברי שעון קיץ לא יקצרו את החלון.
 */
export const FAILURE_CONTACT_DAYS = 14;

function calendarDay(value: string): number | null {
  const input = String(value || '').trim();
  const dmy = input.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})(?:\D|$)/);
  const iso = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]|$)/);
  if (!dmy && !iso) return null;
  const yearText = iso ? iso[1] : dmy![3];
  const year = yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText);
  const month = Number(iso ? iso[2] : dmy![2]);
  const day = Number(iso ? iso[3] : dmy![1]);
  const stamp = Date.UTC(year, month - 1, day);
  const checked = new Date(stamp);
  if (!Number.isFinite(stamp) || checked.getUTCFullYear() !== year ||
      checked.getUTCMonth() + 1 !== month || checked.getUTCDate() !== day) return null;
  return stamp;
}

export function isFailureContactEligible(date: string | null | undefined, now: Date = new Date()): boolean {
  const failed = calendarDay(date || '');
  if (failed == null || !Number.isFinite(now.getTime())) return false;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSince = (today - failed) / 86400000;
  return daysSince >= 0 && daysSince <= FAILURE_CONTACT_DAYS;
}

// ── תרומה בתשלומי אשראי כ"הוראת קבע" לצורך הודעות ────────────────────────
//
// מבחינת התורם, ₪1,200 ב-12 תשלומים זה ₪100 שיורדים לו כל חודש — בדיוק כמו
// הוראת קבע, והוא ראוי לאותה תודה חודשית. בכספים זו נשארת תרומה אחת (היא
// כבר רשומה ביומן בסכום המלא), ולכן היא לא נכנסת ללשונית הוראות הקבע —
// רק לרשימת מקבלי ההודעות, כל עוד נשארו בה תשלומים.

export interface InstallmentPlan {
  name: string;
  phone?: string;
  monthly: number;
  paid: number;
  total: number;
}

function parseDmy(v?: string): Date | null {
  const m = String(v || '').trim().match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

export interface InstallmentRow extends InstallmentPlan {
  amount: number;
  date: string;
  /** החודש של התשלום האחרון, בפורמט MM/YYYY */
  endsMonth: string;
  done: boolean;
  purpose?: string;
}

/** כל התרומות בתשלומי אשראי — רצות וגמורות — לפי ההערה "שולם ב-N תשלומים" שהסקריפט רושם */
export function installmentRows(donations: any[], now: Date = new Date()): InstallmentRow[] {
  const out: InstallmentRow[] = [];
  (donations || []).forEach(d => {
    if (!d?.name || d.status) return; // סטטוס לא ריק = חיוב שנכשל/בוטל
    const m = String(d.notes || '').match(/(\d+)\s*תשלומים/);
    const total = m ? Number(m[1]) : 0;
    const amount = Number(d.amount) || 0;
    if (total < 2 || amount <= 0) return;
    const start = parseDmy(d.date);
    if (!start) return;
    const elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (elapsed < 0) return;
    const end = new Date(start.getFullYear(), start.getMonth() + total - 1, 1);
    out.push({
      name: d.name,
      monthly: Math.round(amount / total),
      paid: Math.min(total, elapsed + 1),
      total,
      amount,
      date: d.date,
      endsMonth: `${String(end.getMonth() + 1).padStart(2, '0')}/${end.getFullYear()}`,
      done: elapsed >= total,
      purpose: d.purpose,
    });
  });
  // רצות קודם, ובתוכן — מי שהכי קרוב לסיום
  return out.sort((a, b) => Number(a.done) - Number(b.done) || (b.paid / b.total) - (a.paid / a.total));
}

/** תרומות בתשלומים שעדיין רצות היום */
export function activeInstallments(donations: any[], now: Date = new Date()): InstallmentPlan[] {
  return installmentRows(donations, now).filter(r => !r.done)
    .map(({ name, monthly, paid, total }) => ({ name, monthly, paid, total }));
}

/**
 * טלפון של אדם — אותו מקור כמו בכרטיס איש הקשר (ראה contactPhone): תיקון
 * ידני בכרטיס קודם, אחר כך מה שרשום על ההוראה ובגיליון. מספר לא תקין מדולג.
 */
export function phoneFor(hk: HkEntry, crm: Record<string, any>, donors: Record<string, any>): string {
  return contactPhone(crm?.[hk.name], donors?.[hk.name], hk.phone);
}

/**
 * מי מקבל את ההודעה:
 * · תודה / כללית — כל מי שיש לו הוראה פעילה (כולל "מסתיימת בקרוב").
 * · כשל חיוב — רק מי שיש לו כשל פתוח (שלא נכנס כסף אחריו).
 *
 * אדם עם כמה הוראות מקבל הודעה **אחת**, עם הסכום המצטבר. שני אנשים עם
 * אותו טלפון (בני זוג) גם הם מקבלים אחת — אחרת אותו מכשיר מקבל אותה
 * הודעה פעמיים.
 */
export function buildRecipients(
  kind: BroadcastKind,
  hk: HkEntry[],
  failures: ChargeFailure[],
  crm: Record<string, any>,
  donors: Record<string, any>,
  threshold: number,
  donations: any[] = [],
  now: Date = new Date(),
): Recipient[] {
  const failIdx = indexFailures(failures);
  const byKey = new Map<string, Recipient>();

  (hk || []).forEach(h => {
    if (!h?.name) return;
    let reason = '';
    let failureDate = '';
    let failedAmount: number | null = null;
    if (kind === 'failure') {
      const fail = openFailureFor(h, failIdx);
      if (!fail || !isFailureContactEligible(fail.date, now)) return;
      reason = String(fail.reason || '').trim();
      failureDate = failureDateDisplay(fail.date);
      const reportedAmount = Number(fail.amount);
      if (Number.isFinite(reportedAmount) && reportedAmount > 0) failedAmount = reportedAmount;
    } else {
      const status = getHkStatus(h, threshold);
      if (status !== 'active' && status !== 'expiring') return;
    }

    const phone = phoneFor(h, crm, donors);
    const key = phone || `name:${h.name.trim()}`;
    const existing = byKey.get(key);
    // בכשל חיוב מציינים רק את הסכום שלא עבר, ולא הוראות נוספות של אותו תורם.
    const amount = failedAmount ?? (Number(h.amount) || 0);
    if (existing) {
      existing.amount += amount;
      if (kind === 'failure') {
        existing.failureCount = (existing.failureCount || 1) + 1;
        if (existing.failureDate !== failureDate) existing.failureDate = '';
      }
      if (h.id) existing.orderIds.push(String(h.id));
      if (!existing.reason && reason) existing.reason = reason;
      if (!existing.name.split(' / ').includes(h.name)) existing.name += ` / ${h.name}`;
    } else {
      byKey.set(key, {
        key, name: h.name, phone, amount, reason,
        failureDate: kind === 'failure' ? failureDate : undefined,
        failureCount: kind === 'failure' ? 1 : undefined,
        orderIds: h.id ? [String(h.id)] : [],
      });
    }
  });

  // תורמים בתשלומי אשראי — בתודה ובהודעה הכללית בלבד (אין להם "כשל חיוב")
  if (kind !== 'failure') {
    activeInstallments(donations).forEach(plan => {
      const phone = contactPhone(crm?.[plan.name], donors?.[plan.name]);
      const key = phone || `name:${plan.name.trim()}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.amount += plan.monthly;
        if (!existing.name.split(' / ').includes(plan.name)) existing.name += ` / ${plan.name}`;
        if (!existing.orderIds.length) existing.installments = { paid: plan.paid, total: plan.total };
      } else {
        byKey.set(key, { key, name: plan.name, phone, amount: plan.monthly, reason: '', orderIds: [], installments: { paid: plan.paid, total: plan.total } });
      }
    });
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

export interface TemplateVars {
  signer: string;
  org: string;
  lang?: BroadcastLang;
}

/** נוסח מדויק לחיוב אחד או לכמה חיובים, בלי להמציא תאריך או לייחס סכום מצטבר ליום יחיד. */
function failureDescription(
  r: Pick<Recipient, 'amount' | 'failureDate' | 'failureCount'>,
  lang: BroadcastLang,
): string {
  const sum = (Number(r.amount) || 0).toLocaleString('he-IL');
  const count = r.failureCount || 1;
  const date = r.failureDate?.trim();
  if (lang === 'ru') {
    return count > 1
      ? `несколько платежей по регулярному пожертвованию на общую сумму ${sum} ₪ не прошли`
      : `платёж по регулярному пожертвованию на сумму ${sum} ₪${date ? ` от ${date}` : ''} не прошёл`;
  }
  return count > 1
    ? `כמה חיובים של הוראת הקבע, בסכום כולל של ${sum} ₪, לא הושלמו`
    : `החיוב האחרון של הוראת הקבע, בסך ${sum} ₪${date ? `, מתאריך ${date}` : ''}, לא הושלם`;
}

export function fillTemplate(
  template: string,
  r: Pick<Recipient, 'name' | 'amount' | 'reason' | 'failureDate' | 'failureCount'>,
  vars: TemplateVars,
): string {
  return template
    .replace(/\{פרטי חיוב\}/g, failureDescription(r, vars.lang || 'he'))
    .replace(/\{שם\}/g, r.name)
    .replace(/\{סכום\}/g, (Number(r.amount) || 0).toLocaleString('he-IL'))
    .replace(/\{תאריך\}/g, r.failureDate || '')
    .replace(/\{סיבה\}/g, r.reason || '')
    .replace(/\{חותם\}/g, vars.signer)
    .replace(/\{ארגון\}/g, vars.org);
}

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export const PLACEHOLDERS: { token: string; label: string }[] = [
  { token: '{שם}', label: 'שם' },
  { token: '{סכום}', label: 'סכום' },
  { token: '{פרטי חיוב}', label: 'פרטי חיוב (כולל תאריך)' },
  { token: '{תאריך}', label: 'תאריך כשל' },
  { token: '{סיבה}', label: 'סיבת הכשל' },
  { token: '{חותם}', label: 'חותם' },
  { token: '{ארגון}', label: 'ארגון' },
];

export const DEFAULT_TEMPLATES: Record<BroadcastKind, Record<BroadcastLang, string>> = {
  thanks: {
    he: 'שלום {שם},\nרצינו להודות לך מכל הלב על התרומה החודשית בסך ₪{סכום}. בזכות השותפות שלך {ארגון} ממשיך לפעול למען כל הקהילה.\nיהי רצון שהקב"ה יברך אותך ואת כל המשפחה בכל טוב!\n\nבברכה,\n{חותם}',
    ru: 'Здравствуйте, {שם}!\nОт всего сердца благодарим вас за ежемесячное пожертвование в размере ₪{סכום}. Благодаря вашей поддержке {ארגון} продолжает работать для всей общины.\nПусть Всевышний благословит вас и всю вашу семью!\n\nС уважением,\n{חותם}',
  },
  general: {
    he: 'שלום {שם},\n\n\nבברכה,\n{חותם}',
    ru: 'Здравствуйте, {שם}!\n\n\nС уважением,\n{חותם}',
  },
  failure: {
    he: 'מה שלומך, {שם}?\n\nקודם כול, רציתי להודות לך על השותפות הקבועה שלך בפעילות של {ארגון}. התמיכה שלך חשובה לנו מאוד, ובזכותך אנחנו יכולים להמשיך לפעול למען הקהילה.\n\nרק רציתי לעדכן אותך שלפי הרישום אצלנו, {פרטי חיוב}.\n\nכשיתאפשר לך, אשמח אם תוכל לבדוק את העניין. ואם צריך עזרה, אשתדל לסייע.\n\nתודה רבה על הכול!\n{חותם}',
    ru: 'Здравствуйте, {שם}! Как Ваши дела?\n\nПрежде всего хочу поблагодарить Вас за постоянное участие в деятельности {ארגון}. Ваша поддержка очень важна для нас, и благодаря Вам мы можем продолжать работать для нашей общины.\n\nХотел только сообщить, что, согласно нашим данным, {פרטי חיוב}.\n\nКогда у Вас будет возможность, буду благодарен, если Вы сможете проверить. Если понадобится помощь, постараюсь помочь.\n\nБольшое спасибо за всё!\n{חותם}',
  },
};

// ── מה כבר נשלח ────────────────────────────────────────────────────────────
// נשמר במכשיר, לפי סוג ההודעה וחודש — כך שאפשר לעצור באמצע ולהמשיך אחר כך
// בדיוק מאיפה שעצרת, ובחודש הבא מתחילים סבב חדש מעצמו.

export function roundKey(kind: BroadcastKind, now: Date = new Date()): string {
  // כשל חיוב הוא אירוע, לא קמפיין חודשי. אותו אירוע לא חוזר לתור בסוף החודש.
  if (kind === 'failure') return 'kehila:hk-broadcast:sent:failure:incidents';
  return `kehila:hk-broadcast:sent:${kind}:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* לא קריטי */ }
}

export function loadSent(kind: BroadcastKind): Record<string, string> {
  return readJson<Record<string, string>>(roundKey(kind), {});
}

export function saveSent(kind: BroadcastKind, sent: Record<string, string>) {
  writeJson(roundKey(kind), sent);
}

// קיים דור ישן של נוסחי כשל שנשמרו מקומית דרך עורך ההודעות.
 // משדרגים רק עותק שלא נערך, בלי לדרוס נוסח אישי שהמשתמש כתב.
const LEGACY_FAILURE_TEMPLATES: Record<BroadcastLang, string> = {
  he: 'שלום {שם},\nרצינו לעדכן שהחיוב החודשי של הוראת הקבע שלך (₪{סכום}) לא עבר החודש. ייתכן שתוקף הכרטיס פג או שהכרטיס הוחלף.\nנשמח אם תוכל/י לעדכן את פרטי האשראי — אפשר פשוט להשיב להודעה הזו ונסדר את זה יחד.\nתודה רבה על השותפות!\n\n{חותם}',
  ru: 'Здравствуйте, {שם}!\nХотим сообщить, что ежемесячный платёж по вашему постоянному пожертвованию (₪{סכום}) в этом месяце не прошёл. Возможно, истёк срок действия карты или карта была заменена.\nБудем благодарны, если вы обновите данные карты — просто ответьте на это сообщение, и мы всё уладим вместе.\nСпасибо за ваше участие!\n\n{חותם}',
};

// הנוסח הקודם: מעדכנים אותו אוטומטית רק אם לא נערך באופן אישי.
const PREVIOUS_FAILURE_TEMPLATES: Record<BroadcastLang, string> = {
    he: 'שלום {שם},\n\nקודם כול, תודה רבה על השותפות הקבועה שלך בפעילות של {ארגון}. התמיכה שלך חשובה לנו מאוד, ובזכות שותפים כמוך אנחנו יכולים להמשיך לפעול למען הקהילה.\n\nרק רציתי לעדכן שלפי הרישום אצלנו, {פרטי חיוב}. לפעמים זו פשוט תקלה טכנית קטנה.\n\nכשיתאפשר לך, אשמח אם יהיה לך זמן לבדוק את העניין. ואם צריך עזרה, אפשר פשוט לענות לי כאן.\n\nתודה רבה על הכול!\n{חותם}',
    ru: 'Здравствуйте, {שם}!\n\nПрежде всего хочу от всего сердца поблагодарить Вас за постоянную поддержку {ארגון}. Ваше участие очень важно для нашей общины.\n\nНебольшое уточнение: по нашим данным, {פרטי חיוב}. Иногда это просто технический сбой.\n\nКогда будет удобно, буду благодарен, если Вы сможете проверить. Если нужна помощь, просто ответьте на это сообщение.\n\nБольшое спасибо за Вашу поддержку!\n{חותם}',
};

const TEMPLATE_KEY = 'kehila:hk-broadcast:templates';
const LANG_KEY = 'kehila:hk-broadcast:lang';

export function loadTemplate(kind: BroadcastKind, lang: BroadcastLang): string {
  const saved = readJson<Record<string, string>>(TEMPLATE_KEY, {});
  const customized = saved[`${kind}:${lang}`];
  if (kind === 'failure' && (
    customized === LEGACY_FAILURE_TEMPLATES[lang] ||
    customized === PREVIOUS_FAILURE_TEMPLATES[lang]
  )) {
    return DEFAULT_TEMPLATES.failure[lang];
  }
  return customized ?? DEFAULT_TEMPLATES[kind][lang];
}

export function saveTemplate(kind: BroadcastKind, lang: BroadcastLang, text: string) {
  const saved = readJson<Record<string, string>>(TEMPLATE_KEY, {});
  saved[`${kind}:${lang}`] = text;
  writeJson(TEMPLATE_KEY, saved);
}

/** שפה לכל אדם — נזכרת בין סבבים, כי מי שמקבל ברוסית יקבל ברוסית גם בחודש הבא */
export function loadLangs(): Record<string, BroadcastLang> {
  return readJson<Record<string, BroadcastLang>>(LANG_KEY, {});
}

export function saveLangs(langs: Record<string, BroadcastLang>) {
  writeJson(LANG_KEY, langs);
}

// שם לפנייה, לפי איש קשר ושפת ההודעה. שימושי במיוחד כאשר השם במאגר
// בעברית אבל ההודעה ברוסית. לא משנה את רשומת איש הקשר עצמה.
const GREETING_NAME_KEY = 'kehila:hk-broadcast:greeting-names';

export function loadGreetingNames(): Record<string, string> {
  return readJson<Record<string, string>>(GREETING_NAME_KEY, {});
}

export function saveGreetingNames(names: Record<string, string>) {
  writeJson(GREETING_NAME_KEY, names);
}

export function greetingNameKey(contactKey: string, lang: BroadcastLang): string {
  return `${lang}:${contactKey}`;
}

// ── תמונה מצורפת ───────────────────────────────────────────────────────────
// קישור wa.me יכול לשאת רק טקסט. כשיש תמונה, השליחה עוברת דרך "שיתוף" של
// הטלפון (navigator.share): וואטסאפ נפתח עם התמונה והטקסט, ובוחרים איש קשר.
// התמונה נשמרת ב-IndexedDB (גדולה מדי ל-localStorage), כדי שלא צריך לבחור
// אותה מחדש בכל פתיחה של המסך.

const IMG_DB = 'kehila-hk-broadcast';
const IMG_STORE = 'images';

function openImgDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IMG_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IMG_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadImage(kind: BroadcastKind): Promise<File | null> {
  try {
    const db = await openImgDb();
    return await new Promise(resolve => {
      const req = db.transaction(IMG_STORE).objectStore(IMG_STORE).get(kind);
      req.onsuccess = () => {
        const v = req.result as { blob: Blob; name: string; type: string } | undefined;
        resolve(v ? new File([v.blob], v.name, { type: v.type }) : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveImage(kind: BroadcastKind, file: File | null): Promise<void> {
  try {
    const db = await openImgDb();
    const store = db.transaction(IMG_STORE, 'readwrite').objectStore(IMG_STORE);
    if (file) store.put({ blob: file, name: file.name, type: file.type }, kind);
    else store.delete(kind);
  } catch { /* לא קריטי — התמונה פשוט לא תיזכר */ }
}

/** האם הטלפון יודע לשתף קובץ לאפליקציה אחרת (אנדרואיד/אייפון כן, רוב המחשבים לא) */
export function canShareFile(file: File): boolean {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}
