const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const inbox = read('src/components/QuickInboxTab.tsx');
const app = read('src/App.tsx');
const nav = read('src/lib/navigation.ts');

assert.match(nav, /\{ id: 'inbox', label: 'קליטה' \}/);
assert.doesNotMatch(nav, /DEFAULT_BOTTOM_NAV_PRIMARY[^;]*inbox/s,
  'קליטה מהירה נמצאת תחת „עוד” כברירת מחדל ואינה מעמיסה את הסרגל');
assert.match(app, /activeTab === 'inbox'.*<QuickInboxTab/s);
assert.match(inbox, /STANDALONE_TASKS_ID/,
  'הטיוטות משתמשות במאגר המסונכרן הקיים ולא במאגר מקומי נפרד');
assert.match(inbox, /שום דבר אינו הופך לתרומה, הוצאה או משימה בלי החלטה שלך/);
assert.match(inbox, /resolvedAt: new Date\(\)\.toISOString\(\)/,
  'רק לחיצה מפורשת הופכת טיוטה למשימה');
assert.match(inbox, /deletedAt: now/);
assert.match(inbox, /setTimeout\(\(\) => setUndoId[\s\S]*5000\)/,
  'מחיקת טיוטה היא רכה וכוללת ביטול לחמש שניות');
assert.match(inbox, /needsAttachment: true/);
assert.match(inbox, /התוכן לא נשמר בגיליון.*לצרף את הקובץ/s,
  'קובץ בינארי אינו נדחס לתא בגיליון והמסך מסביר מה לעשות');

console.log('✓ קליטה מהירה שומרת טיוטה, דורשת אישור ומאפשרת ביטול');
