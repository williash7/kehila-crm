const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const nav = read('src/lib/navigation.ts');
const bottom = read('src/components/BottomNav.tsx');
const side = read('src/components/SideNav.tsx');
const app = read('src/App.tsx');
const ui = read('src/components/GlobalSearchTab.tsx');

assert.match(nav, /\{ id: 'search', label: 'חיפוש' \}/, 'החיפוש הוא מסך ניווט שניתן לסדר או להסתיר');
assert.doesNotMatch(nav, /DEFAULT_BOTTOM_NAV_PRIMARY[^;]*search/s,
  'החיפוש אינו מעמיס כברירת מחדל על ארבעת הכפתורים הראשיים');
assert.match(bottom, /search: Search/);
assert.match(side, /id: 'search'.*label: 'חיפוש'/);
assert.match(app, /activeTab === 'search'.*<GlobalSearchTab/s);
assert.match(app, /result\.kind === 'contact'.*setScoreOpenContact/s,
  'תוצאת איש קשר פותחת את הכרטיס עצמו');
assert.match(ui, /buildGlobalSearchIndex/);
assert.match(ui, /searchGlobalIndex/);
assert.match(ui, /אנשים, תרומות, פעילויות, קמפיינים ומשימות/);

console.log('✓ החיפוש הכללי נגיש, אופציונלי בניווט ומוביל למסך המתאים');
