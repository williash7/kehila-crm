// דוח תקינות: מזהה בעיות כספיות ומבניות, ואינו משנה נתונים.
const fs = require('fs');
const path = require('path');

let failed = 0;
function ok(c, m) { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failed = 1; }

const stores = {};
function sheet(name) {
  return {
    getName: () => name,
    getDataRange: () => ({ getValues: () => stores[name].map(r => r.slice()) }),
  };
}
global.SpreadsheetApp = {
  getActiveSpreadsheet: () => ({
    getSheetByName: n => stores[n] ? sheet(n) : null,
    getId: () => 'sheet-test',
    getName: () => 'בדיקה',
  }),
};
global.Session = { getScriptTimeZone: () => 'Asia/Jerusalem' };
global.Utilities = {
  formatDate: (d, _tz, fmt) => {
    const p = n => String(n).padStart(2, '0');
    return fmt.replace('yyyy', d.getFullYear()).replace('MM', p(d.getMonth() + 1)).replace('dd', p(d.getDate()));
  },
};
global.Logger = { log: () => {} };

const code = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script', 'Code.gs'), 'utf8');
eval(code);

function seed() {
  Object.keys(SH).forEach(k => { stores[SH[k]] = [(COLS[k] || []).slice()]; });
  __tableCache = {};
}
function add(name, obj) {
  const headers = stores[name][0];
  stores[name].push(headers.map(h => obj[h] === undefined ? '' : obj[h]));
}
function codes(report) { return report.issues.map(i => i.code); }

console.log('א. גיליון תקין:');
seed();
add(SH.CONTACTS, { 'שם מלא': 'ישראל ישראלי' });
add(SH.HK, { 'מזהה': '100', 'שם': 'ישראל ישראלי', 'תאריך פתיחה': '01/07/2026', 'סכום': 100, 'מספר תשלומים': 2 });
add(SH.LOG, { 'מזהה': 'hk:100:2026-07', 'שם': 'ישראל ישראלי', 'תאריך תרומה': '01/07/2026', 'סכום': 100, 'אפיק גבייה': 'הוראת קבע' });
add(SH.LOG, { 'מזהה': 'hk:100:2026-08', 'שם': 'ישראל ישראלי', 'תאריך תרומה': '01/08/2026', 'סכום': 100, 'אפיק גבייה': 'הוראת קבע' });

let before = JSON.stringify(stores);
let report = getIntegrity_();
ok(report.success === true, 'הפעולה הצליחה');
ok(report.healthy === true, 'אין שגיאות בגיליון התקין');
ok(report.summary.errors === 0, 'מונה השגיאות אפס');
ok(JSON.stringify(stores) === before, 'הבדיקה לא שינתה נתונים');

console.log('\nב. גיליון עם תקלות:');
seed();
add(SH.CONTACTS, { 'שם מלא': 'ישראל ישראלי' });
add(SH.HK, { 'מזהה': '200', 'שם': 'ישראל ישראלי', 'תאריך פתיחה': '01/08/2026', 'סכום': 0, 'מספר תשלומים': 2 });
add(SH.LOG, { 'מזהה': 'dup-1', 'שם': 'ישראל ישראלי', 'תאריך תרומה': '10/08/2026', 'סכום': 50, 'אפיק גבייה': 'מזומן' });
add(SH.LOG, { 'מזהה': 'dup-1', 'שם': 'אדם לא קיים', 'תאריך תרומה': '10/08/2026', 'סכום': 0, 'אפיק גבייה': 'מזומן', 'סטטוס': 'מצב חדש' });
add(SH.LOG, { 'מזהה': 'hk:999:2026-08', 'שם': 'ישראל ישראלי', 'תאריך תרומה': '01/08/2026', 'סכום': 100, 'אפיק גבייה': 'הוראת קבע' });
add(SH.LOG, { 'מזהה': 'hk:777:2026-08', 'שם': 'ישראל ישראלי', 'תאריך תרומה': '01/08/2026', 'סכום': 100, 'אפיק גבייה': 'הוראת קבע', 'סטטוס': STATUS_FAILED });
add(SH.FAILURES, { 'תאריך': '01/08/2026', 'שם': 'ישראל ישראלי', 'מזהה הוראה': '888', 'סכום': 100 });

before = JSON.stringify(stores);
let syncSchedules = 0;
maybeSync_ = () => { syncSchedules++; };
report = route_('getIntegrity', {});
const found = codes(report);
ok(report.healthy === false, 'הדוח מסמן שהמצב דורש טיפול');
ok(found.includes('orders_invalid'), 'סכום הוראה לא תקין');
ok(found.includes('log_duplicate_id'), 'מזהה יומן כפול');
ok(found.includes('charges_orphaned'), 'חיוב ללא הוראה');
const orphanIssue = report.issues.find(i => i.code === 'charges_orphaned');
ok(orphanIssue && !orphanIssue.items.some(x => x.includes('777')), 'חיוב נכשל ללא הוראה נשמר כתיעוד תקין');
ok(!found.includes('charges_missing'), 'חיובים חסרים עתידיים אינם יוצרים רעש בדוח');
ok(found.includes('log_invalid_amount'), 'סכום יומן לא תקין');
ok(found.includes('log_unknown_status'), 'סטטוס לא מוכר');
ok(found.includes('log_unknown_contact'), 'שם יומן ללא איש קשר');
ok(found.includes('failures_orphaned'), 'כשל ללא הוראה');
ok(syncSchedules === 0, 'הרצת הדוח אינה מתזמנת סנכרון רקע');
ok(JSON.stringify(stores) === before, 'גם מול תקלות לא השתנה אף תא');

console.log('\nג. חוזה הנתונים:');
ok(typeof report.generatedAt === 'string' && report.generatedAt.length > 10, 'זמן יצירת הדוח');
ok(report.codeVersion === CODE_VERSION, 'גרסת הסקריפט');
ok(report.issues.every(i => i.code && i.severity && i.title && typeof i.count === 'number'), 'כל ממצא ניתן להצגה בממשק');

console.log('\n✓ דוח תקינות קריאה־בלבד');
process.exitCode = failed;
