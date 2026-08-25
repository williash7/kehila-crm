// ═══════════════════════════════════════════════════════════════════════════
// גיבוי מלא ודוח תקינות — צד האפליקציה.
//
// הכלל שנבדק כאן חשוב יותר מכל השאר: **גיבוי חלקי לא יורד.**
// קובץ שלא ירד אומר את האמת; קובץ שירד חסר משקר בשקט, ומי שסומך עליו
// יגלה את החסר ביום שבו יזדקק לו.
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const B = require('/tmp/stub/backup.js');

let failed = 0;
function ok(c, m) { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failed = 1; }
async function throws(fn) { try { await fn(); return null; } catch (e) { return e; } }

const manifest = {
  success: true, schemaVersion: 1, codeVersion: '2026-08-23b',
  generatedAt: '2026-08-23T00:00:00Z', maxLimit: 500,
  spreadsheet: { id: 'x', name: 'גיליון', timeZone: 'Asia/Jerusalem' },
  sheets: {
    'אנשי קשר': { present: true, headers: ['שם מלא'], rowCount: 3 },
    'יומן תרומות ומפגשים': { present: true, headers: ['מזהה', 'סכום'], rowCount: 0 },
    'לשונית חסרה': { present: false, headers: [], rowCount: 0 },
  },
  syncKeys: ['crm', 'projects'],
};

/** שרת תקין: מחזיר שורות במנות. */
const goodChunk = (limit = 2) => async (sheet, offset, lim) => {
  const total = manifest.sheets[sheet].rowCount;
  const take = Math.min(lim ?? limit, limit, total - offset);
  const rows = [];
  for (let i = 0; i < take; i++) rows.push([`שורה ${offset + i + 1}`]);
  const consumed = offset + rows.length;
  return {
    success: true, sheet, headers: manifest.sheets[sheet].headers,
    rows, offset, total, nextOffset: consumed < total ? consumed : null,
  };
};
const goodSync = async key => ({ success: true, data: { key, v: 1 } });

