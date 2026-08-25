import type { ClientBackupState } from './clientBackup';

// ─────────────────────────────────────────────────────────────────────────────
// גיבוי מלא ודוח תקינות — הלוגיקה, בלי React.
//
// ── למה הגיבוי מגיע במקטעים ולא בבת אחת ──────────────────────────────────
//
// תשובה של Apps Script עוברת כמחרוזת JSON אחת בזיכרון. יומן עם כמה אלפי
// שורות, בתוספת ערכי הסנכרון, מגיע בקלות לעשרות מגה — וזה נופל על מגבלת
// הזיכרון או על שש הדקות, **ודווקא אצל מי שהכי צריך גיבוי.**
//
// לכן: manifest, ואז לשונית-לשונית ומקטע-מקטע. איטי יותר, אבל מסתיים.
//
// ── ומה קורה כשמשהו נכשל באמצע ────────────────────────────────────────────
//
// **עוצרים. לא מורידים כלום.**
//
// גיבוי חלקי שנראה שלם מסוכן יותר מגיבוי שנכשל: מי שסומך עליו יגלה את
// החסר רק ביום שבו הוא יזדקק לו — כלומר בדיוק ברגע הגרוע ביותר. קובץ
// שלא ירד אומר את האמת; קובץ שירד חסר משקר בשקט.
//
// לכן `collectBackup` זורקת ב-`BackupIncomplete`, והממשק מציג מה לא
// התקבל במקום להציע הורדה.
// ─────────────────────────────────────────────────────────────────────────────

export interface SheetMeta {
  present: boolean;
  headers: string[];
  rowCount: number;
}

export interface Manifest {
  success: boolean;
  schemaVersion?: number | string;
  generatedAt?: string;
  codeVersion?: string;
  spreadsheet?: { id: string; name: string; timeZone: string };
  maxLimit?: number;
  sheets?: Record<string, SheetMeta>;
  syncKeys?: string[];
  error?: string;
}

export interface Chunk {
  success: boolean;
  sheet?: string;
  headers?: string[];
  rows?: any[][];
  offset?: number;
  total?: number;
  nextOffset?: number | null;
  complete?: boolean;
  error?: string;
}

export interface BackupFile {
  kind: 'kehila-crm-backup';
  /**
   * תמיד `true` בקובץ שירד — וזו בדיוק הנקודה.
   *
   * הקובץ נכתב רק אחרי שכל מה שהמניפסט הכריז עליו התקבל, ולכן השדה הזה
   * הוא **הצהרה בתוך הקובץ עצמו** שהוא שלם. מי שיפתח אותו בעוד שנה, או
   * כלי שחזור עתידי, יכול לבדוק שורה אחת במקום לספור שורות מול מניפסט
   * שכבר לא קיים.
   */
  success: true;
  schemaVersion: number | string;
  generatedAt: string;
  codeVersion: string;
  spreadsheet: any;
  sheets: Record<string, { present: boolean; headers: string[]; rows: any[][]; rowCount: number }>;
  /** ערכי הסנכרון שנמשכו, מפתח אחר מפתח. */
  syncResolved: Record<string, any>;
  /** מידע חשוב שחי במכשיר ולא בגיליון. קיים מגירסה 2. */
  clientState?: ClientBackupState;
  /** מפת כיסוי קריאה לאדם וגם שער אימות לפני שחזור. */
  coverage?: BackupCoverage;
}

export interface BackupCoverage {
  sheets: number;
  sheetRows: number;
  syncKeys: string[];
  clientKeys: string[];
  records: {
    contacts: number;
    logRows: number;
    standingOrders: number;
    chargeFailures: number;
    nameAliases: number;
    activities: number;
    campaigns: number;
    tasks: number;
    tasksWithId: number;
    homeVisitRounds: number;
    financeTransactions: number;
    customHolidays: number;
  };
  relationships: {
    namedLogRows: number;
    purposedLogRows: number;
    cashLocatedLogRows: number;
    campaignActivityLinks: number;
  };
}

function presentSheet(backup: BackupFile, name: string) {
  return backup.sheets?.[name]?.present ? backup.sheets[name] : undefined;
}

function columnCount(backup: BackupFile, sheetName: string, header: string): number {
  const sheet = presentSheet(backup, sheetName);
  if (!sheet) return 0;
  const index = sheet.headers.indexOf(header);
  return index < 0 ? 0 : sheet.rows.filter(row => String(row?.[index] ?? '').trim()).length;
}

