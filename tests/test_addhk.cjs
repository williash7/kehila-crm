// הוספת הוראת קבע ידנית — כולל ללא הגבלה, וכולל דחיית מזהה כפול
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
global.Logger={log:()=>{}}; global.Session={getScriptTimeZone:()=>'Asia/Jerusalem'};
global.Utilities={formatDate:d=>`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`};
eval(fs.readFileSync(path,'utf8'));
const R=Date; global.Date=class extends R{constructor(...a){return a.length?new R(...a):new R(2026,7,12);}static now(){return new R(2026,7,12).getTime();}};

sheets['הוראות קבע']=makeSheet('הוראות קבע',[['מזהה','שם','תאריך פתיחה','סכום','מספר תשלומים','טלפון','אימייל','קמפיין','תאריך ביטול','הערות']]);
sheets['יומן תרומות ומפגשים']=makeSheet('יומן תרומות ומפגשים',[['מזהה','שם','תאריך תרומה','סכום','ייעוד','אפיק גבייה','תאריך מפגש','מיקום מפגש','מטרת המפגש','סיכום ותובנות','מקור','סטטוס']]);
sheets['אנשי קשר']=makeSheet('אנשי קשר',[['שם מלא','טלפון','אימייל','כתובת','בן/בת זוג','תאריך לידה','תאריך לידה עברי','יארצייט','הערות']]);
sheets['כשלי חיוב']=makeSheet('כשלי חיוב',[['תאריך','שם','מזהה הוראה','סכום','סיבה']]);
sheets['מיפוי שמות']=makeSheet('מיפוי שמות',[['שם שגוי / כפילות','השם התקין']]);

console.log('1. הוראה של 12 תשלומים מ-01/12/2025:');
let r = addStandingOrder_({ name:'תורם ללא מייל', amount:250, startDate:'2025-12-01', payments:12, id:'1999001', phone:'050-1112222' });
console.log('  ', JSON.stringify(r));

console.log('\n2. הוראה ללא הגבלת זמן מ-15/05/2026:');
r = addStandingOrder_({ name:'תורם קבוע', amount:80, startDate:'2026-05-15', unlimited:true, id:'1999002' });
console.log('  ', JSON.stringify(r));

console.log('\n3. אותו מספר הוראה שוב — אמור להידחות:');
r = addStandingOrder_({ name:'מישהו אחר', amount:50, startDate:'2026-01-01', payments:6, id:'1999001' });
console.log('  ', JSON.stringify(r));

console.log('\n4. בלי סכום — אמור להידחות:');
console.log('  ', JSON.stringify(addStandingOrder_({ name:'בלי סכום', payments:12 })));

console.log('\nמה שנוצר:');
getHK_().forEach(h => console.log('  ', JSON.stringify({id:h.id,name:h.name,amount:h.amount,payments:h.payments,unlimited:h.unlimited,paid:h.paid,remaining:h.remaining,active:h.active})));
console.log('\nאנשי קשר שנוצרו:', JSON.stringify(sheets['אנשי קשר'].values.slice(1).map(r=>r.slice(0,2))));
