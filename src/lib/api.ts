import { getOrg, hebcalUrl } from './orgConfig';

export const HEBCAL_API = () => hebcalUrl('shabbat');

// כתובת ה-Google Apps Script (ה-"Web App" שמחובר לגיליון גוגל שיטס).
// האפליקציה פונה אליה ישירות מהדפדפן — אין שרת ביניים.
// בגרסה הגנרית הכתובת אינה כתובה בקוד: כל משתמש מזין את הכתובת של
// הגיליון שלו באשף ההגדרה, והיא נשמרת ב-localStorage (ראה orgConfig.ts).
const gsUrl = () => getOrg().gsUrl;

// ─────────────────────────────────────────────────────────────────────────────
// תור בקשות — לכל היותר MAX_CONCURRENT בו-זמנית.
//
// טעינת האפליקציה יורה תריסר בקשות במקביל. Google Apps Script מגבילה כמה
// ריצות של אותו סקריפט רצות בו-זמנית, ומי שחורג מקבל דף שגיאה ב-HTML במקום
// JSON — מה שנראה למשתמש כ"שגיאת חיבור" אקראית שנעלמת אחרי רענון.
//
// שלוש במקביל מנצלות את הרשת היטב ולא מתקרבות לתקרה. שאר הבקשות ממתינות
// בתור ונכנסות ברגע שמתפנה מקום — אף אחת לא אובדת.
// ─────────────────────────────────────────────────────────────────────────────
const MAX_CONCURRENT = 3;
let running = 0;
const waiting: (() => void)[] = [];

function acquire(): Promise<void> {
  if (running < MAX_CONCURRENT) { running++; return Promise.resolve(); }
  return new Promise(resolve => waiting.push(() => { running++; resolve(); }));
}

function release() {
  running--;
  const next = waiting.shift();
  if (next) next();
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * קריאה עם ניסיונות חוזרים.
 *
 * כשגוגל מסרבת בגלל עומס רגעי היא מחזירה דף HTML, ו-JSON.parse נכשל. זו
 * שגיאה חולפת ולא תקלה אמיתית — ניסיון נוסף אחרי המתנה קצרה כמעט תמיד
 * מצליח. עדיף להמתין חצי שנייה מאשר להציג למשתמש מסך שגיאה.
 *
 * **רק לקריאה.** בקשת כתיבה לא חוזרת על עצמה: אם היא הספיקה להירשם בגיליון
 * ורק התשובה אבדה, ניסיון חוזר היה רושם את אותה תרומה פעמיים.
 */
async function getJson(url: string, attempts = 3): Promise<any> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(400 * i);
    await acquire();
    try {
      const r = await fetch(url);
      const text = await r.text();
      try {
        return JSON.parse(text);
      } catch {
        lastErr = new Error('התקבלה תשובה שאינה JSON (כנראה עומס רגעי בגוגל)');
      }
    } catch (e) {
      lastErr = e;
    } finally {
      release();
    }
  }
  throw lastErr;
}

export async function apiGet(action: string) {
  try {
    const GS_URL = gsUrl();
    if (!GS_URL) return { ...getMockData(action), _error: 'לא הוגדרה כתובת גיליון' };
    const data = await getJson(`${GS_URL}?action=${action}`);
    if (data && data.error) {
      console.error(`API Error for ${action}:`, data.details || data.error);
      return { ...getMockData(action), _error: data.error, _details: data.details };
    }
    return data;
  } catch (e: any) {
    console.error(`Network Error for ${action}:`, e);
    return { ...getMockData(action), _error: 'שגיאת רשת', _details: e.toString() };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// המטמון של הפתיחה.
//
// הנתונים הכבדים — סיכום, תרומות, תורמים, הוראות קבע — נמשכו מהשרת בכל
// פתיחה, והמסך המתין להם. אבל הם כמעט תמיד זהים למה שהיה לפני דקה, ולכן
// ההמתנה הזו כמעט תמיד מיותרת.
//
// מעכשיו הם נשמרים מקומית: הפתיחה מציירת מיד את מה שהיה, והרענון קורה
// ברקע. אם משהו השתנה — המסך מתעדכן תוך כדי.
// ─────────────────────────────────────────────────────────────────────────────

const SNAPSHOT_KEY = 'bundle_snapshot_v1';

export interface Snapshot {
  savedAt: number;
  data: any;
}

export function readSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.data ? s : null;
  } catch { return null; }
}

export function saveSnapshot(data: any) {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // המכסה של localStorage מלאה. לא קריטי — רק נאבד את הפתיחה המיידית.
  }
}

