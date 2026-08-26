// ═══════════════════════════════════════════════════════════════════════════
// „הורד את מה שאני רואה”.
//
// ההבטחה היחידה של היחידה הזו: **הקובץ מכיל בדיוק את השורות שעל המסך.**
// לא את כל הנתונים, ולא את העמוד הראשון — את המסונן, במלואו.
//
// אם ההבטחה הזו נשברת פעם אחת, הקובץ הופך למשהו שצריך לבדוק ידנית — וזה
// מבטל את כל הטעם שבו.
// ═══════════════════════════════════════════════════════════════════════════

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const E = require('/tmp/stub/exportRows.js');

// ── הליבה ──
{
  const rows = [
    { name: 'ישראל', date: '01/01/2026', amount: 200, method: '💵 מזומן', notes: 'עם "גרשיים"' },
    { name: 'שרה', date: '02/01/2026', amount: 0 },
  ];
  const out = E.toExportRows(rows, E.DONATION_COLUMNS);
  const headers = E.exportHeaders(E.DONATION_COLUMNS);

  assert.strictEqual(out.length, 2, 'שורה לכל רשומה');
  assert.strictEqual(out[0].length, headers.length, 'מספר התאים תואם לכותרות');
  assert.strictEqual(out[0][0], 'ישראל');
  assert.strictEqual(out[0][2], 200, 'סכום נשאר מספר — כדי שאקסל יסכם אותו');

  // רשומת מפגש יושבת באותו מערך כמו תרומה, עם סכום 0. בלי הטור הזה מי
  // שפותח את הקובץ מסכם מפגשים כתרומות על ₪0 ולא מבין למה הספירה שונה.
  const kindIdx = headers.indexOf('סוג הרשומה');
  assert.strictEqual(out[0][kindIdx], 'תרומה');
  assert.strictEqual(out[1][kindIdx], 'מפגש / נוכחות');

  // „הכי מפורט” — אשר ביקש את זה במפורש.
  ['הערות', 'מזהה', 'מקור', 'היכן המזומן'].forEach(h =>
    assert.ok(headers.includes(h), `הטור „${h}” יוצא לקובץ`));
}

// ── שדה חסר לא מפיל את הייצוא ──
{
  // רשומה חלקית מהגיליון היא מציאות, לא מקרה קצה. ייצוא שנופל עליה
  // משאיר את המשתמש בלי קובץ בכלל.
  const out = E.toExportRows([{}], E.DONATION_COLUMNS);
  assert.strictEqual(out.length, 1);
  assert.ok(out[0].every(v => v !== undefined && v !== null), 'אין תאים ריקים מסוג undefined');
}

// ── סדר ותוכן נשמרים כפי שהתקבלו ──
{
  // הפונקציה אינה מסננת ואינה ממיינת. ברגע שתתחיל, הקובץ יוכל להיפרד
  // ממה שעל המסך.
  const rows = [{ name: 'ג' }, { name: 'א' }, { name: 'ב' }];
  const out = E.toExportRows(rows, E.CONTACT_COLUMNS);
  assert.deepStrictEqual(out.map(r => r[0]), ['ג', 'א', 'ב'], 'הסדר כפי שהתקבל');
}

