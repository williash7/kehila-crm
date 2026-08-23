import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  apiGet, apiPost, getCRMData,
  getCRMDataCloud, saveCRMDataCloud, saveCRMDataCloudSync,
  getEventsDataCloud, saveEventsDataCloud,
  getHolidayExtrasCloud, saveHolidayExtrasCloud,
  getManualDonations, saveManualDonations,
  getHistoryDataCloud, saveHistoryDataCloud,
  getHomeVisitsDataCloud, saveHomeVisitsDataCloud,
  getProjectsCloud, saveProjectsCloud,
  getFinanceData, getFinanceDataCloud, saveFinanceData, saveFinanceDataCloud,
  getCustomHols,
  apiGetAll, readSnapshot,
  saveCRMData, saveEventsData, saveHolidayExtras,
  saveHistoryData, saveHomeVisitsData, saveProjects as saveProjectsLocal,
} from '../lib/api';
import { Donor, Donation, ReportSummary } from '../types';
import { annotateRenewals, ChargeFailure, HkEntry } from '../lib/standingOrders';
import { mergeManualDonations } from '../lib/manualDonations';
import { extractMerges, applyMergesToCrm, mergeCrmPair, coalesceDonorsByMerges, resolveCanonicalName, MERGES_KEY } from '../lib/nameMerges';
import { AppSettings, loadSettings, saveSettings, filterDonorsBySettings } from '../lib/settings';
import { logAction } from '../lib/score';
import { computeSummarySince, computeDonorTotalSince } from '../lib/donationFilter';
import { HistoryEntry, buildHistoryEntry, countAttendance, sumBudget, findLatestHistoryFor, tasksFromHistory, historyEntryFingerprint } from '../lib/history';
import { STANDALONE_TASKS_ID, createHomeVisitTask, createHolidayReminderTask, createEventReminderTask, createThankYouTask, computeMissingThankYouTasks, backfillEventTaskDates } from '../lib/tasks';
import { HomeVisitEntry, HomeVisitRound, HomeVisitsData, moveEntry } from '../lib/homeVisits';
import { buildHolidayList } from '../lib/holidayList';
import { computeMissingHolidayReminders } from '../lib/holidayAutoTasks';
import { computeMissingEventReminders } from '../lib/eventAutoTasks';
import { Project, normalizeProjects } from '../lib/projects';
import { Activity, normalizeActivities } from '../lib/activities';
import { hebcalUrl } from '../lib/orgConfig';
import { chabadHolidayItems } from '../lib/chabadDates';
import { FinanceData, emptyFinanceData, normalizeFinanceData } from '../lib/finance';

