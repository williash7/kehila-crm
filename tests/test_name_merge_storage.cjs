const fs = require('fs');
eval(fs.readFileSync('/tmp/base.js', 'utf8').split("console.log('1.")[0]);

let failed = 0;
function ok(value, message) {
  console.log((value ? '  ✓ ' : '  ✗ ') + message);
  if (!value) failed = 1;
}

console.log('א. מעבר אוטומטי מהתא הישן:');
writeSync_('crm', {
  'ישראל ישראלי': { circle: 'close' },
  __nameMerges__: {
    'ישראל י.': 'ישראל ישראלי',
    'ישראלי ישראל': 'ישראל ישראלי',
  },
});

let before = readCRM_();
ok(Object.keys(before.__nameMerges__).length === 2, 'החיבורים הישנים עדיין נקראים');

// שמירת CRM רגילה אינה שולחת בהכרח את המפה. אסור שזה ימחק אותה.
saveCRM_({ 'ישראל ישראלי': { circle: 'approach' } });
let aliases = readNameMerges_();
ok(Object.keys(aliases).length === 2, 'שני החיבורים הועברו לשורות נפרדות');
ok(!readSync_('crm').__nameMerges__, 'התא הישן כבר אינו מחזיק את כל המפה');
ok(readCRM_().__nameMerges__['ישראל י.'] === 'ישראל ישראלי', 'חוזה הקריאה נשאר תואם לאפליקציה');

console.log('\nב. כל פעולה משנה חיבור יחיד:');
saveContactMerge_({
  aliasName: 'י. ישראל',
  canonicalName: 'ישראל ישראלי',
});
aliases = readNameMerges_();
ok(Object.keys(aliases).length === 3, 'חיבור חדש נוסף בשורה משלו');
ok(readSync_('crm')['ישראל ישראלי'].circle === 'approach',
  'הוספת חיבור אינה כותבת מחדש את מאגר ה-CRM');

saveContactMerges_({
  aliasNames: ['ישראל השלישי', 'ישראל הרביעי'],
  canonicalName: 'ישראל ישראלי',
});
aliases = readNameMerges_();
ok(aliases['ישראל השלישי'] === 'ישראל ישראלי' && aliases['ישראל הרביעי'] === 'ישראל ישראלי',
  'מיזוג מרובה שומר את כל השמות בפעולה אחת');

deleteContactMerge_({
  aliasName: 'ישראל י.',
});
aliases = readNameMerges_();
ok(!aliases['ישראל י.'], 'נמחק רק החיבור שנבחר');
ok(aliases['ישראלי ישראל'] && aliases['י. ישראל'], 'שאר החיבורים נשמרו');

console.log('\nג. עריכת CRM מאוחרת אינה מוחקת חיבורים:');
saveCRM_({ 'ישראל ישראלי': { phone: '050' } });
ok(Object.keys(readNameMerges_()).length === 4, 'כל השורות נשארו אחרי עריכה רגילה');

console.log('\nד. הלקוח משתמש בפעולות יחידניות ושומר תאימות:');
const root = __dirname + '/..';
const api = fs.readFileSync(root + '/src/lib/api.ts', 'utf8');
const ctx = fs.readFileSync(root + '/src/store/AppContext.tsx', 'utf8');
ok(/apiPost\('saveContactMerge'/.test(api), 'קיימת פעולת הוספת חיבור יחיד');
ok(/apiPost\('deleteContactMerge'/.test(api), 'קיימת פעולת מחיקת חיבור יחיד');
ok(/apiPost\('saveContactMerge', \{ aliasName, canonicalName \}\)/.test(api),
  'הלקוח שולח במיזוג רק את שני השמות');
ok(/apiPost\('saveContactMerges', \{ aliasNames: cleanAliases, canonicalName \}\)/.test(api),
  'הלקוח שולח מיזוג מרובה בבקשה אחת');
ok(!/function saveContactMerge_\(body\)[\s\S]*?saveCRM_\(body\.data\)[\s\S]*?return \{ success: true/.test(
  fs.readFileSync(root + '/google-apps-script/Code.gs', 'utf8')),
  'השרת לא כותב את כל ה-CRM בזמן מיזוג');
ok(/saveCRMDataCloud\(\{ \.\.\.next, \[MERGES_KEY\]: nameMerges \}\)/.test(ctx),
  'גם מול סקריפט ישן עריכת CRM אינה משמיטה את המפה');

process.exitCode = failed;
