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
  // ── שיפור נכנס בבחירה, לא בהפתעה ──
  // הכרטיס רשום ולכן זמין בעורך תחת "מוסתרים", אבל מי שלא ביקש אותו
  // לא מוצא ביום בהיר אחד כרטיס חדש בראש מסך הבית.
  assert.ok(!DEFAULT_ORDER.includes('focus'),
    'focus אינו בברירת המחדל — הוא אופציונלי');
  assert.ok(hiddenCards([]).includes('focus'),
    'אבל הוא מופיע בעורך כזמין להוספה, ולא נעלם');

  // ── תאריך ההקשר של המשימות ──
  // משימה בלי מועד משלה יורשת את מועד החג או האירוע. בלי זה היא נראית
  // כמו משימה בלי תאריך ולא מגיעה לריכוז כשהיא באמת דחופה.
  assert.ok(/scope: 'holiday'[\s\S]{0,120}contextDate/.test(home),
    'משימות חג נשלחות עם תאריך החג');
  assert.ok(/nextEventOccurrence\(e, today\)/.test(home),
    'משימות אירוע משתמשות במופע הקרוב');
  assert.ok(!/contextDate: e\.date/.test(home),
    'ולא ב-e.date — באירוע חוזר זה המופע הראשון, שנמצא בעבר הרחוק');

  // ── המופע הקרוב, לא הראשון ──
  // hebcal סורק שנתיים קדימה, ולכן אותו שם חג מופיע פעמיים. שמירת
  // הראשון שנתקלים בו נותנת לפעמים את החג של השנה הבאה.
  assert.ok(/buildHolidayList\(holidays, getCustomHols\(\), today\)/.test(home),
    'תאריכי החגים נלקחים מ-buildHolidayList, שבוחרת את המופע הקרוב ביותר');

  // ── holidayExtras אינו רק חגים ──
  // הוא משמש גם כארון למשימות עצמאיות ולמשימות של תאריכים אישיים.
  // בלי ההחרגה, כל משימה עצמאית נכנסה גם כ"חג" וגם בדלי העצמאי —
  // כלומר הופיעה פעמיים בריכוז.
  assert.ok(/NOT_A_HOLIDAY/.test(home) &&
            /STANDALONE_TASKS_ID/.test(home) &&
            /PERSONAL_DATE_EXTRAS_ID/.test(home),
    'שני המפתחות המיוחדים מוחרגים מרשימת החגים');
  assert.ok(!/Object\.keys\(holidayExtras \|\| \{\}\)\.forEach\(k => holidayIds\.add\(k\)\)/.test(home),
    'ואין מעבר עיוור על כל מפתחות holidayExtras');
  assert.ok(/buildTodayFocus/.test(home), 'המסך משתמש בחישוב של יוסי');
  assert.ok(!/homeMode/.test(settings) && !/homeMode/.test(home),
    'אין הגדרת מצב בית — הכרטיס הוא המנגנון, ושתי מערכות תצורה למסך אחד מייצרות התנגשויות');
  // הכרטיס חייב להיות ניתן להסתרה כמו כל כרטיס אחר; אם הוא מוצג
  // מחוץ ל-renderCard, עורך הדשבורד לא ישלוט בו.
  assert.ok(/case 'focus':/.test(home), 'עובר דרך אותו switch כמו כל הכרטיסים');
  assert.ok(!/\{renderFocus\(\)\}/.test(home), 'ולא מוצג ישירות מחוץ לרשימה');
}

console.log('✓ כרטיסי הדשבורד: ' + DASH_CARDS.length + ' כרטיסים, החיבור למסך קיים');
