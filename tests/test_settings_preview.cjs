const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const settings = read('src/components/SettingsTab.tsx');
const preview = read('src/components/SettingsLivePreview.tsx');
const appearance = read('src/components/AppearanceCard.tsx');

assert.match(settings, /group === 'appearance' \|\| group === 'navigation'/,
  'התצוגה קיימת במראה ובניווט');
assert.match(settings, /md:pl-\[328px\]/, 'במחשב נשמר מקום לחלון בצד שמאל');
assert.match(preview, /md:left-4/, 'במחשב החלון מוצמד לשמאל');
assert.match(preview, /md:fixed/, 'במחשב החלון נשאר בזמן גלילה');
assert.match(preview, /הצג תצוגה מקדימה/, 'אפשר להחזיר חלון שהוסתר');
assert.match(preview, /הסתר תצוגה מקדימה/, 'אפשר להסתיר את החלון');
assert.match(preview, /resolveCards\(settings\.dashboardCards\)/, 'שינויי הדשבורד מופיעים בחלון');
assert.match(preview, /normalizeBottomNavPrimary/, 'שינויי הניווט מופיעים בחלון');
assert.doesNotMatch(appearance, /<LivePreview \/>/, 'אין דוגמית כפולה בתוך הגדרת המראה');

console.log('✓ תצוגה מקדימה משותפת למראה ולניווט, בנייד למעלה ובמחשב משמאל');
