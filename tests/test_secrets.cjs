// ═══════════════════════════════════════════════════════════════════════════
// סודות לא עוזבים את המכשיר.
//
// טוקן הגישה לדף הפייסבוק הוא אישור חתימה: מי שמחזיק בו יכול לפרסם בשם
// הארגון. הוא נשמר ב-AppSettings, וזו הסיבה ש-AppSettings **אינו מסונכרן**
// לגיליון — הגיליון משותף, ניתן לשיתוף בקישור, ומגובה אוטומטית על ידי
// גוגל. סוד שנכנס לשם מפסיק להיות סוד.
//
// זו לא הערה שאפשר לסמוך עליה. די בשורה אחת תמימה — writeSync_('settings')
// או saveCRMDataCloud({ ...crm, settings }) — כדי להדליף אותו בשקט, בלי
// שום סימן במסך. לכן הכלל נאכף כאן.
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'google-apps-script', 'Code.gs'), 'utf8');

let failed = 0;
function ok(c, m) { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failed = 1; }

// ── מה בכלל נשמר בענן ──
//
// הרשימה נגזרת מהקוד ולא כתובה כאן ביד: מפתח חדש שמישהו יוסיף ל-writeSync_
// יופיע כאן מיד, וייאלץ החלטה מודעת במקום להיבלע.
const synced = [...new Set(
  [...code.matchAll(/write[Ss]ync_?\w*\(\s*'([a-zA-Z]+)'/g)].map(m => m[1])
)].sort();

const ALLOWED = ['crm', 'events', 'history', 'holidayExtras',
                 'homeVisits', 'orgConfig', 'projects', 'rebbeDate'].sort();

console.log('א. המפתחות שמסתנכרנים לגיליון:');
console.log('     ' + synced.join(', '));
ok(JSON.stringify(synced) === JSON.stringify(ALLOWED),
   'הרשימה זהה למה שאושר — מפתח חדש דורש החלטה מודעת');
ok(!synced.includes('settings'),
   'AppSettings אינו מסונכרן (שם יושב טוקן הפייסבוק)');

// ── והסודות עצמם ──
const SECRETS = ['fbAccessToken', 'fbPageId'];

console.log('\nב. הסודות אינם נשלחים לשום מקום:');
SECRETS.forEach(s => {
  ok(!code.includes(s), `${s} אינו מופיע כלל ב-Code.gs`);
});

// סריקה של כל קוד המקור: הסוד מותר להופיע בהגדרות ובמי שצורך אותו
// בפועל, אבל אסור שיופיע באותה שורה עם שליחה החוצה.
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p)) files.push(p);
  }
})(path.join(root, 'src'));

const SEND = /apiPost|saveCRMDataCloud|saveEventsDataCloud|saveProjectsCloud|saveHistoryDataCloud|saveHomeVisitsDataCloud|saveHolidayExtrasCloud|fetch\(/;

const leaks = [];
files.forEach(f => {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (!SECRETS.some(s => line.includes(s))) return;
    if (!SEND.test(line)) return;
    // הקריאה ל-Graph API של פייסבוק היא היעד הלגיטימי היחיד
    if (line.includes('graph.facebook.com')) return;
    leaks.push(`${path.relative(root, f)}:${i + 1}`);
  });
});
ok(leaks.length === 0,
   leaks.length ? 'סוד נשלח החוצה: ' + leaks.join(', ')
                : 'שום סוד אינו נשלח לגיליון או לרשת');

// ── ותמונת המצב המקומית ──
//
// snapshot נשמר ב-localStorage ולא נשלח לשום מקום, אבל כדאי לוודא
// שהוא מכיל רק את מה שהגיע מהשרת ולא את ההגדרות המקומיות.
const api = fs.readFileSync(path.join(root, 'src', 'lib', 'api.ts'), 'utf8');
console.log('\nג. מטמון הפתיחה:');
ok(/saveSnapshot\(res\)/.test(api),
   'נשמר רק מה שחזר מהשרת, בלי לערבב הגדרות מקומיות');

console.log('\n✓ סודות נשארים במכשיר');
process.exitCode = failed;
