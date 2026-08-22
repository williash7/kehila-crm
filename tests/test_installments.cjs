// שני מיילים במבנה זהה, משמעות הפוכה:
//  א. תרומה חד-פעמית בתשלומי אשראי — חייבת להירשם
//  ב. עסקה שהיא בעצם הוראת קבע שכבר רשומה — אסור שתירשם שוב
const fs=require('fs');
const path=__dirname + '/../google-apps-script/Code.gs';
function makeSheet(n,v){const c=new Proxy({},{get:()=>()=>c});return{name:n,values:v,getName:()=>n,getLastRow:()=>v.length,
 getLastColumn:()=>(v[0]?v[0].length:0),getMaxRows:()=>v.length+500,getDataRange:()=>({getValues:()=>v.map(r=>r.slice())}),
 setFrozenRows:()=>{},autoResizeColumns:()=>{},appendRow:r=>v.push(r),deleteRow:r=>v.splice(r-1,1),
 getRange:(r,cc,nr,nc)=>({setValue:x=>{while(v.length<r)v.push([]);v[r-1][cc-1]=x;return c;},
  getValues:()=>{const o=[];for(let i=0;i<(nr||1);i++)o.push((v[r-1+i]||[]).slice(cc-1,cc-1+(nc||1)));return o;},
  setValues:m=>{m.forEach((row,i)=>{const ri=r-1+i;while(v.length<=ri)v.push([]);row.forEach((x,j)=>{v[ri][cc-1+j]=x;});});return c;},
  setFontWeight:()=>c,setBackground:()=>c,setFontColor:()=>c,setItalic:()=>c,setStrikethrough:()=>c,setRanges:()=>c,build:()=>({})})};}
const sheets={};
global.SpreadsheetApp={getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n]||null,getSheets:()=>Object.values(sheets),insertSheet:n=>(sheets[n]=makeSheet(n,[])),deleteSheet:()=>{}}),
 newConditionalFormatRule:()=>{const c=new Proxy({},{get:()=>()=>c});return c;}};
const logs=[]; global.Logger={log:m=>logs.push(String(m))};
global.Session={getScriptTimeZone:()=>'Asia/Jerusalem'};
global.Utilities={formatDate:d=>`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`};
eval(fs.readFileSync(path,'utf8'));
const R=Date; global.Date=class extends R{constructor(...a){return a.length?new R(...a):new R(2026,7,12);}static now(){return new R(2026,7,12).getTime();}};

sheets['הוראות קבע']=makeSheet('הוראות קבע',[
  ['מזהה','שם','תאריך פתיחה','סכום','מספר תשלומים','טלפון','אימייל','קמפיין','תאריך ביטול','הערות'],
  // הוראת קבע ותיקה של אותו אדם, ₪100 לחודש — מלכודת לתנאי התאריך
  ['1800001','שמואל ודקלה מולא','01/01/2024',100,12,'','','','',''],
  // הוראת קבע שנפתחה בסמוך לעסקה ב', באותו סכום חודשי
  ['1900002','תורם עם הוראת קבע','05/03/2026',150,12,'','','','',''],
]);
sheets['יומן תרומות ומפגשים']=makeSheet('יומן תרומות ומפגשים',[['מזהה','שם','תאריך תרומה','סכום','ייעוד','אפיק גבייה','תאריך מפגש','מיקום מפגש','מטרת המפגש','סיכום ותובנות','מקור','סטטוס']]);
sheets['אנשי קשר']=makeSheet('אנשי קשר',[['שם מלא','טלפון','אימייל','כתובת','בן/בת זוג','תאריך לידה','תאריך לידה עברי','יארצייט','הערות']]);
sheets['כשלי חיוב']=makeSheet('כשלי חיוב',[['תאריך','שם','מזהה הוראה','סכום','סיבה']]);
sheets['מיפוי שמות']=makeSheet('מיפוי שמות',[['שם שגוי / כפילות','השם התקין']]);

const f = { name:'שם:', amount:'סכום:', date:'תאריך עסקה:', id:'מספר אישור:',
            purpose:'קטגוריה:', phone:'טלפון:', address:'כתובת:', payments:'תשלומים:' };

const mailA = `תאריך עסקה: 31/07/2025 17:47
מספר זהות: 060511144
שם: שמואל ודקלה מולא
כתובת: יוספטל 15 עפולה
טלפון: 0523695566
סכום: 1200.00 ₪
תשלומים: 12
קטגוריה: חבד בעליה
מספר אישור: 016450`;

const mailB = `תאריך עסקה: 05/03/2026 10:00
שם: תורם עם הוראת קבע
טלפון: 050-0000000
סכום: 1800.00 ₪
תשלומים: 12
קטגוריה: חבד בעליה
מספר אישור: 777777`;

console.log('א. תרומה בתשלומים בלי הוראת קבע תואמת (₪1,200 ב-12):');
console.log('   נרשם?', handleDonationEmail_(mailA, new R(2025,6,31), f) ? '✅ כן' : '❌ לא');

console.log('\nב. עסקה שהיא בעצם ההוראה #1900002 (₪1,800 ב-12 = ₪150 לחודש, אותו שבוע):');
console.log('   נרשם?', handleDonationEmail_(mailB, new R(2026,2,5), f) ? '❌ כן — ספירה כפולה' : '✅ לא, כצפוי');

flushWrites_();
console.log('\nמה שנכנס ליומן:');
sheets['יומן תרומות ומפגשים'].values.slice(1).forEach(r =>
  console.log('  ', r[1], '| ₪' + r[3], '|', r[2], '|', r[9] || '—'));
console.log('\nסה"כ ביומן:', getDonations_().reduce((s,d)=>s+d.amount,0), '₪');
