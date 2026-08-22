// גיבוי מלא: כל לשוניות האפליקציה, תאריכים עם טיפוס, ונתוני overflow פתורים.
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
    getId: () => 'sheet-123',
    getName: () => 'קהילה לבדיקה',
  }),
};
global.Session = { getScriptTimeZone: () => 'Asia/Jerusalem' };
global.Utilities = { formatDate: () => '' };
global.Logger = { log: () => {} };

const overflow = { 'overflow-projects': JSON.stringify([{ id: 'p1', name: 'פסח' }]) };
global.DriveApp = {
  getFileById: id => ({ getBlob: () => ({ getDataAsString: () => overflow[id] }) }),
};

const code = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script', 'Code.gs'), 'utf8');
eval(code);

Object.keys(SH).forEach(k => { stores[SH[k]] = [(COLS[k] || []).slice()]; });

const born = new Date(1990, 4, 17, 12, 30);
stores[SH.CONTACTS][0].push('עמודה חופשית');
stores[SH.CONTACTS].push(['ישראל ישראלי', '050', '', '', '', born, '', '', '', 'ערך מותאם']);
stores[SH.SYNC].push(['crm', JSON.stringify({ 'ישראל ישראלי': { circle: 'close' } })]);
stores[SH.SYNC].push(['projects', JSON.stringify({ __overflow: 'overflow-projects' })]);

const before = JSON.stringify(stores);
const out = exportAll_();

console.log('א. חוזה הגיבוי:');
ok(out.success === true, 'הפעולה הצליחה');
ok(out.schemaVersion === 1, 'גרסת סכימת גיבוי מפורשת');
ok(out.codeVersion === CODE_VERSION, 'גרסת הסקריפט מצורפת');
ok(out.spreadsheet.id === 'sheet-123' && out.spreadsheet.name === 'קהילה לבדיקה', 'זהות הגיליון מצורפת');

console.log('\nב. תוכן מלא:');
ok(Object.keys(SH).every(k => out.sheets[SH[k]]), 'כל לשוניות האפליקציה כלולות');
ok(out.sheets[SH.CONTACTS].headers.includes('עמודה חופשית'), 'עמודה שהמשתמש הוסיף נשמרת');
const dateCell = out.sheets[SH.CONTACTS].rows[0][5];
ok(dateCell && dateCell.__type === 'date' && /1990-05-17/.test(dateCell.value), 'תאריך נשמר עם טיפוס מפורש');
ok(out.syncResolved.crm['ישראל ישראלי'].circle === 'close', 'נתון סנכרון רגיל נפתר');
ok(out.syncResolved.projects[0].name === 'פסח', 'מצביע overflow נפתר לתוכן המלא');

console.log('\nג. קריאה בלבד:');
ok(JSON.stringify(stores) === before, 'אף תא לא השתנה בזמן הייצוא');

console.log('\n✓ גיבוי מלא מוכן להורדה מקומית');
process.exitCode = failed;