function taskLists(backup: BackupFile): any[][] {
  const sync = backup.syncResolved || {};
  const lists: any[][] = [];
  Object.values(sync.holidayExtras || {}).forEach((extra: any) => {
    if (Array.isArray(extra?.tasks)) lists.push(extra.tasks);
  });
  (Array.isArray(sync.events) ? sync.events : []).forEach((event: any) => {
    if (Array.isArray(event?.tasks)) lists.push(event.tasks);
  });
  (Array.isArray(sync.projects) ? sync.projects : []).forEach((project: any) => {
    if (Array.isArray(project?.tasks)) lists.push(project.tasks);
  });
  return lists;
}

/** ספירות מפורשות שמוכיחות אילו סוגי מידע וקשרים נמצאים בקובץ. */
export function buildBackupCoverage(backup: BackupFile): BackupCoverage {
  const sync = backup.syncResolved || {};
  const tasks = taskLists(backup).flat();
  const projects = Array.isArray(sync.projects) ? sync.projects : [];
  const clientValues = backup.clientState?.values || {};
  let customHolidays: any[] = [];
  try { customHolidays = JSON.parse(clientValues.custom_hols || '[]'); } catch { /* מאומת בנפרד */ }
  return {
    sheets: Object.values(backup.sheets || {}).filter(sheet => sheet.present).length,
    sheetRows: Object.values(backup.sheets || {}).reduce((sum, sheet) => sum + (sheet.rows?.length || 0), 0),
    syncKeys: Object.keys(sync).sort(),
    clientKeys: Object.keys(clientValues).sort(),
    records: {
      contacts: presentSheet(backup, 'אנשי קשר')?.rows.length || 0,
      logRows: presentSheet(backup, 'יומן תרומות ומפגשים')?.rows.length || 0,
      standingOrders: presentSheet(backup, 'הוראות קבע')?.rows.length || 0,
      chargeFailures: presentSheet(backup, 'כשלי חיוב')?.rows.length || 0,
      nameAliases: presentSheet(backup, 'מיפוי שמות')?.rows.length || 0,
      activities: Array.isArray(sync.events) ? sync.events.length : 0,
      campaigns: projects.length,
      tasks: tasks.length,
      tasksWithId: tasks.filter(task => String(task?.id || '').trim()).length,
      homeVisitRounds: Array.isArray(sync.homeVisits?.rounds) ? sync.homeVisits.rounds.length : 0,
      financeTransactions: Array.isArray(sync.finance?.transactions) ? sync.finance.transactions.length : 0,
      customHolidays: Array.isArray(customHolidays) ? customHolidays.length : 0,
    },
    relationships: {
      namedLogRows: columnCount(backup, 'יומן תרומות ומפגשים', 'שם'),
      purposedLogRows: columnCount(backup, 'יומן תרומות ומפגשים', 'ייעוד'),
      cashLocatedLogRows: columnCount(backup, 'יומן תרומות ומפגשים', 'מיקום מזומן'),
      campaignActivityLinks: projects.reduce((sum: number, project: any) =>
        sum + (Array.isArray(project?.activityIds) ? project.activityIds.length : (project?.eventId ? 1 : 0)), 0),
    },
  };
}

/** נזרקת כשרכיב כלשהו לא התקבל. אין קובץ, ויש למה. */
export class BackupIncomplete extends Error {
  failures: { what: string; error: string }[];
  constructor(failures: { what: string; error: string }[]) {
    super('הגיבוי לא הושלם');
    this.name = 'BackupIncomplete';
    this.failures = failures;
  }
}

export interface Progress {
  /** 0..1 */
  ratio: number;
  label: string;
}

/** כמה בקשות יידרשו — כדי שאפשר יהיה להראות התקדמות אמיתית ולא ספינר. */
export function plannedSteps(m: Manifest, limit: number): number {
  const perSheet = Object.values(m.sheets || {}).reduce(
    (n, s) => n + Math.max(1, Math.ceil((s.rowCount || 0) / Math.max(1, limit))), 0);
  return perSheet + (m.syncKeys || []).length;
}

/**
 * אוסף גיבוי מלא.
 *
 * `fetchChunk` ו-`fetchSync` מוזרקים מבחוץ — כך אפשר לבדוק את כל ההיגיון
 * בלי רשת, וזה מה שהופך את הקובץ הזה לנבדק.
 */