/**
 * כל נתוני הפתיחה בבקשה אחת.
 *
 * גיליון שעדיין מריץ קוד ישן לא מכיר את הפעולה הזו. במקרה כזה מחזירים
 * null, והקורא נופל בחזרה לשתים־עשרה הבקשות הנפרדות — כך שהאפליקציה
 * עובדת גם לפני שהסקריפט עודכן.
 */
export async function apiGetAll(): Promise<any | null> {
  const res = await apiGet('getAll');
  if (!res || res._error || !res.summary) return null;
  saveSnapshot(res);
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// גיבוי ותקינות — קריאות שאסור להן ליפול על נתוני דמה.
//
// apiGet מחזיר getMockData(action) כשמשהו משתבש, וזה נכון לרוב המסכים:
// עדיף להראות משהו מאשר מסך שבור. אבל **בגיבוי ובדוח תקינות זה מסוכן**:
// גיבוי של נתוני דמה נראה כמו גיבוי אמיתי, ודוח תקינות על נתוני דמה
// יגיד "הכול תקין" על גיליון שמעולם לא נבדק.
//
// לכן כאן: אין נפילה אחורה. פעולה שאינה מוכרת לגיליון מוחזרת כשגיאה
// מפורשת, והממשק מבקש לעדכן את הסקריפט.
// ─────────────────────────────────────────────────────────────────────────────

const NOT_DEPLOYED = 'SCRIPT_NOT_DEPLOYED';

/** קריאה גולמית, בלי נתוני דמה ובלי בליעת שגיאות. */
async function apiGetStrict(action: string, params: Record<string, any> = {}) {
  const GS_URL = gsUrl();
  if (!GS_URL) throw new Error('לא הוגדרה כתובת גיליון');

  const qs = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map(k => `&${k}=${encodeURIComponent(String(params[k]))}`)
    .join('');

  const data = await getJson(`${GS_URL}?action=${action}${qs}`);
  if (data && data.error) {
    // "פעולה לא מוכרת" פירושו גיליון שטרם נפרס — לא תקלה אמיתית.
    if (String(data.error).indexOf('פעולה לא מוכרת') >= 0) throw new Error(NOT_DEPLOYED);
    throw new Error(data.details || data.error);
  }
  return data;
}

/** האם השגיאה פירושה "הסקריפט בגיליון עדיין לא עודכן". */
export function isNotDeployed(e: any): boolean {
  return String(e?.message || e) === NOT_DEPLOYED;
}

export const exportManifest = () => apiGetStrict('exportAll');
export const exportChunk = (sheet: string, offset: number, limit: number) =>
  apiGetStrict('exportAll', { sheet, offset, limit });
export const exportSync = (syncKey: string) => apiGetStrict('exportAll', { syncKey });
export const fetchIntegrity = () => apiGetStrict('getIntegrity');
export const fetchPaymentLedger = () => apiGetStrict('getPaymentLedger');

/** קריאת שחזור מחמירה: אין נתוני דמה ואין הצלחה שקטה על תשובת שגיאה. */
async function restorePost(action: string, data: any) {
  const res = await apiPost(action, data);
  if (!res?.success) {
    const message = String(res?.details || res?.error || 'פעולת השחזור נכשלה');
    if (message.indexOf('פעולה לא מוכרת') >= 0) throw new Error(NOT_DEPLOYED);
    throw new Error(message);
  }
  return res;
}

export const restoreBegin = (manifest: any) => restorePost('restoreBegin', { manifest });
export const restoreSheet = (data: any) => restorePost('restoreSheet', data);
export const restoreSync = (data: any) => restorePost('restoreSync', data);
export const restoreFinish = (token: string) => restorePost('restoreFinish', { token });
export const restoreRollback = (token: string) => restorePost('restoreRollback', { token });

export async function apiPost(action: string, data: any) {
  try {
    // חשוב: שולחים כ-text/plain ולא application/json.
    // דפדפנים שולחים קודם בקשת "preflight" (OPTIONS) לכל בקשת POST עם
    // Content-Type: application/json בין אתרים שונים (CORS), וה-Google Apps
    // Script לא יודע לענות לבקשת OPTIONS כזו — מה שהיה חוסם את הבקשה.
    // עם text/plain הדפדפן לא שולח preflight, וה-Script קורא את הגוף
    // הגולמי (e.postData.contents) ומפרש אותו כ-JSON בדיוק כמו קודם.
    const GS_URL = gsUrl();
    if (!GS_URL) throw new Error('לא הוגדרה כתובת גיליון');

    // מזהה ייחודי לבקשה, שנשאר קבוע בין הניסיונות.
    //
    // בזכותו מותר לשלוח שוב: השרת זוכר מזהים שכבר טיפל בהם ומחזיר את
    // התשובה השמורה במקום לבצע שוב. בלי זה כל תקלה רגעית — עומס, רשת, או
    // תוסף בדפדפן שמשכפל בקשות — הפילה את הפעולה, כי לא היה בטוח לנסות
    // שנית ולסכן רישום כפול של אותה תרומה.
    const reqId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const payload = JSON.stringify({ ...data, action, reqId });

    let lastErr: any;
    for (let i = 0; i < 3; i++) {
      if (i > 0) await sleep(400 * i);
      await acquire();
      let text: string | null = null;
      try {
        const r = await fetch(GS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: payload,
        });
        text = await r.text();
      } catch (e) {
        lastErr = e;
      } finally {
        release();
      }

      if (text !== null) {
        try {
          const res = JSON.parse(text);
          if (res && res.error) throw new Error(res.details || res.error);
          return res;
        } catch (e: any) {
          // שגיאה שהשרת החזיר היא תשובה סופית — אין טעם לנסות שוב
          if (e instanceof SyntaxError) lastErr = new Error('התקבלה תשובה שאינה JSON');
          else throw e;
        }
      }
    }
    throw lastErr || new Error('הפעולה נכשלה');
  } catch (e: any) {
    console.error('API POST Error:', e);
    return { error: e.toString(), success: false };
  }
}

