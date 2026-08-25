const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'DonorsTab.tsx'),
  'utf8'
);

assert.match(
  source,
  /onInput=\{e => setSearch\(e\.currentTarget\.value\)\}/,
  'חיפוש שמות צריך להתעדכן מיד גם בזמן הקלדה עברית'
);
assert.match(
  source,
  /const listRenderKey = list\.map\(d => d\.name\)\.join\('\\u001f'\)/,
  'צריך לחשב מפתח ציור לפי התוצאות המסוננות ובסדר המוצג'
);
assert.match(source, /key=\{`mobile:\$\{listRenderKey\}`\}/);
assert.match(source, /key=\{`desktop:\$\{listRenderKey\}`\}/);
assert.match(
  source,
  /className="mb-3 flex gap-2 md:mb-0 md:shrink-0"/,
  'פקדי המיון צריכים להופיע גם בחלון מחשב ולא להיות עטופים ב-md:hidden'
);
assert.doesNotMatch(
  source,
  /md:hidden mb-3 flex gap-2/,
  'אסור להסתיר את המיון במסך רחב'
);
assert.match(source, /DONOR_SORT_KEY = 'kehila:list-sort:contacts'/);
assert.match(
  source,
  /localStorage\.setItem\(DONOR_SORT_KEY, JSON\.stringify\(\{ field: sort, direction: sortDir \}\)\)/,
  'בחירת המיון והכיוון צריכה להישמר לפתיחה הבאה'
);

console.log('✓ חיפוש ומיון אנשי הקשר מתרעננים, מוצגים גם במחשב ונשמרים');
