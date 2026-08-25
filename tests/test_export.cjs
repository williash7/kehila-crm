// גיבוי מדורג: manifest קטן, מקטעי לשוניות, וערכי sync מבודדים.
const fs = require('fs');
const path = require('path');

let failed = 0;
function ok(c, m) { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failed = 1; }

const stores = {};
function sheet(name) {
  return {
    getName: () => name,
    getLastRow: () => stores[name].length,
    getLastColumn: () => Math.max(0, ...stores[name].map(r => r.length)),
    getDataRange: () => ({ getValues: () => stores[name].map(r => r.slice()) }),
    getRange: (row, column, rows, columns) => ({
      getValues: () => stores[name].slice(row - 1, row - 1 + rows)
        .map(r => Array.from({ length: columns }, (_, i) => r[column - 1 + i] ?? '')),
    }),
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
global.ContentService = {
  MimeType: { JSON: 'json' },
  createTextOutput: text => ({ text, setMimeType() { return this; } }),
};

const overflow = { 'overflow-projects': JSON.stringify([{ id: 'p1', name: 'פסח' }]) };
let driveReads = 0;
global.DriveApp = {
  getFileById: id => ({ getBlob: () => ({ getDataAsString: () => {
    driveReads++;
    if (!(id in overflow)) throw new Error('קובץ overflow חסר');
    return overflow[id];
  } }) }),
};

const code = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script', 'Code.gs'), 'utf8');
eval(code);

Object.keys(SH).forEach(k => { stores[SH[k]] = [(COLS[k] || []).slice()]; });

const born = new Date(1990, 4, 17, 12, 30);
stores[SH.CONTACTS][0].push('עמודה חופשית');
stores[SH.CONTACTS].push(['ישראל ישראלי', '050', '', '', '', born, '', '', '', 'ערך מותאם']);
stores[SH.CONTACTS].push(['שרה ישראלי', '052']);
stores[SH.SYNC].push(['crm', JSON.stringify({ 'ישראל ישראלי': { circle: 'close' } })]);
stores[SH.SYNC].push(['projects', JSON.stringify({ __overflow: 'overflow-projects' })]);
stores[SH.SYNC].push(['broken', JSON.stringify({ __overflow: 'missing-file' })]);

const before = JSON.stringify(stores);

console.log('א. manifest קטן:');
const manifest = exportAll_({});
ok(manifest.success === true, 'הפעולה הצליחה');
ok(manifest.schemaVersion === 2 && manifest.codeVersion === CODE_VERSION, 'גרסאות החוזה מצורפות');
ok(manifest.spreadsheet.id === 'sheet-123' && manifest.spreadsheet.name === 'קהילה לבדיקה', 'זהות הגיליון מצורפת');
ok(manifest.maxLimit === 500, 'תקרת המקטע מפורשת');
ok(Object.keys(SH).every(k => manifest.sheets[SH[k]]), 'כל לשוניות האפליקציה מופיעות');
ok(manifest.sheets[SH.CONTACTS].rowCount === 2, 'מספר השורות מדויק');
ok(manifest.sheets[SH.CONTACTS].headers.includes('עמודה חופשית'), 'עמודה שהמשתמש הוסיף מופיעה');
ok(manifest.syncKeys.includes('projects') && !('syncResolved' in manifest), 'מוחזרים מפתחות בלי תוכן כבד');
ok(driveReads === 0, 'manifest אינו קורא קובצי overflow');

console.log('\nב. דפדוף לשונית:');
const first = exportAll_({ sheet: SH.CONTACTS, offset: '0', limit: '1' });
ok(first.success && first.rows.length === 1, 'הוחזר רק המקטע המבוקש');
ok(first.total === 2 && first.nextOffset === 1 && first.complete === false, 'מצב ההתקדמות מדויק');
const dateCell = first.rows[0][5];
ok(dateCell && dateCell.__type === 'date' && /1990-05-17/.test(dateCell.value), 'תאריך נשמר עם טיפוס מפורש');
const second = exportAll_({ sheet: SH.CONTACTS, offset: first.nextOffset, limit: 100000 });
ok(second.limit === 500, 'השרת קוצץ limit גדול');
ok(second.rows.length === 1 && second.nextOffset === null && second.complete === true, 'המקטע האחרון נסגר');
const throughGet = JSON.parse(doGet({ parameter: {
  action: 'exportAll', sheet: SH.CONTACTS, offset: '1', limit: '1',
} }).text);
ok(throughGet.rows.length === 1 && throughGet.offset === 1, 'doGet מעביר את פרמטרי הדפדוף');

console.log('\nג. ערכי סנכרון בבידוד:');
const crm = exportAll_({ syncKey: 'crm' });
ok(crm.success && crm.data['ישראל ישראלי'].circle === 'close', 'ערך רגיל נפתר');
const projects = exportAll_({ syncKey: 'projects' });
ok(projects.success && projects.data[0].name === 'פסח', 'מצביע overflow נפתר');
const broken = exportAll_({ syncKey: 'broken' });
ok(broken.success === false && /overflow|חסר/.test(broken.error), 'כשל overflow נשאר מקומי');
ok(exportAll_({ syncKey: 'crm' }).success === true, 'כשל במפתח אחד אינו פוגע באחר');

console.log('\nד. קריאה בלבד:');
ok(JSON.stringify(stores) === before, 'אף תא לא השתנה בזמן הייצוא');

console.log('\n✓ חוזה הגיבוי המדורג תקין');
process.exitCode = failed;
