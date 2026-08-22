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
const R=Date;
const NOW = new R(2026,7,13);
sheets['כשלי חיוב']=mk('כשלי חיוב',[
  ['תאריך','שם','מזהה הוראה','סכום','סיבה'],
  [new R(2026,7,10),'כשל מלפני 3 ימים','1','100','סירוב'],
  [new R(2026,6,20),'כשל מלפני 24 ימים','2','100','סירוב'],
  [new R(2026,6,5),'כשל מלפני 39 ימים','3','100','סירוב'],
  [new R(2025,8,12),'כשל מלפני שנה','4','100','סירוב'],
  ['','ללא תאריך','5','100','סירוב'],
]);
console.log('סה"כ כשלים בלשונית:', sheets['כשלי חיוב'].values.length-1);
console.log('מה שהדשבורד יספור (30 יום):', recentFailureCount_(NOW));
console.log('צפוי: 3 (שניים בתוך החלון + אחד ללא תאריך)',
  recentFailureCount_(NOW)===3 ? '✅' : '❌');
