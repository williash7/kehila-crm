const fs = require('fs');
const assert = require('assert');
eval(fs.readFileSync('/tmp/base.js', 'utf8').split("console.log('1.")[0]);

function cloneValue(v) {
  if (v instanceof Date) return new Date(v.getTime());
  if (Array.isArray(v)) return v.map(cloneValue);
  return v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cloneValue(x)])) : v;
}

function makeBook(seed, id, name) {
  const data = cloneValue(seed);
  const book = {
    id, name, data,
    getId: () => id,
    getName: () => name,
    getSheetByName(sheetName) {
      if (!data[sheetName]) return null;
      const api = {
        getName: () => sheetName,
        getLastRow: () => data[sheetName].length,
        getLastColumn: () => Math.max(0, ...(data[sheetName].map(r => r.length))),
        getDataRange: () => ({ getValues: () => cloneValue(data[sheetName]) }),
        clearContents: () => { data[sheetName] = []; return api; },
        appendRow: row => { data[sheetName].push(cloneValue(row)); return api; },
        getRange(row, col, nRows = 1, nCols = 1) {
          const range = {
            getValues: () => data[sheetName].slice(row - 1, row - 1 + nRows).map(r => r.slice(col - 1, col - 1 + nCols)),
            setValues(values) {
              values.forEach((r, i) => {
                const target = data[sheetName][row - 1 + i] || (data[sheetName][row - 1 + i] = []);
                r.forEach((v, j) => { target[col - 1 + j] = cloneValue(v); });
              });
              return range;
            },
            setValue(value) { return range.setValues([[value]]); },
          };
          return range;
        },
      };
      return api;
    },
    insertSheet(sheetName) { data[sheetName] = []; return this.getSheetByName(sheetName); },
    copy(copyName) {
      const copy = makeBook(data, `snapshot-${Object.keys(copies).length + 1}`, copyName);
      copies[copy.id] = copy;
      return copy;
    },
  };
  return book;
}

const seed = {};
Object.keys(SH).forEach(key => { seed[SH[key]] = [COLS[key].slice()]; });
seed[SH.CONTACTS].push(['ישן']);
const copies = {};
const active = makeBook(seed, 'active', 'קהילה');
SpreadsheetApp = {
  getActiveSpreadsheet: () => active,
  openById: id => copies[id],
};

const props = {};
PropertiesService = { getScriptProperties: () => ({
  getProperty: key => props[key] || null,
  setProperty: (key, value) => { props[key] = value; },
  deleteProperty: key => { delete props[key]; },
}) };
LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
Utilities.getUuid = () => 'restore-token';

const overflowSeed = cloneValue(seed);
overflowSeed[SH.SYNC].push(['crm', JSON.stringify({ __overflow: 'old-file' })]);
const overflowSnapshot = makeBook(overflowSeed, 'overflow-copy', 'overflow');
DriveApp = { getFileById: id => ({ makeCopy: () => ({ getId: () => `${id}-safety` }) }) };
isolateSnapshotOverflow_(overflowSnapshot);
assert.deepStrictEqual(JSON.parse(overflowSnapshot.data[SH.SYNC][1][1]), { __overflow: 'old-file-safety' },
  'עותק הבטיחות מקבל קובץ overflow מבודד');

function manifest(syncKeys = ['crm'], schemaVersion = 1) {
  return {
    schemaVersion,
    sheets: exportSheetNames_().map(name => ({
      name, present: true, headerCount: table_(name).headers.length, rowCount: name === SH.CONTACTS ? 1 : 0,
    })),
    syncKeys,
  };
}

assert.doesNotThrow(() => validateRestoreManifest_(manifest(['crm'], 2)), 'גיבוי מלא חדש בגרסה 2 מתקבל');
assert.throws(() => validateRestoreManifest_(manifest(['crm'], 3)), /גרסת הגיבוי/, 'גרסה עתידית לא מוכרת נעצרת');
const oldManifest = manifest(['crm'], 2);
oldManifest.sheets.pop();
assert.doesNotThrow(() => validateRestoreManifest_(oldManifest),
  'גיבוי ישן אינו נפסל רק מפני שנוספה מאז לשונית חדשה');

assert.throws(() => restoreBegin_({ manifest: manifest(['evil']) }), /מפתח סנכרון/,
  'מפתח שאינו מאושר נעצר לפני יצירת עותק');
assert.strictEqual(Object.keys(copies).length, 0);

