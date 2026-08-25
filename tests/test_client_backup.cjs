const assert = require('assert');
const C = require('/tmp/stub/clientBackup.js');

class MemoryStorage {
  constructor(values = {}) { this.values = { ...values }; }
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.values, key) ? this.values[key] : null; }
  setItem(key, value) { this.values[key] = String(value); }
  removeItem(key) { delete this.values[key]; }
}

const source = new MemoryStorage({
  app_settings_v1: JSON.stringify({ theme: 'dark', fbAccessToken: 'secret-facebook' }),
  org_config_v1: JSON.stringify({ orgName: { he: 'קהילה' }, gsUrl: 'https://current.example' }),
  custom_hols: JSON.stringify([{ id: 'פסח' }]),
  poster_bgImage: 'data:image/png;base64,abc',
  score_total: '17',
  'kehila:list-sort:contacts': JSON.stringify({ field: 'name', direction: 'asc' }),
  google_token_v1: 'secret-google',
});
const collected = C.collectClientBackupState(source);
assert.strictEqual(JSON.parse(collected.values.app_settings_v1).theme, 'dark');
assert.ok(!('fbAccessToken' in JSON.parse(collected.values.app_settings_v1)), 'אסימון פייסבוק אינו נכנס לקובץ');
assert.ok(!('google_token_v1' in collected.values), 'אסימון גוגל אינו נכנס לקובץ');
assert.strictEqual(JSON.parse(collected.values.custom_hols)[0].id, 'פסח', 'חגים מותאמים נשמרים');
assert.strictEqual(collected.values.poster_bgImage, 'data:image/png;base64,abc', 'רקע הפוסטר נשמר');
assert.strictEqual(collected.values.score_total, '17', 'מצב הניקוד נשמר');
assert.ok(collected.values['kehila:list-sort:contacts'], 'המיון האחרון נשמר');

const target = new MemoryStorage({
  app_settings_v1: JSON.stringify({ theme: 'old', fbAccessToken: 'keep-facebook' }),
  org_config_v1: JSON.stringify({ orgName: { he: 'ישן' }, gsUrl: 'https://keep-current.example' }),
  manual_donations: 'old',
});
const restored = C.restoreClientBackupState(collected, target);
assert.strictEqual(restored, C.CLIENT_BACKUP_KEYS.length);
const restoredSettings = JSON.parse(target.getItem('app_settings_v1'));
const restoredOrg = JSON.parse(target.getItem('org_config_v1'));
assert.strictEqual(restoredSettings.theme, 'dark');
assert.strictEqual(restoredSettings.fbAccessToken, 'keep-facebook', 'האסימון הקיים נשמר');
assert.strictEqual(restoredOrg.orgName.he, 'קהילה');
assert.strictEqual(restoredOrg.gsUrl, 'https://keep-current.example', 'חיבור הגיליון הקיים נשמר');
assert.strictEqual(target.getItem('manual_donations'), null, 'מפתח שלא היה בגיבוי חוזר למצב ריק');

assert.throws(() => C.validateClientBackupState({
  schemaVersion: 1, values: { dangerous_unknown_key: 'x' }, excludedSensitive: [],
}), /אינו מוכר/);

class FailingStorage extends MemoryStorage {
  constructor(values) { super(values); this.failOnce = true; }
  setItem(key, value) {
    if (this.failOnce && key === 'poster_bgImage') { this.failOnce = false; throw new Error('quota'); }
    super.setItem(key, value);
  }
}
const beforeFailure = Object.fromEntries(C.CLIENT_BACKUP_KEYS.map(key => [key, `old-${key}`]));
const failing = new FailingStorage(beforeFailure);
assert.throws(() => C.restoreClientBackupState(collected, failing), /לא הושלם/);
C.CLIENT_BACKUP_KEYS.forEach(key => assert.strictEqual(failing.getItem(key), beforeFailure[key],
  `כשל מקומי אינו משאיר שחזור חלקי: ${key}`));

console.log('✓ גיבוי מצב המכשיר ללא סודות ושחזור בטוח');
