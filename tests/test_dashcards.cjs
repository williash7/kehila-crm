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

// ── הכרטיס "מה דורש טיפול" ──
// נבנה ככרטיס ולא כמצב בית נפרד, כדי שלא יהיו שתי מערכות תצורה למסך אחד.
{
  const home = fs.readFileSync(__dirname + '/../src/components/HomeTab.tsx', 'utf8');
  const settings = fs.readFileSync(__dirname + '/../src/lib/settings.ts', 'utf8');
  assert.ok(DASH_CARDS.some(c => c.id === 'focus'), 'הכרטיס רשום ברשימה');
  assert.ok(DEFAULT_ORDER.includes('focus'), 'ומופיע בברירת המחדל');
  assert.ok(/buildTodayFocus/.test(home), 'המסך משתמש בחישוב של יוסי');
  assert.ok(!/homeMode/.test(settings) && !/homeMode/.test(home),
    'אין הגדרת מצב בית — הכרטיס הוא המנגנון, ושתי מערכות תצורה למסך אחד מייצרות התנגשויות');
  // הכרטיס חייב להיות ניתן להסתרה כמו כל כרטיס אחר; אם הוא מוצג
  // מחוץ ל-renderCard, עורך הדשבורד לא ישלוט בו.
  assert.ok(/case 'focus':/.test(home), 'עובר דרך אותו switch כמו כל הכרטיסים');
  assert.ok(!/\{renderFocus\(\)\}/.test(home), 'ולא מוצג ישירות מחוץ לרשימה');
}

console.log('✓ כרטיסי הדשבורד: ' + DASH_CARDS.length + ' כרטיסים, החיבור למסך קיים');
