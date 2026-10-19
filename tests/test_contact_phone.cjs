// טלפון של איש קשר: מקור אחד לכל הכפתורים, ומייל אינו מספר טלפון.
const assert = require('assert');
const P = require('/tmp/stub/contactPhone.js');

console.log('א. מייל שנכנס לעמודת הטלפון אינו מספר:');
assert.strictEqual(P.normalizePhone('מייל: 6441770@gmail.com'), '');
assert.strictEqual(P.normalizePhone('6441770'), '');
assert.strictEqual(P.normalizePhone('050-123-4567'), '972501234567');
assert.strictEqual(P.normalizePhone('04-644-0770'), '97246440770');
assert.strictEqual(P.normalizePhone('+1 (212) 555-0100'), '12125550100');
assert.strictEqual(P.normalizePhone('050-1234567 מייל: a1@b.com'), '972501234567');

console.log('ב. תיקון ב"ערוך הכל" גובר על המספר הישן:');
assert.strictEqual(P.contactPhone({ phone: '6441770', customFields: { 'טלפון': '052-743-2814' } }, { 'טלפון': 'מייל: 6441770@gmail.com' }), '972527432814');

console.log('ג. מספר שגוי לא חוסם מספר תקין ממקור אחר:');
assert.strictEqual(P.contactPhone({ phone: '6441770' }, { 'טלפון': '0527432814' }), '972527432814');
assert.strictEqual(P.contactPhone({}, { 'טלפון': 'מייל: 6441770@gmail.com' }, '0501111111'), '972501111111');

console.log('ד. אין מספר תקין — ריק, והטקסט הגולמי זמין להצגה:');
assert.strictEqual(P.contactPhone({}, { 'טלפון': 'מייל: 6441770@gmail.com' }), '');
assert.strictEqual(P.rawPhoneText({}, { 'טלפון': 'מייל: 6441770@gmail.com' }), 'מייל: 6441770@gmail.com');

console.log('✓ טלפון איש קשר');
