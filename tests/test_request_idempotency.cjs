const fs = require('fs');
const assert = require('assert');

eval(fs.readFileSync('/tmp/base.js', 'utf8').split("console.log('1.")[0]);

const props = {};
let held = false;
let acquisitions = 0;

PropertiesService = {
  getScriptProperties: () => ({
    getProperty: key => Object.prototype.hasOwnProperty.call(props, key) ? props[key] : null,
    setProperty: (key, value) => { props[key] = String(value); },
    deleteProperty: key => { delete props[key]; },
  }),
};

LockService = {
  getScriptLock: () => ({
    waitLock() {
      assert.strictEqual(held, false, 'אין נעילה מקוננת');
      held = true;
      acquisitions++;
    },
    releaseLock() {
      assert.strictEqual(held, true, 'משחררים רק נעילה שנתפסה');
      held = false;
    },
  }),
};

Logger = { log() {} };

const first = claimRequest_('same-request');
assert.strictEqual(first.claimed, true, 'הבקשה הראשונה נתפסת לביצוע');
assert.ok(props[REQ_PENDING_PREFIX + 'same-request'], 'נשמר סימון זמני');

const concurrent = claimRequest_('same-request');
assert.strictEqual(concurrent.claimed, false, 'בקשה זהה במקביל אינה מתבצעת שוב');
assert.strictEqual(concurrent.cached, false, 'עדיין אין תשובה שמורה');

const response = { success: true, id: 'don-1' };
finishRequest_('same-request', response);
assert.strictEqual(props[REQ_PENDING_PREFIX + 'same-request'], undefined, 'סימון זמני נמחק בסיום');

const retry = claimRequest_('same-request');
assert.strictEqual(retry.cached, true, 'ניסיון חוזר מקבל תשובה קודמת');
assert.deepStrictEqual(retry.response, response, 'התשובה הקודמת נשמרת במלואה');

// סימון שנשאר אחרי הפסקה כפויה אינו חוסם את המערכת לנצח.
props[REQ_PENDING_PREFIX + 'stale-request'] = String(Date.now() - REQ_PENDING_MAX_AGE_MS - 1);
assert.strictEqual(claimRequest_('stale-request').claimed, true, 'סימון שפג מוחלף בניסיון חדש');
releaseRequestClaim_('stale-request');
assert.strictEqual(props[REQ_PENDING_PREFIX + 'stale-request'], undefined, 'כשל משחרר את הבקשה לניסיון חוזר');

appendAudit_('addDonation', {
  reqId: 'donation-request',
  audit: { subject: 'ישראל ישראלי', details: 'תרומה ידנית', source: 'phone' },
});
let audit = readSync_(AUDIT_SYNC_KEY);
assert.strictEqual(audit.length, 1, 'פעולת כתיבה מתועדת');
assert.strictEqual(audit[0].label, 'הוספת תרומה');
assert.strictEqual(audit[0].subject, 'ישראל ישראלי');
assert.strictEqual(audit[0].id, 'donation-request', 'יומן השינויים משתמש במזהה הבקשה');

appendAudit_('previewStandingOrderUpdate', { reqId: 'preview' });
appendAudit_('saveFinance', { reqId: 'private', audit: false });
audit = readSync_(AUDIT_SYNC_KEY);
assert.strictEqual(audit.length, 1, 'תצוגה מקדימה ופעולה שהוחרגה אינן נרשמות');

assert.strictEqual(held, false, 'כל הנעילות שוחררו');
assert.ok(acquisitions >= 6, 'כל מעבר מצב עבר תחת נעילה');

console.log('✓ מזהה בקשה יציב: תפיסה, חסימת כפילות, תשובה שמורה ושחרור');
