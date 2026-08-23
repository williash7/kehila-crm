const assert = require('assert');
const fs = require('fs');
const N = require('/tmp/stub/navigation.js');

console.log('א. סדר ישן נשמר ומסכים חדשים מתווספים בלי כפילות:');
const order = N.normalizeBottomNavOrder(['settings', 'home', 'settings', 'unknown']);
assert.deepStrictEqual(order.slice(0, 2), ['settings', 'home']);
assert.strictEqual(new Set(order).size, N.DEFAULT_BOTTOM_NAV_ORDER.length);
assert.ok(order.includes('events') && order.includes('guide'));

console.log('ב. בסרגל יש לכל היותר ארבעה פריטים:');
const primary = N.normalizeBottomNavPrimary(['home', 'tasks', 'donors', 'donations', 'events'], order);
assert.deepStrictEqual(primary, ['home', 'tasks', 'donors', 'donations']);
assert.deepStrictEqual(N.normalizeBottomNavPrimary(undefined).slice(0, 4), N.DEFAULT_BOTTOM_NAV_PRIMARY);

console.log('ג. מרכז כספי מופיע רק כשהאפשרות שלו פעילה:');
assert.ok(!N.availableNavigationItems(false).some(item => item.id === 'finance'));
assert.ok(N.availableNavigationItems(true).some(item => item.id === 'finance'));

console.log('ד. הסרגל, תפריט עוד ועורך ההגדרות מחוברים:');
const bottom = fs.readFileSync('src/components/BottomNav.tsx', 'utf8');
const editor = fs.readFileSync('src/components/NavigationSettingsCard.tsx', 'utf8');
const settings = fs.readFileSync('src/components/SettingsTab.tsx', 'utf8');
const settingsLib = fs.readFileSync('src/lib/settings.ts', 'utf8');
assert.ok(/MoreHorizontal/.test(bottom) && /עוד מסכים/.test(bottom), 'פריטים מוסתרים חייבים להישאר בתפריט עוד');
assert.ok(/bottomNavPrimary/.test(bottom) && /normalizeBottomNavOrder/.test(bottom), 'הסרגל חייב לקרוא את הבחירה השמורה');
assert.ok(/עד ארבעה מסכים/.test(editor) && /העבר את .* למעלה/.test(editor), 'העורך חייב לתמוך בגלויות ובסדר');
assert.ok(/label: 'ארגון'/.test(settings) && /label: 'ניווט'/.test(settings) && /label: 'מידע וכלים'/.test(settings), 'ההגדרות חייבות להיות מחולקות ללשוניות לפי נושא');
assert.ok(/bottomNavOrder/.test(settingsLib) && /bottomNavPrimary/.test(settingsLib), 'הבחירה חייבת להישמר ב-AppSettings');

console.log('✓ ניווט תחתון גמיש והגדרות מחולקות ללשוניות');
