const a = require('/tmp/dash.js');
const fs = require('fs');
const assert = require('assert');
const { resolveCards, hiddenCards, moveCard, DEFAULT_ORDER, DASH_CARDS } = a;

// ── התנהגות הספרייה ──
assert.deepStrictEqual(resolveCards([]), DEFAULT_ORDER, 'ריק = ברירת מחדל');
assert.deepStrictEqual(resolveCards(null), DEFAULT_ORDER);
assert.deepStrictEqual(resolveCards(['hero', 'לא-קיים', 'stats']), ['hero', 'stats'],
  'מזהה שאינו מוכר נזרק, ולא מפיל את המסך');
assert.deepStrictEqual(hiddenCards(['hero']).includes('recent'), true, 'מה שאינו ברשימה — מוסתר');
assert.deepStrictEqual(moveCard(['a','b','c'], 0, 2), ['b','c','a']);
assert.deepStrictEqual(moveCard(['a','b'], 0, -1), ['a','b'], 'מחוץ לטווח = בלי שינוי');

// ── החיבור עצמו ──
// זו הבדיקה שהייתה חסרה: העורך שמר בהגדרות, HomeTab לא קרא אותן,
// והמשתמש ראה שינוי שלא קרה. כאן מוודאים שהמסך באמת מתייעץ עם ההגדרה.
const home = fs.readFileSync(__dirname + '/../src/components/HomeTab.tsx', 'utf8');
assert.ok(/resolveCards\(settings\.dashboardCards\)/.test(home),
  'HomeTab חייב לקרוא את סדר הכרטיסים מההגדרות');
assert.ok(/cardOrder\.map/.test(home), 'פריסת המובייל חייבת לרוץ על הסדר השמור');
assert.ok(/mainColumn\.map/.test(home) && /sideColumn\.map/.test(home),
  'פריסת המחשב חייבת לרוץ על הסדר השמור');
assert.ok(!/{renderShabbatCard\(\)}/.test(home),
  'לא נשארה קריאה ישירה לכרטיס — כזו עוקפת את ההגדרות');

// כל כרטיס במטא-דאטה מטופל ב-switch, אחרת הוא יבחר בעורך ולא יופיע
DASH_CARDS.forEach(c => assert.ok(
  new RegExp(`case '${c.id}':`).test(home), `אין טיפול בכרטיס ${c.id}`));

console.log('✓ כרטיסי הדשבורד: ' + DASH_CARDS.length + ' כרטיסים, החיבור למסך קיים');
