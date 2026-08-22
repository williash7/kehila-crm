// בדיקה: זיהוי תאריך הכתיבה לרבי — ובעיקר שהוא לא דורס הקלדה ידנית מאוחרת יותר.

const fs = require('fs');
const path = __dirname + '/../google-apps-script/Code.gs';

function makeSheet(name, values) {
  const chain = new Proxy({}, { get: () => () => chain });
  return {
    name, values,
    getName: () => name,
    getLastRow: () => values.length,
    getLastColumn: () => (values[0] ? values[0].length : 0),
    getMaxRows: () => values.length + 500,
    getDataRange: () => ({ getValues: () => values.map(r => r.slice()) }),
    setFrozenRows: () => {}, autoResizeColumns: () => {},
    appendRow: (r) => values.push(r),
    deleteRow: (r) => values.splice(r - 1, 1),
    getRange: (r, c, nr, nc) => ({
      setValue: (v) => { while (values.length < r) values.push([]); values[r - 1][c - 1] = v; return chain; },
      getValues: () => { const o = []; for (let i = 0; i < (nr || 1); i++) o.push((values[r-1+i]||[]).slice(c-1, c-1+(nc||1))); return o; },
      setValues: (m) => { m.forEach((row, i) => { const ri = r-1+i; while (values.length <= ri) values.push([]); row.forEach((v, j) => { values[ri][c-1+j] = v; }); }); return chain; },
      setFontWeight: () => chain, setBackground: () => chain, setFontColor: () => chain,
      setItalic: () => chain, setStrikethrough: () => chain, setRanges: () => chain, build: () => ({}),
    }),
  };
}

const sheets = {};
global.SpreadsheetApp = {
  getActiveSpreadsheet: () => ({
    getSheetByName: (n) => sheets[n] || null,
    getSheets: () => Object.values(sheets),
    insertSheet: (n) => (sheets[n] = makeSheet(n, [])),
    deleteSheet: () => {},
  }),
  newConditionalFormatRule: () => { const c = new Proxy({}, { get: () => () => c }); return c; },
};
const logs = [];
global.Logger = { log: (m) => logs.push(String(m)) };
global.Session = { getScriptTimeZone: () => 'Asia/Jerusalem' };
global.Utilities = {
  formatDate: (d, tz, fmt) => fmt === 'yyyy-MM-dd'
    ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`,
};

// ── מוק ג'ימייל: מייל אחד שנשלח לאוהל ──────────────────────────────────────
let sentDate = new Date(2026, 7, 10);   // 10/08/2026
let searched = '';
global.GmailApp = {
  search: (q) => { searched = q; return [{ getMessages: () => [{ getDate: () => sentDate }] }]; },
};

eval(fs.readFileSync(path, 'utf8'));

sheets['סנכרון נתונים'] = makeSheet('סנכרון נתונים', [['מפתח', 'ערך']]);

const read = () => readSync_('rebbeDate') || '(ריק)';

console.log('שאילתת החיפוש:', searched || '(עוד לא רץ)');

// ── 1. אין תאריך רשום — נלקח מהמייל ────────────────────────────────────────
syncRebbeDate_();
console.log('\n1. גיליון ריק + מייל מ-10/08/2026');
console.log('   →', read(), sheets['סנכרון נתונים'].values.length === 2 ? '✅' : '❌');
console.log('   שאילתה:', searched);

// ── 2. הרצה חוזרת על אותו מייל — לא משנה כלום ──────────────────────────────
const before = JSON.stringify(sheets['סנכרון נתונים'].values);
syncRebbeDate_();
console.log('\n2. הרצה חוזרת (אותו מייל)');
console.log('   →', read(), before === JSON.stringify(sheets['סנכרון נתונים'].values) ? '✅ לא השתנה' : '❌ השתנה');

// ── 3. הקלדה ידנית מאוחרת יותר — המייל הישן לא דורס ────────────────────────
writeSync_('rebbeDate', '2026-08-12');   // המשתמש הקליד 12/08
syncRebbeDate_();                         // המייל עדיין מ-10/08
console.log('\n3. הוקלד ידנית 12/08/2026, המייל מ-10/08/2026');
console.log('   →', read(), read() === '2026-08-12' ? '✅ ההקלדה הידנית שרדה' : '❌ נדרסה');

// ── 4. נשלח מייל חדש — כן מעדכן ────────────────────────────────────────────
sentDate = new Date(2026, 7, 20);   // 20/08/2026
syncRebbeDate_();
console.log('\n4. נשלח מייל חדש ב-20/08/2026');
console.log('   →', read(), read() === '2026-08-20' ? '✅ עודכן' : '❌ לא עודכן');

// ── 5. אין מיילים בכלל — לא קורס ───────────────────────────────────────────
global.GmailApp.search = () => [];
const r5 = syncRebbeDate_();
console.log('\n5. אין אף מייל לאוהל');
console.log('   →', r5 === null ? '✅ חזר null בלי לקרוס' : '❌', '· התאריך נשאר', read());

// ── 6. ג'ימייל זורק שגיאה (אין הרשאה) — הריצה היומית לא נופלת ──────────────
global.GmailApp.search = () => { throw new Error('אין הרשאה'); };
const r6 = syncRebbeDate_();
console.log('\n6. ג\'ימייל זורק שגיאה');
console.log('   →', r6 === null ? '✅ נבלע בשקט' : '❌', '· התאריך נשאר', read());

console.log('\nלוג:', logs.join(' | '));
