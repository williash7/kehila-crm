const assert = require('assert');
const fs = require('fs');
const H = require('/tmp/stub/backupHistory.js');

function memoryStorage(seed = {}) {
  const data = { ...seed };
  return {
    getItem: key => Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null,
    setItem: (key, value) => { data[key] = value; },
    data,
  };
}

const fixed = new Date('2026-08-23T03:10:00.000Z');
const stamp = H.makeBackupStamp({ rows: 120, sheets: 5, sync: 8 }, 'backup.json', fixed);
assert.deepStrictEqual(stamp, {
  completedAt: fixed.toISOString(), fileName: 'backup.json', rows: 120, sheets: 5, sync: 8,
});

const storage = memoryStorage();
assert.strictEqual(H.writeBackupStamp(stamp, storage), true, 'חותמת תקינה נשמרת');
assert.deepStrictEqual(H.readBackupStamp(storage), stamp, 'החותמת נקראת אחרי רענון');

assert.strictEqual(H.readBackupStamp(memoryStorage({ [H.BACKUP_STAMP_KEY]: '{broken' })), null,
  'JSON פגום אינו מפיל את המסך');
assert.strictEqual(H.readBackupStamp(memoryStorage({
  [H.BACKUP_STAMP_KEY]: JSON.stringify({ ...stamp, rows: -1 }),
})), null, 'חותמת לא תקינה אינה מוצגת');
assert.strictEqual(H.writeBackupStamp(stamp, { getItem: () => null, setItem: () => { throw Error('full'); } }), false,
  'כשל באחסון המקומי אינו הופך גיבוי מוצלח לכשל');

// שער סדר הפעולות בממשק: לא כותבים חותמת לפני אימות הקובץ והפעלת ההורדה.
const card = fs.readFileSync(__dirname + '/../src/components/BackupCard.tsx', 'utf8');
const verified = card.indexOf('file?.success !== true');
const downloaded = card.indexOf('a.click()');
const stamped = card.indexOf('writeBackupStamp(');
assert.ok(verified >= 0 && downloaded > verified && stamped > downloaded,
  'החותמת נכתבת רק אחרי אימות קובץ שלם והפעלת ההורדה');

console.log('✓ זכירת הגיבוי האחרון');

