// ייבוא כספי: מזהים יציבים, דחיות מוסברות, ומנוע חיובים יחיד לאצווה.
const fs = require('fs');
const path = require('path');

let failed = 0;
function ok(c, m) { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failed = 1; }

function makeSheet(name, values) {
  const chain = new Proxy({}, { get: () => () => chain });
  return {
    name, values,
    getName: () => name,
    getLastRow: () => values.length,
    getLastColumn: () => (values[0] ? values[0].length : 0),
    getDataRange: () => ({ getValues: () => values.map(r => r.slice()) }),
    appendRow: r => values.push(r),
    getRange: (r, c, nr, nc) => ({
      setValue: v => { while (values.length < r) values.push([]); values[r - 1][c - 1] = v; return chain; },
      getValues: () => Array.from({ length: nr || 1 }, (_, i) =>
        (values[r - 1 + i] || []).slice(c - 1, c - 1 + (nc || 1))),
      setValues: matrix => {
        matrix.forEach((row, i) => {
          const ri = r - 1 + i;
          while (values.length <= ri) values.push([]);
          row.forEach((v, j) => { values[ri][c - 1 + j] = v; });
        });
        return chain;
      },
    }),
  };
}

const sheets = {};
global.SpreadsheetApp = {
  getActiveSpreadsheet: () => ({ getSheetByName: name => sheets[name] || null }),
};
global.Logger = { log: () => {} };
global.Utilities = {
  formatDate: d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
};
global.Session = { getScriptTimeZone: () => 'Asia/Jerusalem' };

const code = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script', 'Code.gs'), 'utf8');
eval(code);

Object.keys(SH).forEach(key => { sheets[SH[key]] = makeSheet(SH[key], [(COLS[key] || []).slice()]); });
sheets[SH.ALIASES].values.push(['אבי כהן', 'אברהם כהן']);

let generationCalls = 0;
generateStandingOrderCharges = () => { generationCalls++; return 0; };

const payload = {
  contacts: [],
  donations: [
    { name: 'אבי כהן', amount: '₪100', date: '17.08.2026', method: 'מזומן' },
    { name: 'אברהם כהן', amount: '100.00', date: '17/08/2026', method: 'מזומן' },
  ],
  standingOrders: [
    { id: 'X1', name: 'שרה לוי', amount: 50, startDate: '01/08/2026', payments: 12 },
    { id: 'X1', name: 'שרה לוי', amount: 50, startDate: '01/08/2026', payments: 12 },
    { name: 'דוד כהן', amount: '₪75.00', startDate: '02.08.2026', payments: 6 },
  ],
};

console.log('א. ייבוא ראשון:');
const first = importRows_(payload);
ok(first.success === true, 'הייבוא הצליח');
ok(first.added.donations === 2, 'שתי תרומות זהות אמיתיות נשמרו');
ok(first.added.standingOrders === 2, 'מונה הוראות הקבע משקף את הגיליון');
ok(first.rejected.standingOrders.length === 1, 'מזהה ספק כפול דווח כדחייה');
ok(first.rejected.standingOrders[0].id === 'X1' && first.rejected.standingOrders[0].reason, 'הדחייה כוללת מזהה וסיבה');
ok(generationCalls === 1, 'מנוע החיובים רץ פעם אחת לכל האצווה');

const logIds = sheets[SH.LOG].values.slice(1).map(r => r[0]);
ok(logIds.length === 2 && logIds[0] !== logIds[1], 'סיומת סידורית מפרידה רשומות זהות');
ok(logIds.every(id => id.includes('17%2F08%2F2026') && id.includes('10000')), 'שם, תאריך וסכום נורמלו בחתימה');
const orderCount = sheets[SH.HK].values.length - 1;

console.log('\nב. ייבוא חוזר של אותו קובץ:');
const second = importRows_(payload);
ok(second.added.donations === 0 && second.rejected.donations.length === 2, 'התרומות החוזרות לא נוספו שוב');
ok(second.added.standingOrders === 0 && second.rejected.standingOrders.length === 3, 'הוראות הקבע החוזרות לא נוספו שוב');
ok(sheets[SH.LOG].values.length - 1 === 2, 'מספר שורות היומן נשאר קבוע');
ok(sheets[SH.HK].values.length - 1 === orderCount, 'מספר ההוראות נשאר קבוע');
ok(generationCalls === 1, 'כשהכול נדחה המנוע אינו רץ');

console.log('\nג. הוספה רגילה:');
const direct = addStandingOrder_({ id: 'X2', name: 'רחל לוי', amount: 80, startDate: '03/08/2026', payments: 3 });
ok(direct.success === true && generationCalls === 2, 'הוספה רגילה עדיין מפעילה את המנוע מיד');

console.log('\nד. שורות לא תקינות:');
const invalid = importRows_({ donations: [{}], standingOrders: [null] });
const invalidRows = [...invalid.rejected.donations, ...invalid.rejected.standingOrders];
ok(invalidRows.length === 2, 'שורות ריקות אינן נעלמות בשקט');
ok(invalidRows.every(r => (r.name || r.id) && r.reason), 'כל דחייה ניתנת להצגה עם כותרת וסיבה');

console.log('\n✓ מניעת כפילויות וחוזה הדחיות תקינים');
process.exitCode = failed;
