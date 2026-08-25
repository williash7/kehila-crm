const assert = require('assert');
const fs = require('fs');
const R = require('/tmp/stub/restore.js');
const B = require('/tmp/stub/backup.js');
const C = require('/tmp/stub/clientBackup.js');

function backup(overrides = {}) {
  return {
    kind: 'kehila-crm-backup', success: true, schemaVersion: 1,
    generatedAt: '2026-08-23T03:00:00.000Z', spreadsheet: { name: 'קהילה' },
    sheets: {
      'אנשי קשר': { present: true, headers: ['שם', 'תאריך'], rows: [['א', { __type: 'date', value: '2026-01-01T00:00:00.000Z' }]], rowCount: 1 },
      'חסרה': { present: false, headers: [], rows: [], rowCount: 0 },
    },
    syncResolved: { crm: { א: { phone: '1' } } },
    ...overrides,
  };
}

const plan = R.validateBackupForRestore(backup());
assert.strictEqual(plan.totalRows, 1);
assert.strictEqual(plan.sheetCount, 1);
assert.strictEqual(plan.syncCount, 1);
assert.strictEqual(plan.sourceName, 'קהילה');

const v2 = backup({
  schemaVersion: 2,
  clientState: {
    schemaVersion: 1,
    values: Object.fromEntries(C.CLIENT_BACKUP_KEYS.map(key => [key, key === 'custom_hols' ? '[]' : null])),
    excludedSensitive: ['google_token_v1'],
  },
});
v2.coverage = B.buildBackupCoverage(v2);
const v2Plan = R.validateBackupForRestore(v2);
assert.strictEqual(v2Plan.backup.clientState.values.custom_hols, '[]', 'מידע המכשיר מתקבל בגיבוי החדש');
assert.throws(() => R.validateBackupForRestore({ ...v2, coverage: { ...v2.coverage, sheetRows: 99 } }), /כיסוי/,
  'שינוי בתוכן או בספירות נעצר לפני שחזור');
assert.throws(() => R.validateBackupForRestore(backup({
  clientState: { schemaVersion: 1, values: { custom_hols: '[]' }, excludedSensitive: [] },
})), /חסרים פריטי מכשיר/, 'גם גיבוי ישן שמכיל מצב מכשיר חלקי נעצר לפני שינוי הנתונים');

const manifest = R.restoreManifest(plan);
assert.deepStrictEqual(manifest.syncKeys, ['crm']);
assert.strictEqual(manifest.sheets.length, 2, 'גם לשונית חסרה נשארת במניפסט, כדי למנוע גיבוי חלקי');

const manyRows = Array.from({ length: 1001 }, (_, i) => [String(i)]);
const chunkPlan = R.validateBackupForRestore(backup({
  sheets: { X: { present: true, headers: ['id'], rows: manyRows, rowCount: manyRows.length } },
}));
const chunks = R.sheetChunks(chunkPlan, 'X');
assert.deepStrictEqual(chunks.map(c => c.rows.length), [500, 500, 1]);
assert.ok(chunks[0].headers && chunks[1].headers === undefined, 'כותרות נשלחות רק במקטע הראשון');

for (const bad of [
  null,
  backup({ success: false }),
  backup({ schemaVersion: 2 }),
  backup({ sheets: { X: { present: true, headers: ['a'], rows: [], rowCount: 1 } } }),
  backup({ sheets: { X: { present: false, headers: ['a'], rows: [], rowCount: 0 } } }),
  backup({ sheets: { X: { present: true, headers: ['a'], rows: [['a', 'b']], rowCount: 1 } } }),
]) {
  assert.throws(() => R.validateBackupForRestore(bad), /./);
}

assert.strictEqual(R.RESTORE_CONFIRM_WORD, 'שחזר');

const backupCard = fs.readFileSync('src/components/BackupCard.tsx', 'utf8');
assert.ok(backupCard.includes('restoreRollback(token)'), 'כשל אחרי תחילת שחזור חייב להפעיל החזרה אוטומטית');
assert.ok(backupCard.includes('עותק בטיחות מלא'), 'המשתמש חייב לקבל הסבר ברור על עותק הבטיחות');
assert.ok(!backupCard.includes('שתי פעולות שאינן משנות דבר'), 'אסור להציג את השחזור כפעולה שאינה משנה נתונים');
assert.ok(backupCard.lastIndexOf('restoreClientBackupState') > backupCard.indexOf('restoreFinish(token)'),
  'מצב המכשיר חוזר רק אחרי שהשחזור בשרת הסתיים בהצלחה');

console.log('✓ אימות ותכנון שחזור בצד הלקוח');