export async function collectBackup(
  manifest: Manifest,
  fetchChunk: (sheet: string, offset: number, limit: number) => Promise<Chunk>,
  fetchSync: (key: string) => Promise<{ success: boolean; data?: any; error?: string }>,
  onProgress?: (p: Progress) => void,
  hardLimit?: number,
  clientState?: ClientBackupState
): Promise<BackupFile> {
  const cap = manifest.maxLimit || 500;
  const limit = Math.max(1, Math.min(hardLimit || cap, cap));
  const out: BackupFile = {
    kind: 'kehila-crm-backup',
    success: true,
    schemaVersion: manifest.schemaVersion ?? 1,
    generatedAt: manifest.generatedAt || new Date().toISOString(),
    codeVersion: manifest.codeVersion || '',
    spreadsheet: manifest.spreadsheet || null,
    sheets: {},
    syncResolved: {},
  };

  const fail = (what: string, error: string): never => {
    throw new BackupIncomplete([{ what, error }]);
  };

  const total = Math.max(1, plannedSteps(manifest, limit));
  let done = 0;
  const tick = (label: string) => {
    done++;
    onProgress?.({ ratio: Math.min(done / total, 1), label });
  };

  for (const name of Object.keys(manifest.sheets || {})) {
    const meta = manifest.sheets![name];
    out.sheets[name] = {
      present: !!meta.present,
      headers: meta.headers || [],
      rows: [],
      rowCount: meta.rowCount || 0,
    };
    if (!meta.present) { tick(name); continue; }

    let offset: number | null = 0;
    let guard = 0;
    while (offset !== null) {
      // הגנה מפני שרת שמחזיר nextOffset שאינו מתקדם. בלעדיה לולאה
      // אינסופית שנראית למשתמש כמו "הגיבוי תקוע".
      if (++guard > 10000) fail(name, 'ההורדה לא הסתיימה — יותר מדי מקטעים');

      let c: Chunk;
      try {
        c = await fetchChunk(name, offset, limit);
      } catch (e: any) {
        return fail(`${name} (מ-${offset})`, String(e?.message || e));
      }
      if (!c || !c.success) return fail(`${name} (מ-${offset})`, c?.error || 'שגיאה לא ידועה');

      if (c.headers?.length) out.sheets[name].headers = c.headers;
      out.sheets[name].rows.push(...(c.rows || []));
      if (typeof c.total === 'number') out.sheets[name].rowCount = c.total;

      const next = c.nextOffset;
      if (next === null || next === undefined) offset = null;
      else if (next <= offset) return fail(name, 'השרת לא התקדם בין מקטעים');
      else offset = next;

      tick(`${name} · ${out.sheets[name].rows.length} שורות`);
    }

    // מה שהמניפסט הכריז עליו חייב להתקבל במלואו. פער כאן פירושו
    // גיבוי חסר שנראה שלם — בדיוק מה שאסור.
    const got = out.sheets[name].rows.length;
    const want = out.sheets[name].rowCount;
    if (got < want) fail(name, `התקבלו ${got} שורות מתוך ${want}`);
  }

  for (const key of manifest.syncKeys || []) {
    let r: { success: boolean; data?: any; error?: string };
    try {
      r = await fetchSync(key);
    } catch (e: any) {
      return fail(key, String(e?.message || e));
    }
    if (!r?.success) return fail(key, r?.error || 'שגיאה לא ידועה');
    out.syncResolved[key] = r.data;
    tick(key);
  }

  if (clientState) out.clientState = clientState;
  out.coverage = buildBackupCoverage(out);

  return out;
}

/** שם קובץ יציב וממוין לפי תאריך. */
export function backupFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `גיבוי-לוח-בקרה-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
         `-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

