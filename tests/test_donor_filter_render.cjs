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

console.log('✓ מונה אנשי הקשר וכרטיסי הרשימה מתרעננים יחד אחרי חיפוש או מיון');
