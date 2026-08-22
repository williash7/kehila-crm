// המייל האמיתי שלא נכנס — מקצה לקצה, דרך כללי המייל שבגיליון
const fs = require('fs');
const path = __dirname + '/../google-apps-script/Code.gs';

function makeSheet(name, values) {
  const chain = new Proxy({}, { get: () => () => chain });
  return { name, values, getName: () => name, getLastRow: () => values.length,
    getLastColumn: () => (values[0] ? values[0].length : 0), getMaxRows: () => values.length + 500,
    getDataRange: () => ({ getValues: () => values.map(r => r.slice()) }),
    setFrozenRows: () => {}, autoResizeColumns: () => {}, appendRow: r => values.push(r), deleteRow: r => values.splice(r-1,1),
    getRange: (r, c, nr, nc) => ({
      setValue: v => { while (values.length < r) values.push([]); values[r-1][c-1] = v; return chain; },
      getValues: () => { const o=[]; for(let i=0;i<(nr||1);i++) o.push((values[r-1+i]||[]).slice(c-1,c-1+(nc||1))); return o; },
      setValues: m => { m.forEach((row,i)=>{const ri=r-1+i; while(values.length<=ri) values.push([]); row.forEach((v,j)=>{values[ri][c-1+j]=v;});}); return chain; },
      setFontWeight: ()=>chain, setBackground: ()=>chain, setFontColor: ()=>chain,
      setItalic: ()=>chain, setStrikethrough: ()=>chain, setRanges: ()=>chain, build: ()=>({}) }) };
}
const sheets = {};
global.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: n=>sheets[n]||null, getSheets: ()=>Object.values(sheets), insertSheet: n=>(sheets[n]=makeSheet(n,[])), deleteSheet: ()=>{} }),
  newConditionalFormatRule: () => { const c = new Proxy({}, { get: () => () => c }); return c; } };
const logs=[]; global.Logger = { log: m => logs.push(String(m)) };
global.Session = { getScriptTimeZone: () => 'Asia/Jerusalem' };
global.Utilities = { formatDate: d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` };

const BODY = `שלום רב,

להלן פרטי ההוראה שהוקמה עבור מרכז חב"ד עפולה:

מספר הוראה: 2112098
מספר זהות: 332303643
שם תורם: חונוביץי אלה
כתובת: ירושלים
עיר: עפולה
טלפון: 054-4804024
מייל: hunovich82@gmail.com
סכום כל חיוב: 300.00 ש"ח
תאריך חיוב הבא: 28/01/2026
תדירות גביה: חודשי
מס' חיובים: ללא הגבלה
באמצעות כרטיס: *********9790
קטגוריה: חבד בעליה
הערות:
מיקום מסוף: Online`;

const label = { getName: () => 'לוח בקרה — נקלט' };
let served = false;
global.GmailApp = {
  getUserLabelByName: () => label, createLabel: () => label,
  search: (q) => {
    if (!/הוראת קבע חדשה/.test(q) || served) return [];
    served = true;
    return [{ getMessages: () => [{ getPlainBody: () => BODY, getDate: () => new Date(2026,0,28,20,49) }], addLabel: () => {} }];
  },
};

eval(fs.readFileSync(path,'utf8'));
const R = Date;
global.Date = class extends R { constructor(...a){ return a.length ? new R(...a) : new R(2026,7,12); } static now(){ return new R(2026,7,12).getTime(); } };

const ss = SpreadsheetApp.getActiveSpreadsheet();
ensureSheet_(ss, SH.CONTACTS, COLS.CONTACTS);
ensureSheet_(ss, SH.LOG, COLS.LOG);
ensureSheet_(ss, SH.HK, COLS.HK);
ensureSheet_(ss, SH.FAILURES, COLS.FAILURES);
ensureSheet_(ss, SH.ALIASES, COLS.ALIASES);
ensureSheet_(ss, SH.RULES, COLS.RULES);
ensureSheet_(ss, SH.SYNC, COLS.SYNC);
seedNedarimRules_();
flushWrites_();

const res = syncEmails(true);
console.log('תוצאת הסריקה:', JSON.stringify(res));
console.log('\nשורת הוראת הקבע שנוצרה:');
const hkRows = sheets['הוראות קבע'].values;
console.log('  ' + hkRows[0].slice(0,6).join(' | '));
hkRows.slice(1).forEach(r => console.log('  ' + r.slice(0,6).join(' | ')));

console.log('\nמה האפליקציה מקבלת:');
getHK_().forEach(h => console.log('  ', JSON.stringify({
  id:h.id, name:h.name, amount:h.amount, payments:h.payments,
  unlimited:h.unlimited, paid:h.paid, remaining:h.remaining, active:h.active })));

const paid = sheets['יומן תרומות ומפגשים'].values.slice(1);
console.log('\nחיובים שנוצרו ביומן:', paid.length,
  '· מהם עתידיים:', paid.filter(r=>String(r[11]).trim()==='עתידי').length);
console.log('  ראשון:', paid[0] && paid[0][2], '· אחרון:', paid[paid.length-1] && paid[paid.length-1][2]);
console.log('\nאיש הקשר שנוצר:', JSON.stringify(sheets['אנשי קשר'].values.slice(1).map(r=>r.slice(0,4))));
