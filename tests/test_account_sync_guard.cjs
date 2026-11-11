const assert = require('assert');
const S = require('/tmp/stub/accountSync.js');

class MemoryStorage {
  constructor() { this.values = {}; }
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.values, key) ? this.values[key] : null; }
  setItem(key, value) { this.values[key] = String(value); }
  removeItem(key) { delete this.values[key]; }
}

const storage = new MemoryStorage();
assert.strictEqual(S.isAccountSyncEnabled(storage), false, 'אין כתיבת רקע לפני הסכמה');
S.enableAccountSync('remote-1', 'hash-1', storage);
assert.strictEqual(S.isAccountSyncEnabled(storage), true);
assert.strictEqual(S.accountSyncBaseline(storage), 'remote-1');
assert.strictEqual(S.accountSyncLastHash(storage), 'hash-1');
assert.strictEqual(S.remoteChangedSinceBaseline('remote-1', storage), false,
  'אותה גרסת ענן ניתנת לעדכון');
assert.strictEqual(S.remoteChangedSinceBaseline('remote-from-other-device', storage), true,
  'גרסת ענן חדשה יותר נחסמת לפני כתיבה');
S.markAccountSyncConflict(storage);
assert.strictEqual(S.hasAccountSyncConflict(storage), true, 'התנגשות עוצרת את מסלול הרקע');
S.recordAccountSync('remote-2', 'hash-2', storage);
assert.strictEqual(S.hasAccountSyncConflict(storage), false);
assert.strictEqual(S.accountSyncBaseline(storage), 'remote-2');
S.disableAccountSync(storage);
assert.strictEqual(S.isAccountSyncEnabled(storage), false);
assert.strictEqual(S.accountSyncBaseline(storage), '');

console.log('✓ שער הסכמה ובסיס גרסה לסנכרון חשבון');
