// עריכה ומחיקה של שורה ביומן
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
global.Logger={log:()=>{}}; global.Session={getScriptTimeZone:()=>'Asia/Jerusalem'};
global.Utilities={formatDate:d=>`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`};
eval(fs.readFileSync(path,'utf8'));

sheets['יומן תרומות ומפגשים']=mk('יומן תרומות ומפגשים',[
  ['מזהה','שם','תאריך תרומה','סכום','ייעוד','אפיק גבייה','תאריך מפגש','מיקום מפגש','מטרת המפגש','סיכום ותובנות','מקור','סטטוס'],
  ['man-1','ישראל ישראלי','12/08/2026',500,'','🔗 קישור ישיר','','','','','ידני',''],
  ['hk:1900001:2026-08','תורם הוק','02/08/2026',250,'','הוראת קבע','','','','','הוראת קבע 1900001',''],
]);
sheets['אנשי קשר']=mk('אנשי קשר',[['שם מלא','טלפון','אימייל','כתובת','בן/בת זוג','תאריך לידה','תאריך לידה עברי','יארצייט','הערות']]);
sheets['מיפוי שמות']=mk('מיפוי שמות',[['שם שגוי / כפילות','השם התקין']]);

const show = () => sheets['יומן תרומות ומפגשים'].values.slice(1).map(r=>`${r[0]} | ${r[1]} | ₪${r[3]} | ${r[5]} | ייעוד:${r[4]||'—'} | ${r[9]||'—'}`);
console.log('לפני:'); show().forEach(x=>console.log('  '+x));

console.log('\n1. תיקון אפיק גבייה + שיוך לפרויקט + הערה:');
let r = updateDonation_({ id:'man-1', method:'💵 מזומן', purpose:'🎯 הדפסת לוח שנה', notes:'נמסר ביד' });
console.log('  ', JSON.stringify(r));

console.log('\n2. תיקון סכום בלבד — אסור שידרוס שדות אחרים:');
r = updateDonation_({ id:'man-1', amount:750 });
console.log('  ', JSON.stringify(r));

console.log('\nאחרי:'); show().forEach(x=>console.log('  '+x));

console.log('\n3. מחיקת חיוב של הוראת קבע — אמורה להיחסם:');
console.log('  ', JSON.stringify(deleteDonation_({ id:'hk:1900001:2026-08' })));

console.log('\n4. מחיקת התרומה הידנית:');
console.log('  ', JSON.stringify(deleteDonation_({ id:'man-1' })));
console.log('\nנשאר ביומן:'); show().forEach(x=>console.log('  '+x));

console.log('\n5. עריכת מזהה שלא קיים:');
console.log('  ', JSON.stringify(updateDonation_({ id:'לא-קיים', amount:1 })));