const firstManifest = manifest();
firstManifest.sheets.find(item => item.name === SH.CONTACTS).headerCount += 1;
const begin = restoreBegin_({ manifest: firstManifest, reqId: 'restore-begin-1' });
assert.strictEqual(begin.success, true);
assert.strictEqual(Object.keys(copies).length, 1, 'עותק בטיחות נוצר לפני כתיבה');
const retriedBegin = restoreBegin_({ manifest: firstManifest, reqId: 'restore-begin-1' });
assert.strictEqual(retriedBegin.token, begin.token, 'ניסיון רשת חוזר מקבל את אותו שחזור');
assert.strictEqual(Object.keys(copies).length, 1, 'ניסיון רשת חוזר אינו יוצר עותק בטיחות נוסף');

for (const name of exportSheetNames_()) {
  const headers = name === SH.CONTACTS ? seed[name][0].concat(['שדה אישי']) : seed[name][0];
  const rows = name === SH.CONTACTS
    ? [['חדש', '', '', '', '', { __type: 'date', value: '2026-01-02T00:00:00.000Z' }, '', '', '=לא נוסחה', 'ערך מותאם']]
    : [];
  restoreSheet_({ token: begin.token, sheet: name, offset: 0, total: rows.length, headers, rows });
}
assert.throws(() => restoreFinish_({ token: begin.token }), /המפתח/, 'אי אפשר לסיים לפני כל מפתחות sync');
restoreSync_({ token: begin.token, key: 'crm', data: { חדש: { phone: '1' } } });
const finish = restoreFinish_({ token: begin.token });
assert.strictEqual(finish.success, true);
assert.ok(finish.restoreReport && finish.restoreReport.sheets.length === exportSheetNames_().length,
  'בסיום מוחזר דוח שלמות לכל הלשוניות ששוחזרו');
const contactsReport = finish.restoreReport.sheets.find(item => item.name === SH.CONTACTS);
assert.deepStrictEqual(
  { expected: contactsReport.expectedRows, restored: contactsReport.restoredRows, verified: contactsReport.verified },
  { expected: 1, restored: 1, verified: true },
  'דוח השלמות משווה בין הכמות בגיבוי לכמות שנכתבה בפועל');
assert.strictEqual(active.data[SH.CONTACTS][1][0], 'חדש');
assert.ok(active.data[SH.CONTACTS][1][5] instanceof Date, 'תאריך מפורש חוזר ל-Date');
assert.strictEqual(active.data[SH.CONTACTS][1][8], "'=לא נוסחה", 'מחרוזת מסוכנת אינה הופכת לנוסחה');
assert.strictEqual(active.data[SH.CONTACTS][0][9], 'שדה אישי', 'עמודה מותאמת נשמרת בשחזור');
assert.strictEqual(active.data[SH.CONTACTS][1][9], 'ערך מותאם', 'ערך בעמודה מותאמת נשמר בשחזור');

const rolled = restoreRollback_({ token: begin.token });
assert.strictEqual(rolled.success, true);
assert.strictEqual(active.data[SH.CONTACTS][1][0], 'ישן', 'החזרה משיבה את המצב שלפני השחזור');

const allKeysManifest = manifest(RESTORE_SYNC_KEYS.slice(), 2);
const allKeysBegin = restoreBegin_({ manifest: allKeysManifest, reqId: 'restore-all-keys' });
for (const name of exportSheetNames_()) {
  const rows = name === SH.CONTACTS ? [Array(seed[name][0].length).fill('')] : [];
  restoreSheet_({ token: allKeysBegin.token, sheet: name, offset: 0, total: rows.length, headers: seed[name][0], rows });
}
RESTORE_SYNC_KEYS.forEach(key => restoreSync_({
  token: allKeysBegin.token,
  key,
  data: key === 'projects' ? [{ id: 'p1', activityIds: ['e1'] }] : { restoredKey: key },
}));
assert.strictEqual(restoreFinish_({ token: allKeysBegin.token }).success, true,
  'כל סוגי נתוני הסנכרון של האפליקציה עוברים שחזור מלא');

assert.throws(() => restoreSheet_({ token: 'missing', sheet: SH.CONTACTS, offset: 0, total: 0, headers: [], rows: [] }), /אינו קיים/);
console.log('✓ שחזור שרת: רשימות מותרות, עותק בטיחות, השלמה והחזרה');
