global.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
global.window={location:{href:''},addEventListener:()=>{}};
const { explainApiError } = require('/tmp/stub/api.js');
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}
const a = explainApiError('פעולה לא מוכרת: updateDonation');
console.log('  ', a);
ok(a.indexOf('גרסה ישנה') >= 0, 'סקריפט ישן — מוסבר במילים של המשתמש');
ok(a.indexOf('גרסה חדשה') >= 0, 'ההוראה המדויקת מופיעה');
ok(a.indexOf('updateDonation') < 0, 'שם הפעולה הטכני לא מוצג');
const b = explainApiError('<!DOCTYPE html><html>...');
console.log('  ', b);
ok(b.indexOf('נסה שוב') >= 0, 'דף שגיאה — הצעה לנסות שוב');
ok(explainApiError('חסר סכום החיוב') === 'חסר סכום החיוב', 'שגיאה עניינית עוברת כמו שהיא');
ok(explainApiError('') === 'הפעולה נכשלה', 'בלי טקסט — הודעה כללית');
ok(explainApiError(undefined) === 'הפעולה נכשלה', 'undefined לא מפיל');
