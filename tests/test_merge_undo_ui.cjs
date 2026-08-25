const fs = require('fs');
const path = require('path');
const assert = require('assert');

const modal = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'MergeContactsModal.tsx'), 'utf8');

assert.ok(/offerUndo\(aliasName, canonicalName, true, aliasName === presetName\)/.test(modal), 'מיזוג ידני מציע ביטול ושומר את התנהגות כרטיס איש הקשר');
assert.ok(/offerUndo\(aliasName, canonicalName, false\)/.test(modal), 'מיזוג מתוך הצעה מציע ביטול');
assert.ok(/unmergeContact\(lastMerge\.alias\)/.test(modal), 'הביטול משתמש במנגנון הפיצול הקיים');
assert.ok(/}, 5000\)/.test(modal), 'חלון הביטול נמשך חמש שניות');
assert.ok(/clearUndoTimer/.test(modal), 'הטיימר מנוקה בסגירה ובפירוק הרכיב');

console.log('✓ מיזוג ידני ומוצע ניתנים לביטול מיידי במשך חמש שניות');