/** סיכום קריא לאדם: כמה שורות ירדו בפועל. */
export function backupSummary(b: BackupFile): { rows: number; sheets: number; sync: number } {
  return {
    rows: Object.values(b.sheets).reduce((n, s) => n + s.rows.length, 0),
    sheets: Object.keys(b.sheets).length,
    sync: Object.keys(b.syncResolved).length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// דוח התקינות
// ─────────────────────────────────────────────────────────────────────────────

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  code: string;
  severity: Severity;
  title: string;
  count: number;
  items: any[];
  truncated?: boolean;
  details?: string;
}

export interface IntegrityReport {
  success: boolean;
  generatedAt?: string;
  codeVersion?: string;
  healthy?: boolean;
  summary?: Record<string, number>;
  issues?: Issue[];
  error?: string;
}

/**
 * מה עושים עם כל ממצא.
 *
 * הדוח מדווח *מה* לא תקין; בלי זה המשתמש נשאר עם רשימת קודים ובלי מושג
 * מה לעשות. וזה בדיוק מה שהופך דוח אבחון לרעש שמתעלמים ממנו.
 */
export const ISSUE_HELP: Record<string, string> = {
  missing_sheets:
    'הריצו בגיליון: לוח בקרה ← כלים מתקדמים ← התקנה ראשונית. היא יוצרת את מה שחסר ולא נוגעת בקיים.',
  contacts_missing_name:
    'שורה באנשי הקשר בלי שם אינה נגישה מהאפליקציה. מלאו שם, או מחקו את השורה בגיליון.',
  contacts_duplicate_name:
    'שני כרטיסים לאותו אדם מפצלים לו את היסטוריית התרומות. אחדו אותם במסך אנשי הקשר, או דרך לשונית "מיפוי שמות".',
  orders_duplicate_id:
    'שתי הוראות עם אותו מספר — החיובים שלהן יתערבבו. השאירו אחת ומחקו את השנייה בגיליון.',
  orders_invalid:
    'הוראה בלי סכום או בלי מספר תשלומים לא תייצר חיובים. השלימו בגיליון, או ערכו את ההוראה במסך הוראות הקבע.',
  orders_missing_name:
    'הוראה בלי שם אינה משויכת לאף אחד ולא תופיע בכרטיס. מלאו את השם בגיליון.',
  log_duplicate_id:
    'שתי שורות עם אותו מזהה — סימן לעריכה ידנית בגיליון. השאירו אחת.',
  log_missing_id:
    'שורה בלי מזהה עלולה להיכתב שוב בסריקה הבאה ולהיספר פעמיים. הוסיפו מזהה ייחודי, או מחקו.',
  log_missing_name:
    'תרומה בלי שם לא משויכת לאיש קשר ולא נספרת אצלו. מלאו את השם.',
  charges_orphaned:
    'חיוב שמצביע להוראה שכבר לא קיימת. אם ההוראה נמחקה בטעות — החזירו אותה; אם החיוב שגוי — מחקו את השורה.',
  charges_malformed_id:
    'מזהה חיוב בפורמט לא מוכר. כנראה נערך ידנית. השוו לשורות אחרות של אותה הוראה.',
  log_invalid_amount:
    'סכום שאינו מספר לא נספר בשום סיכום. בדקו את התא — לרוב זה טקסט שנכנס בטעות.',
  log_unknown_status:
    'ערך בעמודת סטטוס שאינו ריק, "נכשל", "עתידי" או "מבוטל". שורה כזו עלולה להיספר ככסף בטעות.',
  log_unknown_contact:
    'שם ביומן שאינו קיים באנשי הקשר. לרוב שגיאת כתיב — הוסיפו אותו ללשונית "מיפוי שמות" והוא יתחבר לכרטיס הנכון.',
  failures_orphaned:
    'כשל חיוב שמצביע להוראה לא מוכרת. לרוב הוראה ישנה שנמחקה — אפשר להתעלם.',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  error: 'דורש טיפול',
  warning: 'כדאי לבדוק',
  info: 'לידיעה',
};

/** ממיין: מה שדורש טיפול קודם, ובתוך אותה חומרה — הגדול קודם. */
export function sortIssues(issues: Issue[]): Issue[] {
  const rank: Record<string, number> = { error: 0, warning: 1, info: 2 };
  return [...(issues || [])].sort(
    (a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) || (b.count || 0) - (a.count || 0)
  );
}

/** משפט אחד שמסכם את הדוח כולו. */
export function headline(r: IntegrityReport): string {
  if (!r?.success) return 'הבדיקה לא הצליחה לרוץ';
  const e = r.summary?.errors || 0;
  const w = r.summary?.warnings || 0;
  if (!e && !w) return 'לא נמצאו בעיות';
  if (!e) return `${w} ${w === 1 ? 'נקודה' : 'נקודות'} שכדאי לבדוק`;
  return `${e} ${e === 1 ? 'ממצא' : 'ממצאים'} שדורשים טיפול` + (w ? ` · ועוד ${w} לבדיקה` : '');
}
