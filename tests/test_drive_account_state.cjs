const assert = require('assert');
const D = require('/tmp/stub/driveConfig.js');

const legacy = D.parseDriveAccountState({
  configured: true,
  orgName: { he: 'קהילה' },
  gsUrl: 'https://script.example/exec',
});
assert.strictEqual(legacy.schemaVersion, 2);
assert.strictEqual(legacy.config.orgName.he, 'קהילה');
assert.strictEqual(legacy.updatedAt, '');
assert.deepStrictEqual(legacy.clientState.values, {});

const current = D.parseDriveAccountState({
  schemaVersion: 2,
  config: { configured: true, orgName: { he: 'קהילה' } },
  clientState: {
    schemaVersion: 1,
    values: { custom_hols: '[]' },
    excludedSensitive: ['google_token_v1'],
  },
  updatedAt: '2026-11-11T10:00:00.000Z',
});
assert.strictEqual(current.updatedAt, '2026-11-11T10:00:00.000Z');
assert.strictEqual(current.clientState.values.custom_hols, '[]');

assert.strictEqual(D.parseDriveAccountState(null), null);
assert.throws(() => D.parseDriveAccountState({ schemaVersion: 3, config: {} }), /אינה נתמכת/,
  'גרסה עתידית אינה מפורשת בטעות כקובץ ישן');
assert.throws(() => D.parseDriveAccountState({
  schemaVersion: 2,
  config: {},
  clientState: { schemaVersion: 1, values: { google_token_v1: 'secret' }, excludedSensitive: [] },
  updatedAt: '2026-11-11T10:00:00.000Z',
}), /אינו מוכר/, 'סכמת חשבון דוחה מפתח רגיש או לא מוכר');
assert.throws(() => D.parseDriveAccountState({
  schemaVersion: 2, config: [], clientState: {}, updatedAt: '',
}), /אינו תקין/);

console.log('✓ סכמת חשבון, תאימות לאחור ודחיית קובץ לא בטוח');
