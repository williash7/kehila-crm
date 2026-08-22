// בדיקה: החוזה בין הפרומפט שהאפליקציה מייצרת לבין importRows_ בשרת.
// אם ה-AI יחזיר בדיוק את המבנה שהפרומפט מבקש — האם השרת קולט אותו נכון?

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
      getValues: () => {
        const out = [];
        for (let i = 0; i < (nr || 1); i++) out.push((values[r - 1 + i] || []).slice(c - 1, c - 1 + (nc || 1)));
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
global.Utilities = { formatDate: (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` };
global.Session = { getScriptTimeZone: () => 'Asia/Jerusalem' };

eval(fs.readFileSync(path, 'utf8'));

sheets['אנשי קשר'] = makeSheet('אנשי קשר', [
  ['שם מלא', 'טלפון', 'אימייל', 'כתובת', 'בן/בת זוג', 'תאריך לידה', 'תאריך לידה עברי', 'יארצייט', 'הערות'],
]);
sheets['יומן תרומות ומפגשים'] = makeSheet('יומן תרומות ומפגשים', [
  ['מזהה', 'שם', 'תאריך תרומה', 'סכום', 'ייעוד', 'אפיק גבייה',
   'תאריך מפגש', 'מיקום מפגש', 'מטרת המפגש', 'סיכום ותובנות', 'מקור', 'סטטוס'],
]);
sheets['הוראות קבע'] = makeSheet('הוראות קבע', [
  ['מזהה', 'שם', 'תאריך פתיחה', 'סכום', 'מספר תשלומים', 'טלפון', 'אימייל', 'קמפיין', 'תאריך ביטול', 'הערות'],
]);
sheets['כשלי חיוב'] = makeSheet('כשלי חיוב', [['תאריך', 'שם', 'מזהה הוראה', 'סכום', 'סיבה']]);
sheets['מיפוי שמות'] = makeSheet('מיפוי שמות', [['שם שגוי / כפילות', 'השם התקין']]);

// ── בדיוק המבנה שהפרומפט באפליקציה מבקש מה-AI ────────────────────────────────
const aiOutput = `הנה התוצאה שביקשת:

\`\`\`json
{
  "contacts": [
    { "שם מלא": "ישראל ישראלי", "טלפון": "050-1234567", "כתובת": "הרצל 5", "בן/בת זוג": "שרה", "הערות": "מכיר מהשכונה" },
    { "שם מלא": "רבקה לוי", "טלפון": "052-9876543", "כתובת": "", "מקצוע": "מורה" }
  ],
  "donations": [
    { "name": "ישראל ישראלי", "amount": 500, "date": "15/05/2026", "method": "מזומן", "purpose": "תרומה כללית", "notes": "" },
    { "name": "רבקה לוי", "amount": 180, "date": "01/06/2026", "method": "ביט/פייבוקס", "purpose": "לוח שנה" }
  ],
  "standingOrders": [
    { "name": "דוד כהן", "amount": 100, "startDate": "01/09/2025", "payments": 12, "phone": "054-1112222", "campaign": "בניין" }
  ],
  "items": [
    { "text": "להתקשר לישראל", "targetKind": "contact", "targetLabel": "ישראל ישראלי" }
  ]
}
\`\`\`

בהצלחה!`;

// אותה חילוץ שהאפליקציה עושה
const fence = aiOutput.match(/```(?:json)?\s*([\s\S]*?)```/);
const parsed = JSON.parse((fence ? fence[1] : aiOutput).trim());

const res = importRows_({
  contacts: parsed.contacts,
  donations: parsed.donations,
  standingOrders: parsed.standingOrders,
});

console.log('תוצאת הייבוא:', JSON.stringify(res.added), '· תווית:', res.tag);
console.log('\nאנשי קשר בגיליון:');
sheets['אנשי קשר'].values.forEach((r, i) => console.log('  ', i === 0 ? r.join(' | ') : r.join(' | ')));
console.log('\nיומן:');
sheets['יומן תרומות ומפגשים'].values.slice(1).forEach(r => console.log('  ', r[0], '|', r[1], '|', r[2], '|', r[3], '|', r[5], '|', r[10]));
console.log('\nהוראות קבע:');
sheets['הוראות קבע'].values.slice(1).forEach(r => console.log('  ', r.slice(0, 5).join(' | ')));

const beforeUndo = sheets['יומן תרומות ומפגשים'].values.length - 1;
const deleted = undoImport(res.tag);
const afterUndo = sheets['יומן תרומות ומפגשים'].values.length - 1;
console.log('\nביטול ייבוא: נמחקו', deleted, '| שורות ביומן לפני:', beforeUndo, 'אחרי:', afterUndo);
console.log('(חיובי ההוראה שנשארו הם הצפויים — הביטול לא נוגע בהוראות קבע)');
console.log('\nלוג:', logs.join(' | '));
