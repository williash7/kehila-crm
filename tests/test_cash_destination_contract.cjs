// ─────────────────────────────────────────────────────────────────────────────
// חוזה יעדי המזומן: הלקוח והשרת חייבים להכיר את אותה רשימה.
//
// ── הבאג שהוליד את הבדיקה ─────────────────────────────────────────────────
//
// נוסף יעד `salary` בצד הלקוח. הכפתור הופיע, אשר לחץ עליו, השמירה דיווחה
// „נשמר”. אבל `cleanCashDestination_` בשרת עדיין הכיר ארבעה ערכים בלבד,
// ולכן כתב מחרוזת ריקה. הבחירה נעלמה, התרומה חזרה להיות „עדיין לא סווג”,
// ושום הודעת שגיאה לא הופיעה בשום מקום.
//
// זה הדפוס המסוכן ביותר במערכת הזו: **פעולה שמדווחת הצלחה ולא קרתה.**
// `tsc` לא יכול לתפוס אותו — צד אחד TypeScript והצד השני מחרוזות ב-.gs.
//
// ── למה בדיקה טקסטואלית ולא בדיקה שמריצה קוד ──────────────────────────────
//
// אפשר היה לטעון את שני הקבצים ולהריץ. אבל מה שנשבר כאן אינו התנהגות
// אלא **סנכרון בין שתי רשימות שנכתבות ביד**, וזה בדיוק מה שהשוואת
// טקסט תופסת ישירות ובלי תלות בסביבת הרצה של Apps Script.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const assert = require('assert');

const client = fs.readFileSync('src/lib/cashDonations.ts', 'utf8');
const server = fs.readFileSync('google-apps-script/Code.gs', 'utf8');
const types = fs.readFileSync('src/types.ts', 'utf8');

// ── הרשימה בצד הלקוח ────────────────────────────────────────────────────────
const clientValues = [...client.matchAll(/\{\s*value:\s*'([a-z_]+)'/g)].map(m => m[1]);
assert.ok(clientValues.length >= 4, 'לא נמצאו יעדי מזומן ב-cashDonations.ts — כנראה השתנה המבנה והבדיקה כבר לא בודקת כלום');

// ── הרשימה בצד השרת ─────────────────────────────────────────────────────────
const serverMatch = server.match(/function cleanCashDestination_\(value\)\s*\{[\s\S]*?var allowed = \[([^\]]+)\]/);
assert.ok(serverMatch, 'cleanCashDestination_ לא נמצאה ב-Code.gs');
const serverValues = [...serverMatch[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]);

assert.deepStrictEqual(
  [...serverValues].sort(),
  [...clientValues].sort(),
  'רשימת יעדי המזומן בשרת אינה זהה לזו שבלקוח. ערך שהלקוח שולח והשרת לא מכיר נכתב כמחרוזת ריקה, השמירה מדווחת „הצליחה”, והבחירה של המשתמש נעלמת בלי שום שגיאה.',
);

// ── והטיפוס עצמו ────────────────────────────────────────────────────────────
const typeMatch = types.match(/export type CashDestination\s*=\s*([^;]+);/);
assert.ok(typeMatch, 'CashDestination לא נמצא ב-types.ts');
const typeValues = [...typeMatch[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]);

assert.deepStrictEqual(
  [...typeValues].sort(),
  [...clientValues].sort(),
  'הטיפוס CashDestination אינו תואם לרשימת האפשרויות. ערך שקיים בטיפוס ואינו ברשימה לא יופיע כפתור בשום מסך; ערך הפוך ייפול ב-tsc.',
);

// ── ושלושת הצדדים מכירים את המקרה שבגללו הכול התחיל ────────────────────────
['org_account', 'personal', 'activity_cashbox', 'salary', 'unclassified'].forEach(value => {
  assert.ok(clientValues.includes(value), `היעד ${value} חסר בלקוח`);
  assert.ok(serverValues.includes(value), `היעד ${value} חסר בשרת`);
});

// ── הגרסאות ─────────────────────────────────────────────────────────────────
//
// שינוי ב-Code.gs שאינו מלווה בהעלאת גרסה הוא שינוי שאשר לא יידע שהוא
// צריך לפרוס. האפליקציה תמשיך לרוץ מול השרת הישן ותתנהג כאילו התיקון
// קיים.
const codeVersion = server.match(/var CODE_VERSION = '([^']+)'/);
const expected = fs.readFileSync('src/lib/version.ts', 'utf8').match(/EXPECTED_CODE_VERSION = '([^']+)'/);
assert.ok(codeVersion && expected, 'לא נמצאה אחת מהגרסאות');
assert.strictEqual(codeVersion[1], expected[1], 'CODE_VERSION ו-EXPECTED_CODE_VERSION חייבות להיות זהות');

console.log('✓ חמשת יעדי המזומן מוכרים בטיפוס, בלקוח ובשרת, והגרסאות תואמות');
