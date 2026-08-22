// ═══════════════════════════════════════════════════════════════════════════
// המסלול המהיר: בקשה אחת במקום שתים־עשרה.
//
// הפתיחה ירתה שתים־עשרה בקשות נפרדות. Apps Script מגבילה ריצות במקביל,
// והלקוח שולח לכל היותר שלוש — כלומר ארבעה גלים, כל אחד משלם מחדש את זמן
// ההתנעה. שבע מהן היו readSync_, כולן קוראות את **אותה לשונית**.
//
// כאן בודקים שהאיחוד לא שינה את המשמעות: אותם נתונים בדיוק, ומטמון
// שלא יכול להגיש נתון ישן לכתיבה.
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
eval(fs.readFileSync('/tmp/base.js', 'utf8').split("console.log('1.")[0]);

let failed = 0;
function ok(c, m) { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failed = 1; }

// ── נתוני בסיס ──
const hk = sheets[SH.HK];
const cId = hk.values[0].indexOf('מזהה');
hk.values.push(['1001', 'ישראל ישראלי', '01/01/2026', 200, 12, '', '', 'קמפיין פסח', '', '', '']);

const log = sheets[SH.LOG];
log.values.push(['ned:1', 'ישראל ישראלי', '05/01/2026', 200, 'פסח', 'אשראי', '']);

writeSync_('crm', { 'ישראל ישראלי': { phone: '050' } });
writeSync_('projects', [{ id: 'p1', name: 'פסח' }]);
writeSync_('events', []);
writeSync_('history', []);
writeSync_('homeVisits', { rounds: [] });
writeSync_('holidayExtras', {});
writeSync_('rebbeDate', '2026-01-01');

console.log('א. הבקשה המאוחדת מחזירה את מה שהנפרדות החזירו:');
__cacheOn = true; __tableCache = {};
const all = getAll_();
__cacheOn = false; __tableCache = {};

ok(JSON.stringify(all.donations) === JSON.stringify(getDonations_()), 'תרומות');
ok(JSON.stringify(all.donors) === JSON.stringify(getDonors_()), 'תורמים');
ok(JSON.stringify(all.hk) === JSON.stringify(getHK_()), 'הוראות קבע');
ok(JSON.stringify(all.failures) === JSON.stringify(getFailures_()), 'שגיאות');
ok(JSON.stringify(all.summary) === JSON.stringify(getSummary_()), 'סיכום');
ok(JSON.stringify(all.crm) === JSON.stringify(readSync_('crm')), 'כרטיסים');
ok(JSON.stringify(all.projects) === JSON.stringify(readSync_('projects')), 'פרויקטים');
ok(all.rebbeDate === readSync_('rebbeDate'), 'תאריך כתיבה לרבי');
ok(all.version === CODE_VERSION, 'הגרסה נשלחת יחד — בלי בקשת ping נפרדת');

console.log('\nב. כל השדות שהאפליקציה מצפה להם קיימים:');
['summary', 'donations', 'donors', 'hk', 'failures', 'rebbeDate',
 'crm', 'events', 'holidayExtras', 'history', 'homeVisits', 'projects',
].forEach(k => ok(k in all, k));

console.log('\nג. חלק שנכשל אינו מפיל את כל הפתיחה:');
{
  const real = getDonors_;
  getDonors_ = function () { throw new Error('נפילה מדומה'); };
  let res = null, threw = false;
  try { res = getAll_(); } catch { threw = true; }
  getDonors_ = real;
  ok(!threw, 'getAll לא זרק');
  ok(res && JSON.stringify(res.donors) === '{}', 'החלק שנכשל חזר ריק');
  ok(res && res.donations.length > 0, 'ושאר הנתונים הגיעו בכל זאת');
}

console.log('\nד. המטמון מוגבל לבקשות קריאה:');
{
  // הבדיקה החשובה כאן. אילו המטמון היה פעיל גם בכתיבה, כל קוד שקורא
  // לשונית → כותב אליה → קורא שוב היה מקבל את המצב שלפני הכתיבה, ובלי
  // שום הודעת שגיאה. באג כזה נראה למשתמש כמו "הגיליון לא התעדכן".
  __cacheOn = false; __tableCache = {};
  const before = table_(SH.HK).rows.length;
  sheets[SH.HK].values.push(['1002', 'שרה כהן', '01/02/2026', 300, 6, '', '', '', '', '', '']);
  ok(table_(SH.HK).rows.length === before + 1, 'בכתיבה — כל קריאה רואה את המצב האמיתי');

  __cacheOn = true; __tableCache = {};
  const cached = table_(SH.HK).rows.length;
  sheets[SH.HK].values.push(['1003', 'דוד לוי', '01/03/2026', 400, 6, '', '', '', '', '', '']);
  ok(table_(SH.HK).rows.length === cached, 'בקריאה — הלשונית נקראת פעם אחת');
  invalidateTable_(SH.HK);
  ok(table_(SH.HK).rows.length === cached + 1, 'ופסילה מפורשת מחזירה את המצב העדכני');
  __cacheOn = false; __tableCache = {};
}

console.log('\nה. הצד של האפליקציה:');
{
  const root = __dirname + '/..';
  const api = fs.readFileSync(root + '/src/lib/api.ts', 'utf8');
  const ctx = fs.readFileSync(root + '/src/store/AppContext.tsx', 'utf8');
  ok(/apiGetAll/.test(api), 'קיימת פונקציה לבקשה המאוחדת');
  ok(/readSnapshot|saveSnapshot/.test(api), 'קיים מטמון פתיחה מקומי');
  ok(/const bundle = await apiGetAll/.test(ctx), 'הפתיחה משתמשת בה');
  ok(/apiGet\('getSummary'\)/.test(ctx), 'ונשמרה נפילה אחורה לגיליון עם קוד ישן');
  ok(/applySnapshot\(snap\.data\)/.test(ctx), 'ומצייר מיד את מה שהיה');

  // הגרסה שהאפליקציה מצפה לה חייבת להיות זו שבסקריפט, אחרת המשתמש
  // יראה אזהרה מיד אחרי שעדכן.
  const ver = fs.readFileSync(root + '/src/lib/version.ts', 'utf8');
  const expected = (ver.match(/EXPECTED_CODE_VERSION = '([^']+)'/) || [])[1];
  ok(expected === CODE_VERSION, `הגרסאות תואמות (${expected} = ${CODE_VERSION})`);
}

console.log('\n✓ מסלול מהיר: 12 בקשות → 1');
process.exitCode = failed;
