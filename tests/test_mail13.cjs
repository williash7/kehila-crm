const fs=require('fs');
const path=__dirname + '/../google-apps-script/Code.gs';
function mk(n,v){const c=new Proxy({},{get:()=>()=>c});return{name:n,values:v,getName:()=>n,getLastRow:()=>v.length,
 getLastColumn:()=>(v[0]?v[0].length:0),getMaxRows:()=>v.length+500,getDataRange:()=>({getValues:()=>v.map(r=>r.slice())}),
 setFrozenRows:()=>{},autoResizeColumns:()=>{},appendRow:r=>v.push(r),deleteRow:r=>v.splice(r-1,1),
 getRange:(r,cc,nr,nc)=>({setValue:x=>{while(v.length<r)v.push([]);v[r-1][cc-1]=x;return c;},
  getValues:()=>{const o=[];for(let i=0;i<(nr||1);i++)o.push((v[r-1+i]||[]).slice(cc-1,cc-1+(nc||1)));return o;},
  setValues:m=>{m.forEach((row,i)=>{const ri=r-1+i;while(v.length<=ri)v.push([]);row.forEach((x,j)=>{v[ri][cc-1+j]=x;});});return c;},
  setFontWeight:()=>c,setBackground:()=>c,setFontColor:()=>c,setItalic:()=>c,setStrikethrough:()=>c,setRanges:()=>c,build:()=>({})})};}
const sheets={};
global.SpreadsheetApp={getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n]||null,getSheets:()=>Object.values(sheets),insertSheet:n=>(sheets[n]=mk(n,[])),deleteSheet:()=>{}}),
 newConditionalFormatRule:()=>{const c=new Proxy({},{get:()=>()=>c});return c;}};
const logs=[]; global.Logger={log:m=>logs.push(String(m))};
global.Session={getScriptTimeZone:()=>'Asia/Jerusalem'};
global.Utilities={formatDate:d=>`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`};
eval(fs.readFileSync(path,'utf8'));

sheets['הוראות קבע']=mk('הוראות קבע',[['מזהה','שם','תאריך פתיחה','סכום','מספר תשלומים','טלפון','אימייל','קמפיין','תאריך ביטול','הערות']]);
sheets['יומן תרומות ומפגשים']=mk('יומן תרומות ומפגשים',[['מזהה','שם','תאריך תרומה','סכום','ייעוד','אפיק גבייה','תאריך מפגש','מיקום מפגש','מטרת המפגש','סיכום ותובנות','מקור','סטטוס']]);
sheets['אנשי קשר']=mk('אנשי קשר',[['שם מלא','טלפון','אימייל','כתובת','בן/בת זוג','תאריך לידה','תאריך לידה עברי','יארצייט','הערות']]);
sheets['מיפוי שמות']=mk('מיפוי שמות',[['שם שגוי / כפילות','השם התקין']]);
sheets['כללי מייל']=mk('כללי מייל',[['פעיל','שם הכלל','חיפוש בגימייל','סוג','שדות (JSON)']]);
seedNedarimRules_(); flushWrites_();

const t = table_('כללי מייל');
const rule = t.rows.find(r => String(r[3]).trim()==='donation');
const f = JSON.parse(rule[4]);
console.log('שדות הכלל:', JSON.stringify(f));

const BODY = cleanBody_(`שלום רב,

להלן פרטי העסקה שנתקבלה במערכת עבור מרכז חב"ד עפולה:

תאריך עסקה: 13/08/2026 10:49
מספר זהות: 314103581
שם: זילברמן סטניסלב
כתובת: עמק הזיתים 7א חיפה
טלפון: 0546206509
מייל: drums7612@gmail.com נשלח אישור ביצוע
סכום: 300.00 ₪
תשלומים: 1
קטגוריה: לוח שנה - חבד בעליה
הערות:
4 ספרות אחרונות: 8335
מותג: ביט
מספר אישור: 434279
מיקום מסוף: Online`);

console.log('\nמה שהפרסר מוציא:');
Object.keys(f).forEach(k => console.log('  ' + k.padEnd(10), '→', JSON.stringify(field_(BODY, f[k]))));

const ok = handleDonationEmail_(BODY, new Date(2026,7,13,10,49), f);
flushWrites_();
console.log('\nנרשם?', ok ? '✅ כן' : '❌ לא');
sheets['יומן תרומות ומפגשים'].values.slice(1).forEach(r=>console.log('  ', r[0],'|',r[1],'|',r[2],'| ₪'+r[3],'|',r[4],'|',r[5]));
console.log('\nלוג:', logs.join(' | ') || '(ריק)');
