// ═══════════════════════════════════════════════════════════════════════════
// תור הכתיבות — שמירה שנכשלה לא נעלמת.
//
// הבדיקה המרכזית כאן היא ג': **כישלון שחוזר כערך ולא כחריגה עדיין נספר
// ככישלון.** זה היה הבאג המקורי — `apiPost` לעולם אינה זורקת, ולכן
// `.catch(console.error)` שהיה בקוד היה למעשה קוד מת. הכישלון חזר כערך,
// אף אחד לא בדק אותו, והנתונים לא הגיעו לגיליון בשקט מוחלט.
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// ── localStorage מדומה, ומתג שמאפשר לדמות מכסה מלאה ──
let store = {};
let quotaFull = false;
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { if (quotaFull) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
global.navigator = { onLine: true };

const Q = require('/tmp/stub/writeQueue.js');

let failed = 0;
function ok(c, m) { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failed = 1; }
const reset = () => { store = {}; quotaFull = false; };

const okPost = async () => ({ success: true });
/** כך נראה כישלון אמיתי: ערך מוחזר, **לא** חריגה. */
const valueFail = async () => ({ success: false, error: 'שגיאת רשת' });
const throwFail = async () => { throw new Error('נפילה'); };

(async () => {
  console.log('א. זיהוי כישלון:');
  ok(Q.isFailure({ success: false, error: 'x' }) === true, 'success:false הוא כישלון');
  ok(Q.isFailure({ error: 'x' }) === true, 'שדה error הוא כישלון');
  ok(Q.isFailure(null) === true, 'תשובה ריקה היא כישלון');
  ok(Q.isFailure({ success: true }) === false, 'הצלחה אינה כישלון');
  ok(Q.isFailure({ data: [1, 2] }) === false, 'תשובה עם נתונים ובלי שגיאה אינה כישלון');

  console.log('\nב. כתיבה שהצליחה אינה נכנסת לתור:');
  {
    reset();
    await Q.trackedPost('saveCRM', { data: { a: 1 } }, okPost);
    ok(Q.queueSize() === 0, 'התור נשאר ריק');
  }

  console.log('\nג. כישלון שחוזר כערך — הבאג המקורי:');
  {
    reset();
    await Q.trackedPost('saveCRM', { data: { a: 1 } }, valueFail);
    ok(Q.queueSize() === 1, 'נכנס לתור למרות שלא נזרקה חריגה');
    ok(Q.loadQueue()[0].lastError === 'שגיאת רשת', 'הסיבה נשמרה');
    ok(Q.loadQueue()[0].data.data.a === 1, 'והנתונים עצמם נשמרו במלואם');
  }

  console.log('\nד. גם חריגה אמיתית נתפסת:');
  {
    reset();
    const res = await Q.trackedPost('saveEvents', { data: [] }, throwFail);
    ok(Q.queueSize() === 1, 'נכנס לתור');
    ok(res && res.success === false, 'ומוחזרת תשובת כישלון במקום להפיל את הקורא');
  }

  console.log('\nה. התור שורד סגירת דפדפן:');
  {
    reset();
    await Q.trackedPost('saveCRM', { data: { a: 1 } }, valueFail);
    // אותו localStorage, מודול טעון מחדש — כמו פתיחה מחדש של האפליקציה.
    delete require.cache[require.resolve('/tmp/stub/writeQueue.js')];
    const Q2 = require('/tmp/stub/writeQueue.js');
    ok(Q2.queueSize() === 1, 'נשמר ב-localStorage ולא רק בזיכרון');
  }

  console.log('\nו. איחוד — עשרים עריכות אינן עשרים עותקים:');
  {
    reset();
    for (let i = 0; i < 20; i++) await Q.trackedPost('saveCRM', { data: { n: i } }, valueFail);
    ok(Q.queueSize() === 1, 'נשאר פריט אחד');
    ok(Q.loadQueue()[0].data.data.n === 19, 'והוא **האחרון** — שמירת בלוק שלם מחליפה את הקודמת');
  }

  console.log('\nז. פעולה שאינה מחליפה — נשמרת במלואה:');
  {
    // הכלל ההפוך, וחשוב לא פחות: פעולה שמוסיפה שורה אסור שתאוחד,
    // אחרת שתי תרומות יהפכו לאחת.
    reset();
    ok(!Q.REPLACING.has('addDonation'), 'addDonation אינו ברשימת המחליפים');
    await Q.trackedPost('addDonation', { amount: 100 }, valueFail);
    await Q.trackedPost('addDonation', { amount: 200 }, valueFail);
    ok(Q.queueSize() === 2, 'שתי התרומות שמורות בנפרד');
  }

  console.log('\nח. ניסיון חוזר:');
  {
    reset();
    await Q.trackedPost('saveCRM', { data: { a: 1 } }, valueFail);
    await Q.trackedPost('saveProjects', { data: [] }, valueFail);
    ok(Q.queueSize() === 2, 'שניים ממתינים');

    const r = await Q.flushQueue(okPost);
    ok(r.sent === 2 && r.failed === 0, 'שניהם נשלחו');
    ok(Q.queueSize() === 0, 'והתור התרוקן');
  }

  console.log('\nט. ניסיון חוזר שנכשל שוב — נשאר, ונספר:');
  {
    reset();
    await Q.trackedPost('saveCRM', { data: { a: 1 } }, valueFail);
    await Q.flushQueue(valueFail);
    ok(Q.queueSize() === 1, 'לא נזרק');
    ok(Q.loadQueue()[0].attempts === 2, 'מונה הניסיונות עלה — כך המחוון יודע שנתקע');
  }

  console.log('\nי. הצלחה חלקית — מה שעבר לא נשלח שוב:');
  {
    reset();
    await Q.trackedPost('saveCRM', { data: {} }, valueFail);
    await Q.trackedPost('saveProjects', { data: [] }, valueFail);
    const sent = [];
    await Q.flushQueue(async (a, d) => {
      sent.push(a);
      return a === 'saveCRM' ? { success: true } : { success: false, error: 'עדיין נופל' };
    });
    ok(Q.queueSize() === 1, 'נשאר רק מי שנכשל');
    ok(Q.loadQueue()[0].action === 'saveProjects', 'והוא הנכון');
    ok(!sent.includes('saveCRM') || sent.filter(a => a === 'saveCRM').length === 1,
       'מה שהצליח לא נשלח פעמיים — אחרת היינו רושמים אותו דבר כפול');
  }

  console.log('\nיא. מכסה מלאה — נכשל בקול, לא בשקט:');
  {
    reset();
    quotaFull = true;
    await Q.trackedPost('saveCRM', { data: { a: 1 } }, valueFail);
    ok(Q.queueState().persistFailed === true,
       'המצב הגרוע ביותר — לא נשמר וגם לא נזכר — מדווח במפורש');
    quotaFull = false;
    ok(Q.queueSize() === 0, 'ולא נשמרה גרסה חלקית שמתחזה לשלמה');
  }

  console.log('\nיב. הניסוח למשתמש:');
  {
    ok(Q.pendingLabel(0) === '', 'תור ריק — אין הודעה');
    ok(Q.pendingLabel(1) === 'שינוי אחד ממתין לשמירה', 'יחיד');
    ok(/3/.test(Q.pendingLabel(3)), 'רבים כולל המספר');
  }


  console.log('\nטו. מזהה הבקשה יציב — ההגנה מפני רישום כפול:');
  {
    // הבדיקה שיוסי דרש, והיא החשובה ביותר בקובץ הזה.
    //
    // התרחיש: הכתיבה **בוצעה** בגיליון, והתשובה אבדה בדרך חזרה. הלקוח
    // רואה כישלון ומנסה שוב. אם הניסיון החוזר נושא מזהה חדש, השרת אינו
    // מזהה שזו אותה פעולה — ואותה תרומה נרשמת פעמיים.
    //
    // כלומר: בלי הבדיקה הזו, התור שנועד למנוע אובדן נתונים היה יוצר
    // **שכפול** נתונים. גרוע מהמצב שהוא בא לתקן.
    reset();
    const ids = [];
    await Q.trackedPost('addDonation', { amount: 100 }, async (a, d, reqId) => {
      ids.push(reqId);
      return { success: false, error: 'התשובה אבדה' };
    });
    ok(ids[0] && typeof ids[0] === 'string', 'מזהה נשלח כבר בניסיון הראשון');
    ok(Q.loadQueue()[0].reqId === ids[0], 'ואותו מזהה נשמר בפריט התור');

    await Q.flushQueue(async (a, d, reqId) => { ids.push(reqId); return { success: true }; });
    ok(ids.length === 2 && ids[0] === ids[1],
       'הניסיון החוזר נושא את **אותו** מזהה — השרת יזהה כפילות ולא יכתוב שוב');
  }

  console.log('\nטז. בקשה שכבר בטיפול בשרת אינה נחשבת תקלה:');
  {
    reset();
    await Q.trackedPost('saveCRM', { data: {} }, valueFail);
    const before = Q.loadQueue()[0].attempts;
    await Q.flushQueue(async () => ({ success: false, code: 'REQUEST_IN_PROGRESS', retryable: true }));
    ok(Q.queueSize() === 1, 'נשארת בתור — לא יודעים עדיין אם הצליחה');
    ok(Q.loadQueue()[0].attempts === before,
       'ומונה הניסיונות **לא** עלה — אחרת המחוון היה מתריע על תקלה שאין');
    ok(Q.isRetryable({ retryable: true }) === true, 'הדגל מזוהה');
    ok(Q.isRetryable({ success: false, error: 'x' }) === false, 'כישלון רגיל אינו „בטיפול”');
  }


  console.log('\nיז. 51 פעולות — הראשונה אינה נמחקת בשקט:');
  {
    // הגרסה הראשונה חתכה ב-slice(-50), כלומר הפעולה ה-51 מחקה את הראשונה.
    // לשמירות בלוק מאוחדות זה לא היה מורגש; ל-51 תרומות שנרשמו בערב אחד
    // בלי קליטה זה **אובדן כסף**, בלי שום סימן.
    reset();
    for (let i = 0; i < Q.QUEUE_LIMIT; i++) {
      await Q.trackedPost('addDonation', { amount: i }, valueFail);
    }
    ok(Q.queueSize() === Q.QUEUE_LIMIT, `${Q.QUEUE_LIMIT} פעולות בתור`);
    const firstBefore = Q.loadQueue()[0].data.amount;

    const accepted = await Q.trackedPost('addDonation', { amount: 999 }, valueFail);
    const after = Q.loadQueue();
    ok(after.length === Q.QUEUE_LIMIT, 'התור לא גדל');
    ok(after[0].data.amount === firstBefore,
       'והפעולה הראשונה **עדיין שם** — לא נמחקה כדי לפנות מקום');
    ok(!after.some(i => i.data.amount === 999), 'החדשה לא נכנסה');
    ok(Q.queueState().queueFull === true,
       'והמצב מדווח — דחייה גלויה במקום מחיקה שקטה');
    ok(accepted !== undefined, 'הקורא מקבל תשובה ולא נתקע');
  }

  console.log('\nיח. פעולה מחליפה נכנסת גם כשהתור מלא — בלי לכבות את האזהרה:');
  {
    // התקרה נספרת על פעולות **שאינן מחליפות** בלבד. שמירת רקע מוגבלת
    // ממילא לפריט אחד לכל סוג, ולכן חסימתה הייתה מאבדת את עריכת הכרטיס
    // האחרונה בלי להגן על דבר.
    reset();
    for (let i = 0; i < Q.QUEUE_LIMIT; i++) await Q.trackedPost('addDonation', { amount: i }, valueFail);
    await Q.trackedPost('addDonation', { amount: 999 }, valueFail);   // נדחית
    ok(Q.queueState().queueFull === true, 'האזהרה דלוקה');

    await Q.trackedPost('saveCRM', { data: { x: 1 } }, valueFail);
    ok(Q.loadQueue().some(i => i.action === 'saveCRM'), 'saveCRM נכנס');
    ok(Q.loadQueue().length === Q.QUEUE_LIMIT + 1, 'והתור אכן גדל ל-51 פריטים');

    // הבאג שיוסי מצא: שמירת רקע שנכנסה בהצלחה כיבתה את האזהרה, למרות
    // שלא התפנה מקום והפעולה שנדחתה עדיין חסרה. אזהרה שנכבית לבד היא
    // אזהרה שלא ראו.
    ok(Q.queueState().queueFull === true,
       '**והאזהרה עדיין דלוקה** — לא התפנה מקום, והפעולה שנדחתה עדיין חסרה');

    // נכבית רק כששליחה מוצלחת באמת מפנה מקום.
    let once = false;
    await Q.flushQueue(async (a) => {
      if (a === 'addDonation' && !once) { once = true; return { success: true }; }
      return { success: false, error: 'עדיין' };
    });
    ok(Q.queueState().queueFull === false,
       'וכבתה רק אחרי שאחת מ-50 הפעולות נשלחה בהצלחה');
  }

  console.log('\nיט. מכסה מלאה — הרשימה הקודמת נשארת בשלמותה:');
  {
    // הבאג השני שיוסי מצא: הגרסה הראשונה שמרה במקרה כזה את חמשת האחרונים,
    // מחקה את כל השאר, **וקבעה persistFailed = false.** כלומר מחקה נתונים
    // והודיעה שהכול תקין.
    reset();
    for (let i = 0; i < 8; i++) await Q.trackedPost('addDonation', { amount: i }, valueFail);
    const before = JSON.stringify(Q.loadQueue());
    ok(Q.loadQueue().length === 8, 'שמונה בתור');

    quotaFull = true;
    await Q.trackedPost('addDonation', { amount: 99 }, valueFail);

    quotaFull = false;   // רק כדי שנוכל לקרוא
    ok(JSON.stringify(Q.loadQueue()) === before,
       'שמונה הפעולות הקודמות נשארו **בדיוק** כפי שהיו — אף אחת לא נמחקה');
    ok(Q.queueState().persistFailed === true,
       'והדגל דלוק — נכשל בקול, לא מוחק בשקט');
  }

  console.log('\nכ. הדגל דביק עד לכתיבה מלאה מוצלחת:');
  {
    ok(Q.queueState().persistFailed === true, 'עדיין דלוק אחרי הכישלון');
    await Q.flushQueue(okPost);
    ok(Q.queueState().persistFailed === false, 'וכבה רק אחרי שכתיבה מלאה הצליחה');
  }


  console.log('\nכא. חוזה WriteOutcome — „ממתין” אינו „נכשל”:');
  {
    // הניסוח הוא הבאג. „נכשל” מזמין לחיצה נוספת, והלחיצה הנוספת יוצרת
    // רישום שני של אותה תרומה. שלושה מצבים מפורשים במקום שני בוליאנים,
    // כי שני בוליאנים מאפשרים את הצירוף חסר המשמעות „נכשל אבל בתור”.
    reset();
    const saved = await Q.submitWrite('saveFinance', { data: {} }, okPost);
    ok(saved.status === 'saved', 'השרת אישר → saved');

    const queued = await Q.submitWrite('saveFinance', { data: {} }, valueFail);
    ok(queued.status === 'queued', 'נכשל אך נשמר בתור → queued, **לא** failed');
    ok(Q.queueSize() === 1, 'והוא באמת בתור');
    ok(/ממתין/.test(Q.outcomeMessage(queued)) && !/נכשל/.test(Q.outcomeMessage(queued)),
       'וההודעה למשתמש אינה אומרת „נכשל”');
  }

  console.log('\nכב. failed רק כשבאמת לא נשמר בשום מקום:');
  {
    reset();
    quotaFull = true;
    const r = await Q.submitWrite('addDonation', { amount: 1 }, valueFail);
    quotaFull = false;
    ok(r.status === 'failed', 'התור לא הצליח לשמור → failed');
    ok(r.status === 'failed' && !!r.error, 'ויש סיבה להציג');
  }

  console.log('\nכג. תור בתקרה → failed ולא queued:');
  {
    // המקרה שיוסי ביקש לוודא במפורש: הפעולה לא נשמרה בשום מקום, ולכן
    // אסור שתיראה למשתמש כמי שהתקבלה.
    reset();
    for (let i = 0; i < Q.QUEUE_LIMIT; i++) await Q.trackedPost('addDonation', { amount: i }, valueFail);
    const r = await Q.submitWrite('addDonation', { amount: 999 }, valueFail);
    ok(r.status === 'failed', 'תקרה → failed');
    ok(Q.queueState().queueFull === true, 'והאזהרה דלוקה');
  }

  console.log('\nכד. המרכז הכספי משתמש בחוזה:');
  {
    const root = path.join(__dirname, '..');
    const api = fs.readFileSync(root + '/src/lib/api.ts', 'utf8');
    const tab = fs.readFileSync(root + '/src/components/FinanceTab.tsx', 'utf8');
    ok(/saveFinanceDataCloud\(data: any\): Promise<WriteOutcome>/.test(api),
       'saveFinanceDataCloud מחזירה WriteOutcome ולא boolean');
    ok(/submitWrite\('saveFinance'/.test(api), 'ועוברת דרך submitWrite');
    ok(/'queued'/.test(tab), 'המסך מכיר את מצב ההמתנה');
    ok(/ממתין לשליחה/.test(tab), 'ומציג אותו כהמתנה');
    ok(!/הסנכרון נכשל/.test(tab),
       'והניסוח הישן „הסנכרון נכשל” הוסר — הוא הזמין לחיצה כפולה');
  }


  console.log('\nכד2. תרומה ומפגש — כל שש נקודות הכתיבה:');
  {
    // הקבוצה הראשונה של שלב ב׳. יוסי בחר דווקא את שתי אלה כי **השרת כבר
    // גוזר להן מזהה רשומה יציב מתוך `reqId`** — ובלי התנאי הזה, תור על
    // פעולה שמוסיפה שורה פשוט מכפיל כסף.
    const root = path.join(__dirname, '..');
    const api = fs.readFileSync(root + '/src/lib/api.ts', 'utf8');
    ok(/addDonationQueued/.test(api) && /submitWrite\('addDonation'/.test(api),
       'קיים עוטף לתרומה');
    ok(/addMeetingQueued/.test(api) && /submitWrite\('addMeeting'/.test(api),
       'וקיים עוטף למפגש');

    // כל מופעי addMeeting הומרו, לא רק MeetingModal. נקודה שנשארה מאחור
    // היא בדיוק המקום שבו אשר יראה „נכשל” וילחץ שוב.
    const files = ['DonationModal', 'MeetingModal', 'QuickLogButtons',
                   'HolidayModal', 'EventsTab', 'SettingsTab'];
    files.forEach(f => {
      const src = fs.readFileSync(`${root}/src/components/${f}.tsx`, 'utf8');
      ok(!/apiPost\(\s*'add(Donation|Meeting)'/.test(src),
         `${f}: אין קריאה ישירה שעוקפת את התור`);
    });

    const dm = fs.readFileSync(root + '/src/components/DonationModal.tsx', 'utf8');
    ok(/outcome\.status !== 'failed'/.test(dm),
       'תרומה: „ממתין” נחשב הצלחה ולא שולח את המשתמש ללחוץ שוב');

    const quick = fs.readFileSync(root + '/src/components/QuickLogButtons.tsx', 'utf8');
    ok(/outcome\.status === 'failed'/.test(quick)
       && quick.indexOf("setLogged(prev => ({ ...prev, [meetType]: Date.now() }))")
          > quick.indexOf("if (outcome.status === 'failed')"),
       'תיעוד מהיר: „נרשם” מוצג רק אחרי שהמפגש אושר או נשמר בתור');
    ok(/disabled=\{isRecent\('טלפון'\) \|\| saving\['טלפון'\]\}/.test(quick),
       'תיעוד מהיר: לחיצה כפולה חסומה בזמן השמירה');

    // דיווח מרוכז חייב להפריד „אושרו” מ„ממתינות”, אחרת המספר שמוצג
    // למשתמש הוא מספר שאי אפשר לסמוך עליו.
    const st = fs.readFileSync(root + '/src/components/SettingsTab.tsx', 'utf8');
    ok(/queuedCount/.test(st) && /ממתינות לשליחה/.test(st),
       'סנכרון מרוכז: הממתינות נספרות בנפרד מהמאושרות');
  }

  console.log('\nכד3. שדות איש קשר ותאריכים — מקומי קודם, תור אחר כך:');
  {
    const root = path.join(__dirname, '..');
    const api = fs.readFileSync(root + '/src/lib/api.ts', 'utf8');
    const profile = fs.readFileSync(root + '/src/components/ProfileModal.tsx', 'utf8');
    const donors = fs.readFileSync(root + '/src/components/DonorsTab.tsx', 'utf8');
    ok(/updateDonorFieldQueued/.test(api) && /submitWrite\('updateDonorField'/.test(api),
       'עדכון שדה עובר דרך התור');
    ok(/updatePersonalDateQueued/.test(api) && /submitWrite\('updatePersonalDate'/.test(api),
       'וגם תאריך אישי');
    ok(!/apiPost\(\s*'update(DonorField|PersonalDate)'/.test(profile),
       'כרטיס איש קשר אינו עוקף עוד את התור');
    ok(!/apiPost\(\s*'updateDonorField'/.test(donors),
       'גם יצירת איש קשר אינה עוקפת אותו');
    ok(profile.indexOf('updateCrm(name, { customFields: newCustomFields })')
       < profile.indexOf('const outcomes = await Promise.all'),
       'הכרטיס המקומי מתעדכן לפני ההמתנה לרשת');
    ok(/setPendingFieldWrites\(failedSpecs\)/.test(profile)
       && /ללחוץ שוב על שמירה כדי לנסות מחדש/.test(profile),
       'פעולה שלא נכנסה גם לתור נשארת לניסיון חוזר גלוי');
    ok(!/updateDonorField[^\n]*then\(\(\) => refresh\(\)\)/.test(profile),
       'אין רענון מיידי שעלול להחזיר ערך ישן מהשרת');
  }

  console.log('\nכה. ישן בתור, חדש הצליח — הישן אינו דורס:');
  {
    // הבאג שיוסי תיאר, והוא נראה למשתמש כמו „הנתונים חזרו אחורה לבד”:
    // מצב A נכשל ונשאר בתור, מצב B חדש יותר הצליח, ובסבב הבא A נשלח
    // ומחזיר את הכול אחורה.
    reset();
    await Q.trackedPost('saveFinance', { data: { v: 'A' } }, valueFail);
    ok(Q.queueSize() === 1, 'A ממתין בתור');

    await Q.trackedPost('saveFinance', { data: { v: 'B' } }, okPost);
    ok(Q.queueSize() === 0, 'אחרי ש-B אושר בשרת, A **הוסר** ולא יישלח וידרוס אותו');
  }

  console.log('\nכו. saveFinance הוא בלוק מלא — ולכן מאוחד:');
  {
    reset();
    ok(Q.REPLACING.has('saveFinance'), 'saveFinance ברשימת המחליפים');
    await Q.trackedPost('saveFinance', { data: { v: 1 } }, valueFail);
    await Q.trackedPost('saveFinance', { data: { v: 2 } }, valueFail);
    ok(Q.queueSize() === 1, 'פריט אחד');
    ok(Q.loadQueue()[0].data.data.v === 2, 'והוא החדש — הישן לא יישלח אחריו');
  }

  console.log('\nכז. שתי שמירות של אותו בלוק אינן יוצאות במקביל:');
  {
    // בלי סדרוּת יש מרוץ אמיתי: A יוצא, B יוצא, B מגיע ראשון, A מגיע
    // אחריו ודורס אותו — והמשתמש רואה את העריכה שלו נעלמת בלי שגיאה.
    reset();
    const order = [];
    let releaseA;
    const gateA = new Promise(r => { releaseA = r; });

    const post = async (a, d) => {
      order.push('התחיל ' + d.data.v);
      if (d.data.v === 'A') await gateA;
      order.push('הסתיים ' + d.data.v);
      return { success: true };
    };

    const pA = Q.trackedPost('saveCRM', { data: { v: 'A' } }, post);
    const pB = Q.trackedPost('saveCRM', { data: { v: 'B' } }, post);

    await new Promise(r => setTimeout(r, 10));
    ok(!order.includes('התחיל B'),
       'B **לא** יצא כל עוד A באוויר — אין מרוץ בין שתי שמירות של אותו בלוק');

    releaseA();
    await Promise.all([pA, pB]);
    ok(order.join('|') === 'התחיל A|הסתיים A|התחיל B|הסתיים B',
       'והסדר נשמר לפי סדר היצירה: ' + order.join(' → '));
  }

  console.log('\nכח. פעולות שונות אינן ממתינות זו לזו:');
  {
    // שרשרת לכל action, לא נעילה גלובלית. אין סיבה ששמירת פרויקטים
    // תמתין לשמירת אנשי קשר.
    reset();
    let releaseCrm;
    const gate = new Promise(r => { releaseCrm = r; });
    let projectsDone = false;

    const pCrm = Q.trackedPost('saveCRM', { data: {} }, async () => { await gate; return { success: true }; });
    const pProj = Q.trackedPost('saveProjects', { data: [] }, async () => { projectsDone = true; return { success: true }; });

    await new Promise(r => setTimeout(r, 10));
    ok(projectsDone === true, 'שמירת הפרויקטים רצה בלי להמתין לאנשי הקשר');
    releaseCrm();
    await Promise.all([pCrm, pProj]);
  }

  console.log('\nכח2. ניסיון חוזר ישן ושמירה חדשה עוברים באותה שרשרת:');
  {
    // A נשמרה בתור. כשהחיבור חוזר מתחילה שליחתה, ובאותו רגע המשתמש
    // שומר B. בלי אותה שרשרת בדיוק, B יכולה להגיע ראשונה ואז A הישנה
    // מגיעה אחריה ומחזירה את כל המסך לאחור.
    reset();
    await Q.trackedPost('saveFinance', { data: { v: 'A' } }, valueFail);

    const order = [];
    let releaseA, announceA;
    const gateA = new Promise(r => { releaseA = r; });
    const startedA = new Promise(r => { announceA = r; });
    const flush = Q.flushQueue(async (_a, d) => {
      order.push('התחיל ' + d.data.v);
      announceA();
      await gateA;
      order.push('הסתיים ' + d.data.v);
      return { success: true };
    });

    await startedA;
    const fresh = Q.submitWrite('saveFinance', { data: { v: 'B' } }, async (_a, d) => {
      order.push('התחיל ' + d.data.v);
      order.push('הסתיים ' + d.data.v);
      return { success: true };
    });
    await new Promise(r => setTimeout(r, 10));
    ok(!order.includes('התחיל B'),
       'B ממתינה עד ש-A הישנה מסיימת — A לא תוכל להגיע אחריה ולדרוס');

    releaseA();
    await Promise.all([flush, fresh]);
    ok(order.join('|') === 'התחיל A|הסתיים A|התחיל B|הסתיים B',
       'השרת רואה קודם את הישן ואז את החדש: ' + order.join(' → '));
  }

  console.log('\nכט. האזהרה שורדת רענון:');
  {
    // queueFull חי בזיכרון המודול בלבד. בלי גזירה מהתור, רענון היה מכבה
    // את האזהרה בזמן שהתור עצמו נשאר מלא ב-localStorage.
    reset();
    for (let i = 0; i < Q.QUEUE_LIMIT; i++) await Q.trackedPost('addDonation', { amount: i }, valueFail);
    await Q.trackedPost('addDonation', { amount: 999 }, valueFail);
    ok(Q.queueState().queueFull === true, 'דלוק לפני הרענון');

    delete require.cache[require.resolve('/tmp/stub/writeQueue.js')];
    const Q3 = require('/tmp/stub/writeQueue.js');   // כמו פתיחה מחדש
    ok(Q3.queueState().queueFull === true,
       '**ועדיין דלוק אחרי** — המצב נגזר מהתור ולא רק נזכר');
    ok(Q3.queueState().items.length === Q.QUEUE_LIMIT, 'והתור עצמו שלם');
  }

  console.log('\nיג. החיבור בפועל:');
  {
    const root = path.join(__dirname, '..');
    const api = fs.readFileSync(root + '/src/lib/api.ts', 'utf8');
    const app = fs.readFileSync(root + '/src/App.tsx', 'utf8');
    const ctx = fs.readFileSync(root + '/src/store/AppContext.tsx', 'utf8');

    // הבדיקה שמונעת נסיגה: אם מישהו יחזיר בעתיד `.catch(console.error)`
    // על כתיבה, הבדיקה הזו תיפול. זה בדיוק הדפוס שגרם לבאג.
    const deadCatch = api.match(/apiPost\([^)]*\)\.catch\(console\.error\)/g) || [];
    ok(deadCatch.length === 0,
       'אין יותר כתיבה עם catch(console.error) — apiPost לא זורקת, וזה היה קוד מת');

    ['saveCRM', 'saveEvents', 'saveHolidayExtras', 'saveHistory', 'saveHomeVisits', 'saveProjects']
      .forEach(a => ok(new RegExp(`trackedPost\\('${a}'`).test(api), `${a} עובר דרך התור`));

    ok(/trackedPost\('updateRebbe'/.test(ctx), 'updateRebbe עובר דרך התור');
    ok(/startAutoFlush/.test(ctx), 'הניסיונות החוזרים מופעלים בפתיחה');
    ok(/<PendingWritesBanner \/>/.test(app), 'המחוון מוצג');

    // חוזה מול השרת: apiPost חייבת לקבל reqId מבחוץ, אחרת הניסיון החוזר
    // יקבל מזהה חדש וההגנה מפני כפילות בשרת לא תעבוד.
    ok(/apiPost\(action: string, data: any, reqId\?: string\)/.test(api),
       'apiPost מקבלת reqId חיצוני');
    ok(/reqId: id/.test(api), 'והוא נשלח במעטפת הבקשה');
  }

  console.log('\nיד. עובד השירות — הקונכייה נשמרת, הנתונים לא:');
  {
    const sw = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');

    ok(/caches\.open/.test(sw), 'קיים מטמון (הקובץ הקודם היה ריק מתוכן)');
    ok(/script\.google\.com/.test(sw),
       'תשובות מהגיליון מסומנות כנתונים חיים');
    // זו ההגנה החשובה: הגשת סכומי תרומות ממטמון היא בדיוק אותו סוג שקר
    // שקט שהתור בא לתקן.
    ok(/hebcal\.com/.test(sw) && /isLiveData/.test(sw),
       'ושירותי חוץ נוספים — כולם לרשת בלבד');
    ok(/req\.method !== 'GET'/.test(sw), 'כתיבות אינן נוגעות במטמון כלל');
    ok(/mode === 'navigate'/.test(sw), 'לניווט יש טיפול נפרד');
    ok(sw.indexOf('await fetch(req)') > 0 || /fetch\(req\)/.test(sw), 'הרשת מנוסה תחילה');
    ok(/caches\.delete/.test(sw), 'מטמונים ישנים נמחקים ולא תופסים מכסה');
  }

  console.log('\n✓ תור כתיבות ועבודה ללא רשת');
  process.exitCode = failed;
})();
