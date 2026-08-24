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