interface AppState {
  summary: ReportSummary | null;
  effectiveSummary: ReportSummary | null; // summary מסונן לפי settings.donationsSinceDate (או summary הרגיל אם אין סינון)
  donations: Donation[];
  donors: Record<string, Donor>;
  visibleDonors: Record<string, Donor>; // מסונן לפי הגדרות תצוגה + total מחושב לפי donationsSinceDate
  hk: HkEntry[];
  failures: ChargeFailure[];
  rebbeDate: Date | null;
  shabbat: any;
  holidays: any[];
  hebrewDate: string;
  loading: boolean;
  loadingText: string;
  apiError: string | null;
  crm: Record<string, any>;
  holidayExtras: Record<string, any>;
  eventsData: Activity[];
  projects: Project[];
  history: HistoryEntry[];
  nameMerges: Record<string, string>;
  settings: AppSettings;
  homeVisits: HomeVisitsData;
  financeData: FinanceData;
  updateFinanceData: (data: FinanceData) => Promise<boolean>;
  updateSettings: (partial: Partial<AppSettings>) => void;
  refresh: () => void;
  addManualDonation: (donation: any) => void;
  updateCrm: (name: string, data: any) => void;
  updateCrmMany: (updates: Record<string, any>) => Promise<boolean>;
  updateHolidayExtras: (id: string, data: any) => void;
  updateEventsData: (data: any[]) => void;
  updateProjects: (data: Project[]) => void;
  updateRebbeDate: (date: Date) => void;
  mergeContacts: (aliasName: string, canonicalName: string) => Promise<boolean>;
  unmergeContact: (aliasName: string) => Promise<boolean>;
  archiveOccurrence: (params: { type: 'holiday' | 'event'; id: string; name: string; occurrenceDate?: string }) => void;
  importTasksFromHistory: (params: { type: 'holiday' | 'event'; id: string; name: string }) => boolean;
  updateHistoryEntry: (id: string, data: Partial<HistoryEntry>) => void;
  addHistoryEntries: (entries: HistoryEntry[]) => number;
  deleteHistoryEntry: (id: string) => void;
  startHomeVisitRound: (entries: HomeVisitEntry[]) => void;
  markHomeVisitDone: (roundId: string, name: string) => void;
  unmarkHomeVisitDone: (roundId: string, name: string) => void;
  createHomeVisitTaskForEntry: (roundId: string, name: string) => void;
  updateHomeVisitEntry: (roundId: string, name: string, patch: Partial<HomeVisitEntry>) => void;
  reorderHomeVisitEntries: (roundId: string, from: number, to: number) => void;
  archiveHomeVisitRound: (roundId: string) => void;
  deleteHomeVisitRound: (roundId: string) => void;
  removeHomeVisitEntry: (roundId: string, name: string) => void;
  addHomeVisitEntries: (roundId: string, entries: HomeVisitEntry[]) => void;
  updateHomeVisitRoundMeta: (roundId: string, patch: Partial<HomeVisitRound>) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donors, setDonors] = useState<Record<string, Donor>>({});
  const [hk, setHk] = useState<HkEntry[]>([]);
  const [failures, setFailures] = useState<ChargeFailure[]>([]);
  const [rebbeDate, setRebbeDate] = useState<Date | null>(null);

  // Hebcal states
  const [shabbat, setShabbat] = useState<any>(null);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [hebrewDate, setHebrewDate] = useState<string>('טוען...');

  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('מתחבר לגיליון...');
  const [apiError, setApiError] = useState<string | null>(null);

  // Start with localStorage so the UI renders immediately, then cloud data overwrites
  const initialCrm = extractMerges(getCRMData());
  const [crm, setCrm] = useState<Record<string, any>>(initialCrm.crmRest);
  const [nameMerges, setNameMerges] = useState<Record<string, string>>(initialCrm.merges);
  const [holidayExtras, setHolidayExtras] = useState<Record<string, any>>({});
  const [eventsData, setEventsData] = useState<Activity[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [homeVisits, setHomeVisits] = useState<HomeVisitsData>({ rounds: [] });
  const [financeData, setFinanceData] = useState<FinanceData>(() => normalizeFinanceData(getFinanceData() || emptyFinanceData()));
  const [settings, setSettings] = useState<AppSettings>(loadSettings());

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  };

  // ברירת המחדל של "מאיזה תאריך סופרים תרומות" כשלא הוגדר תאריך מפורש
  // ב-Settings — מתחילת השנה הנוכחית, לא כל הזמנים. משותף לכל הסכומים
  // המוצגים באפליקציה (דשבורד, דוחות, סכום לכל איש קשר) כדי שיהיו עקביים
  // זה עם זה — ראה effectiveSummary למטה למקור הבאג שזה מתקן.
  const effectiveSinceIso = settings.donationsSinceDate || `${new Date().getFullYear()}-01-01`;

  const visibleDonors = React.useMemo(() => {
    const filtered = filterDonorsBySettings(donors, crm, settings);
    const withFilteredTotals: Record<string, Donor> = {};
    Object.keys(filtered).forEach(name => {
      // filterDonorsBySettings גנרי ומחזיר Record<string, any> — מחזירים כאן
      // את הטיפוס המדויק כדי שהמיזוג למטה יישאר Donor תקין.
      const d = filtered[name] as Donor;
      withFilteredTotals[name] = { ...d, total: computeDonorTotalSince(d.donations, effectiveSinceIso) };
    });
    return withFilteredTotals;
  }, [donors, crm, settings, effectiveSinceIso]);

  // תמיד מחושב בצד הלקוח מתוך רשימת התרומות הגולמית (לא מ-summary הגולמי
  // מהשרת) — כדי שהמספר יהיה עקבי בין "ברירת מחדל" לבין תאריך מותאם אישית
  // שהוגדר ב-Settings. בעבר, "ריק" נפל בחזרה ל-summary מהשרת שיכול לחשב
  // אחרת מ-computeSummarySince (למשל לגבי הו"ק), מה שגרם למספר שונה ולא
  // עקבי בין "מתחילת השנה" (ברירת מחדל) לבין תאריך מפורש שהוקלד.
  const effectiveSummary = React.useMemo(() => {
    const computed = computeSummarySince(donations, effectiveSinceIso);
    return { ...(summary || {}), ...computed } as ReportSummary;
  }, [summary, donations, effectiveSinceIso]);

  const loadHebcal = () => {
    // זמני שבת לפי המיקום ומנהג הדלקת הנרות שהוגדרו בהגדרות הארגון
    fetch(hebcalUrl('shabbat'))
      .then(r => r.json())
      .then(setShabbat)
      .catch(console.error);

    const today = new Date();
    const y = today.getFullYear();
    fetch(hebcalUrl('hebcal', { v: 1, start: `${y}-01-01`, end: `${y + 1}-12-31`, maj: 'on', min: 'on', nx: 'on', mf: 'on', ss: 'on', mod: 'off', c: 'on' }))
      .then(r => r.json())
      .then(data => {
        if (data.items) {
          // תאריכי חב"ד וחסידות אינם קיימים ב-Hebcal ולכן מתווספים כאן.
          // הסינון עצמו (אילו חגים להציג) קורה בתצוגה לפי ההגדרות, כדי
          // שלא נאבד נתונים ושינוי הגדרה ייכנס לתוקף מיד.
          const fromHebcal = data.items.filter((item: any) =>
            item.category === 'holiday' || item.category === 'roshchodesh'
          );
          setHolidays([...fromHebcal, ...chabadHolidayItems()]);
        }
      })
      .catch(console.error);

    fetch(`https://www.hebcal.com/converter?cfg=json&gy=${today.getFullYear()}&gm=${today.getMonth() + 1}&gd=${today.getDate()}&g2h=1`)
      .then(r => r.json())
      .then(data => { if (data.hebrew) setHebrewDate(data.hebrew); })
      .catch(console.error);
  };

  // silent = רענון ברקע. הנתונים מתעדכנים, אבל המסך נשאר על מקומו.
  //
  // בלי זה כל פעולה קטנה — ביטול הוראת קבע, הוספת תרומה — החליפה את כל
  // האפליקציה במסך טעינה וזרקה את המשתמש חזרה לדשבורד. זה נראה כאילו
  // הדפדפן נטען מחדש, והמשתמש איבד את המקום שבו היה.
  /**
   * מצייר תמונת מצב שמורה.
   *
   * מכוון: זה **לא** מריץ את מיזוג התרומות הידניות ולא את השמות הממוזגים
   * — אלה נגזרים מהשרת ורצים מיד אחרי, כשהתשובה האמיתית מגיעה. המטרה כאן
   * צנועה: שיהיה מה להסתכל עליו בשנייה הראשונה.
   */
  const applySnapshot = (d: any) => {
    try {
      const { merges, crmRest } = extractMerges(d.crm || {});
      setCrm(applyMergesToCrm(crmRest, merges));
      setNameMerges(merges);
      setSummary(d.summary || null);
      setDonations(d.donations || []);
      setHk(annotateRenewals(d.hk || []));
      setFailures(d.failures || []);
      setEventsData(normalizeActivities(d.events));
      setHolidayExtras(d.holidayExtras || {});
      setHistory(d.history || []);
      setHomeVisits(d.homeVisits?.rounds ? d.homeVisits : { rounds: [] });
      setProjects(normalizeProjects(d.projects));
      setFinanceData(normalizeFinanceData(d.finance || getFinanceData() || emptyFinanceData()));
      if (d.rebbeDate) setRebbeDate(new Date(d.rebbeDate));

      const map: Record<string, any> = {};
      (d.donations || []).forEach((x: any) => {
        if (!x?.name) return;
        if (!map[x.name]) map[x.name] = { name: x.name, total: 0, donations: [], lastDate: '' };
        map[x.name].donations.push(x);
        map[x.name].total += x.amount || 0;
        if (x.date) map[x.name].lastDate = x.date;
      });
      Object.assign(map, d.donors || {});
      setDonors(prev => (Object.keys(map).length ? map : prev));
    } catch {
      // תמונת מצב פגומה אינה סיבה לא לפתוח את האפליקציה
    }
  };

  const loadAll = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setLoadingText('מתחבר לגיליון...');
    }

    loadHebcal();

    // ── ציור מיידי ממה שהיה בפעם הקודמת ──────────────────────────────────
    //
    // הנתונים האלה כמעט תמיד זהים למה שהיה לפני דקה, ולכן ההמתנה להם
    // כמעט תמיד מיותרת. מציירים אותם מיד, ומרעננים ברקע: מי שפותח את
    // האפליקציה רואה את הדשבורד שלו במקום מסך טעינה.
    //
    // רק בפתיחה הראשונה. רענון יזום ("בדוק שוב") לא צריך להבהב בנתונים
    // ישנים לפני שהחדשים מגיעים.
    if (!opts?.silent) {
      const snap = readSnapshot();
      if (snap?.data?.summary) {
        applySnapshot(snap.data);
        setLoading(false);          // המסך כבר שמיש — הרענון ימשיך ברקע
      }
    }

    let resolvedCrm: Record<string, any> = extractMerges(getCRMData()).crmRest;
    let resolvedMerges: Record<string, string> = extractMerges(getCRMData()).merges;

    /** מחיל את קבוצות הנתונים המסונכרנות. משותף לשני מסלולי הטעינה. */
    const applyCloud = (
      cloudCrm: any, cloudEvents: any, cloudExtras: any,
      cloudHistory: any, cloudHomeVisits: any, cloudProjects: any, cloudFinance: any
    ) => {
      const { merges, crmRest } = extractMerges(cloudCrm);
      const cleanedCrm = applyMergesToCrm(crmRest, merges);
      resolvedCrm = cleanedCrm;
      resolvedMerges = merges;
      setCrm(cleanedCrm);
      setNameMerges(merges);
      setEventsData(normalizeActivities(cloudEvents));
      setHolidayExtras(cloudExtras);
      setHistory(cloudHistory || []);
      setHomeVisits(cloudHomeVisits?.rounds ? cloudHomeVisits : { rounds: [] });
      setProjects(normalizeProjects(cloudProjects));
      setFinanceData(normalizeFinanceData(cloudFinance || emptyFinanceData()));
    };

    // ── בקשה אחת, ואם אי אפשר — שתים־עשרה ─────────────────────────────────
    //
    // הפתיחה ירתה שתים־עשרה בקשות נפרדות לגיליון. Apps Script מגבילה ריצות
    // במקביל, ולכן הן יצאו בארבעה גלים של שלוש — וכל גל שילם מחדש את זמן
    // ההתנעה של הסקריפט. זה היה רוב ה"איטיות": לא חישוב, אלא המתנה.
    //
    // getAll מביא את הכול יחד. גיליון שעדיין מריץ קוד ישן לא מכיר את
    // הפעולה, ואז נופלים חזרה למסלול הישן — האפליקציה עובדת בשני המקרים.
    const bundle = await apiGetAll().catch(() => null);

    let cloudLoads: Promise<any> = Promise.resolve();
    if (bundle) {
      // שרת מגרסה קודמת מחזיר getAll תקין בלי השדה החדש. במקרה כזה שומרים
      // על העותק המקומי ולא דורסים אותו בריק עד שאשר יפרוס את Code.gs החדש.
      const bundleFinance = bundle.finance === undefined ? getFinanceData() : bundle.finance;
      applyCloud(bundle.crm, bundle.events, bundle.holidayExtras,
                 bundle.history, bundle.homeVisits, bundle.projects, bundleFinance);
      // שומרים גם בעותקים המקומיים, כדי שמסכים שקוראים אותם ישירות
      // לא יראו נתונים ישנים.
      saveCRMData(bundle.crm || {});
      saveEventsData(bundle.events || []);
      saveHolidayExtras(bundle.holidayExtras || {});
      saveHistoryData(bundle.history || []);
      saveHomeVisitsData(bundle.homeVisits || { rounds: [] });
      saveProjectsLocal(bundle.projects || []);
      saveFinanceData(bundleFinance || emptyFinanceData());
    } else {
      cloudLoads = Promise.all([
        getCRMDataCloud(),
        getEventsDataCloud(),
        getHolidayExtrasCloud(),
        getHistoryDataCloud(),
        getHomeVisitsDataCloud(),
        getProjectsCloud(),
        getFinanceDataCloud(),
      ]).then(r => applyCloud(r[0], r[1], r[2], r[3], r[4], r[5], r[6])).catch(console.error);
    }

    try {
      const [sumRes, donRes, failRes, rebbeRes, hkRes, donorsRes] = bundle
        ? [
            bundle.summary,
            { donations: bundle.donations },
            { failures: bundle.failures },
            { date: bundle.rebbeDate },
            { hk: bundle.hk },
            { donors: bundle.donors },
          ]
        : await Promise.all([
            apiGet('getSummary'),
            apiGet('getDonations'),
            apiGet('getFailures'),
            apiGet('getRebbe'),
            apiGet('getHK'),
            apiGet('getDonors'),
          ]);

      if (sumRes._error) {
        setApiError(`${sumRes._error}: ${sumRes._details || ''}`);
      } else {
        setApiError(null);
      }

      if (rebbeRes?.date) setRebbeDate(new Date(rebbeRes.date));
      if (sumRes.total !== undefined) setSummary(sumRes);

      const map: Record<string, Donor> = {};

      if (donorsRes.donors && donorsRes.donors.length > 0) {
        const firstRow = donorsRes.donors[0];
        const headerMap: Record<string, string> = {};
        const reverseHeaderMap: Record<string, string> = {};

        Object.keys(firstRow).forEach(badKey => {
          const realHeader = firstRow[badKey];
          if (realHeader) {
            headerMap[badKey] = realHeader;
            reverseHeaderMap[realHeader] = badKey;
          }
        });

        localStorage.setItem('reverseHeaderMap', JSON.stringify(reverseHeaderMap));

        donorsRes.donors.slice(1).forEach((d: any) => {
          const cleanDonor: any = { name: d.name, total: 0, donations: [], lastDate: '' };
          Object.keys(d).forEach(badKey => {
            const realHeader = headerMap[badKey] || badKey;
            cleanDonor[realHeader] = d[badKey];
          });
          if (cleanDonor['שם מלא']) cleanDonor.name = cleanDonor['שם מלא'];
          if (!cleanDonor.name) return;
          map[cleanDonor.name] = cleanDonor;
        });
      }

      // Wait for cloud CRM so we can merge correctly
      await cloudLoads;

      Object.keys(resolvedCrm).forEach((name) => {
        if (!map[name]) map[name] = { name, total: 0, donations: [], lastDate: '' };
      });

      const serverDonations: any[] = donRes.donations || [];
      // מיזוג העותקים המקומיים. ההשוואה מנורמלת (ראה manualDonations.ts) —
      // בלעדיה תרומה ידנית נספרה פעמיים, כי התאריך שהאפליקציה יוצרת מגיע עם
      // נקודות והגיליון מחזיר לוכסנים.
      const { keepLocal: uniqueManual, pruned } = mergeManualDonations(serverDonations, getManualDonations());
      // מה שכבר הגיע מהשרת אינו צריך להישאר מקומית. בלי הגיזום הזה הרשימה
      // המקומית גדלה לנצח, וכל שגיאת נרמול עתידית הייתה מתגלגלת על כולה.
      if (pruned > 0) saveManualDonations(uniqueManual);
      // שם קנוני (אחרי מיזוגי אנשי קשר) לכל רשומה — כדי שתרומות/מפגשים של שני
      // שמות ממוזגים יופיעו כמקשה אחת בכל מקום שמשתמש ברשימת donations הזו
      const allDonations = [...serverDonations, ...uniqueManual].map((d: any) =>
        d && d.name ? { ...d, name: resolveCanonicalName(d.name, resolvedMerges) } : d
      );

      if (allDonations.length > 0) {
        setDonations(allDonations);
        allDonations.forEach((d: Donation) => {
          if (!d.name) return;
          if (!map[d.name]) map[d.name] = { name: d.name, total: 0, donations: [], lastDate: '' };
          map[d.name].donations.push(d);
          map[d.name].total += (d.amount || 0);
          if (!map[d.name].lastDate || !d.date) {
            if (d.date) map[d.name].lastDate = d.date;
          } else {
            const curDateStr = d.date.split('/').reverse().join('-');
            const lastDateStr = map[d.name].lastDate.split('/').reverse().join('-');
            if (new Date(curDateStr) > new Date(lastDateStr)) map[d.name].lastDate = d.date;
          }
        });
      }
      // מעביר כינויים (למשל "אברהם אריאל") לתוך הרשומה הקנונית — מקפל כפילויות
      // שנוצרו מרשומות תורם נפרדות בגיליון עבור אותו אדם.
      setDonors(coalesceDonorsByMerges(map, resolvedMerges));

      if (failRes.failures) setFailures(failRes.failures);
      // מסמנים כאן ולא בכל מסך בנפרד: "מי חידש את מי" הוא מאפיין של
      // הרשימה כולה, ומסך שיקבל שורה בלי הסימון יציג אותה כהוראה שנפלה.
      if (hkRes.hk) setHk(annotateRenewals(hkRes.hk));

    } catch (e) {
      console.error('Error fetching data:', e);
      if (!opts?.silent) setLoadingText('שגיאת חיבור');
    }

    if (!opts?.silent) setLoading(false);
  };

  const addManualDonation = (donation: any) => {
    setDonations(prev => {
      const updated = [donation, ...prev];
      const manual = getManualDonations();
      saveManualDonations([donation, ...manual]);
      return updated;
    });
    setDonors(prev => {
      const name = donation.name;
      if (!name) return prev;
      const existing = prev[name] || { name, total: 0, donations: [], lastDate: '' };
      return {
        ...prev,
        [name]: {
          ...existing,
          donations: [donation, ...(existing.donations || [])],
          total: (existing.total || 0) + (donation.amount || 0),
          lastDate: donation.date || existing.lastDate,
        },
      };
    });
    logAction('donation');

    // כל תרומה אמיתית (לא רשומת "מפגש" עם amount<=0) מקבלת אוטומטית משימת
    // "לשלוח תודה" — כדי שלא תישכח. גיבוי רטרואקטיבי לתרומות ישנות יותר קורה
    // פעם אחת בלבד ב-useEffect למטה, לא כאן.
    if (donation.name && (donation.amount || 0) > 0) {
      setHolidayExtras(prev => {
        const cur = prev[STANDALONE_TASKS_ID] || {};
        const next = { ...prev, [STANDALONE_TASKS_ID]: { ...cur, tasks: [...(cur.tasks || []), createThankYouTask(donation.name, donation.amount, donation.date)] } };
        saveHolidayExtrasCloud(next);
        return next;
      });
      logAction('task_create');
    }
  };

  /**
   * עדכון של כמה אנשי קשר בבת אחת, שממתינים לסיומו.
   *
   * לולאה של updateCrm הייתה מייצרת שמירה נפרדת לכל איש קשר, כולן "שגר ושכח",
   * ואז כל refresh שיגיע לפני שהאחרונה נחתה היה מחזיר מהשרת עותק ישן ודורס
   * את הכול. כאן נבנה מצב אחד, נשמר פעם אחת, וממתינים לתשובה.
   */
  const updateCrmMany = async (updates: Record<string, any>): Promise<boolean> => {
    let snapshot: Record<string, any> = {};
    setCrm(prev => {
      const next = { ...prev };
      Object.keys(updates).forEach(n => { next[n] = { ...(prev[n] || {}), ...updates[n] }; });
      snapshot = next;
      return next;
    });
    // setCrm הסינכרוני כבר מילא את snapshot, ולכן אפשר לשמור אותו כאן
    await new Promise(r => setTimeout(r, 0));
    return saveCRMDataCloudSync(snapshot);
  };

  const updateCrm = (name: string, data: any) => {
    setCrm(prev => {
      const next = { ...prev, [name]: { ...(prev[name] || {}), ...data } };
      saveCRMDataCloud(next);
      return next;
    });
    logAction('contact_update');
  };

  // ממזג שני שמות (למשל "אברהם אריאל" ו"אברהם אריאל ציגנוב") לאיש קשר אחד.
  // aliasName נעלם מהרשימות; כל התרומות/המפגשים/פרטי ה-CRM שלו עוברים ל-canonicalName.
  // מתעדכן מיידית בצד הלקוח (בלי סיבוב רשת), ונשמר ברקע לענן.
  /**
   * ── מיזוג שני אנשי קשר ────────────────────────────────────────────────
   *
   * שני באגים ישבו כאן, ושניהם גרמו למיזוג "להתבטל מעצמו":
   *
   * 1. **מה שנשמר לא היה מה שהשתנה.** השמירה שלחה `{...crm, merges}` עם
   *    ה-crm שנקרא בזמן הרינדור — כלומר **לפני** המיזוג. השינוי האמיתי
   *    (איחוד הרשומות ומחיקת הכינוי) נעשה ב-setCrm שאחריו, ומעולם לא הגיע
   *    לגיליון. בטעינה הבאה השרת החזיר את המצב הישן.
   *
   * 2. **שמירה שלא ממתינים לה.** הרענון שבא אחרי המיזוג הספיק לפעמים
   *    להקדים את הכתיבה, למשוך את המצב הקודם, ולמחוק גם את מפת המיזוגים.
   *
   * לכן: בונים כאן את המצב המלא — גם ה-crm הממוזג וגם המפה — שומרים אותו
   * בשמירה אחת שממתינים לה, ומחזירים אם הצליחה.
   */
  const mergeContacts = async (aliasName: string, canonicalName: string): Promise<boolean> => {
    if (!aliasName || !canonicalName || aliasName === canonicalName) return false;

    const nextMerges = { ...nameMerges, [aliasName]: canonicalName };
    let snapshot: Record<string, any> = {};

    setCrm(prev => {
      const next = { ...prev };
      if (next[aliasName]) {
        next[canonicalName] = mergeCrmPair(next[aliasName], next[canonicalName]);
        delete next[aliasName];
      }
      snapshot = next;
      return next;
    });
    setNameMerges(nextMerges);
    setDonations(prev => prev.map(d => (d.name === aliasName ? { ...d, name: canonicalName } : d)));
    setDonors(prev => coalesceDonorsByMerges(prev, { [aliasName]: canonicalName }));

    await new Promise(r => setTimeout(r, 0));
    return saveCRMDataCloudSync({ ...snapshot, [MERGES_KEY]: nextMerges });
  };

  // מבטל מיזוג — טוען מחדש מהשרת כדי לפצל בחזרה לשתי רשומות נפרדות עם הנתונים המקוריים
  /** ביטול מיזוג. גם כאן ממתינים לשמירה לפני שמושכים מחדש. */
  const unmergeContact = async (aliasName: string): Promise<boolean> => {
    const nextMerges = { ...nameMerges };
    delete nextMerges[aliasName];
    setNameMerges(nextMerges);

    const ok = await saveCRMDataCloudSync({ ...crm, [MERGES_KEY]: nextMerges });
    // הטעינה מחדש רק אחרי שהשמירה אושרה — "setTimeout(400)" היה הימור, ואם
    // הוא הפסיד, הקריאה החזירה את המיזוג בדיוק אחרי שביטלת אותו.
    if (ok) loadAll({ silent: true });
    return ok;
  };

  const updateHolidayExtras = (id: string, data: any) => {
    setHolidayExtras(prev => {
      const next = { ...prev, [id]: { ...(prev[id] || {}), ...data } };
      saveHolidayExtrasCloud(next);
      return next;
    });
  };

  const updateEventsData = (data: any[]) => {
    const normalized = normalizeActivities(data);
    setEventsData(normalized);
    saveEventsDataCloud(normalized);
  };

  const updateProjects = (data: Project[]) => {
    const normalized = normalizeProjects(data);
    setProjects(normalized);
    saveProjectsCloud(normalized);
  };

  const updateFinanceData = async (data: FinanceData): Promise<boolean> => {
    const normalized = normalizeFinanceData(data);
    setFinanceData(normalized);
    return saveFinanceDataCloud(normalized);
  };

  const updateHistoryEntry = (id: string, data: Partial<HistoryEntry>) => {
    setHistory(prev => {
      const next = prev.map(h => (h.id === id ? { ...h, ...data } : h));
      saveHistoryDataCloud(next);
      return next;
    });
  };

  // מוסיף סיכומי עבר ידניים או כאלה שחולצו בעזרת AI. טביעת התוכן מונעת
  // מאותו סיכום להיכנס שוב אם המשתמש הדביק פעמיים את אותו פלט.
  const addHistoryEntries = (entries: HistoryEntry[]): number => {
    const known = new Set(history.map(historyEntryFingerprint));
    const unique = entries.filter(entry => {
      const key = historyEntryFingerprint(entry);
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
    if (!unique.length) return 0;
    setHistory(prev => {
      const next = [...prev, ...unique];
      saveHistoryDataCloud(next);
      return next;
    });
    logAction('history_archive', unique.length);
    return unique.length;
  };

  // מוחק רשומת היסטוריה לצמיתות — לשימוש כשמשהו הועבר להיסטוריה בטעות.
  // לא משחזר משימות/נוכחות חזרה למופע החי (זה כבר קיים בנפרד — "ייבוא משימות
  // מההיסטוריה" בכרטיס החג/אירוע החי).
  const deleteHistoryEntry = (id: string) => {
    setHistory(prev => {
      const next = prev.filter(h => h.id !== id);
      saveHistoryDataCloud(next);
      return next;
    });
  };

  // מסמן חג/אירוע כ"הסתיים": שומר תמונת מצב (משימות/נוכחות/תקציב) בהיסטוריה,
  // ומרוקן את המשימות (ואת הנוכחות) החיות כדי שהמופע הבא יתחיל נקי.
  // גם ממלא אוטומטית את שדה "אשתקד" עם המספרים האמיתיים שהתקבלו, לקראת השנה הבאה.
  const archiveOccurrence = ({ type, id, name, occurrenceDate }: { type: 'holiday' | 'event'; id: string; name: string; occurrenceDate?: string }) => {
    if (type === 'holiday') {
      const extra = holidayExtras[id] || {};
      const entry = buildHistoryEntry({
        type, name, occurrenceDate,
        tasks: extra.tasks, attendance: extra.attendance, budget: extra.budget, insights: extra.insights,
      });
      setHistory(prev => {
        const next = [...prev, entry];
        saveHistoryDataCloud(next);
        return next;
      });
      const attCount = countAttendance(extra.attendance);
      const budgetSums = sumBudget(extra.budget);
      updateHolidayExtras(id, {
        tasks: [],
        attendance: {},
        insights: { summary: '', good: '', improve: '', plan: '' },
        lastYear: { donors: attCount || extra.lastYear?.donors || '', amount: budgetSums.actualIncome || extra.lastYear?.amount || '' },
      });
    } else {
      const ev = eventsData.find((e: any) => e.id === id);
      if (!ev) return;
      const entry = buildHistoryEntry({
        type, name, occurrenceDate,
        tasks: ev.tasks, attendance: ev.attendance, budget: ev.budget,
      });
      setHistory(prev => {
        const next = [...prev, entry];
        saveHistoryDataCloud(next);
        return next;
      });
      updateEventsData(eventsData.map((e: any) => (e.id === id ? { ...e, tasks: [], attendance: {} } : e)));
    }
    logAction('history_archive');
  };

  // מייבא משימות מהמופע הקודם (מההיסטוריה) כמשימות חדשות (done:false)
  const importTasksFromHistory = ({ type, id, name }: { type: 'holiday' | 'event'; id: string; name: string }): boolean => {
    const latest = findLatestHistoryFor(history, type, name);
    if (!latest || (latest.tasks || []).length === 0) return false;
    const importedTasks = tasksFromHistory(latest);
    if (type === 'holiday') {
      const extra = holidayExtras[id] || {};
      updateHolidayExtras(id, { tasks: [...(extra.tasks || []), ...importedTasks] });
    } else {
      const ev = eventsData.find((e: any) => e.id === id);
      if (!ev) return false;
      updateEventsData(eventsData.map((e: any) => (e.id === id ? { ...e, tasks: [...(e.tasks || []), ...importedTasks] } : e)));
    }
    logAction('task_create', importedTasks.length);
    return true;
  };

  const updateRebbeDate = async (date: Date) => {
    setRebbeDate(date);
    localStorage.setItem('rebbe_date', date.toISOString());
    import('../lib/api').then(({ apiPost }) => {
      apiPost('updateRebbe', { date: date.toISOString().split('T')[0] }).catch(console.error);
    });
  };

  // כשמתחילים מערך ביקורים חדש — נוצרות אוטומטית משימות "ביקור בית" (kind:'homeVisit')
  // ל-5 האנשים הראשונים ברשימה, כדי שהמערך יופיע מייד בכרטיסיית "משימות".
  const startHomeVisitRound = (entries: HomeVisitEntry[]) => {
    const round = { id: `round_${Date.now()}`, createdAt: new Date().toISOString(), status: 'active' as const, entries };
    setHomeVisits(prev => {
      const next = { rounds: [...prev.rounds, round] };
      saveHomeVisitsDataCloud(next);
      return next;
    });
    const initialTasks = entries.slice(0, 5).map(e => createHomeVisitTask(e.name, round.id));
    if (initialTasks.length > 0) {
      setHolidayExtras(prev => {
        const cur = prev[STANDALONE_TASKS_ID] || {};
        const next = { ...prev, [STANDALONE_TASKS_ID]: { ...cur, tasks: [...(cur.tasks || []), ...initialTasks] } };
        saveHolidayExtrasCloud(next);
        return next;
      });
      logAction('task_create', initialTasks.length);
    }
  };

  // מסמן איש קשר במערך ביקורים כ"בוצע" — גם ברשומת המערך עצמה וגם במשימה
  // התואמת בכרטיסיית "משימות" (אם קיימת), כדי ששני המקומות יישארו מסונכרנים.
  const markHomeVisitDone = (roundId: string, name: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    setHomeVisits(prev => {
      const next = {
        rounds: prev.rounds.map(r => r.id === roundId
          ? { ...r, entries: r.entries.map(e => e.name === name ? { ...e, visited: true, visitedDate: todayStr } : e) }
          : r),
      };
      saveHomeVisitsDataCloud(next);
      return next;
    });
    setHolidayExtras(prev => {
      const cur = prev[STANDALONE_TASKS_ID] || {};
      const tasks = (cur.tasks || []).map((t: any) =>
        t.kind === 'homeVisit' && t.roundId === roundId && t.personName === name ? { ...t, done: true, doneAt: new Date().toISOString() } : t
      );
      const next = { ...prev, [STANDALONE_TASKS_ID]: { ...cur, tasks } };
      saveHolidayExtrasCloud(next);
      return next;
    });
    logAction('home_visit');
  };

  // מבטל סימון "בוצע" לביקור בית — גם ברשומת המערך וגם במשימה התואמת. לשימוש
  // מתצוגת "משימות שהושלמו" בהיסטוריה ("בטל ביצוע").
  const unmarkHomeVisitDone = (roundId: string, name: string) => {
    setHomeVisits(prev => {
      const next = {
        rounds: prev.rounds.map(r => r.id === roundId
          ? { ...r, entries: r.entries.map(e => e.name === name ? { ...e, visited: false, visitedDate: undefined } : e) }
          : r),
      };
      saveHomeVisitsDataCloud(next);
      return next;
    });
    setHolidayExtras(prev => {
      const cur = prev[STANDALONE_TASKS_ID] || {};
      const tasks = (cur.tasks || []).map((t: any) =>
        t.kind === 'homeVisit' && t.roundId === roundId && t.personName === name ? { ...t, done: false } : t
      );
      const next = { ...prev, [STANDALONE_TASKS_ID]: { ...cur, tasks } };
      saveHolidayExtrasCloud(next);
      return next;
    });
  };

  // יוצר משימת "ביקור בית" ידנית לאיש קשר ספציפי במערך (למשל אחרי שהמשימות
  // האוטומטיות הראשונות כבר טופלו) — מדלג אם כבר יש לו משימה פתוחה באותו מערך.
  const createHomeVisitTaskForEntry = (roundId: string, name: string) => {
    setHolidayExtras(prev => {
      const cur = prev[STANDALONE_TASKS_ID] || {};
      const tasks: any[] = cur.tasks || [];
      const alreadyOpen = tasks.some(t => t.kind === 'homeVisit' && t.roundId === roundId && t.personName === name && !t.done);
      if (alreadyOpen) return prev;
      const next = { ...prev, [STANDALONE_TASKS_ID]: { ...cur, tasks: [...tasks, createHomeVisitTask(name, roundId)] } };
      saveHolidayExtrasCloud(next);
      return next;
    });
    logAction('task_create');
  };

  const updateHomeVisitEntry = (roundId: string, name: string, patch: Partial<HomeVisitEntry>) => {
    setHomeVisits(prev => {
      const next = {
        rounds: prev.rounds.map(r => r.id === roundId
          ? { ...r, entries: r.entries.map(e => e.name === name ? { ...e, ...patch } : e) }
          : r),
      };
      saveHomeVisitsDataCloud(next);
      return next;
    });
  };

  const reorderHomeVisitEntries = (roundId: string, from: number, to: number) => {
    setHomeVisits(prev => {
      const next = {
        rounds: prev.rounds.map(r => r.id === roundId ? { ...r, entries: moveEntry(r.entries, from, to) } : r),
      };
      saveHomeVisitsDataCloud(next);
      return next;
    });
  };

  const archiveHomeVisitRound = (roundId: string) => {
    setHomeVisits(prev => {
      const next = { rounds: prev.rounds.map(r => r.id === roundId ? { ...r, status: 'archived' as const } : r) };
      saveHomeVisitsDataCloud(next);
      return next;
    });
  };

  // מוחק מערך שלם (בלתי הפיך) — גם מנקה כל משימת "ביקור בית" פתוחה ששייכת אליו.
  const deleteHomeVisitRound = (roundId: string) => {
    setHomeVisits(prev => {
      const next = { rounds: prev.rounds.filter(r => r.id !== roundId) };
      saveHomeVisitsDataCloud(next);
      return next;
    });
    setHolidayExtras(prev => {
      const cur = prev[STANDALONE_TASKS_ID] || {};
      const tasks = (cur.tasks || []).filter((t: any) => !(t.kind === 'homeVisit' && t.roundId === roundId));
      const next = { ...prev, [STANDALONE_TASKS_ID]: { ...cur, tasks } };
      saveHolidayExtrasCloud(next);
      return next;
    });
  };

  // מסיר איש קשר מהמערך (למשל הוסף בטעות), וגם מוחק את משימת "ביקור בית" הפתוחה
  // התואמת לו (אם קיימת) מכרטיסיית "משימות".
  const removeHomeVisitEntry = (roundId: string, name: string) => {
    setHomeVisits(prev => {
      const next = { rounds: prev.rounds.map(r => r.id === roundId ? { ...r, entries: r.entries.filter(e => e.name !== name) } : r) };
      saveHomeVisitsDataCloud(next);
      return next;
    });
    setHolidayExtras(prev => {
      const cur = prev[STANDALONE_TASKS_ID] || {};
      const tasks = (cur.tasks || []).filter((t: any) => !(t.kind === 'homeVisit' && t.roundId === roundId && t.personName === name));
      const next = { ...prev, [STANDALONE_TASKS_ID]: { ...cur, tasks } };
      saveHolidayExtrasCloud(next);
      return next;
    });
  };

  const addHomeVisitEntries = (roundId: string, entries: HomeVisitEntry[]) => {
    setHomeVisits(prev => {
      const next = { rounds: prev.rounds.map(r => r.id === roundId ? { ...r, entries: [...r.entries, ...entries] } : r) };
      saveHomeVisitsDataCloud(next);
      return next;
    });
  };

  // מעדכן מטא-דאטה של המערך עצמו (ייעוד/טווח תאריכים/משימות הכנה) — לא נוגע ברשימת האנשים.
  const updateHomeVisitRoundMeta = (roundId: string, patch: Partial<HomeVisitRound>) => {
    setHomeVisits(prev => {
      const next = { rounds: prev.rounds.map(r => r.id === roundId ? { ...r, ...patch } : r) };
      saveHomeVisitsDataCloud(next);
      return next;
    });
  };

  // בכל טעינה/רענון — בודק אילו חגים נכנסו לטווח 30 הימים ועדיין אין להם משימת
  // "לעדכן את החג", ומוסיף אותה אוטומטית (לתוך המשימות של אותו חג עצמו, כדי
  // שתופיע גם בכרטיסיית "משימות" וגם בכרטיס החג המלא). ממתין ל-loading===false
  // כדי לא ליצור כפילויות לפני שה-holidayExtras מהענן נטען.
  useEffect(() => {
    if (loading || holidays.length === 0) return;
    const list = buildHolidayList(holidays, getCustomHols(), new Date());
    const missing = computeMissingHolidayReminders(list, holidayExtras);
    if (missing.length === 0) return;
    setHolidayExtras(prev => {
      const next = { ...prev };
      missing.forEach(h => {
        const cur = next[h.id] || {};
        next[h.id] = { ...cur, tasks: [...(cur.tasks || []), createHolidayReminderTask(h.name)] };
      });
      saveHolidayExtrasCloud(next);
      return next;
    });
  }, [holidays, holidayExtras, loading]);

  // כמו התזכורת לחגים, אבל לאירועים חוזרים — יום לפני כל מופע. המזהה הייחודי
  // של המופע (dueDate על המשימה) מבטיח שכל מופע חדש מקבל תזכורת משלו.
  useEffect(() => {
    if (loading || eventsData.length === 0) return;
    const missing = computeMissingEventReminders(eventsData, new Date());
    if (missing.length === 0) return;
    setEventsData(prev => {
      const next = prev.map((ev: any) => {
        const m = missing.find(x => x.id === ev.id);
        if (!m) return ev;
        return { ...ev, tasks: [...(ev.tasks || []), createEventReminderTask(m.name, m.occurrenceDateISO)] };
      });
      saveEventsDataCloud(next);
      return next;
    });
  }, [eventsData, loading]);

  // גיבוי חד-פעמי: יוצר משימות "לשלוח תודה" עבור תרומות מ-10 הימים האחרונים
  // שנוספו לפני שהפיצ'ר הזה קיים (או הגיעו ישירות מהגיליון בלי לעבור דרך
  // addManualDonation). רץ פעם אחת בלבד — דגל קבוע ב-localStorage, אותו
  // דפוס בדיוק כמו backfillLastWeek ב-score.ts.
  useEffect(() => {
    if (loading) return;
    if (localStorage.getItem('thankyou_backfill_v1_done')) return;
    localStorage.setItem('thankyou_backfill_v1_done', 'true');
    const missing = computeMissingThankYouTasks(donations, holidayExtras[STANDALONE_TASKS_ID]?.tasks || [], new Date());
    if (missing.length === 0) return;
    setHolidayExtras(prev => {
      const cur = prev[STANDALONE_TASKS_ID] || {};
      const next = { ...prev, [STANDALONE_TASKS_ID]: { ...cur, tasks: [...(cur.tasks || []), ...missing] } };
      saveHolidayExtrasCloud(next);
      return next;
    });
  }, [loading, donations, holidayExtras]);

  // גיבוי חד-פעמי: ממלא תאריך אירוע גם למשימות אירוע קיימות שנוצרו לפני
  // שמשימות אירוע חדשות התחילו לקבל את תאריך האירוע אוטומטית — ראה
  // backfillEventTaskDates. רץ פעם אחת בלבד.
  useEffect(() => {
    if (loading || eventsData.length === 0) return;
    if (localStorage.getItem('event_task_date_backfill_v1_done')) return;
    localStorage.setItem('event_task_date_backfill_v1_done', 'true');
    const { events: next, count } = backfillEventTaskDates(eventsData, new Date());
    if (count === 0) return;
    setEventsData(next);
    saveEventsDataCloud(next);
  }, [loading, eventsData]);

  // ── החלת המראה על מסמך ה-HTML ─────────────────────────────────────────
  //
  // התכונות יושבות על <html> ולא בתוך React: כך גם רקע העמוד, גלילה
  // וסרגלי המערכת מקבלים את הערכה, ולא רק מה שמצויר בתוך האפליקציה.
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute('data-theme', settings.theme || 'classic');
    el.setAttribute('data-size', settings.uiSize || 'normal');
    el.setAttribute('data-density', settings.density || 'normal');
    el.setAttribute('data-graphics', settings.graphics === false ? 'off' : 'on');
    el.setAttribute('data-finish', settings.finish || 'float');
    el.setAttribute('data-surface', settings.surface || 'auto');
    el.setAttribute('data-icons', settings.icons || 'thin');
    el.setAttribute('data-font', settings.font || 'classic');
    // צבע סרגל הדפדפן בנייד — אחרת הוא נשאר זהב על ערכה כהה
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      // סרגל הדפדפן צמוד לסרגל הניווט של האפליקציה, ולכן הוא לוקח את
      // צבע הניווט — לא את צבע הבסיס. בסרגל בהיר ההבדל בולט מאוד.
      const navBg = getComputedStyle(el).getPropertyValue('--c-nav-bg').trim();
      if (navBg) meta.setAttribute('content', navBg);
    }
    // ── תלות מפורשת בכל ציר ──────────────────────────────────────────────
    // כאן היה באג שנראה בדיוק כמו "האפשרות לא עושה כלום": נוספו ארבעה
    // צירים חדשים, ורשימת התלויות נשארה עם הארבעה הישנים. התכונות נכתבו
    // פעם אחת בטעינה, וכל בחירה של גימור, ניווט, אייקון או גופן נשמרה
    // בהגדרות בלי שאיש יעדכן את ה-DOM. הצבע דווקא עבד, כי theme היה ברשימה.
  }, [
    settings.theme, settings.uiSize, settings.density, settings.graphics,
    settings.finish, settings.surface, settings.icons, settings.font,
  ]);

  useEffect(() => {
    loadAll();
    const localRebbe = localStorage.getItem('rebbe_date');
    if (localRebbe) setRebbeDate(new Date(localRebbe));
  }, []);

  return (
    <AppContext.Provider value={{
      summary, effectiveSummary, donations, donors, visibleDonors, hk, failures, rebbeDate,
      shabbat, holidays, hebrewDate,
      // refresh נקרא אחרי כל פעולת כתיבה, ולכן הוא שקט: מרענן נתונים
      // בלי להחליף את המסך במסך טעינה. הטעינה הראשונה בלבד מציגה אותו.
      loading, loadingText, apiError, crm, holidayExtras, eventsData, history, nameMerges,
      refresh: () => loadAll({ silent: true }),
      projects, updateProjects, financeData, updateFinanceData,
      addManualDonation, updateCrm, updateCrmMany, updateHolidayExtras, updateEventsData, updateRebbeDate,
      mergeContacts, unmergeContact, settings, updateSettings,
      archiveOccurrence, importTasksFromHistory, updateHistoryEntry, addHistoryEntries, deleteHistoryEntry,
      homeVisits, startHomeVisitRound, markHomeVisitDone, unmarkHomeVisitDone, createHomeVisitTaskForEntry,
      updateHomeVisitEntry, reorderHomeVisitEntries, archiveHomeVisitRound, deleteHomeVisitRound,
      removeHomeVisitEntry, addHomeVisitEntries, updateHomeVisitRoundMeta,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useAppStore must be used within AppProvider');
  return context;
};
