const V = require('/tmp/stub/ver.js');
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}

console.log('א. חותמת הבנייה:');
console.log('   ', V.BUILD_COMMIT, '·', V.formatBuildTime(V.BUILD_TIME));
// לא משווים ל-commit ספציפי: הוא משתנה בכל שמירה, והבדיקה הייתה
// נכשלת על כל קומיט — כלומר מתריעה על שום דבר. מה שחשוב הוא שההזרקה
// עבדה בכלל, ושמה שהוזרק נראה כמו hash.
ok(/^[0-9a-f]{7,40}$/.test(V.BUILD_COMMIT), 'ה-commit מוזרק בבנייה');
ok(V.formatBuildTime('') === 'הרצה מקומית', 'בלי חותמת — נאמר במפורש');
ok(V.formatBuildTime('לא-תאריך') === 'לא-תאריך', 'ערך שבור לא מפיל');

console.log('\nב. השוואת גרסאות:');
ok(V.compareVersions(V.EXPECTED_CODE_VERSION) === 'ok', 'זהות → הכול מעודכן');
ok(V.compareVersions('2026-08-18c') === 'sheetOutdated', 'גיליון ישן יותר מזוהה');
ok(V.compareVersions('2026-08-13') === 'sheetOutdated', 'גם ישן בהרבה');
ok(V.compareVersions('2026-09-01') === 'sheetAhead', 'גיליון חדש יותר — האפליקציה היא הישנה');
ok(V.compareVersions('') === 'unknown', 'אין תשובה מהגיליון');
ok(V.compareVersions(null) === 'unknown', 'null');
ok(V.compareVersions(undefined) === 'unknown', 'undefined');

console.log('\nג. סדר הגרסאות עם סיומת אות:');
const order = ['2026-08-18','2026-08-18b','2026-08-18c','2026-08-18d'];
ok(order.every((v,i) => i === 0 || order[i-1] < v), 'ההשוואה הלקסיקוגרפית שומרת על הסדר הכרונולוגי');
ok('2026-08-18d' < '2026-08-19', 'ותאריך חדש עדיין גובר על סיומת אות');
