// שינוי סכום של הוראת קבע — התרחיש: התחיל ב-100, עבר ל-300 באמצע
const fs = require('fs');
const path = __dirname + '/../google-apps-script/Code.gs';
function makeSheet(name, values) {
  const chain = new Proxy({}, { get: () => () => chain });
  return { name, values, getName: () => name, getLastRow: () => values.length,
    getLastColumn: () => (values[0] ? values[0].length : 0), getMaxRows: () => values.length + 500,
    getDataRange: () => ({ getValues: () => values.map(r => r.slice()) }),
    setFrozenRows: () => {}, autoResizeColumns: () => {}, appendRow: r => values.push(r), deleteRow: r => values.splice(r-1,1),
    getRange: (r,c,nr,nc) => ({
      setValue: v => { while (values.length<r) values.push([]); values[r-1][c-1]=v; return chain; },
      getValues: () => { const o=[]; for(let i=0;i<(nr||1);i++) o.push((values[r-1+i]||[]).slice(c-1,c-1+(nc||1))); return o; },
      setValues: m => { m.forEach((row,i)=>{const ri=r-1+i; while(values.length<=ri) values.push([]); row.forEach((v,j)=>{values[ri][c-1+j]=v;});}); return chain; },
      setFontWeight:()=>chain,setBackground:()=>chain,setFontColor:()=>chain,
      setItalic:()=>chain,setStrikethrough:()=>chain,setRanges:()=>chain,build:()=>({}) }) };
}
const sheets={};
global.SpreadsheetApp={getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n]||null,getSheets:()=>Object.values(sheets),insertSheet:n=>(sheets[n]=makeSheet(n,[])),deleteSheet:()=>{}}),
  newConditionalFormatRule:()=>{const c=new Proxy({},{get:()=>()=>c});return c;}};
const logs=[]; global.Logger={log:m=>logs.push(String(m))};
global.Session={getScriptTimeZone:()=>'Asia/Jerusalem'};
global.Utilities={formatDate:d=>`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`};
eval(fs.readFileSync(path,'utf8'));
const R=Date;
global.Date=class extends R{constructor(...a){return a.length?new R(...a):new R(2026,7,12);}static now(){return new R(2026,7,12).getTime();}};

sheets['הוראות קבע']=makeSheet('הוראות קבע',[
  ['מזהה','שם','תאריך פתיחה','סכום','מספר תשלומים','טלפון','אימייל','קמפיין','תאריך ביטול','הערות'],
  ['7000001','תורם שהעלה סכום','10/10/2025',100,12,'','','','',''],
]);
sheets['יומן תרומות ומפגשים']=makeSheet('יומן תרומות ומפגשים',[
  ['מזהה','שם','תאריך תרומה','סכום','ייעוד','אפיק גבייה','תאריך מפגש','מיקום מפגש','מטרת המפגש','סיכום ותובנות','מקור','סטטוס'],
]);
sheets['כשלי חיוב']=makeSheet('כשלי חיוב',[['תאריך','שם','מזהה הוראה','סכום','סיבה']]);
sheets['מיפוי שמות']=makeSheet('מיפוי שמות',[['שם שגוי / כפילות','השם התקין']]);

generateStandingOrderCharges();
const rows = () => sheets['יומן תרומות ומפגשים'].values.slice(1)
  .map(r => ({ d: r[2] instanceof R ? `${String(r[2].getDate()).padStart(2,'0')}/${String(r[2].getMonth()+1).padStart(2,'0')}/${r[2].getFullYear()}` : String(r[2]), amt: r[3], st: String(r[11]||'').trim()||'בוצע' }));

console.log('לפני — כל החיובים על ₪100:');
console.log('  ' + rows().map(r=>`${r.d}:₪${r.amt}${r.st!=='בוצע'?'('+r.st+')':''}`).join('  '));

const res = updateStandingOrderAmount_({ id:'7000001', amount:300, date:'2026-02-10' });
console.log('\nתוצאה:', JSON.stringify(res));
console.log('\nאחרי — שינוי ל-₪300 החל מ-10/02/2026:');
console.log('  ' + rows().map(r=>`${r.d}:₪${r.amt}${r.st!=='בוצע'?'('+r.st+')':''}`).join('  '));

const hk = getHK_()[0];
console.log('\nשורת ההוראה: סכום =', hk.amount, '· הערות:', sheets['הוראות קבע'].values[1][9]);
const before = rows().filter(r=>r.amt===100).length, after = rows().filter(r=>r.amt===300).length;
console.log('\nחיובים ב-₪100:', before, '· ב-₪300:', after,
  (before===4 && after===8) ? '✅ ארבעה ראשונים בישן, השאר בחדש' : '❌');
