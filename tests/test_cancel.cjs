// בדיקה: מנוע הוראות הקבע מול תרחיש הסירוב-ביום-ההקמה וביטול ידני.
// מדמה את Apps Script במידה המינימלית שנדרשת ל-generateStandingOrderCharges.

const fs = require('fs');
const path = __dirname + '/../google-apps-script/Code.gs';

// ── מוק גיליון ──────────────────────────────────────────────────────────────
function makeSheet(name, values) {
  const chain = new Proxy({}, { get: () => () => chain });
  return {
    name,
    values,
    getName: () => name,
    getLastRow: () => values.length,
    getLastColumn: () => (values[0] ? values[0].length : 0),
    getMaxRows: () => values.length + 500,
    getDataRange: () => ({ getValues: () => values.map(r => r.slice()) }),
    setFrozenRows: () => {}, autoResizeColumns: () => {},
    appendRow: (r) => values.push(r),
    getRange: (r, c, nr, nc) => ({
      setValue: (v) => { while (values.length < r) values.push([]); values[r - 1][c - 1] = v; return chain; },
      getValues: () => {
        const out = [];
        for (let i = 0; i < (nr || 1); i++) {
          const row = values[r - 1 + i] || [];
          out.push(row.slice(c - 1, c - 1 + (nc || 1)));
        }
        return out;
      },
      setValues: (m) => {
        m.forEach((row, i) => {
          const ri = r - 1 + i;
          while (values.length <= ri) values.push([]);
          row.forEach((v, j) => { values[ri][c - 1 + j] = v; });
        });
        return chain;
      },
      setFontWeight: () => chain, setBackground: () => chain,
      setFontColor: () => chain, setItalic: () => chain, setStrikethrough: () => chain,
      setRanges: () => chain, build: () => ({}),
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
global.Utilities = { formatDate: (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` };
global.Session = { getScriptTimeZone: () => 'Asia/Jerusalem' };

// ── טעינת הקוד ──────────────────────────────────────────────────────────────
eval(fs.readFileSync(path, 'utf8'));

// ── נתוני הבדיקה ────────────────────────────────────────────────────────────
// היום מדומיין כ-12/08/2026 — 11 חודשים אחרי ההקמה.
const REAL_DATE = Date;
global.Date = class extends REAL_DATE {
  constructor(...a) { return a.length ? new REAL_DATE(...a) : new REAL_DATE(2026, 7, 12); }
  static now() { return new REAL_DATE(2026, 7, 12).getTime(); }
};

sheets['הוראות קבע'] = makeSheet('הוראות קבע', [
  ['מזהה', 'שם', 'תאריך פתיחה', 'סכום', 'מספר תשלומים', 'טלפון', 'אימייל', 'קמפיין', 'תאריך ביטול', 'הערות'],
  // 1. סורבה ביום ההקמה — אמורה להתבטל אוטומטית
  ['1911716', 'אילון מדיה', '08/09/2025', 100, 12, '054-2217770', '', 'חבד בעליה', '', ''],
  // 2. תקינה לגמרי
  ['2000001', 'תורם תקין', '08/09/2025', 200, 12, '', '', '', '', ''],
  // 3. בוטלה ידנית אחרי 3 חיובים
  ['3000001', 'תורם שביטל', '08/09/2025', 12, 12, '', '', '', '08/12/2025', ''],
  // 4+5. אותו אדם בדיוק, שתי הוראות נפרדות
  ['4000001', 'ישראל ישראלי', '05/10/2025', 300, 12, '', '', '', '', ''],
  ['4000002', 'ישראל ישראלי', '05/02/2026', 150, 12, '', '', '', '', ''],
]);
sheets['יומן תרומות ומפגשים'] = makeSheet('יומן תרומות ומפגשים', [
  ['מזהה', 'שם', 'תאריך תרומה', 'סכום', 'ייעוד', 'אפיק גבייה',
   'תאריך מפגש', 'מיקום מפגש', 'מטרת המפגש', 'סיכום ותובנות', 'מקור', 'סטטוס'],
]);
sheets['כשלי חיוב'] = makeSheet('כשלי חיוב', [
  ['תאריך', 'שם', 'מזהה הוראה', 'סכום', 'סיבה'],
  [new REAL_DATE(2025, 8, 8, 22, 14), 'אילון מדיה', '1911716', '100.00', 'סירוב - מסגרת מלאה'],
]);
sheets['מיפוי שמות'] = makeSheet('מיפוי שמות', [['שם שגוי / כפילות', 'השם התקין']]);

// שלב א': הגיליון כפי שהוא היום — 12 חיובים "בוצעו" לכל הוראה, כולל המתות.
generateStandingOrderCharges();
console.log('--- לפני הביטול (המצב הקיים בגיליון) ---');
console.log('סה"כ שורות ביומן:', sheets['יומן תרומות ומפגשים'].values.length - 1);

// שלב ב': עכשיו מוסיפים תאריך ביטול רטרואקטיבי להוראה שכבר יש לה 12 חיובים.
sheets['הוראות קבע'].values[2][8] = '08/01/2026';  // תורם תקין ביטל בינואר
_logIds = null;
generateStandingOrderCharges();
const afterFirst = JSON.stringify(sheets['יומן תרומות ומפגשים'].values);
_logIds = null;
generateStandingOrderCharges();
const afterSecond = JSON.stringify(sheets['יומן תרומות ומפגשים'].values);

// ── תוצאות ──────────────────────────────────────────────────────────────────
const hk = getHK_();
const byOrder = {};
sheets['יומן תרומות ומפגשים'].values.slice(1).forEach(r => {
  const order = String(r[0]).split(':')[1];
  const st = String(r[11] || '').trim() || '(בוצע)';
  byOrder[order] = byOrder[order] || {};
  byOrder[order][st] = (byOrder[order][st] || 0) + 1;
});

console.log('ביטול אוטומטי — תאריך ביטול שנרשם:',
  sheets['הוראות קבע'].values[1][8], '|', sheets['הוראות קבע'].values[1][9]);
console.log('\nחיובים ביומן לפי הוראה:');
Object.keys(byOrder).forEach(o => console.log('  ' + o + ':', JSON.stringify(byOrder[o])));
console.log('\nמה האפליקציה מקבלת:');
hk.forEach(h => console.log('  ' + h.id, '| נותרו:', h.remaining, '| פעיל:', h.active, '| בוטל:', h.cancelDate || '—'));
console.log('\nכסף שנספר לכל הוראה:');
const charges = chargesByOrder_();
Object.keys(charges).forEach(o => console.log('  ' + o + ':', charges[o].count, 'חיובים'));
console.log('\nאידמפוטנטי:', afterFirst === afterSecond ? '✅ כן' : '❌ לא');

// ── שלב ג': ביטול והחזרה דרך פעולת האפליקציה ────────────────────────────────
console.log('\n--- דרך האפליקציה ---');
let r = cancelStandingOrder_({ id: '3000001', date: '', reason: '' });   // החזרת הוראה
_logIds = null; generateStandingOrderCharges();
console.log('החזרת 3000001:', JSON.stringify(r), '→ חיובים:', chargesByOrder_()['3000001'].count);

r = cancelStandingOrder_({ id: '3000001', date: '2025-11-08', reason: 'בקשת התורם' });
_logIds = null; generateStandingOrderCharges();
console.log('ביטול מ-08/11/2025:', JSON.stringify(r), '→ חיובים:', chargesByOrder_()['3000001'].count);
console.log('הערה שנשמרה:', sheets['הוראות קבע'].values[3][9]);

// ── שלב ד': החזרת הוראה שבוטלה אוטומטית — אסור שתתבטל שוב ──────────────────
cancelStandingOrder_({ id: '1911716', date: '', reason: '' });
_logIds = null; generateStandingOrderCharges();
const auto = sheets['הוראות קבע'].values[1];
console.log('\nהחזרת ההוראה שבוטלה אוטומטית:');
console.log('  תאריך ביטול אחרי 2 ריצות:', auto[8] || '(ריק — נשארה מוחזרת ✅)');
console.log('  חיובים שנוצרו לה:', (chargesByOrder_()['1911716'] || {count:0}).count);
console.log('  הערה:', auto[9]);
console.log('לוג:', logs.join(' | '));


// ── שלב ה': ביטול אצל אדם עם שתי הוראות — האם השנייה נפגעת? ────────────────
console.log('\n--- אותו אדם, שתי הוראות ---');
const show = () => getHK_().filter(h => h.name === 'ישראל ישראלי')
  .map(h => `#${h.id} ₪${h.amount} ${h.active ? 'פעילה' : 'לא פעילה'}${h.cancelDate ? ' (בוטלה ' + h.cancelDate + ')' : ''} · חיובים: ${(chargesByOrder_()[h.id]||{count:0}).count}`);
console.log('לפני: ', show().join('\n       '));

cancelStandingOrder_({ id: '4000001', date: '2026-03-05', reason: 'בקשת התורם' });
_logIds = null; generateStandingOrderCharges();
console.log('\nאחרי ביטול #4000001 בלבד:');
console.log('       ' + show().join('\n       '));
