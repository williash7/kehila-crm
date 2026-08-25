const fs = require('fs');
const path = require('path');
const assert = require('assert');

const api = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'api.ts'), 'utf8');
const card = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'AuditLogCard.tsx'), 'utf8');
const settings = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'SettingsTab.tsx'), 'utf8');

assert.ok(/apiGet\('getAudit'\)/.test(api), 'היומן נטען מהפעולה הייעודית');
assert.ok(/if \(next && !loaded/.test(card), 'היומן נטען רק אחרי פתיחת הכרטיס');
assert.ok(/לקריאה בלבד/.test(card), 'הממשק מבהיר שאין בו פעולת שינוי');
assert.ok(/entry\.label, entry\.subject, entry\.details/.test(card), 'אפשר לחפש בתיאור ובנושא');
assert.ok(/<AuditLogCard \/>/.test(settings), 'היומן מחובר תחת מידע וכלים');

console.log('✓ יומן השינויים נטען לפי דרישה ומוצג לקריאה בלבד');