(async () => {
  console.log('א. גיבוי מוצלח:');
  {
    const seen = [];
    const file = await B.collectBackup(manifest, goodChunk(2), goodSync, p => seen.push(p.ratio));
    ok(file.kind === 'kehila-crm-backup', 'סוג הקובץ');
    ok(file.success === true, 'הקובץ מצהיר על עצמו כשלם (success === true)');
    ok(file.codeVersion === '2026-08-23b', 'גרסת הסקריפט נשמרת בקובץ');
    ok(file.sheets['אנשי קשר'].rows.length === 3, 'כל שלוש השורות ירדו, בשתי מנות');
    ok(file.sheets['אנשי קשר'].present === true, 'present נשמר כפי שהחוזה דורש');
    ok(file.sheets['לשונית חסרה'].present === false, 'לשונית שאינה קיימת מסומנת ולא מדלגת בשקט');
    ok(Object.keys(file.syncResolved).length === 2, 'שני מפתחות הסנכרון');
    ok(file.syncResolved.crm.key === 'crm', 'התוכן עצמו');
    ok(seen.length > 0 && seen[seen.length - 1] <= 1, 'ההתקדמות מדווחת ואינה חורגת מ-100%');
  }

  console.log('\nב. כשל במקטע — אין קובץ:');
  {
    const e = await throws(() => B.collectBackup(manifest,
      async (s, o) => (o === 0 ? await goodChunk(2)(s, o, 2)
                               : { success: false, error: 'תקלה רגעית' }),
      goodSync));
    ok(e && e.name === 'BackupIncomplete', 'נזרקה BackupIncomplete ולא הוחזר קובץ חלקי');
    ok(e.failures?.[0]?.error === 'תקלה רגעית', 'הסיבה נשמרת ומוצגת למשתמש');
  }

  console.log('\nג. כשל במפתח סנכרון — גם כן אין קובץ:');
  {
    // זה המקרה של קובץ overflow שנמחק מ-Drive. הנתונים הכבדים יושבים שם,
    // וגיבוי בלעדיהם הוא בדיוק "נראה שלם ואינו".
    const e = await throws(() => B.collectBackup(manifest, goodChunk(500),
      async k => (k === 'projects' ? { success: false, error: 'הקובץ ב-Drive לא נמצא' }
                                   : { success: true, data: {} })));
    ok(e && e.name === 'BackupIncomplete', 'נעצר');
    ok(e.failures[0].what === 'projects', 'ונאמר איזה מפתח');
  }

  console.log('\nד. שרת שאינו מתקדם — לא נתקעים לנצח:');
  {
    const e = await throws(() => B.collectBackup(manifest,
      async (s, o) => ({ success: true, sheet: s, headers: [], rows: [['x']], offset: o,
                         total: 3, nextOffset: 0 }),   // תמיד 0
      goodSync));
    ok(e && e.name === 'BackupIncomplete', 'זוהה ונעצר במקום לולאה אינסופית');
  }

  console.log('\nה. פחות שורות ממה שהוכרז — נחשב כשל:');
  {
    const e = await throws(() => B.collectBackup(manifest,
      async (s, o) => ({ success: true, sheet: s, headers: [], rows: [], offset: o,
                         total: 3, nextOffset: null }),
      goodSync));
    ok(e && e.name === 'BackupIncomplete', 'פער מול המניפסט אינו עובר בשתיקה');
  }

  console.log('\nו. תקרת המנה מכובדת:');
  {
    let asked = 0;
    await B.collectBackup({ ...manifest, maxLimit: 2 },
      async (s, o, lim) => { asked = Math.max(asked, lim); return goodChunk(2)(s, o, lim); },
      goodSync, undefined, 100000);   // בקשה חצופה
    ok(asked <= 2, 'גם כשמבקשים 100,000 — נשלח לכל היותר maxLimit');
  }

  console.log('\nז. הדוח:');
  {
    const r = {
      success: true, healthy: false,
      summary: { errors: 2, warnings: 1, contacts: 10, logRows: 500, standingOrders: 4 },
      issues: [
        { code: 'log_unknown_status', severity: 'warning', title: 'סטטוסים', count: 1, items: [] },
        { code: 'orders_duplicate_id', severity: 'error', title: 'מזהים כפולים', count: 2, items: [] },
        { code: 'log_duplicate_id', severity: 'error', title: 'כפולים ביומן', count: 9, items: [] },
      ],
    };
    const sorted = B.sortIssues(r.issues);
    ok(sorted[0].code === 'log_duplicate_id', 'שגיאות קודם, והגדולה בראש');
    ok(sorted[2].severity === 'warning', 'האזהרות בסוף');
    ok(/דורשים טיפול/.test(B.headline(r)), 'הכותרת אומרת מה המצב');
    ok(B.headline({ success: true, summary: { errors: 0, warnings: 0 } }) === 'לא נמצאו בעיות', 'גיליון נקי');
    ok(/לא הצליחה/.test(B.headline({ success: false })), 'כשל בבדיקה עצמה');

    // לכל ממצא שהשרת יודע להחזיר חייבת להיות הנחיה מה לעשות.
    // דוח שאומר "יש בעיה" בלי לומר מה עושים הופך לרעש שמתעלמים ממנו.
    const code = fs.readFileSync(
      path.join(__dirname, '..', 'google-apps-script', 'Code.gs'), 'utf8');
    const codes = [...code.matchAll(/integrityIssue_\(\s*issues,\s*'([a-z_]+)'/g)].map(m => m[1]);
    const missing = [...new Set(codes)].filter(c => !B.ISSUE_HELP[c]);
    ok(missing.length === 0, 'לכל ' + new Set(codes).size + ' סוגי הממצאים יש הנחיה' +
       (missing.length ? ' — חסר: ' + missing.join(', ') : ''));
  }

  console.log('\nח. מפת הכיסוי כוללת רשומות וקשרים:');
  {
    const rich = {
      kind: 'kehila-crm-backup', success: true, schemaVersion: 2,
      sheets: {
        'אנשי קשר': { present: true, headers: ['שם'], rows: [['א'], ['ב']], rowCount: 2 },
        'יומן תרומות ומפגשים': {
          present: true, headers: ['שם', 'ייעוד', 'מיקום מזומן'],
          rows: [['א', 'פסח', 'עמותה'], ['ב', '', '']], rowCount: 2,
        },
        'מיפוי שמות': { present: true, headers: ['שם'], rows: [['אחר']], rowCount: 1 },
      },
      syncResolved: {
        events: [{ id: 'e1', tasks: [{ id: 't1' }] }],
        projects: [{ id: 'p1', activityIds: ['e1'], tasks: [{ id: 't2' }, { title: 'ישן' }] }],
        homeVisits: { rounds: [{ id: 'h1' }] },
        finance: { transactions: [{ id: 'f1' }] },
      },
      clientState: { schemaVersion: 1, values: { custom_hols: '[{"id":"c1"}]' }, excludedSensitive: [] },
    };
    const coverage = B.buildBackupCoverage(rich);
    ok(coverage.records.contacts === 2 && coverage.records.tasks === 3, 'אנשי קשר ומשימות נספרים');
    ok(coverage.records.tasksWithId === 2, 'מזהים יציבים למשימות נספרים בנפרד');
    ok(coverage.relationships.purposedLogRows === 1, 'ייעוד תרומה וקישור קמפיין–פעילות נספרים');
    ok(coverage.relationships.campaignActivityLinks === 1, 'קישור פעילות לקמפיין נספר');
    ok(coverage.records.customHolidays === 1, 'מידע מכשיר חשוב נכלל בכיסוי');
  }

  console.log('\nט. המסך:');
  {
    const root = path.join(__dirname, '..');
    const card = fs.readFileSync(root + '/src/components/BackupCard.tsx', 'utf8');
    const settings = fs.readFileSync(root + '/src/components/SettingsTab.tsx', 'utf8');
    const api = fs.readFileSync(root + '/src/lib/api.ts', 'utf8');

    ok(/<BackupCard \/>/.test(settings), 'הכרטיס מוצג בהגדרות');
    ok(/onClick=\{runCheck\}/.test(card), 'הבדיקה רצה בלחיצה');
    ok(!/useEffect\([^)]*runCheck/.test(card), 'ולא אוטומטית בפתיחת המסך');
    ok(/isNotDeployed/.test(card), 'מטופל המקרה שהסקריפט טרם נפרס');
    ok(/getMockData/.test(api) && !/getMockData/.test(card),
       'הגיבוי אינו נופל לנתוני דמה — גיבוי של דמה נראה כמו גיבוי אמיתי');
    ok(/ISSUE_HELP\[issue\.code\]/.test(card), 'לכל ממצא מוצג מה לעשות איתו');
    ok(/file\?\.success !== true/.test(card),
       'המסך מאמת במפורש שהקובץ מצהיר על עצמו כשלם לפני ההורדה');

    // ההורדה חייבת להיות **אחרי** האיסוף, אחרת ירד קובץ חלקי.
    const iCollect = card.indexOf('collectBackup');
    const iDownload = card.indexOf('a.click()');
    ok(iCollect > 0 && iDownload > iCollect, 'ההורדה קורית רק אחרי איסוף מלא');
  }

  console.log('\n✓ גיבוי ותקינות');
  process.exitCode = failed;
})();