function getMockData(action: string) {
  if (action === 'getSummary') {
    return {
      total: 125000,
      thisMonthTotal: 15400,
      donorCount: 42,
      hkActive: 12,
      failureCount: 2,
      byMethod: { 'קישור ישיר': 45000, 'הוק': 30000, 'ביט/פייבוקס': 25000, 'מזומן': 25000 }
    };
  }
  if (action === 'getDonations') {
    return {
      donations: [
        { name: 'ישראל ישראלי', amount: 500, date: '15/05/2026', method: 'ביט/פייבוקס', purpose: 'תרומה כללית' },
        { name: 'דוד כהן', amount: 100, date: '10/05/2026', method: 'הוק', purpose: 'הוראת קבע' },
        { name: 'משה לוי', amount: 1800, date: '01/05/2026', method: 'העברה בנקאית', purpose: 'תרומה' }
      ]
    };
  }
  if (action === 'getDonors') {
    return {
      donors: [
        { name: 'דוד כהן', 'כתובת': 'הכלנית 4', 'תאריך לידה': '15/05/1980', 'תאריך לידה עברי': 'כ באייר', 'יארצייט': 'טז באייר תשפד', spouse: 'רבקה', tefillin: 'כן', mezuzah: 'לא בדק השנה' }
      ]
    };
  }
  if (action === 'getHK') {
    return { hk: [{ name: 'דוד כהן', active: true, amount: 100, remaining: 10, lastBilled: '10/05/2026' }] };
  }
  if (action === 'getFailures') {
    return { failures: [{ name: 'שמעון לוי', reason: 'כרטיס פג תוקף', amount: '₪100', date: '01/05/2026' }] };
  }
  if (action === 'getRebbe') return { date: '' };
  return {};
}

// ── Local Storage Helpers ─────────────────────────────────────────────────────

export function getCRMData(): Record<string, any> {
  try { return JSON.parse(localStorage.getItem('crm_data') || '{}'); }
  catch { return {}; }
}

export function saveCRMData(data: any) {
  localStorage.setItem('crm_data', JSON.stringify(data));
}

export function getManualDonations(): any[] {
  try { return JSON.parse(localStorage.getItem('manual_donations') || '[]'); }
  catch { return []; }
}

export function saveManualDonations(data: any[]) {
  localStorage.setItem('manual_donations', JSON.stringify(data));
}

export function getEventsData(): any[] {
  try { return JSON.parse(localStorage.getItem('events_data') || '[]'); }
  catch { return []; }
}

export function saveEventsData(data: any[]) {
  localStorage.setItem('events_data', JSON.stringify(data));
}

export function getHolidayExtras(): Record<string, any> {
  try { return JSON.parse(localStorage.getItem('holiday_extras') || '{}'); }
  catch { return {}; }
}

export function saveHolidayExtras(data: any) {
  localStorage.setItem('holiday_extras', JSON.stringify(data));
}

export function getHistoryData(): any[] {
  try { return JSON.parse(localStorage.getItem('history_data') || '[]'); }
  catch { return []; }
}

