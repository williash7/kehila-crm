import { getOrg, hebcalUrl } from './orgConfig';

export const HEBCAL_API = () => hebcalUrl('shabbat');

// כתובת ה-Google Apps Script (ה-"Web App" שמחובר לגיליון גוגל שיטס).
// האפליקציה פונה אליה ישירות מהדפדפן — אין שרת ביניים.
// בגרסה הגנרית הכתובת אינה כתובה בקוד: כל משתמש מזין את הכתובת של
// הגיליון שלו באשף ההגדרה, והיא נשמרת ב-localStorage (ראה orgConfig.ts).
const gsUrl = () => getOrg().gsUrl;

export async function apiGet(action: string) {
  try {
    const GS_URL = gsUrl();
    if (!GS_URL) return { ...getMockData(action), _error: 'לא הוגדרה כתובת גיליון' };
    const r = await fetch(`${GS_URL}?action=${action}`);
    const data = await r.json();
    if (!r.ok) {
      console.error(`API Error for ${action}:`, data.details || data.error);
      return { ...getMockData(action), _error: data.error, _details: data.details };
    }
    return data;
  } catch (e: any) {
    console.error(`Network Error for ${action}:`, e);
    return { ...getMockData(action), _error: 'שגיאת רשת', _details: e.toString() };
  }
}

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
    const r = await fetch(GS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...data, action }),
    });
    const res = await r.json();
    if (!r.ok) throw new Error(res.details || res.error);
    return res;
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
