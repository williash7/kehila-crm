// המקרים האמיתיים מהאפליקציה — לפי הנתונים שנשלחו
const fs = require('fs');
const path = __dirname + '/../google-apps-script/Code.gs';

function makeSheet(name, values) {
  const chain = new Proxy({}, { get: () => () => chain });
  return { name, values,
    getName: () => name, getLastRow: () => values.length,
    getLastColumn: () => (values[0] ? values[0].length : 0), getMaxRows: () => values.length + 500,
    getDataRange: () => ({ getValues: () => values.map(r => r.slice()) }),
    setFrozenRows: () => {}, autoResizeColumns: () => {}, appendRow: r => values.push(r), deleteRow: r => values.splice(r-1,1),
    getRange: (r, c, nr, nc) => ({
      setValue: v => { while (values.length < r) values.push([]); values[r-1][c-1] = v; return chain; },
      getValues: () => { const o=[]; for(let i=0;i<(nr||1);i++) o.push((values[r-1+i]||[]).slice(c-1,c-1+(nc||1))); return o; },
      setValues: m => { m.forEach((row,i)=>{const ri=r-1+i; while(values.length<=ri) values.push([]); row.forEach((v,j)=>{values[ri][c-1+j]=v;});}); return chain; },
      setFontWeight: ()=>chain, setBackground: ()=>chain, setFontColor: ()=>chain,
      setItalic: ()=>chain, setStrikethrough: ()=>chain, setRanges: ()=>chain, build: ()=>({}),
    }) };
}
const sheets = {};
global.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: n => sheets[n]||null, getSheets: ()=>Object.values(sheets), insertSheet: n=>(sheets[n]=makeSheet(n,[])), deleteSheet: ()=>{} }),
  newConditionalFormatRule: () => { const c = new Proxy({}, { get: () => () => c }); return c; } };
global.Logger = { log: ()=>{} };
global.Session = { getScriptTimeZone: () => 'Asia/Jerusalem' };
global.Utilities = { formatDate: d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` };
eval(fs.readFileSync(path,'utf8'));

const R = Date;
global.Date = class extends R { constructor(...a){ return a.length ? new R(...a) : new R(2026,7,12); } static now(){ return new R(2026,7,12).getTime(); } };

sheets['הוראות קבע'] = makeSheet('הוראות קבע', [
  ['מזהה','שם','תאריך פתיחה','סכום','מספר תשלומים','טלפון','אימייל','קמפיין','תאריך ביטול','הערות'],
  ['1853291','יהודה בלוי',           '28/07/2025',   5, 12,'','','','',''],
  ['1863294','חיים דוד וקיילא וילהלם','05/08/2025',  18, 12,'','','','',''],
  ['1853507','ענדי ודבורה לאה קלמן', '28/07/2025', 120, 12,'','','','',''],
  ['1862172','ובר אלחנן',            '04/08/2025',  80, 12,'','','','',''],
  ['9999999','הוראה שבאמת רצה',      '10/03/2026', 200, 12,'','','','',''],
  ['2112098','חונוביץי אלה',         '28/01/2026', 300, 'ללא הגבלה','','','','',''],
]);
sheets['יומן תרומות ומפגשים'] = makeSheet('יומן תרומות ומפגשים', [
  ['מזהה','שם','תאריך תרומה','סכום','ייעוד','אפיק גבייה','תאריך מפגש','מיקום מפגש','מטרת המפגש','סיכום ותובנות','מקור','סטטוס'],
]);
sheets['כשלי חיוב'] = makeSheet('כשלי חיוב', [['תאריך','שם','מזהה הוראה','סכום','סיבה']]);
sheets['מיפוי שמות'] = makeSheet('מיפוי שמות', [['שם שגוי / כפילות','השם התקין']]);

generateStandingOrderCharges();

// מסמנים ככשלים את מה שלא נגבה בפועל, לפי "חיוב אחרון" שדווח מהאפליקציה
const lastOk = { '1853291':'28/08/2025', '1863294':'05/04/2026', '1853507':'28/06/2026', '1862172':'04/09/2025' };
const log = sheets['יומן תרומות ומפגשים'].values;
const parse = s => { const [d,m,y]=s.split('/').map(Number); return new R(y,m-1,d); };
for (let i=1;i<log.length;i++){
  const id = String(log[i][0]);
  const order = id.split(':')[1];
  if (!lastOk[order]) continue;
  const d = log[i][2] instanceof R ? log[i][2] : parse(String(log[i][2]));
  if (d > parse(lastOk[order])) log[i][11] = 'נכשל';
}

console.log('הוראה                      | פתיחה      | חיוב אחרון | שולמו | נותרו | סטטוס');
console.log('─'.repeat(92));
getHK_().forEach(h => {
  const st = h.cancelDate ? 'בוטלה' : h.unlimited ? 'פעילה · ללא הגבלת זמן' : h.remaining === 0 ? 'הסתיימה' : h.remaining <= 2 ? 'מסתיימת בקרוב' : 'פעילה';
  console.log(
    h.name.padEnd(26).slice(0,26) + '| ' + String(h.startDate).padEnd(11) + '| ' +
    String(h.lastBilled||'—').padEnd(11) + '| ' + String(h.paid).padStart(5) + ' | ' +
    String(h.remaining).padStart(5) + ' | ' + st + (h.unlimited ? '' : ''));
});