export function saveHistoryData(data: any[]) {
  localStorage.setItem('history_data', JSON.stringify(data));
}

export function getHomeVisitsData(): any {
  try { return JSON.parse(localStorage.getItem('home_visits_data') || '{"rounds":[]}'); }
  catch { return { rounds: [] }; }
}

export function saveHomeVisitsData(data: any) {
  localStorage.setItem('home_visits_data', JSON.stringify(data));
}

export function getCustomHols(): any[] {
  try { return JSON.parse(localStorage.getItem('custom_hols') || '[]'); }
  catch { return []; }
}

export function saveCustomHols(data: any[]) {
  localStorage.setItem('custom_hols', JSON.stringify(data));
}

// ── Cloud Sync (Google Sheets ← גיליון "🔄 סנכרון נתונים") ──────────────────

export async function getCRMDataCloud(): Promise<Record<string, any>> {
  try {
    const res = await apiGet('getCRM');
    if (res.data && !res._error) {
      saveCRMData(res.data); // keep local in sync
      return res.data;
    }
  } catch {}
  return getCRMData();
}

export async function saveCRMDataCloud(data: Record<string, any>): Promise<void> {
  saveCRMData(data);
  apiPost('saveCRM', { data }).catch(console.error); // fire and forget
}

/**
 * שמירה שממתינים לה — לפעולות שאסור להמשיך לפניהן.
 *
 * הגרסה ה"שגר ושכח" למעלה מתאימה לעריכה רגילה: אם היא מאחרת בשנייה, לא קרה
 * כלום. אבל פעולה שמוחקת מהגיליון אחריה, או שגורמת לרענון שמושך מהשרת, חייבת
 * לדעת שהכתיבה **הגיעה** — אחרת הקריאה הבאה מחזירה את המצב הישן ודורסת את מה
 * שנשמר, בזמן שהמקור כבר נמחק.
 */
export async function saveCRMDataCloudSync(data: Record<string, any>): Promise<boolean> {
  saveCRMData(data);
  const res = await apiPost('saveCRM', { data });
  return !(res?.error || res?.success === false);
}

/**
 * שומר חיבור יחיד בצד השרת. אם הסקריפט בגיליון עדיין ישן, נופלים זמנית
 * לשמירת ה-CRM הישנה כדי שהחיבור לא יאבד עד לפריסת Code.gs החדש.
 */
export async function saveContactMergeCloud(
  data: Record<string, any>, aliasName: string, canonicalName: string
): Promise<boolean> {
  saveCRMData(data);
  const res = await apiPost('saveContactMerge', { data, aliasName, canonicalName });
  if (res?.success) return true;
  const fallback = await apiPost('saveCRM', { data });
  return !(fallback?.error || fallback?.success === false);
}

/** מבטל חיבור יחיד; בסקריפט ישן נשמרת המפה המלאה כתאימות זמנית. */
export async function deleteContactMergeCloud(
  data: Record<string, any>, aliasName: string
): Promise<boolean> {
  saveCRMData(data);
  const res = await apiPost('deleteContactMerge', { data, aliasName });
  if (res?.success) return true;
  const fallback = await apiPost('saveCRM', { data });
  return !(fallback?.error || fallback?.success === false);
}

export async function getEventsDataCloud(): Promise<any[]> {
  try {
    const res = await apiGet('getEvents');
    if (res.data && !res._error) {
      saveEventsData(res.data);
      return res.data;
    }
  } catch {}
  return getEventsData();
}

export async function saveEventsDataCloud(data: any[]): Promise<void> {
  saveEventsData(data);
  apiPost('saveEvents', { data }).catch(console.error);
}

export async function getHolidayExtrasCloud(): Promise<Record<string, any>> {
  try {
    const res = await apiGet('getHolidayExtras');
    if (res.data && !res._error) {
      saveHolidayExtras(res.data);
      return res.data;
    }
  } catch {}
  return getHolidayExtras();
}

export async function saveHolidayExtrasCloud(data: Record<string, any>): Promise<void> {
  saveHolidayExtras(data);
  apiPost('saveHolidayExtras', { data }).catch(console.error);
}

export async function getHistoryDataCloud(): Promise<any[]> {
  try {
    const res = await apiGet('getHistory');
    if (res.data && !res._error) {
      saveHistoryData(res.data);
      return res.data;
    }
  } catch {}
  return getHistoryData();
}

export async function saveHistoryDataCloud(data: any[]): Promise<void> {
  saveHistoryData(data);
  apiPost('saveHistory', { data }).catch(console.error); // אם הפעולה עוד לא קיימת בשרת — נכשל בשקט, הנתונים עדיין נשמרים מקומית
}

