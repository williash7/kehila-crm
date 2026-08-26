const assert = require('assert');
const fs = require('fs');
const N = require('/tmp/stub/navigation.js');

console.log('א. סדר ישן נשמר ומסכים חדשים מתווספים בלי כפילות:');
const order = N.normalizeBottomNavOrder(['settings', 'home', 'settings', 'unknown']);
assert.deepStrictEqual(order.slice(0, 2), ['settings', 'home']);
assert.strictEqual(new Set(order).size, N.DEFAULT_BOTTOM_NAV_ORDER.length);
assert.ok(order.includes('events') && order.includes('guide'));

console.log('ב. ניתן להציג בסרגל כל מספר של פריטים:');
const primary = N.normalizeBottomNavPrimary(['home', 'tasks', 'donors', 'donations', 'events'], order);
assert.deepStrictEqual(primary, ['home', 'tasks', 'donors', 'donations', 'events']);
assert.deepStrictEqual(N.normalizeBottomNavPrimary(undefined).slice(0, 4), N.DEFAULT_BOTTOM_NAV_PRIMARY);
const allPrimary = N.normalizeBottomNavPrimary(N.DEFAULT_BOTTOM_NAV_ORDER, N.DEFAULT_BOTTOM_NAV_ORDER);
assert.strictEqual(allPrimary.length, N.DEFAULT_BOTTOM_NAV_ORDER.length);

console.log('ג. מרכז כספי מופיע רק כשהאפשרות שלו פעילה:');
// המתג הנפרד של המרכז הכספי בוטל: **הסתרת מסכים נעשית במקום אחד בלבד** —
// הגדרות ← ניווט. שני מנגנונים יצרו חוסר עקביות שאשר הבחין בה: אפשר היה
// לכבות כספים ולא דוחות.
assert.ok(N.availableNavigationItems().some(item => item.id === 'finance'),
  'הכספים זמינים תמיד ברשימת המסכים');
assert.ok(N.availableNavigationItems(false).some(item => item.id === 'finance'),
  'וגם קריאה ישנה עם false אינה מסתירה יותר');

console.log('ד. הסרגל, תפריט עוד ועורך ההגדרות מחוברים:');
const bottom = fs.readFileSync('src/components/BottomNav.tsx', 'utf8');
const editor = fs.readFileSync('src/components/NavigationSettingsCard.tsx', 'utf8');
const settings = fs.readFileSync('src/components/SettingsTab.tsx', 'utf8');
const settingsLib = fs.readFileSync('src/lib/settings.ts', 'utf8');
assert.ok(/MoreHorizontal/.test(bottom) && /עוד מסכים/.test(bottom), 'פריטים מוסתרים חייבים להישאר בתפריט עוד');
assert.ok(/bottomNavPrimary/.test(bottom) && /normalizeBottomNavOrder/.test(bottom), 'הסרגל חייב לקרוא את הבחירה השמורה');
assert.ok(/בחר כמה מסכים שתרצה/.test(editor) && /העבר את .* למעלה/.test(editor), 'העורך חייב לתמוך בבחירה ללא מגבלה ובסדר');
assert.ok(/overflow-x-auto/.test(bottom) && /hidden\.length > 0/.test(bottom), 'הסרגל חייב להיגלל ולהציג עוד רק כשיש פריטים מוסתרים');
assert.ok(/מה ברצונך להגדיר/.test(settings) && /חזרה לקטגוריות/.test(settings) && /group === null/.test(settings), 'ההגדרות חייבות להיפתח במסך קטגוריות ולתמוך בחזרה אליו');
assert.ok(/bottomNavOrder/.test(settingsLib) && /bottomNavPrimary/.test(settingsLib), 'הבחירה חייבת להישמר ב-AppSettings');

console.log('✓ ניווט תחתון ללא מגבלה והגדרות מחולקות לקטגוריות');
