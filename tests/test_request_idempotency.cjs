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

const huge = { success: true, tag: 'import-1', added: { donations: 500 }, rejected: [] };
for (let i = 0; i < 400; i++) huge.rejected.push({ name: `שם ${i}`, reason: 'x'.repeat(40) });
const compact = JSON.parse(requestResponseJson_(huge));
assert.ok(JSON.stringify(compact).length < 3500, 'תשובה גדולה מתקצרת מתחת למכסת הערך');
assert.strictEqual(compact.success, true);
assert.strictEqual(compact.tag, 'import-1', 'שדות המשך חשובים נשמרים גם בתשובה מקוצרת');
assert.deepStrictEqual(compact.added, { donations: 500 });
assert.ok(REQ_KEEP > 50, 'זיכרון השרת גדול מתקרת תור הלקוח ואינו שוכח את הפריט הראשון באמצע ריקון');

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

// גם אחרי שזיכרון התשובות הזמני נוקה, מזהה הרשומה עצמה מונע שורה שנייה.
resetSheet(SH.LOG);
resetSheet(SH.CONTACTS);
resetSheet(SH.ALIASES);
_logIds = null;
_contactIndex = null;
_aliases = null;
const donationBody = { reqId: 'durable-donation', name: 'ישראל ישראלי', amount: 180, date: '25/08/2026' };
const donationFirst = addDonation_(donationBody);
flushWrites_();
const donationRetry = addDonation_(donationBody);
flushWrites_();
assert.strictEqual(donationFirst.id, 'man:durable-donation');
assert.strictEqual(donationRetry.duplicate, true, 'ניסיון חוזר של תרומה מזוהה גם בלי מטמון תשובה');
assert.strictEqual(table_(SH.LOG).rows.length, 1, 'נשארת תרומה אחת בלבד');

const meetingBody = { reqId: 'durable-meeting', name: 'ישראל ישראלי', date: '25/08/2026', notes: 'ביקור' };
const meetingFirst = addMeeting_(meetingBody);
flushWrites_();
const meetingRetry = addMeeting_(meetingBody);
flushWrites_();
assert.strictEqual(meetingFirst.id, 'meet:durable-meeting');
assert.strictEqual(meetingRetry.duplicate, true, 'ניסיון חוזר של מפגש מזוהה גם בלי מטמון תשובה');
assert.strictEqual(table_(SH.LOG).rows.length, 2, 'תרומה אחת ומפגש אחד בלבד');

resetSheet(SH.HK);
_hkIndex = null;
const standingBody = {
  reqId: 'durable-standing-order', name: 'ישראל ישראלי', amount: 100,
  startDate: '25/08/2026', payments: 12,
};
const standingFirst = addStandingOrder_(standingBody, { skipGenerate: true });
flushWrites_();
const standingRetry = addStandingOrder_(standingBody, { skipGenerate: true });
flushWrites_();
assert.strictEqual(standingFirst.id, 'hkman:durable-standing-order');
assert.strictEqual(standingRetry.duplicate, true,
  'ניסיון חוזר של הוראת קבע בלי מספר ספק מזוהה גם בלי מטמון תשובה');
assert.strictEqual(table_(SH.HK).rows.length, 1, 'נשארת הוראת קבע אחת בלבד');

const explicitStanding = {
  reqId: 'explicit-standing-order', id: '998877', name: 'ישראל ישראלי',
  amount: 120, startDate: '25/08/2026', payments: 6,
};
assert.strictEqual(addStandingOrder_(explicitStanding, { skipGenerate: true }).success, true,
  'מספר ספק מפורש נוסף כרגיל');
flushWrites_();
const explicitRetry = addStandingOrder_(explicitStanding, { skipGenerate: true });
assert.strictEqual(explicitRetry.success, false,
  'התנגשות במספר ספק מפורש נשארת שגיאה גלויה ולא מוסתרת ככפילות');

assert.strictEqual(held, false, 'כל הנעילות שוחררו');
assert.ok(acquisitions >= 6, 'כל מעבר מצב עבר תחת נעילה');

console.log('✓ מזהה בקשה יציב: תפיסה, חסימת כפילות, תשובה שמורה ושחרור');
