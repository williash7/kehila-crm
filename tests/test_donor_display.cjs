const assert = require('assert');
const { avatarGradient, hasDisplayName } = require('/tmp/stub/donorDisplay.js');

assert.doesNotThrow(() => avatarGradient(undefined));
assert.strictEqual(avatarGradient(undefined), avatarGradient(null));
assert.strictEqual(avatarGradient('משה'), avatarGradient('משה'));

const records = [
  { name: 'משה' },
  { name: '' },
  { name: '   ' },
  {},
  undefined,
  null,
];
assert.deepStrictEqual(records.filter(hasDisplayName), [{ name: 'משה' }]);

console.log('✓ תצוגת אנשי קשר עמידה בפני רשומות חסרות שם');