// ── שם הקובץ ──
{
  assert.strictEqual(E.exportFileName('תרומות'), 'תרומות');
  assert.strictEqual(E.exportFileName('תרומות', '💵 מזומן+🌐 אתר תרומות'),
    'תרומות_💵 מזומן+🌐 אתר תרומות');
  // תווים שמערכת הקבצים אוסרת היו הופכים את ההורדה לכישלון שקט.
  assert.ok(!/[\\/:*?"<>|]/.test(E.exportFileName('תרומות', 'א/ב:ג*ד')), 'תווים אסורים מוסרים');
}

// ═══════════════════════════════════════════════════════════════════════════
// החיבור בפועל — ההבטחה חייבת להיות זהה בכל מסך.
// ═══════════════════════════════════════════════════════════════════════════

const button = read('src/components/ExportButton.tsx');
assert.match(button, /disabled=\{count === 0\}/, 'אין הורדה כשאין שורות');
assert.match(button, /\{count > 0 && <span/, 'המספר על הכפתור הוא ההצהרה של מה יירד');

const SCREENS = [
  ['src/components/DonationsTab.tsx', 'תרומות'],
  ['src/components/DonorsTab.tsx', 'אנשי קשר'],
  ['src/components/FinanceTab.tsx', 'כספים'],
  ['src/components/EventsTab.tsx', 'פעילויות'],
];
SCREENS.forEach(([file, label]) => {
  const src = read(file);
  assert.match(src, /<ExportButton/, `${label}: יש כפתור הורדה`);
});

// ── והנקודה הקריטית: מייצאים את המסונן, לא את העמוד ──
//
// המסך מציג שלושים תרומות בכל פעם. מי שסינן למזומן מצפה לקבל את **כל**
// תרומות המזומן — לא את השלושים הראשונות. זו שגיאה שנראית כמו קובץ תקין.
{
  const src = read('src/components/DonationsTab.tsx');
  assert.match(src, /rows=\{filteredDonations\}/, 'תרומות: מייצא את המסונן המלא');
  assert.doesNotMatch(src, /rows=\{pagedDonations\}/, 'ולא את העמוד המוצג בלבד');
}

// ═══════════════════════════════════════════════════════════════════════════
// בחירה מרובה של אפיקי גבייה — הבקשה שממנה הכול התחיל.
//
// „מזומן וגם אתר חב״ד וזהו.” עם `<select>` יחיד זה היה בלתי אפשרי.
// ═══════════════════════════════════════════════════════════════════════════
{
  const src = read('src/components/DonationsTab.tsx');
  assert.match(src, /const \[methods, setMethods\] = useState<string\[\]>\(\[\]\)/,
    'הבחירה היא רשימה, לא ערך יחיד');
  assert.match(src, /methods\.length\) list = list\.filter\(d => methods\.includes/,
    'והסינון מכבד את כולם יחד');
  assert.doesNotMatch(src, /d\.method === method\b/, 'הסינון היחיד הישן הוסר');

  // קבוצה ריקה = הכל. בלי זה, מסך שנפתח בלי בחירה היה מציג רשימה ריקה.
  assert.match(src, /if \(methods\.length\)/, 'ריק פירושו הכל');

  // שם הקובץ מבדיל בין חתכים — שלושה קבצים בשם „תרומות” בתיקיית ההורדות
  // הם שלושה קבצים שאי אפשר להבדיל ביניהם.
  assert.match(src, /donationFilterHint/, 'הסינון נכנס לשם הקובץ');
}

console.log('✓ הורדה בכל מסך — בדיוק מה שמוצג, ובחירה מרובה של אפיקי גבייה');

// ═══════════════════════════════════════════════════════════════════════════
// לחיצה על פריט מתוך הקשר אחר.
//
// אשר: „בתוך איש הקשר של יוסף אני רואה את התרומות שלו, אני לוחץ על תרומה
// וזה מעביר אותי לעריכת התרומה הספציפית הזו.”
// ═══════════════════════════════════════════════════════════════════════════

const openTargetSrc = read('src/lib/openTarget.ts');
const profile = read('src/components/ProfileModal.tsx');
const app = read('src/App.tsx');

// ── למה ערוץ ולא prop ──
//
// ProfileModal מוצג משבעה מקומות. prop היה מחייב להשחיל אותו דרך כולם, וכל
// מי שישכח ייצור מסך שבו הלחיצה לא עובדת — בקשה שנעלמת בשקט.
const profileUsages = (app + read('src/components/AllDatesModal.tsx') + read('src/components/DonationsTab.tsx')
  + read('src/components/DonorsTab.tsx') + read('src/components/HomeTab.tsx')
  + read('src/components/TasksTab.tsx')).match(/<ProfileModal/g) || [];
assert.ok(profileUsages.length >= 6,
  `ProfileModal מוצג מהרבה מקומות (${profileUsages.length}) — ולכן ערוץ ולא prop`);

assert.match(openTargetSrc, /export function requestOpenItem/, 'קיימת בקשה');
assert.match(openTargetSrc, /export function onOpenItemRequest/, 'וקיים מאזין');
assert.match(openTargetSrc, /if \(!id \|\| itemListeners\.size === 0\) return false/,
  'בקשה בלי מאזין מחזירה false ולא נופלת לחלל');

// ── הצד המבקש ──
assert.match(profile, /requestOpenItem\('donation', e\.data\.id\)/, 'לחיצה על תרומה מבקשת לפתוח אותה');
assert.match(profile, /e\.data\.id \? \(/,
  'תרומה בלי מזהה נשארת טקסט — עדיף בלי כפתור מאשר כפתור שלא עושה כלום');

// ── הצד המאזין ──
assert.match(app, /onOpenItemRequest\(req =>/, 'App מקשיב');
assert.match(app, /setOpenTarget\(\{ id: req\.id, parentId: req\.parentId/,
  'ומעביר את המזהה הלאה — אותו מסלול של תוצאת חיפוש');
// בלי זה הכרטיס נשאר פתוח מעל המסך החדש, והמשתמש חושב שכלום לא קרה.
assert.match(app, /setOpenContact\(null\);\s*\n\s*setActiveTab\(tab\)/,
  'והכרטיס נסגר לפני המעבר');

console.log('✓ לחיצה על תרומה בכרטיס מובילה לתרומה עצמה');
