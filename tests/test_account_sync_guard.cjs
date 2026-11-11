const assert = require('assert');
const S = require('/tmp/stub/accountSync.js');

class MemoryStorage {
  constructor(values = {}) { this.values = { ...values }; }
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.values, key) ? this.values[key] : null; }
  setItem(key, value) { this.values[key] = String(value); }
  removeItem(key) { delete this.values[key]; }
}

const hugeState = {
  schemaVersion: 1,
  values: { poster_bgImage: `data:image/png;base64,${'x'.repeat(2_000_000)}` },
  excludedSensitive: ['google_token_v1'],
};
const hugeHash = S.clientStateHash(hugeState);
assert.ok(hugeHash.length < 40, 'טביעת האצבע קצרה גם כשהגיבוי בגודל מגה־בייטים');
assert.strictEqual(S.clientStateHash(hugeState), hugeHash, 'טביעת האצבע יציבה');
assert.notStrictEqual(S.clientStateHash({ ...hugeState, values: { poster_bgImage: `${hugeState.values.poster_bgImage}!` } }), hugeHash,
  'שינוי במידע משנה את טביעת האצבע');

const storage = new MemoryStorage();
assert.strictEqual(S.isAccountSyncEnabled(storage), false, 'אין כתיבת רקע לפני הסכמה');
S.enableAccountSync('remote-1', 'hash-1', storage);
assert.strictEqual(S.isAccountSyncEnabled(storage), true);
assert.strictEqual(S.accountSyncBaseline(storage), 'remote-1');
assert.strictEqual(S.accountSyncLastHash(storage), 'hash-1');
assert.strictEqual(Object.keys(storage.values).length, 1, 'מצב הסנכרון נשמר אטומית ברשומה אחת');
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

const legacy = new MemoryStorage({
  google_account_sync_enabled_v1: '1',
  google_account_sync_baseline_v1: 'legacy-remote',
  google_account_sync_hash_v1: 'x'.repeat(100_000),
});
assert.strictEqual(S.isAccountSyncEnabled(legacy), true, 'מכשיר מהגרסה הראשונה נשאר מופעל');
assert.strictEqual(S.accountSyncBaseline(legacy), 'legacy-remote');
assert.strictEqual(S.accountSyncLastHash(legacy), '', 'העותק המלא הישן אינו נטען שוב לזיכרון');
S.recordAccountSync('remote-after-migration', 'short-hash', legacy);
assert.strictEqual(legacy.getItem('google_account_sync_hash_v1'), null, 'הערך הענק מהגרסה הראשונה נמחק');
assert.strictEqual(S.accountSyncBaseline(legacy), 'remote-after-migration');
assert.strictEqual(S.accountSyncLastHash(legacy), 'short-hash');

class QuotaStorage extends MemoryStorage {
  constructor(values, limit) { super(values); this.limit = limit; }
  setItem(key, value) {
    const next = { ...this.values, [key]: String(value) };
    const size = Object.entries(next).reduce((sum, [name, raw]) => sum + name.length + raw.length, 0);
    if (size > this.limit) throw new Error('quota exceeded');
    super.setItem(key, value);
  }
}
const quotaStorage = new QuotaStorage({ bundle_snapshot_v1: 'x'.repeat(1_000) }, 300);
assert.doesNotThrow(() => S.enableAccountSync('remote-quota', hugeHash, quotaStorage),
  'מטמון ניתן לבנייה מחדש מפונה אם אין מקום לרשומת הסנכרון');
assert.strictEqual(quotaStorage.getItem('bundle_snapshot_v1'), null);
assert.strictEqual(S.isAccountSyncEnabled(quotaStorage), true);

console.log('✓ טביעת אצבע קצרה, הגירה אטומית ושער בטוח לסנכרון חשבון');
