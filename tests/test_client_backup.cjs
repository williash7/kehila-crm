const assert = require('assert');
const C = require('/tmp/stub/clientBackup.js');

class MemoryStorage {
  constructor(values = {}) { this.values = { ...values }; }
  get length() { return Object.keys(this.values).length; }
  key(index) { return Object.keys(this.values)[index] ?? null; }
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
  'kehila:hk-broadcast:templates': JSON.stringify({ 'thanks:he': 'תודה {שם}' }),
  'kehila:hk-broadcast:sent:thanks:2026-11': JSON.stringify({ donor: 'sent' }),
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
assert.ok(collected.values['kehila:hk-broadcast:templates'], 'תבניות WhatsApp נשמרות');
assert.ok(collected.values['kehila:hk-broadcast:sent:thanks:2026-11'], 'מצב משלוח חודשי נשמר');

const target = new MemoryStorage({
  app_settings_v1: JSON.stringify({ theme: 'old', fbAccessToken: 'keep-facebook' }),
  org_config_v1: JSON.stringify({ orgName: { he: 'ישן' }, gsUrl: 'https://keep-current.example' }),
  manual_donations: 'old',
});
const restored = C.restoreClientBackupState(collected, target);
assert.strictEqual(restored, Object.keys(collected.values).length);
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

const oldBackup = {
  schemaVersion: 1,
  values: { custom_hols: JSON.stringify([{ id: 'ישן' }]) },
  excludedSensitive: [],
};
const newerTarget = new MemoryStorage({
  custom_hols: '[]',
  'kehila:list-sort:finance-cashflow': JSON.stringify({ field: 'date', direction: 'desc' }),
});
assert.doesNotThrow(() => C.validateClientBackupState(oldBackup),
  'גיבוי ישן אינו נפסל רק מפני שנוספו מאז מפתחות חדשים');
assert.strictEqual(C.restoreClientBackupState(oldBackup, newerTarget), 1);
assert.strictEqual(JSON.parse(newerTarget.getItem('custom_hols'))[0].id, 'ישן');
assert.ok(newerTarget.getItem('kehila:list-sort:finance-cashflow'),
  'מפתח חדש שלא היה בגיבוי הישן נשמר ולא נמחק');

const conflictingTarget = new MemoryStorage({ custom_hols: '[{"id":"מקומי"}]' });
assert.strictEqual(C.clientBackupConflictsWithLocal(oldBackup, conflictingTarget), true,
  'מידע מקומי שונה מחייב אישור לפני שחזור');
assert.strictEqual(C.clientBackupConflictsWithLocal(oldBackup, new MemoryStorage()), false,
  'מכשיר ריק ניתן לשחזור ללא אזהרת דריסה');

const remoteSecret = {
  schemaVersion: 1,
  values: { app_settings_v1: JSON.stringify({ theme: 'dark', fbAccessToken: 'remote-secret' }) },
  excludedSensitive: [],
};
const noLocalSecret = new MemoryStorage();
C.restoreClientBackupState(remoteSecret, noLocalSecret);
assert.ok(!JSON.parse(noLocalSecret.getItem('app_settings_v1')).fbAccessToken,
  'אסימון ישן שנמצא בקובץ מרוחק אינו מיובא');
const nullSensitiveBackup = {
  schemaVersion: 1,
  values: { app_settings_v1: null, org_config_v1: null },
  excludedSensitive: [],
};
const localSensitiveValues = new MemoryStorage({
  app_settings_v1: JSON.stringify({ theme: 'old', fbAccessToken: 'keep-facebook' }),
  org_config_v1: JSON.stringify({ orgName: { he: 'ישן' }, gsUrl: 'https://keep.example' }),
});
C.restoreClientBackupState(nullSensitiveBackup, localSensitiveValues);
assert.strictEqual(JSON.parse(localSensitiveValues.getItem('app_settings_v1')).fbAccessToken, 'keep-facebook',
  'ערך null בגיבוי אינו מוחק אסימון מקומי');
assert.strictEqual(JSON.parse(localSensitiveValues.getItem('org_config_v1')).gsUrl, 'https://keep.example',
  'ערך null בגיבוי אינו מוחק את חיבור הגיליון המקומי');
assert.throws(() => C.validateClientBackupState({
  schemaVersion: 1, values: { app_settings_v1: '{broken' }, excludedSensitive: [],
}), /אינו תקין/, 'הגדרה מובנית פגומה נדחית לפני תחילת השחזור');

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