export async function getHomeVisitsDataCloud(): Promise<any> {
  try {
    const res = await apiGet('getHomeVisits');
    if (res.data && !res._error) {
      saveHomeVisitsData(res.data);
      return res.data;
    }
  } catch {}
  return getHomeVisitsData();
}

export async function saveHomeVisitsDataCloud(data: any): Promise<void> {
  saveHomeVisitsData(data);
  apiPost('saveHomeVisits', { data }).catch(console.error); // אם הפעולה עוד לא קיימת בשרת — נכשל בשקט, הנתונים עדיין נשמרים מקומית
}

export async function createHolidayDoc(holidayName: string, dateStr: string): Promise<{ url: string; title: string; error?: string } | null> {
  const res = await apiPost('createHolidayDoc', { holidayName, dateStr });
  if (res.success && res.url) return { url: res.url, title: res.title };
  return { url: '', title: '', error: res.error || res.details || 'Unknown error' };
}

// ── פרויקטי גיוס ─────────────────────────────────────────────────────────────

export function getProjects(): any[] {
  try { return JSON.parse(localStorage.getItem('projects_data') || '[]'); }
  catch { return []; }
}

export function saveProjects(data: any[]) {
  localStorage.setItem('projects_data', JSON.stringify(data));
}

export async function getProjectsCloud(): Promise<any[]> {
  try {
    const res = await apiGet('getProjects');
    if (res.data && !res._error) { saveProjects(res.data); return res.data; }
  } catch {}
  return getProjects();
}

export async function saveProjectsCloud(data: any[]): Promise<void> {
  saveProjects(data);
  apiPost('saveProjects', { data }).catch(console.error);
}

// ── מרכז כספי ────────────────────────────────────────────────────────────────
// הנתונים נשמרים גם מקומית לפתיחה מיידית וגם במפתח sync נפרד. AppSettings
// נשאר מחוץ לענן, ולכן הוספת המרכז אינה מקרבת את סודות Facebook לגיליון.

export function getFinanceData(): any {
  try { return JSON.parse(localStorage.getItem('finance_data_v1') || 'null'); }
  catch { return null; }
}

export function saveFinanceData(data: any) {
  localStorage.setItem('finance_data_v1', JSON.stringify(data));
}

export async function getFinanceDataCloud(): Promise<any> {
  try {
    const res = await apiGet('getFinance');
    if (res.data && !res._error) { saveFinanceData(res.data); return res.data; }
  } catch {}
  return getFinanceData();
}

/** שמירה כספית מאושרת: המסך יודע אם הנתונים הגיעו לענן ואינו מציג הצלחה שקרית. */
export async function saveFinanceDataCloud(data: any): Promise<boolean> {
  saveFinanceData(data);
  if (!gsUrl()) return true; // מצב הדגמה: שמירה מקומית היא השמירה היחידה והתקינה
  const res = await apiPost('saveFinance', { data });
  return !(res?.error || res?.success === false);
}

// ─────────────────────────────────────────────────────────────────────────────
// הודעות שגיאה שאפשר לעשות איתן משהו.
//
// "פעולה לא מוכרת" היא התשובה של הגיליון לפעולה שהקוד שלו לא מכיר — כלומר
// האפליקציה עודכנה והסקריפט בגיליון לא. זו הודעה נכונה לחלוטין ובלתי שמישה
// לחלוטין: המשתמש לא יודע שיש "סקריפט", ובוודאי לא שצריך לפרוס אותו מחדש.
// ─────────────────────────────────────────────────────────────────────────────

export function explainApiError(raw?: string): string {
  const msg = String(raw || '').trim();
  if (!msg) return 'הפעולה נכשלה';

  if (msg.indexOf('פעולה לא מוכרת') >= 0) {
    return 'הגיליון מריץ גרסה ישנה של הסקריפט ולכן אינו מכיר את הפעולה הזו. ' +
           'בגיליון: תוספים ← Apps Script, להדביק את Code.gs המעודכן, ואז ' +
           'פריסה ← נהל פריסות ← עריכה (עיפרון) ← גרסה חדשה ← פריסה. ' +
           'אחרי זה תראה בהגדרות את גרסת הסקריפט המעודכנת.';
  }
  if (msg.indexOf('<!DOCTYPE') >= 0 || msg.indexOf('שאינה JSON') >= 0) {
    return 'הגיליון החזיר דף שגיאה במקום תשובה. בדרך כלל זה חולף אחרי רגע — נסה שוב.';
  }
  return msg;
}
