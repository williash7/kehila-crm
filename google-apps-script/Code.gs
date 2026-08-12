/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  לוח בקרה קהילתי — צד השרת (Google Apps Script)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  קובץ אחד שעושה הכל: משרת את האפליקציה, סורק מיילים של תרומות, ומייצר
 *  את חיובי הוראות הקבע החודשיים.
 *
 *  ── שני עקרונות שמונעים את רוב הבאגים ─────────────────────────────────────
 *
 *  1. לכל שורה ביומן יש **מזהה ייחודי**. תרומה מנדרים = מספר האישור.
 *     חיוב הוראת קבע = מספר ההוראה + החודש. לפני כל כתיבה בודקים אם המזהה
 *     כבר קיים. אי אפשר ליצור כפילות, ולכן אין צורך בפונקציות ניקוי.
 *
 *  2. "כמה חיובים נותרו" **מחושב ולא מאוחסן** — מספר התשלומים פחות מספר
 *     החיובים שכבר קיימים ביומן. מונה שמאוחסן בגיליון יורד ולא עולה, וכל
 *     מחיקה או כשל מוציאים אותו מסנכרון לתמיד. חישוב מתקן את עצמו תמיד.
 *
 *  ── התקנה ─────────────────────────────────────────────────────────────────
 *
 *  1. גיליון חדש: https://sheets.new
 *  2. תוספים ← Apps Script. מוחקים הכל, מדביקים את הקובץ הזה, שומרים.
 *  3. מריצים את הפונקציה  setupSheet  ומאשרים את בקשת ההרשאות.
 *     גוגל תציג "האפליקציה לא מאומתת" — לוחצים "מתקדם" ואז "המשך".
 *  4. פריסה ← פריסה חדשה  (Deploy → New deployment)
 *       בחירת סוג:    אפליקציית אינטרנט   (Web app)
 *       לבצע בתור:    עצמי                (Execute as: Me)
 *       למי יש גישה:  כולם                (Who has access: Anyone)
 *     ולסיום: לפריסה  (Deploy)
 *  5. מעתיקים את הכתובת שמסתיימת ב-/exec לאפליקציה.
 *  6. בתפריט "לוח בקרה" מריצים פעם אחת  סריקת כל היסטוריית המיילים .
 *     בלי הצעד הזה הלשוניות ריקות והאפליקציה תיראה ריקה.
 *
 *  מי שעובר מגיליון ישן: אחרי setupSheet מריצים  migrateFromLegacy .
 *
 *  ── מה רץ לבד מכאן ואילך ──────────────────────────────────────────────────
 *
 *  אין עוד פונקציה שצריך להריץ ידנית. שלוש שכבות מכסות הכל:
 *    · כל טעינה של האפליקציה  → maybeSync_  מושכת מיילים מהימים האחרונים
 *    · כל יום ב-06:00         → dailySync   סריקה + חיובי הוראות קבע
 *    · כל עריכה בגיליון       → onEditHandler
 *  כל שאר הפריטים בתפריט הם לשעת הצורך בלבד.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── שמות הלשוניות ────────────────────────────────────────────────────────────
var SH = {
  CONTACTS: 'אנשי קשר',
  LOG:      'יומן תרומות ומפגשים',
  HK:       'הוראות קבע',
  FAILURES: 'כשלי חיוב',
  ALIASES:  'מיפוי שמות',
  RULES:    'כללי מייל',
  SYNC:     'סנכרון נתונים',
};

// ── עמודות ───────────────────────────────────────────────────────────────────
// הקוד מוצא עמודות **לפי שם**, אף פעם לא לפי מספר. אפשר להזיז עמודות,
// להוסיף עמודות באמצע, ולהוסיף עמודות משלכם בסוף — כלום לא יישבר.
var COLS = {
  CONTACTS: ['שם מלא', 'טלפון', 'אימייל', 'כתובת', 'בן/בת זוג',
             'תאריך לידה', 'תאריך לידה עברי', 'יארצייט', 'הערות'],

  // יומן משולב: אותה שורה יכולה להיות תרומה, מפגש, או שניהם.
  LOG: ['מזהה', 'שם', 'תאריך תרומה', 'סכום', 'ייעוד', 'אפיק גבייה',
        'תאריך מפגש', 'מיקום מפגש', 'מטרת המפגש', 'סיכום ותובנות',
        'מקור', 'סטטוס'],

  // שים לב: אין כאן "חיוב אחרון" ואין "נותרו" — שניהם מחושבים מהיומן.
  //
  // "תאריך ביטול" הוא **השדה היחיד שאתה ממלא ידנית**. נדרים פלוס לא שולחת
  // מייל כשהוראה מבוטלת — לא כשאתה מבטל אותה בממשק, ולא כשהתורם מבקש.
  // בלי השדה הזה הגיליון ממשיך לייצר חיובים לנצח על הוראה מתה.
  // חיובים שתאריכם לפני התאריך הזה נשארים ונספרים; ממנו והלאה — לא.
  HK: ['מזהה', 'שם', 'תאריך פתיחה', 'סכום', 'מספר תשלומים',
       'טלפון', 'אימייל', 'קמפיין', 'תאריך ביטול', 'הערות'],

  FAILURES: ['תאריך', 'שם', 'מזהה הוראה', 'סכום', 'סיבה'],
  ALIASES:  ['שם שגוי / כפילות', 'השם התקין'],
  RULES:    ['פעיל', 'שם הכלל', 'חיפוש בגימייל', 'סוג', 'שדות (JSON)'],
  SYNC:     ['מפתח', 'ערך'],
};

/**
 * ערכי עמודת "סטטוס" ביומן.
 * ריק = חיוב שבוצע בפועל, נספר ככסף.
 * שלושת הערכים כאן **אינם נספרים** — לא בסכומים ולא במניין החיובים שבוצעו.
 */
var STATUS_FAILED    = 'נכשל';   // הגיע מייל סירוב — הכסף לא נכנס
var STATUS_FUTURE    = 'עתידי';  // חיוב הוראת קבע שמועדו עוד לא הגיע
var STATUS_CANCELLED = 'מבוטל';  // ההוראה הופסקה לפני שהחיוב הזה הגיע

/** האם שורה כזו נספרת ככסף שנכנס בפועל. */
function countsAsMoney_(status) {
  var v = String(status || '').trim();
  return v !== STATUS_FAILED && v !== STATUS_FUTURE && v !== STATUS_CANCELLED;
}

/**
 * חלון הזמן שבו מייל סירוב נחשב ככישלון של **ההקמה עצמה** ולא של חיוב בודד.
 * נדרים פלוס שולחת "הוראת קבע חדשה" ואחריה, אם הכרטיס נדחה, "שגיאה / סירוב".
 * מייל הסירוב מדבר על חיוב אחד — אבל אם הוא מגיע באותו יום שבו ההוראה הוקמה,
 * הכרטיס מעולם לא חויב ולו פעם אחת, וכל שאר החיובים הם דמיוניים.
 */
var SETUP_FAILURE_DAYS = 0;   // 0 = אותו יום קלנדרי בלבד

/** נשאר בעמודת ההערות גם אחרי ביטול-הביטול, כסימן ש"כבר טיפלנו בזה". */
var AUTO_CANCEL_NOTE = 'בוטל אוטומטית: סורבה ביום ההקמה';

/**
 * ── הוראת קבע ללא הגבלת זמן ───────────────────────────────────────────────
 *
 * ספק הסליקה כותב במייל ההקמה `מס' חיובים: ללא הגבלה` — טקסט, לא מספר.
 * זו הוראה שתיגבה כל חודש עד שמישהו יעצור אותה, ואלה בדרך כלל התורמים
 * הקבועים ביותר.
 *
 * הערך נשמר בעמודה **כפי שהוא**, כטקסט, כדי שמי שפותח את הגיליון יראה
 * בדיוק מה הספק אמר. הקוד מזהה אותו בכל מקום שבו הוא שואל "כמה תשלומים".
 *
 * להוראה כזו אין לוח זמנים שנגמר: החיובים נוצרים מחודש הפתיחה ועד החודש
 * הנוכחי בלבד, ולא נכתבים חיובים עתידיים אל תוך אינסוף.
 */
var UNLIMITED_TEXT = 'ללא הגבלה';

function isUnlimited_(v) {
  var s = String(v == null ? '' : v).trim();
  return !!s && asNumber_(s) <= 0;   // יש ערך, והוא אינו מספר חיובי
}

// ═══════════════════════════════════════════════════════════════════════════
//  התקנה
// ═══════════════════════════════════════════════════════════════════════════

function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  ensureSheet_(ss, SH.CONTACTS, COLS.CONTACTS);
  ensureSheet_(ss, SH.LOG,      COLS.LOG);
  ensureSheet_(ss, SH.HK,       COLS.HK);
  ensureSheet_(ss, SH.FAILURES, COLS.FAILURES);
  ensureSheet_(ss, SH.ALIASES,  COLS.ALIASES);
  ensureSheet_(ss, SH.RULES,    COLS.RULES);
  ensureSheet_(ss, SH.SYNC,     COLS.SYNC);

  seedNedarimRules_();
  flushWrites_();
  installTriggers_();
  styleLogSheet_();

  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('גיליון1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);

  alert_('הגיליון מוכן ✅\n\n' +
    'שימו לב: הלשוניות נוצרו אבל הן עדיין ריקות.\n' +
    'עוד שני צעדים לפני שיהיו נתונים באפליקציה:\n\n' +
    '1. פריסה ← פריסה חדשה ← אפליקציית אינטרנט\n' +
    '   לבצע בתור: עצמי   |   למי יש גישה: כולם\n' +
    '   ואת הכתובת שמסתיימת ב-/exec מעתיקים לאפליקציה.\n\n' +
    '2. תפריט "לוח בקרה" ← סריקת כל היסטוריית המיילים.\n' +
    '   זו הפעולה שממלאת את הגיליון. היא עשויה לקחת כמה דקות.\n\n' +
    'מכאן והלאה אין מה להריץ ידנית — האפליקציה מסנכרנת בכל טעינה,\n' +
    'ובנוסף יש ריצה יומית ב-06:00.\n\n' +
    'עוברים מגיליון ישן? הריצו עכשיו את migrateFromLegacy.');
}

/**
 * צביעה מותנה ליומן: חיוב עתידי באפור בהיר, חיוב שנכשל באדום חלש.
 * כך רואים במבט אחד מה כבר נכנס ומה רק צפוי — בלי לבלבל בין השניים.
 * מוגדר פעם אחת, בלי עלות בכל ריצה.
 */
function styleLogSheet_() {
  var t = table_(SH.LOG);
  if (!t.sheet) return;
  var c = t.col('סטטוס');
  if (c < 0) return;

  var letter = String.fromCharCode(65 + c); // A, B, C...
  var range = t.sheet.getRange(2, 1, t.sheet.getMaxRows() - 1, t.headers.length);

  var future = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$' + letter + '2="' + STATUS_FUTURE + '"')
    .setBackground('#F1F3F4').setFontColor('#9AA0A6').setItalic(true)
    .setRanges([range]).build();

  var failed = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$' + letter + '2="' + STATUS_FAILED + '"')
    .setBackground('#FCE8E6').setFontColor('#C5221F')
    .setRanges([range]).build();

  var cancelled = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$' + letter + '2="' + STATUS_CANCELLED + '"')
    .setBackground('#FFF8E1').setFontColor('#8D6E63').setStrikethrough(true)
    .setRanges([range]).build();

  t.sheet.setConditionalFormatRules([future, failed, cancelled]);
}

/** ריצות אוטומטיות. מוחק קודם כדי שהרצה חוזרת לא תיצור כפילויות. */
function installTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'dailySync' || fn === 'onEditHandler' || fn === 'backgroundSync') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailySync').timeBased().everyDays(1).atHour(6).create();
  ScriptApp.newTrigger('onEditHandler')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
}

/** הריצה היומית: מושכת מיילים חדשים ומייצרת חיובי הוראות קבע. */
function dailySync() {
  syncEmails(false);
  generateStandingOrderCharges();
  syncRebbeDate_();
}

/**
 * ── מתי נכתב לרבי בפעם האחרונה ────────────────────────────────────────────
 *
 * הדשבורד מציג כרטיס "כתיבה לרבי" עם התאריך האחרון. אפשר להקליד אותו ידנית,
 * אבל הכתיבה עוברת ממילא במייל לאוהל — אז אין סיבה שמישהו יזכור לעדכן.
 * מחפשים את המייל האחרון שנשלח לכתובת, ולוקחים ממנו את התאריך.
 *
 * **מעדכנים רק אם המייל מאוחר מהתאריך הרשום.** זה מכוון: כתיבה שלא עברה
 * במייל — נמסרה ביד, נשלחה בפקס, הוקראה בטלפון — מוקלדת ידנית, ואסור
 * שסריקה של מייל ישן יותר תמחק אותה.
 *
 * מריצים פעם ביום. אין טעם בתדירות גבוהה יותר, ולא נכון לשרוף חיפוש
 * ג'ימייל על כל טעינה של האפליקציה.
 */
var REBBE_EMAIL = 'ohel@ohelchabad.org';   // כתובת האוהל — שנו כאן אם צריך

function syncRebbeDate_() {
  if (!REBBE_EMAIL) return null;

  try {
    var threads = GmailApp.search('in:sent to:' + REBBE_EMAIL, 0, 1);
    if (!threads.length) return null;

    var msgs = threads[0].getMessages();
    if (!msgs.length) return null;
    var sent = msgs[msgs.length - 1].getDate();   // ההודעה האחרונה בשרשור

    var existing = toDate_(readSync_('rebbeDate'));
    if (existing && existing >= sent) return null;

    // נשמר כ-yyyy-MM-dd, הפורמט שהאפליקציה שולחת ב-updateRebbe
    writeSync_('rebbeDate', Utilities.formatDate(sent, Session.getScriptTimeZone(), 'yyyy-MM-dd'));
    Logger.log('תאריך הכתיבה לרבי עודכן ל-' + asDate_(sent));
    return sent;
  } catch (err) {
    // אין הרשאת ג'ימייל, או שהחיפוש נכשל — לא מפילים את הריצה היומית בגלל זה
    Logger.log('זיהוי הכתיבה לרבי נכשל: ' + err);
    return null;
  }
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  var existing = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];

  if (existing.join('') === '') {
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#0D1B2A').setFontColor('#C9A84C');
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
    return sh;
  }

  // הלשונית כבר קיימת. עמודה שנוספה לקוד אחרי שהגיליון הוקם חייבת להתווסף
  // גם כאן, אחרת הרצה חוזרת של setupSheet לא תעדכן גיליון ותיק — והקוד
  // יחפש עמודה שאינה קיימת. מוסיפים **בסוף בלבד**, ולא נוגעים בקיים.
  var current = existing.map(function (h) { return String(h).trim(); });
  var missing = headers.filter(function (h) { return current.indexOf(h) === -1; });
  if (missing.length) {
    sh.getRange(1, current.length + 1, 1, missing.length).setValues([missing])
      .setFontWeight('bold').setBackground('#0D1B2A').setFontColor('#C9A84C');
    sh.autoResizeColumns(1, current.length + missing.length);
  }
  return sh;
}

function alert_(msg) {
  try { SpreadsheetApp.getUi().alert(msg); }
  catch (e) { Logger.log(msg); } // רץ מטריגר, אין ממשק
}

// ═══════════════════════════════════════════════════════════════════════════
//  גישה לגיליון לפי שמות עמודות
// ═══════════════════════════════════════════════════════════════════════════

/**
 * קורא לשונית ומחזיר { headers, rows, sheet, col(name) }.
 * col('סכום') מחזיר את מספר האינדקס של העמודה, או -1.
 */
function table_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) return { headers: [], rows: [], sheet: null, col: function () { return -1; } };

  var values = sh.getDataRange().getValues();
  var headers = (values[0] || []).map(function (h) { return String(h).trim(); });
  var index = {};
  headers.forEach(function (h, i) { if (h) index[h] = i; });

  return {
    sheet: sh,
    headers: headers,
    rows: values.slice(1).filter(function (r) { return r.join('').trim() !== ''; }),
    col: function (n) { return index[n] === undefined ? -1 : index[n]; },
  };
}

/**
 * מוסיף שורה לפי מפת { שם עמודה: ערך } — לא תלוי בסדר העמודות.
 *
 * חשוב לביצועים: השורות **נצברות בזיכרון** ונכתבות בבת אחת ב-flushWrites_.
 * appendRow לכל שורה בנפרד הוא הדבר האיטי ביותר ב-Apps Script — בגיליון עם
 * אלף שורות הוא חורג ממגבלת ששת הדקות ונעצר באמצע. כתיבה מרוכזת אחת
 * מסיימת את אותה עבודה בשניות.
 */
var _writeQueue = {};

function appendByName_(sheetName, obj) {
  if (!_writeQueue[sheetName]) _writeQueue[sheetName] = [];
  _writeQueue[sheetName].push(obj);
  return true;
}

/** כותב לגיליון את כל מה שנצבר. חייב להיקרא בסוף כל פעולה שכותבת. */
function flushWrites_() {
  Object.keys(_writeQueue).forEach(function (sheetName) {
    var queued = _writeQueue[sheetName];
    if (!queued || !queued.length) return;

    var t = table_(sheetName);
    if (!t.sheet) return;

    // עמודות חדשות שהופיעו בנתונים ואינן בכותרות — נוספות פעם אחת
    var headers = t.headers.slice();
    var added = false;
    queued.forEach(function (obj) {
      Object.keys(obj).forEach(function (k) {
        if (k && headers.indexOf(k) === -1) { headers.push(k); added = true; }
      });
    });
    if (added) {
      t.sheet.getRange(1, 1, 1, headers.length).setValues([headers])
        .setFontWeight('bold').setBackground('#0D1B2A').setFontColor('#C9A84C');
    }

    var index = {};
    headers.forEach(function (h, i) { index[h] = i; });

    var matrix = queued.map(function (obj) {
      var row = new Array(headers.length).fill('');
      Object.keys(obj).forEach(function (k) {
        if (index[k] !== undefined) row[index[k]] = obj[k];
      });
      return row;
    });

    t.sheet.getRange(t.sheet.getLastRow() + 1, 1, matrix.length, headers.length).setValues(matrix);
    _writeQueue[sheetName] = [];
  });
}

function get_(row, t, name) {
  var c = t.col(name);
  return c < 0 ? '' : row[c];
}

// ═══════════════════════════════════════════════════════════════════════════
//  נירמול שמות
// ═══════════════════════════════════════════════════════════════════════════

var _aliases = null;

function standardName(name) {
  if (!name) return '';
  var clean = String(name).trim();
  if (_aliases === null) {
    _aliases = {};
    var t = table_(SH.ALIASES);
    t.rows.forEach(function (r) {
      var bad = String(r[0] || '').trim(), good = String(r[1] || '').trim();
      if (bad && good) _aliases[bad] = good;
    });
  }
  return _aliases[clean] || clean;
}

// ═══════════════════════════════════════════════════════════════════════════
//  מזהים ייחודיים — הלב של מניעת הכפילויות
// ═══════════════════════════════════════════════════════════════════════════

var _logIds = null;

/** אוסף את כל המזהים שכבר קיימים ביומן, פעם אחת לכל ריצה. */
function logIds_() {
  if (_logIds) return _logIds;
  _logIds = {};
  var t = table_(SH.LOG);
  t.rows.forEach(function (r) {
    var id = String(get_(r, t, 'מזהה') || '').trim();
    if (id) _logIds[id] = true;
  });
  return _logIds;
}

/** כותב שורה ליומן רק אם המזהה עוד לא קיים. מחזיר true אם נכתבה. */
function addLogRow_(entry) {
  var id = String(entry['מזהה'] || '').trim();
  if (!id) return false;
  var ids = logIds_();
  if (ids[id]) return false;
  appendByName_(SH.LOG, entry);
  ids[id] = true;
  return true;
}

/** מזהה חיוב הוראת קבע: קבוע לכל הוראה+חודש, ולכן לעולם לא ייווצר פעמיים. */
function hkChargeId_(orderId, year, month) {
  return 'hk:' + orderId + ':' + year + '-' + ('0' + (month + 1)).slice(-2);
}

// ═══════════════════════════════════════════════════════════════════════════
//  נקודות כניסה מהאפליקציה
// ═══════════════════════════════════════════════════════════════════════════

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  return json_(safe_(function () {
    var res = route_(action, {});
    flushWrites_();
    return res;
  }));
}

function doPost(e) {
  return json_(safe_(function () {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var res = route_(body.action || '', body);
    flushWrites_();
    return res;
  }));
}

function safe_(fn) {
  try { return fn(); }
  catch (err) { return { error: String(err), details: err && err.stack, success: false }; }
}

/**
 * ── סנכרון בכל טעינה של האפליקציה ────────────────────────────────────────
 *
 * הריצה היומית ב-06:00 לבדה משאירה את המשתמש מול נתונים בני עד יממה, בלי
 * שום דרך לדעת שהוא רק צריך לחכות. לכן טעינה של האפליקציה מפעילה סריקה.
 *
 * **אבל לא בתוך הבקשה עצמה.** טעינת האפליקציה שולחת תריסר בקשות במקביל,
 * וסריקת ג'ימייל בתוך אחת מהן מחזיקה אותה פתוחה שניות ארוכות. השאר
 * נתקעות מאחוריה, חלקן חוזרות כדף שגיאה של גוגל במקום JSON, והמשתמש
 * מקבל "שגיאת חיבור" ומרענן שלוש פעמים עד שזה עולה.
 *
 * לכן הבקשה רק **מתזמנת** ריצה חד-פעמית וחוזרת מיד. הסריקה רצה שנייה
 * אחר כך ברקע, והנתונים שהיא מביאה מופיעים ברענון הבא. תגובה מיידית עם
 * נתונים בני דקה עדיפה על המתנה של עשר שניות לנתונים בני שנייה.
 *
 * שלושה סייגים:
 *
 *  1. **ויסות.** חלון של AUTO_SYNC_MINUTES דקות — רענון אחד באפליקציה
 *     שולח כמה בקשות, וכולן חולקות תזמון אחד.
 *  2. **נעילה.** tryLock(0) בריצת הרקע — מי שלא קיבל אותה מדלג ולא ממתין.
 *  3. **בליעת שגיאות.** כשל בתזמון לא יפיל את התשובה לאפליקציה.
 *
 * שים לב: זה לא מחליף את `syncAllEmailHistory`. הסריקה ההיסטורית עדיין
 * מורצת ידנית פעם אחת מהתפריט — היא ארוכה מכדי לרוץ אפילו ברקע כאן.
 */
var AUTO_SYNC_MINUTES = 2;
var _autoSyncChecked = false;

function maybeSync_() {
  if (_autoSyncChecked) return;
  _autoSyncChecked = true;

  try {
    var props = PropertiesService.getScriptProperties();
    var last = Number(props.getProperty('lastAutoSync') || 0);
    if (Date.now() - last < AUTO_SYNC_MINUTES * 60 * 1000) return;

    // מסמנים לפני ולא אחרי: אם הסריקה נכשלת, לא רוצים שכל קריאה הבאה
    // תנסה שוב מיד ותתקע את האפליקציה בכל טעינה.
    props.setProperty('lastAutoSync', String(Date.now()));
    scheduleBackgroundSync_();
  } catch (err) {
    Logger.log('תזמון הסנכרון נכשל: ' + err);
  }
}

/**
 * קובע ריצה חד-פעמית בעוד שנייה. מוחק תחילה טריגר קודם שממתין, כדי
 * שרצף טעינות לא יצבור טריגרים (יש תקרה של 20 לסקריפט).
 */
function scheduleBackgroundSync_() {
  clearBackgroundSyncTriggers_();
  ScriptApp.newTrigger('backgroundSync').timeBased().after(1000).create();
}

function clearBackgroundSyncTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'backgroundSync') ScriptApp.deleteTrigger(t);
  });
}

/** הסריקה עצמה. רצה כטריגר, לא בתוך בקשה מהאפליקציה. */
function backgroundSync() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) return;   // כבר רצה סריקה — לא מפעילים שנייה
  try {
    syncEmails(false);
    generateStandingOrderCharges();
  } catch (err) {
    Logger.log('סנכרון הרקע נכשל: ' + err);
  } finally {
    lock.releaseLock();
    clearBackgroundSyncTriggers_();   // מנקים אחרינו
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function route_(action, body) {
  // כל פעולת קריאה מושכת קודם מיילים חדשים. פעולות כתיבה לא — המשתמש
  // מחכה לאישור, ואין טעם להוסיף לו סריקה באמצע.
  if (action.indexOf('get') === 0) maybeSync_();

  switch (action) {
    // קריאה
    case 'ping':             return { ok: true, sheet: SpreadsheetApp.getActiveSpreadsheet().getName() };
    case 'getSummary':       return getSummary_();
    case 'getDonations':     return { donations: getDonations_() };
    case 'getDonors':        return { donors: getDonors_() };
    case 'getHK':            return { hk: getHK_() };
    case 'getFailures':      return { failures: getFailures_() };
    case 'getRebbe':         return { date: readSync_('rebbeDate') || '' };
    case 'getCRM':           return { data: readSync_('crm') || {} };
    case 'getEvents':        return { data: readSync_('events') || [] };
    case 'getHolidayExtras': return { data: readSync_('holidayExtras') || {} };
    case 'getHistory':       return { data: readSync_('history') || [] };
    case 'getHomeVisits':    return { data: readSync_('homeVisits') || { rounds: [] } };
    case 'getProjects':      return { data: readSync_('projects') || [] };
    // הגדרות הארגון נשמרות גם בגיליון, כדי שמכשיר נוסף יצטרך רק את
    // כתובת הגיליון ולא יעבור שוב את כל האשף.
    case 'getConfig':        return { data: readSync_('orgConfig') || null };

    // כתיבה
    case 'saveCRM':           writeSync_('crm', body.data);           return { success: true };
    case 'saveEvents':        writeSync_('events', body.data);        return { success: true };
    case 'saveHolidayExtras': writeSync_('holidayExtras', body.data); return { success: true };
    case 'saveHistory':       writeSync_('history', body.data);       return { success: true };
    case 'saveHomeVisits':    writeSync_('homeVisits', body.data);    return { success: true };
    case 'saveProjects':      writeSync_('projects', body.data);      return { success: true };
    case 'updateRebbe':       writeSync_('rebbeDate', body.date);     return { success: true };
    case 'saveConfig':        writeSync_('orgConfig', body.data);      return { success: true };

    case 'addDonation':        return addDonation_(body);
    case 'addMeeting':         return addMeeting_(body);
    case 'addStandingOrder':   return addStandingOrder_(body);
    case 'cancelStandingOrder': return cancelStandingOrder_(body);
    case 'updateStandingOrderAmount': return updateStandingOrderAmount_(body);
    case 'updateDonorField':   return updateDonorField_(body);
    case 'updatePersonalDate': return updateDonorField_(body);
    case 'createHolidayDoc':   return createHolidayDoc_(body);
    case 'importRows':         return importRows_(body);
    case 'undoImport':         return { success: true, deleted: undoImport(String(body.tag || '')) };

    default: return { error: 'פעולה לא מוכרת: ' + action };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  קריאת נתונים
// ═══════════════════════════════════════════════════════════════════════════

/**
 * אנשי קשר.
 * האיבר הראשון במערך הוא שורת תרגום שמות העמודות (c0 → "שם מלא" וכו'),
 * ואחריו השורות עצמן. כך האפליקציה מציגה גם עמודות שהמשתמש הוסיף לבד,
 * בלי שנצטרך לדעת עליהן מראש.
 */
function getDonors_() {
  var t = table_(SH.CONTACTS);
  if (!t.headers.length) return [];

  var headerRow = {};
  t.headers.forEach(function (h, i) { headerRow['c' + i] = h; });

  var out = [headerRow];
  t.rows.forEach(function (r) {
    var o = {};
    t.headers.forEach(function (h, i) { o['c' + i] = fmt_(r[i]); });
    o.name = fmt_(r[0]);
    if (o.name) out.push(o);
  });
  return out;
}

/** היומן המשולב — תרומות ומפגשים באותו מבנה שהאפליקציה מצפה לו. */
function getDonations_() {
  var t = table_(SH.LOG);
  var out = [];
  t.rows.forEach(function (r) {
    if (!countsAsMoney_(get_(r, t, 'סטטוס'))) return; // כשל או חיוב עתידי — לא כסף שנכנס
    var name = fmt_(get_(r, t, 'שם'));
    if (!name) return;
    out.push({
      id:          fmt_(get_(r, t, 'מזהה')),
      name:        name,
      date:        asDate_(get_(r, t, 'תאריך תרומה')),
      amount:      asNumber_(get_(r, t, 'סכום')),
      purpose:     fmt_(get_(r, t, 'ייעוד')),
      method:      fmt_(get_(r, t, 'אפיק גבייה')),
      meetDate:    asDate_(get_(r, t, 'תאריך מפגש')),
      location:    fmt_(get_(r, t, 'מיקום מפגש')),
      meetPurpose: fmt_(get_(r, t, 'מטרת המפגש')),
      notes:       fmt_(get_(r, t, 'סיכום ותובנות')),
      source:      fmt_(get_(r, t, 'מקור')),
    });
  });
  return out;
}

/**
 * הוראות קבע.
 *
 * ── מה זה "נותרו" ─────────────────────────────────────────────────────────
 *
 * **מספר מועדי החיוב שעוד לפנינו בלוח השנה.** לא "כמה כסף חסר".
 *
 * ההבחנה הזו קריטית, וקודם היא הייתה שגויה. הוראה על 12 תשלומים שנפתחה
 * ביולי 2025 סיימה את לוח הזמנים שלה ביוני 2026 — הספק לא יגבה ממנה עוד
 * שקל, לא משנה כמה חיובים הצליחו בדרך. חישוב של "תשלומים פחות מה שנגבה"
 * הציג הוראה שאחד-עשר מחיוביה נכשלו כ"נותרו 1", כאילו עוד צפוי כסף, ואף
 * הציג הוראה שהסתיימה לגמרי כ"פעילה · נותרו 10".
 *
 * כמה כסף באמת נכנס מוצג בנפרד — `paid` מתוך `payments` — כי זו שאלה
 * אחרת לגמרי, וגם היא חשובה.
 */
function getHK_() {
  var t = table_(SH.HK);
  var charges = chargesByOrder_();
  var today = new Date();

  return t.rows.map(function (r) {
    var id = String(get_(r, t, 'מזהה') || '').trim();
    var rawPayments = get_(r, t, 'מספר תשלומים');
    var unlimited = isUnlimited_(rawPayments);
    var payments = asNumber_(rawPayments) || 0;
    var start = toDate_(get_(r, t, 'תאריך פתיחה'));
    var cancelDate = toDate_(get_(r, t, 'תאריך ביטול'));
    var done = charges[id] || { count: 0, last: null };

    // להוראה ללא הגבלה אין מועד סיום, ולכן אין מספר חיובים שנותרו.
    var remaining = (cancelDate || unlimited) ? 0 : futureCharges_(start, payments, today, null);

    return {
      id:         id,
      name:       standardName(get_(r, t, 'שם')),
      startDate:  asDate_(get_(r, t, 'תאריך פתיחה')),
      amount:     asNumber_(get_(r, t, 'סכום')),
      payments:   payments,
      unlimited:  unlimited,
      paid:       done.count,
      remaining:  remaining,
      lastBilled: done.last ? asDate_(done.last) : '',
      cancelDate: asDate_(get_(r, t, 'תאריך ביטול')),
      active:     !cancelDate && (unlimited || remaining > 0),
    };
  }).filter(function (h) { return h.name; });
}

/**
 * כמה ממועדי החיוב של ההוראה עוד לא הגיעו.
 * אותו לוח זמנים בדיוק שמייצר generateStandingOrderCharges — יום החיוב
 * הוא יום הפתיחה, ובחודש קצר מדי נופל ליום האחרון בו.
 */
function futureCharges_(start, payments, today, cancelDate) {
  if (!start || !payments) return 0;
  var billingDay = start.getDate();
  var cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  var count = 0;

  for (var i = 0; i < payments; i++) {
    var y = cursor.getFullYear(), m = cursor.getMonth();
    var d = new Date(y, m, Math.min(billingDay, daysInMonth_(y, m)));
    if (cancelDate && d >= cancelDate) break;
    if (d > today) count++;
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return count;
}

/** סופר כמה חיובים מוצלחים כבר קיימים ביומן לכל הוראת קבע, ומתי האחרון. */
function chargesByOrder_() {
  var t = table_(SH.LOG);
  var map = {};
  t.rows.forEach(function (r) {
    var id = String(get_(r, t, 'מזהה') || '');
    if (id.indexOf('hk:') !== 0) return;
    if (!countsAsMoney_(get_(r, t, 'סטטוס'))) return; // כשל או עתידי אינם חיוב שבוצע
    var orderId = id.split(':')[1];
    if (!map[orderId]) map[orderId] = { count: 0, last: null };
    map[orderId].count++;
    var d = get_(r, t, 'תאריך תרומה');
    if (d instanceof Date && (!map[orderId].last || d > map[orderId].last)) map[orderId].last = d;
  });
  return map;
}

function getFailures_() {
  var t = table_(SH.FAILURES);
  var out = t.rows.map(function (r) {
    return {
      date:   asDate_(get_(r, t, 'תאריך')),
      name:   fmt_(get_(r, t, 'שם')),
      order:  fmt_(get_(r, t, 'מזהה הוראה')),
      amount: fmt_(get_(r, t, 'סכום')),
      reason: fmt_(get_(r, t, 'סיבה')),
    };
  }).filter(function (f) { return f.name; });
  return out.slice(-40).reverse();
}

/**
 * סיכום לדשבורד.
 * חשוב: הסכום כולל את חיובי הוראות הקבע, כי הם יושבים באותו יומן כמו
 * כל תרומה אחרת. בגרסה הקודמת הם ישבו בלשונית נפרדת ולא נספרו כלל.
 */
function getSummary_() {
  var donations = getDonations_();
  var hk = getHK_();
  var now = new Date();

  var total = 0, thisMonth = 0, byMethod = {}, names = {};

  donations.forEach(function (d) {
    if (!d.amount) return;
    total += d.amount;
    names[d.name] = true;
    var m = d.method || 'אחר';
    byMethod[m] = (byMethod[m] || 0) + d.amount;

    var p = String(d.date).split('/');
    if (p.length === 3 && parseInt(p[1], 10) === now.getMonth() + 1 &&
        parseInt(p[2], 10) === now.getFullYear()) thisMonth += d.amount;
  });

  return {
    total: total,
    thisMonthTotal: thisMonth,
    donorCount: Object.keys(names).length,
    hkActive: hk.filter(function (h) { return h.active; }).length,
    failureCount: getFailures_().length,
    byMethod: byMethod,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  כתיבה מהאפליקציה
// ═══════════════════════════════════════════════════════════════════════════

function addDonation_(body) {
  var name = standardName(body.name);
  var amount = asNumber_(body.amount);
  if (!name || !amount) return { success: false, error: 'חסרים שם או סכום' };

  addLogRow_({
    'מזהה':        'man:' + new Date().getTime(),
    'שם':          name,
    'תאריך תרומה': body.date || todayStr_(),
    'סכום':        amount,
    'ייעוד':       body.purpose || '',
    'אפיק גבייה':  body.method || '',
    'סיכום ותובנות': body.notes || '',
    'מקור':        'ידני',
  });
  ensureContact_(name, body.phone, body.address);
  return { success: true };
}

function addMeeting_(body) {
  var name = standardName(body.name);
  if (!name) return { success: false, error: 'חסר שם' };

  addLogRow_({
    'מזהה':         'meet:' + new Date().getTime(),
    'שם':           name,
    'תאריך מפגש':   body.meetDate || body.date || todayStr_(),
    'מיקום מפגש':   body.location || body.meetType || '',
    'מטרת המפגש':   body.meetPurpose || body.purpose || '',
    'סיכום ותובנות': body.notes || '',
    'מקור':         'ידני',
  });
  ensureContact_(name, '', '');
  return { success: true };
}

/** הוספת הוראת קבע ידנית — מה שעד היום היה אפשרי רק בעריכה בגיליון. */
/**
 * הוספת הוראת קבע ידנית.
 *
 * לא כל הוראה מגיעה במייל: לפעמים ההודעה לא נשלחה, נמחקה, או שההוראה
 * הוקמה בטלפון מול הספק. הסימן היחיד הוא תרומה קבועה שחוזרת כל חודש.
 *
 * **כדאי מאוד למלא את מספר ההוראה האמיתי** מממשק הספק. הוא מה שיקשר בין
 * ההוראה הזו לבין מיילי הסירוב שיגיעו עליה בעתיד. בלעדיו נוצר מזהה
 * פנימי, וכשל שיגיע לא יידע לאיזו הוראה הוא שייך.
 */
function addStandingOrder_(body) {
  var name = standardName(body.name);
  var amount = asNumber_(body.amount);
  var unlimited = !!body.unlimited || isUnlimited_(body.payments);
  var payments = asNumber_(body.payments);

  if (!name) return { success: false, error: 'חסר שם התורם' };
  if (!amount) return { success: false, error: 'חסר סכום החיוב' };
  if (!unlimited && !payments) return { success: false, error: 'חסר מספר תשלומים' };

  var id = String(body.id || '').trim() || 'man' + new Date().getTime();
  if (hkIndex_()[id]) {
    return { success: false, error: 'הוראת קבע במספר ' + id + ' כבר קיימת בגיליון' };
  }

  appendByName_(SH.HK, {
    'מזהה':          id,
    'שם':            name,
    'תאריך פתיחה':   body.startDate || todayStr_(),
    'סכום':          amount,
    'מספר תשלומים':  unlimited ? UNLIMITED_TEXT : payments,
    'טלפון':         body.phone || '',
    'אימייל':        body.email || '',
    'קמפיין':        body.campaign || '',
    'הערות':         body.notes || '',
  });
  ensureContact_(name, body.phone, body.address);
  flushWrites_();      // ההוראה חייבת להיות בגיליון לפני ייצור החיובים
  _contactIndex = null;
  _hkIndex = null;
  _logIds = null;
  var created = generateStandingOrderCharges();
  return { success: true, id: id, created: created };
}

/**
 * ביטול הוראת קבע מהאפליקציה — כותב "תאריך ביטול" ותו לא.
 *
 * כל שאר העבודה נעשית ב-generateStandingOrderCharges: היא זו שמפסיקה
 * לייצר חיובים ומסמנת "מבוטל" את מה שכבר נוצר. ההפרדה הזו מכוונת —
 * הביטול הוא **עובדה אחת** בגיליון, והתוצאות שלה מחושבות מחדש בכל ריצה.
 * לכן ביטול דרך האפליקציה וכתיבה ידנית של התאריך בגיליון הם אותו דבר
 * בדיוק, ואי אפשר שהשניים ייצאו מסנכרון.
 *
 * body.date ריק = ביטול הביטול: מנקה את התאריך והחיובים חוזרים.
 */
function cancelStandingOrder_(body) {
  var id = String(body.id || '').trim();
  if (!id) return { success: false, error: 'חסר מזהה הוראה' };

  var t = table_(SH.HK);
  if (!t.sheet) return { success: false, error: 'לשונית הוראות הקבע לא נמצאה' };

  var cCancel = t.col('תאריך ביטול');
  if (cCancel < 0) {
    return { success: false, error: 'העמודה "תאריך ביטול" חסרה — הריצו setupSheet פעם אחת' };
  }
  var cNotes = t.col('הערות');

  for (var i = 0; i < t.rows.length; i++) {
    if (String(get_(t.rows[i], t, 'מזהה') || '').trim() !== id) continue;

    var date = body.date ? toDate_(body.date) : null;
    t.sheet.getRange(i + 2, cCancel + 1).setValue(date || '');

    if (cNotes >= 0) {
      var prev = String(t.rows[i][cNotes] || '').trim();
      var note = date
        ? 'בוטל ' + asDate_(date) + (body.reason ? ': ' + String(body.reason).trim() : '')
        : '';
      // מנקים סימוני ביטול קודמים כדי שלא יצטברו זה על גבי זה — אבל
      // **משאירים** את סימון הביטול האוטומטי. הוא לא הערה אלא זיכרון:
      // בלעדיו applySetupFailures_ הייתה מבטלת שוב את ההוראה בריצה הבאה,
      // ומבטלת בכך את הביטול שלך.
      var kept = prev.split(' · ').filter(function (p) {
        if (!p.trim()) return false;
        return p.indexOf('בוטל') !== 0 || p.indexOf('אוטומטית') >= 0;
      });
      if (note) kept.push(note);
      t.sheet.getRange(i + 2, cNotes + 1).setValue(kept.join(' · '));
    }

    _logIds = null;
    generateStandingOrderCharges();
    return { success: true, id: id, cancelDate: date ? asDate_(date) : '' };
  }

  return { success: false, error: 'הוראת קבע ' + id + ' לא נמצאה' };
}

/**
 * ── שינוי סכום של הוראת קבע ───────────────────────────────────────────────
 *
 * תורם שהעלה את ההוראה מ-₪100 ל-₪300 לא מייצר שום מייל אצל הספק, בדיוק
 * כמו ביטול. הגיליון מכיר רק את הסכום מיום ההקמה, וימשיך לספור 100 לנצח.
 *
 * ולא די בלתקן את הסכום בשורת ההוראה: החיובים החודשיים כבר נכתבו מראש
 * לכל תקופת ההתחייבות, וכל אחד מהם נושא את הסכום הישן. לכן מעדכנים כאן
 * גם אותם — **מהתאריך שנבחר והלאה בלבד**.
 *
 * חיוב שנכשל או שבוטל לא נגעים בו: הוא לא ייגבה, והסכום שרשום עליו הוא
 * חלק מהתיעוד של מה שקרה.
 */
function updateStandingOrderAmount_(body) {
  var id = String(body.id || '').trim();
  var amount = asNumber_(body.amount);
  var from = toDate_(body.date);
  if (!id) return { success: false, error: 'חסר מזהה הוראה' };
  if (!amount || amount <= 0) return { success: false, error: 'סכום חייב להיות גדול מאפס' };
  if (!from) return { success: false, error: 'חסר תאריך תחילת הסכום החדש' };

  var t = table_(SH.HK);
  if (!t.sheet) return { success: false, error: 'לשונית הוראות הקבע לא נמצאה' };
  var cAmount = t.col('סכום'), cNotes = t.col('הערות');
  if (cAmount < 0) return { success: false, error: 'עמודת הסכום לא נמצאה' };

  var row = -1, oldAmount = 0;
  for (var i = 0; i < t.rows.length; i++) {
    if (String(get_(t.rows[i], t, 'מזהה') || '').trim() !== id) continue;
    row = i + 2;
    oldAmount = asNumber_(t.rows[i][cAmount]);
    break;
  }
  if (row < 0) return { success: false, error: 'הוראת קבע ' + id + ' לא נמצאה' };

  t.sheet.getRange(row, cAmount + 1).setValue(amount);
  if (cNotes >= 0) {
    var prev = String(t.rows[row - 2][cNotes] || '').trim();
    var note = 'סכום שונה מ-₪' + oldAmount + ' ל-₪' + amount + ' החל מ-' + asDate_(from);
    t.sheet.getRange(row, cNotes + 1).setValue(prev ? prev + ' · ' + note : note);
  }

  // ── והחיובים עצמם ────────────────────────────────────────────────────────
  var logT = table_(SH.LOG);
  var cId = logT.col('מזהה'), cDate = logT.col('תאריך תרומה');
  var cLogAmount = logT.col('סכום'), cStatus = logT.col('סטטוס');
  var updated = 0;

  if (logT.sheet && cId >= 0 && cLogAmount >= 0) {
    var prefix = 'hk:' + id + ':';
    logT.rows.forEach(function (r, i) {
      if (String(r[cId] || '').indexOf(prefix) !== 0) return;
      var status = cStatus >= 0 ? String(r[cStatus] || '').trim() : '';
      if (status === STATUS_FAILED || status === STATUS_CANCELLED) return;
      var d = toDate_(r[cDate]);
      if (!d || d < from) return;
      logT.sheet.getRange(i + 2, cLogAmount + 1).setValue(amount);
      updated++;
    });
  }

  Logger.log('הוראה ' + id + ': הסכום שונה ל-₪' + amount + ', עודכנו ' + updated + ' חיובים');
  return { success: true, id: id, amount: amount, updated: updated, from: asDate_(from) };
}

/** מעדכן תא בודד באנשי הקשר. יוצר את העמודה אם היא לא קיימת, ואת השורה אם צריך. */
function updateDonorField_(body) {
  var name = standardName(body.name);
  var field = String(body.field || body.key || '').trim();
  if (!name || !field) return { success: false, error: 'חסר שם או שם שדה' };

  var t = table_(SH.CONTACTS);
  if (!t.sheet) return { success: false, error: 'לשונית אנשי הקשר לא נמצאה' };

  var col = t.col(field);
  if (col === -1) {
    col = t.headers.length;
    t.sheet.getRange(1, col + 1).setValue(field).setFontWeight('bold')
      .setBackground('#0D1B2A').setFontColor('#C9A84C');
  }

  var row = -1;
  for (var i = 0; i < t.rows.length; i++) {
    if (standardName(t.rows[i][0]) === name) { row = i + 2; break; } // +2: כותרת + בסיס 1
  }
  if (row === -1) { t.sheet.appendRow([name]); row = t.sheet.getLastRow(); }

  t.sheet.getRange(row, col + 1).setValue(body.value);
  return { success: true };
}

/**
 * מפתח שמות אנשי הקשר, נטען פעם אחת לכל ריצה.
 * בלי המטמון הזה כל בדיקת "האם איש הקשר קיים" קוראת מחדש את כל הגיליון,
 * ובייבוא של אלף שורות זה הופך לאלף קריאות מלאות — הסיבה השנייה
 * לחריגה ממגבלת הזמן.
 */
var _contactIndex = null;

function contactIndex_() {
  if (_contactIndex) return _contactIndex;
  _contactIndex = {};
  var t = table_(SH.CONTACTS);
  t.rows.forEach(function (r, i) {
    var n = standardName(r[0]);
    if (n) _contactIndex[n] = { row: i + 2, data: r };
  });
  return _contactIndex;
}

/** מוסיף איש קשר אם אינו קיים, ומשלים טלפון/כתובת רק אם הם ריקים. */
function ensureContact_(name, phone, address) {
  if (!name) return;
  var idx = contactIndex_();
  var existing = idx[name];

  if (existing) {
    if (!existing.row) return; // עדיין בתור הכתיבה — יישמר בהמשך
    var t = table_(SH.CONTACTS);
    var cPhone = t.col('טלפון'), cAddr = t.col('כתובת');
    if (phone && cPhone >= 0 && !String(existing.data[cPhone] || '').trim()) {
      t.sheet.getRange(existing.row, cPhone + 1).setValue(phone);
      existing.data[cPhone] = phone;
    }
    if (address && cAddr >= 0 && !String(existing.data[cAddr] || '').trim()) {
      t.sheet.getRange(existing.row, cAddr + 1).setValue(address);
      existing.data[cAddr] = address;
    }
    return;
  }

  idx[name] = { row: 0, data: [] };
  appendByName_(SH.CONTACTS, { 'שם מלא': name, 'טלפון': phone || '', 'כתובת': address || '' });
}

/**
 * ייבוא מרוכז מהאפליקציה (כרטיסי הייבוא עם ה-AI).
 * body.contacts / body.donations / body.standingOrders — מערכים.
 * כל שורה מקבלת מזהה עם קידומת imp: ותווית מקור, כך שאפשר לבטל ייבוא שלם.
 */
function importRows_(body) {
  var tag = 'imp' + new Date().getTime();
  var added = { contacts: 0, donations: 0, standingOrders: 0 };

  // אנשי הקשר נכתבים בשני מעברים, וזה הכרחי ולא סגנוני:
  //   · ensureContact_ מוסיף שורה ל**תור הכתיבה** (appendByName_), והיא
  //     מגיעה לגיליון רק ב-flushWrites_.
  //   · updateDonorField_ כותב **מיד** לגיליון, ולכן הוא לא רואה שורה
  //     שעדיין יושבת בתור — ומוסיף שורה שנייה לאותו אדם.
  // מעבר ראשון יוצר, פליטה, ואיפוס האינדקס — ואז מעבר שני ממלא שדות
  // על שורות שכבר קיימות באמת.
  var contacts = (body.contacts || []).filter(function (c) { return c && c['שם מלא']; });

  contacts.forEach(function (c) {
    ensureContact_(standardName(c['שם מלא']), c['טלפון'], c['כתובת']);
    added.contacts++;
  });
  flushWrites_();
  _contactIndex = null;

  contacts.forEach(function (c) {
    Object.keys(c).forEach(function (k) {
      if (k === 'שם מלא' || k === 'טלפון' || k === 'כתובת' || !c[k]) return;
      updateDonorField_({ name: c['שם מלא'], field: k, value: c[k] });
    });
  });

  (body.donations || []).forEach(function (d, i) {
    if (!d || !d.name) return;
    var ok = addLogRow_({
      'מזהה':        d.id ? 'imp:' + d.id : tag + ':' + i,
      'שם':          standardName(d.name),
      'תאריך תרומה': d.date || '',
      'סכום':        asNumber_(d.amount),
      'ייעוד':       d.purpose || '',
      'אפיק גבייה':  d.method || '',
      'סיכום ותובנות': d.notes || '',
      'מקור':        'ייבוא ' + tag,
    });
    if (ok) { ensureContact_(standardName(d.name), d.phone, d.address); added.donations++; }
  });

  (body.standingOrders || []).forEach(function (h) {
    if (!h || !h.name) return;
    addStandingOrder_(h);
    added.standingOrders++;
  });

  flushWrites_();
  return { success: true, added: added, tag: tag };
}

/**
 * מבטל ייבוא שלם לפי התווית שלו — מוחק רק את שורות היומן שאותו ייבוא הוסיף.
 *
 * מה שהוא **לא** מבטל, במכוון: אנשי קשר והוראות קבע. איש קשר שנוצר בייבוא
 * כבר עשוי לצבור תרומות ומפגשים משלו, והוראת קבע כבר ייצרה חיובים חודשיים
 * ביומן. מחיקה שלהם הייתה משאירה שורות יתומות שמצביעות לשומקום. את שני
 * אלה מסירים ידנית מהגיליון, ולכן האפליקציה אומרת את זה במפורש למשתמש.
 */
function undoImport(tag) {
  if (!tag) return 0;
  var t = table_(SH.LOG);
  var c = t.col('מקור');
  if (c < 0 || !t.sheet) return 0;
  var deleted = 0;
  for (var i = t.rows.length - 1; i >= 0; i--) {
    if (String(t.rows[i][c] || '').indexOf(tag) >= 0) { t.sheet.deleteRow(i + 2); deleted++; }
  }
  _logIds = null; // המזהים שנמחקו זמינים שוב
  Logger.log('בוטלו ' + deleted + ' שורות מהייבוא ' + tag);
  return deleted;
}

function createHolidayDoc_(body) {
  var title = (body.holidayName || 'חג') + ' — ' + (body.dateStr || '');
  var doc = DocumentApp.create(title);
  var b = doc.getBody();
  b.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.TITLE);
  b.appendParagraph('משימות:').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  b.appendListItem(' ').setGlyphType(DocumentApp.GlyphType.BULLET);
  b.appendParagraph('תקציב:').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  b.appendParagraph('סיכום:').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  doc.saveAndClose();
  DriveApp.getFileById(doc.getId())
    .setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
  return { success: true, url: doc.getUrl(), title: title };
}

/** שם שנערך ידנית ביומן — מוודא שיש לו כרטיס איש קשר. */
function onEditHandler(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet();
  if (sh.getName() !== SH.LOG) return;
  var t = table_(SH.LOG);
  if (e.range.getColumn() !== t.col('שם') + 1) return;
  ensureContact_(standardName(e.range.getValue()), '', '');
  flushWrites_();
}

// ═══════════════════════════════════════════════════════════════════════════
//  מנוע הוראות קבע
// ═══════════════════════════════════════════════════════════════════════════

/**
 * מייצר את כל חיובי הוראות הקבע שחסרים — מחודש הפתיחה ועד היום.
 * אידמפוטנטי לחלוטין: כל חיוב נושא מזהה קבוע (hk:<הוראה>:<שנה-חודש>),
 * ולכן הרצה חוזרת לא יוצרת כלום. אותה פונקציה משמשת גם לריצה היומית
 * וגם להשלמת פערים היסטוריים — אין צורך בשתי פונקציות נפרדות.
 *
 * הוראה עם "תאריך ביטול" נעצרת שם: חיובים מהתאריך ההוא והלאה לא נוצרים,
 * ומה שכבר נוצר בעבר מסומן "מבוטל". הסימון רץ בכל הרצה ולא רק פעם אחת,
 * ולכן מספיק למלא את התאריך בגיליון — הגיליון יתקן את עצמו מעצמו.
 */
function generateStandingOrderCharges() {
  applySetupFailures_();

  var t = table_(SH.HK);
  var today = new Date();
  var created = 0, matured = 0, cancelled = 0;

  // מפת כל חיובי ההוראות שכבר ביומן: מזהה → { שורה, סטטוס }.
  // צריך את **כולם** ולא רק את ה"עתידי", כי ביטול צריך לתפוס גם חיובים
  // שנרשמו בעבר כאילו בוצעו — הם בדיוק הכסף המדומיין שאנחנו מנקים.
  var logT = table_(SH.LOG);
  var cId = logT.col('מזהה'), cStatus = logT.col('סטטוס');
  var logRows = {};
  logT.rows.forEach(function (r, i) {
    var rid = String(r[cId] || '').trim();
    if (rid.indexOf('hk:') !== 0) return;
    logRows[rid] = { row: i + 2, status: String(r[cStatus] || '').trim() };
  });

  t.rows.forEach(function (r) {
    var id = String(get_(r, t, 'מזהה') || '').trim();
    var name = standardName(get_(r, t, 'שם'));
    var start = toDate_(get_(r, t, 'תאריך פתיחה'));
    var amount = asNumber_(get_(r, t, 'סכום'));
    var rawPayments = get_(r, t, 'מספר תשלומים');
    var unlimited = isUnlimited_(rawPayments);
    var payments = asNumber_(rawPayments);
    if (!id || !name || !start || !amount) return;
    if (!unlimited && !payments) return;

    var cancelDate = toDate_(get_(r, t, 'תאריך ביטול'));
    var billingDay = start.getDate();
    var cursor = new Date(start.getFullYear(), start.getMonth(), 1);

    // הוראה ללא הגבלה: מייצרים עד החודש הנוכחי בלבד. אין לוח זמנים שנגמר,
    // ולכן אין משמעות ל"כל התשלומים מראש" — זו הייתה כתיבה אינסופית.
    // התקרה היא הגנה מפני תאריך פתיחה שגוי בגיליון.
    var rounds = unlimited
      ? Math.min(600, (today.getFullYear() - start.getFullYear()) * 12 +
                      (today.getMonth() - start.getMonth()) + 1)
      : payments;

    // בהוראה רגילה כל התשלומים נרשמים מראש — כך רואים בגיליון את ההתחייבות
    // המלאה. מה שמועדו עוד לא הגיע מסומן "עתידי", לא נספר ככסף, ולא נספר
    // כחיוב שבוצע. בכל הרצה נבדק מי מהם הבשיל בינתיים.
    for (var made = 0; made < rounds; made++) {
      var y = cursor.getFullYear(), m = cursor.getMonth();
      var day = Math.min(billingDay, daysInMonth_(y, m));
      var chargeDate = new Date(y, m, day);
      var isFuture = chargeDate > today;
      var chargeId = hkChargeId_(id, y, m);
      var existing = logRows[chargeId];

      // ── ההוראה כבר לא בתוקף בתאריך הזה ──────────────────────────────
      if (cancelDate && chargeDate >= cancelDate) {
        // "נכשל" נשאר "נכשל": זה אירוע אמיתי עם סיבה רשומה, ולא צריך
        // לטשטש אותו. כל השאר הופך למבוטל ויוצא מהכסף ומהספירה.
        if (existing && existing.status !== STATUS_CANCELLED &&
            existing.status !== STATUS_FAILED && cStatus >= 0) {
          logT.sheet.getRange(existing.row, cStatus + 1).setValue(STATUS_CANCELLED);
          cancelled++;
        }
        cursor.setMonth(cursor.getMonth() + 1);
        continue;
      }

      if (!logIds_()[chargeId]) {
        addLogRow_({
          'מזהה':        chargeId,
          'שם':          name,
          'תאריך תרומה': chargeDate,
          'סכום':        amount,
          'ייעוד':       fmt_(get_(r, t, 'קמפיין')),
          'אפיק גבייה':  'הוראת קבע',
          'מקור':        'הוראת קבע ' + id,
          'סטטוס':       isFuture ? STATUS_FUTURE : '',
        });
        created++;
      } else if (!isFuture && existing && existing.status === STATUS_FUTURE && cStatus >= 0) {
        // הגיע מועדו של חיוב שהיה מסומן עתידי — הופך לחיוב שבוצע
        logT.sheet.getRange(existing.row, cStatus + 1).setValue('');
        matured++;
      }

      cursor.setMonth(cursor.getMonth() + 1);
    }
  });

  flushWrites_();
  if (created || matured || cancelled) {
    Logger.log('נוצרו ' + created + ' חיובי הוראת קבע, ' + matured +
               ' הבשילו, ' + cancelled + ' סומנו כמבוטלים');
  }
  return created;
}

/**
 * ── סירוב ביום ההקמה = ההוראה מעולם לא יצאה לדרך ─────────────────────────
 *
 * נדרים פלוס שולחת שני מיילים נפרדים שאינם יודעים זה על זה: "הוראת קבע
 * חדשה" ואחריו "שגיאה / סירוב". מייל הסירוב מנוסח כאילו הוא מדבר על חיוב
 * בודד, ולכן הקוד סימן חיוב אחד כנכשל והמשיך לייצר את כל השאר. אבל כשהסירוב
 * מגיע באותו יום שבו ההוראה הוקמה, הכרטיס נדחה כבר בחיוב הראשון — ההוראה
 * לא קיימת, ואחד-עשר החיובים הבאים הם כסף שלא היה ולא נברא.
 *
 * המימוש נגזר מלשונית "כשלי חיוב" ולא ממייל בודד, ולכן הוא:
 *   · אינו תלוי בסדר שבו נסרקו המיילים (סירוב יכול להיקלט לפני ההקמה),
 *   · עובד רטרואקטיבית על מה שכבר יושב בגיליון,
 *   · אידמפוטנטי — הרצה חוזרת לא משנה דבר.
 *
 * ביטול שנעשה כאן ניתן לביטול: מוחקים את "תאריך ביטול" והחיובים חוזרים.
 */
function applySetupFailures_() {
  var hkT = table_(SH.HK);
  var cCancel = hkT.col('תאריך ביטול');
  if (cCancel < 0 || !hkT.sheet) return 0;   // גיליון ותיק שטרם קיבל את העמודה

  var cNotes = hkT.col('הערות');
  var failT = table_(SH.FAILURES);
  var applied = 0;

  // תאריך הכשל המוקדם ביותר לכל הוראה
  var firstFailure = {};
  failT.rows.forEach(function (r) {
    var order = String(get_(r, failT, 'מזהה הוראה') || '').trim();
    var d = toDate_(get_(r, failT, 'תאריך'));
    if (!order || !d) return;
    if (!firstFailure[order] || d < firstFailure[order]) firstFailure[order] = d;
  });

  hkT.rows.forEach(function (r, i) {
    var id = String(get_(r, hkT, 'מזהה') || '').trim();
    if (!id || String(r[cCancel] || '').trim()) return;   // כבר מבוטל — לא נוגעים

    // כבר ביטלנו את ההוראה הזו פעם אחת, ומישהו מחק את התאריך במכוון —
    // כנראה התורם תיקן את הכרטיס. לא כופים עליו את הביטול שוב.
    if (cNotes >= 0 && String(r[cNotes] || '').indexOf(AUTO_CANCEL_NOTE) >= 0) return;

    var start = toDate_(get_(r, hkT, 'תאריך פתיחה'));
    var fail = firstFailure[id];
    if (!start || !fail) return;

    var days = Math.floor((fail - start) / 86400000);
    if (days < 0 || days > SETUP_FAILURE_DAYS) return;

    hkT.sheet.getRange(i + 2, cCancel + 1).setValue(start);
    if (cNotes >= 0) {
      var prev = String(r[cNotes] || '').trim();
      hkT.sheet.getRange(i + 2, cNotes + 1)
        .setValue((prev ? prev + ' · ' : '') + AUTO_CANCEL_NOTE);
    }
    applied++;
  });

  if (applied) Logger.log(applied + ' הוראות קבע בוטלו — סורבו ביום ההקמה');
  return applied;
}

function daysInMonth_(y, m) { return new Date(y, m + 1, 0).getDate(); }

/**
 * מסמן חיוב כנכשל במקום למחוק אותו.
 * זה ההבדל המהותי מהגרסה הקודמת: מחיקה גרמה למונה "נותרו" לרוץ קדימה
 * בלי דרך חזרה. סימון משאיר את השורה, מוציא אותה מהכסף ומהספירה,
 * והחודש הזה ייווצר שוב בהרצה הבאה — בדיוק כמו שקורה במציאות.
 */
function markChargeFailed_(orderId, failDate, reason, amount, name) {
  var t = table_(SH.LOG);
  if (!t.sheet) return;
  var chargeId = hkChargeId_(orderId, failDate.getFullYear(), failDate.getMonth());
  var cId = t.col('מזהה'), cStatus = t.col('סטטוס'), cNotes = t.col('סיכום ותובנות');

  for (var i = 0; i < t.rows.length; i++) {
    if (String(t.rows[i][cId] || '').trim() !== chargeId) continue;
    if (cStatus >= 0) t.sheet.getRange(i + 2, cStatus + 1).setValue(STATUS_FAILED);
    if (cNotes >= 0) t.sheet.getRange(i + 2, cNotes + 1).setValue(reason || '');
    return;
  }

  // החיוב עוד לא נוצר — כותבים אותו ישירות כנכשל, כדי שלא ייווצר אחר כך כמוצלח
  addLogRow_({
    'מזהה': chargeId, 'שם': name, 'תאריך תרומה': failDate, 'סכום': asNumber_(amount),
    'אפיק גבייה': 'הוראת קבע', 'מקור': 'הוראת קבע ' + orderId,
    'סטטוס': STATUS_FAILED, 'סיכום ותובנות': reason || '',
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  סנכרון מיילים
// ═══════════════════════════════════════════════════════════════════════════

/**
 * כללי הפרסור יושבים בלשונית "כללי מייל" ולא בקוד, כדי שאפשר יהיה
 * להוסיף ספק סליקה חדש בלי לגעת בסקריפט. נדרים פלוס מגיע כברירת מחדל.
 *
 * עמודת "שדות (JSON)" ממפה שם שדה בגיליון ← התווית שמופיעה בגוף המייל.
 * "סוג": donation (תרומה) או failure (כשל חיוב).
 */
function seedNedarimRules_() {
  // מוסיפים רק כללים שחסרים, לפי שם הכלל. הגרסה הקודמת דילגה על הכל אם
  // כבר היה ולו כלל אחד — ולכן מי שהתקין לפני שנוסף כלל חדש לא קיבל אותו
  // לעולם. כאן כלל שנערך ידנית נשמר, וכלל חדש עדיין מגיע.
  var t = table_(SH.RULES);
  var existing = {};
  t.rows.forEach(function (r) {
    var n = String(get_(r, t, 'שם הכלל') || '').trim();
    if (n) existing[n] = true;
  });

  DEFAULT_RULES.forEach(function (rule) {
    if (existing[rule['שם הכלל']]) return;
    appendByName_(SH.RULES, rule);
  });
}

/**
 * אבחון: מה בעצם מוצא כל כלל בתיבת הדואר, ובאיזה חשבון אנחנו רצים.
 * מריצים כשמשהו "לא נקלט" — התשובה כמעט תמיד כאן.
 */
function debugMailRules() {
  var lines = ['🔍 אבחון קליטת מיילים', '',
               'הסקריפט רץ בחשבון:', '   ' + Session.getActiveUser().getEmail(), ''];

  var t = table_(SH.RULES);
  if (!t.rows.length) {
    lines.push('⚠️ לשונית "כללי מייל" ריקה — הריצו refreshMailRules');
  }

  t.rows.forEach(function (r) {
    var name = String(get_(r, t, 'שם הכלל') || '');
    var query = String(get_(r, t, 'חיפוש בגימייל') || '').trim();
    var active = String(get_(r, t, 'פעיל') || '').trim() === 'כן';
    var found = 0;
    try { found = GmailApp.search(query).length; } catch (e) { found = -1; }
    lines.push((active ? '' : '(כבוי) ') + name + ':  ' +
               (found < 0 ? 'שגיאה בחיפוש' : found + ' שיחות'));
    lines.push('   ' + query);
  });

  // כמה מיילים בכלל יש מנדרים בתיבה הזו — מפריד בין "אין מיילים"
  // לבין "החיפוש לא תפס".
  // מחפשים לפי חתימת המערכת בגוף ההודעה ולא לפי שולח, כי מיילים
  // שהועברו ממרכז אחר נושאים שולח שונה.
  var all = 0, sample = [];
  try {
    var th = GmailApp.search('"מערכת נדרים פלוס"');
    all = th.length;
    th.slice(0, 5).forEach(function (x) { sample.push('   • ' + x.getFirstMessageSubject()); });
  } catch (e) { all = -1; }

  lines.push('', 'סה"כ מיילים מנדרים פלוס בתיבה: ' + all);
  if (sample.length) lines.push('דוגמאות לשורות נושא:', sample.join('\n'));
  if (all === 0) {
    lines.push('', '⚠️ אין בתיבה הזו אף מייל מנדרים.',
               'ייתכן שהמיילים מגיעים לחשבון אחר — אז צריך להעביר את הגיליון',
               'לאותו חשבון, או להגדיר העברה אוטומטית של המיילים לכאן.');
  }

  alert_(lines.join('\n'));
}

/** מוסיף כללי מייל חסרים לגיליון קיים. בטוח להרצה חוזרת. */
function refreshMailRules() {
  seedNedarimRules_();
  var n = (_writeQueue[SH.RULES] || []).length;
  flushWrites_();
  alert_(n ? 'נוספו ' + n + ' כללי מייל חדשים.\n\nהריצו עכשיו "סריקת כל היסטוריית המיילים".'
           : 'כל כללי המייל כבר קיימים — לא היה מה להוסיף.');
}

/**
 * כללי ברירת המחדל של נדרים פלוס.
 *
 * "סוג" קובע מה עושים עם המייל:
 *   donation      — תרומה, נכנסת ליומן
 *   standingOrder — הקמת הוראת קבע, נכנסת ללשונית הוראות קבע
 *   failure       — סירוב חיוב
 *
 * "שדות (JSON)" ממפה שם שדה פנימי ← התווית שמופיעה בגוף המייל.
 */
var DEFAULT_RULES = [
  {
    'פעיל': 'כן',
    'שם הכלל': 'נדרים פלוס — תרומה',
    'חיפוש בגימייל': 'subject:"[נדרים פלוס] התקבלה עסקה חדשה"',
    'סוג': 'donation',
    'שדות (JSON)': JSON.stringify({
      name: 'שם:', date: 'תאריך עסקה:', amount: 'סכום:', purpose: 'קטגוריה:',
      phone: 'טלפון:', address: 'כתובת:', id: 'מספר אישור:', payments: 'תשלומים:',
    }),
  },
  {
    // מייל הקמת הוראת קבע — המקור היחיד להוראות הקבע.
    //
    // מסננים לפי ביטוי בגוף ההודעה ולא לפי שולח, כי הרבה שלוחים מקבלים
    // את המיילים **בהעברה** ממרכז אחר — ואז השולח כבר אינו נדרים פלוס
    // וסינון לפי from: לא מוצא כלום. "תדירות גביה" מופיע רק במייל הזה.
    'פעיל': 'כן',
    'שם הכלל': 'נדרים פלוס — הקמת הוראת קבע',
    'חיפוש בגימייל': 'subject:"[נדרים פלוס] הוראת קבע חדשה"',
    'סוג': 'standingOrder',
    'שדות (JSON)': JSON.stringify({
      id: 'מספר הוראה:', name: 'שם תורם:', amount: 'סכום כל חיוב:',
      startDate: 'תאריך חיוב הבא:', payments: "מס' חיובים:",
      phone: 'טלפון:', email: 'מייל:', address: 'כתובת:', campaign: 'קטגוריה:',
    }),
  },
  {
    'פעיל': 'כן',
    'שם הכלל': 'נדרים פלוס — כשל הוראת קבע',
    'חיפוש בגימייל': 'subject:"[נדרים פלוס] שגיאה / סירוב - הוראת קבע"',
    'סוג': 'failure',
    'שדות (JSON)': JSON.stringify({
      name: 'שם לקוח:', order: 'מספר הוראה:', amount: 'סכום:', reason: 'סיבת שגיאה:',
    }),
  },
];

var LABEL_NAME = 'לוח בקרה — נקלט';

/** התווית שמסמנת שרשור שכבר נקלט. נוצרת בפעם הראשונה. */
function processedLabel_() {
  return GmailApp.getUserLabelByName(LABEL_NAME) || GmailApp.createLabel(LABEL_NAME);
}

/** @param {boolean} all — true סורק את כל ההיסטוריה, false רק יומיים אחרונים. */
function syncEmails(all) {
  var t = table_(SH.RULES);
  var added = 0, failures = 0, orders = 0;

  t.rows.forEach(function (r) {
    if (String(get_(r, t, 'פעיל') || '').trim() !== 'כן') return;
    var query = String(get_(r, t, 'חיפוש בגימייל') || '').trim();
    var kind = String(get_(r, t, 'סוג') || '').trim();
    if (!query) return;

    var fields;
    try { fields = JSON.parse(get_(r, t, 'שדות (JSON)') || '{}'); }
    catch (e) { return; }

    // סורקים במנות, ומדלגים על שרשורים שכבר טופלו (תווית בג'ימייל).
    // כך סריקה היסטורית של אלפי מיילים לא נופלת על מגבלת הזמן, וריצה
    // חוזרת לא עוברת שוב על מה שכבר נקלט.
    var label = processedLabel_();
    var q = (all ? query : query + ' newer_than:3d') + ' -label:' + LABEL_NAME;
    var handled = [];

    for (var page = 0; page < 20; page++) {
      var threads = GmailApp.search(q, 0, 100);
      if (!threads.length) break;

      threads.forEach(function (th) {
      th.getMessages().forEach(function (msg) {
        var body = cleanBody_(msg.getPlainBody());
        if (!body) return;
        if (kind === 'failure') failures += handleFailureEmail_(body, msg.getDate(), fields) ? 1 : 0;
        else if (kind === 'standingOrder') orders += handleStandingOrderEmail_(body, fields) ? 1 : 0;
        else added += handleDonationEmail_(body, msg.getDate(), fields) ? 1 : 0;
      });
      handled.push(th);
      });

      // מסמנים **רק אחרי** שהכתיבה הצליחה. אם נסמן לפני והכתיבה תיכשל,
      // המיילים האלה לא ייסרקו שוב לעולם והנתונים יאבדו.
      flushWrites_();
      handled.forEach(function (th) { th.addLabel(label); });
      handled = [];
    }
  });

  flushWrites_();
  // הוראות קבע חדשות צריכות לקבל מיד את החיובים שכבר הגיע מועדם
  if (orders) { _hkIndex = null; generateStandingOrderCharges(); }

  Logger.log('נקלטו ' + added + ' תרומות, ' + orders + ' הוראות קבע ו-' + failures + ' כשלים');
  return { added: added, orders: orders, failures: failures };
}

function syncAllEmailHistory() {
  var res = syncEmails(true);
  var created = generateStandingOrderCharges();
  alert_('הסריקה ההיסטורית הושלמה ✅\n\n' +
         'תרומות שנקלטו:  ' + res.added + '\n' +
         'הוראות קבע שנקלטו:  ' + res.orders + '\n' +
         'חיובים חודשיים שנוצרו:  ' + created + '\n' +
         'כשלי חיוב:  ' + res.failures);
}

/**
 * מייל הקמת הוראת קבע מנדרים פלוס.
 * זה המקור היחיד להוראות הקבע — אין מייל על כל חיוב חודשי, ולכן
 * החיובים עצמם מיוצרים על ידי generateStandingOrderCharges.
 * מספר ההוראה משמש כמזהה, ולכן קליטה חוזרת של אותו מייל לא תיצור כפילות.
 */
var _hkIndex = null;

function hkIndex_() {
  if (_hkIndex) return _hkIndex;
  _hkIndex = {};
  var t = table_(SH.HK);
  t.rows.forEach(function (r) {
    var id = String(get_(r, t, 'מזהה') || '').trim();
    if (id) _hkIndex[id] = true;
  });
  return _hkIndex;
}

function handleStandingOrderEmail_(body, f) {
  var id = field_(body, f.id);
  var name = standardName(field_(body, f.name));
  if (!id || !name) return false;

  var idx = hkIndex_();
  if (idx[id]) return false; // ההוראה כבר רשומה

  // "מס' חיובים" יכול להיות מספר או "ללא הגבלה". טקסט לא מספרי נשמר כמות
  // שהוא — בעבר parseInt החזיר NaN וההוראה נזרקה בשקט, בלי שאיש ידע.
  var rawPayments = field_(body, f.payments);
  var payments = parseInt(rawPayments, 10);
  var paymentsValue = isNaN(payments) || payments <= 0
    ? (String(rawPayments || '').trim() || UNLIMITED_TEXT)
    : payments;

  var amount = asNumber_(field_(body, f.amount));
  if (!amount) {
    Logger.log('⚠️ הוראת קבע ' + id + ' (' + name + ') נדחתה — לא זוהה סכום חיוב');
    return false;
  }

  appendByName_(SH.HK, {
    'מזהה':          id,
    'שם':            name,
    'תאריך פתיחה':   (field_(body, f.startDate) || '').split(' ')[0],
    'סכום':          amount,
    'מספר תשלומים':  paymentsValue,
    'טלפון':         field_(body, f.phone),
    'אימייל':        emailIn_(field_(body, f.email)),
    'קמפיין':        field_(body, f.campaign),
    'הערות':         'נקלט אוטומטית ממייל',
  });
  idx[id] = true;
  ensureContact_(name, field_(body, f.phone), field_(body, f.address));
  return true;
}

function handleDonationEmail_(body, msgDate, f) {
  var payments = parseInt(field_(body, f.payments), 10) || 1;
  var name = standardName(field_(body, f.name));
  if (!name) return false;

  var amount = asNumber_(field_(body, f.amount));
  var extId = field_(body, f.id);
  var dateStr = (field_(body, f.date) || '').split(' ')[0];
  var txDate = toDate_(dateStr) || msgDate;

  // ── עסקה שנפרסה לתשלומים ────────────────────────────────────────────────
  //
  // שני דברים שונים לגמרי מגיעים באותו מבנה מייל:
  //
  //  1. **הוראת קבע** — הספק שולח גם מייל "הוראה שהוקמה", והחיובים
  //     החודשיים מיוצרים ממנו. רישום הסכום המלא גם כאן = ספירה כפולה.
  //  2. **תרומה חד-פעמית בתשלומי אשראי** — ₪1,200 ב-12 תשלומים. אין שום
  //     הוראת קבע, ואם לא נרשום אותה, הכסף פשוט לא קיים.
  //
  // ההבחנה: האם יש הוראת קבע של אותו אדם, באותו סכום חודשי, שנפתחה בסמוך.
  // בעבר כל עסקה בתשלומים נזרקה, ומקרה 2 רק נרשם כאזהרה ליומן הריצה —
  // כלומר הכסף נעלם ואף אחד לא ידע.
  if (payments > 1) {
    if (hasMatchingStandingOrder_(name, amount / payments, txDate)) return false;
  }

  // מזהה יציב מהספק. אם אין — נופלים לחתימה של שם+תאריך+סכום.
  var id = extId ? 'ned:' + extId : 'ned:' + name + '|' + dateStr + '|' + amount;

  var ok = addLogRow_({
    'מזהה':        id,
    'שם':          name,
    'תאריך תרומה': dateStr || asDate_(msgDate),
    'סכום':        amount,
    'ייעוד':       field_(body, f.purpose),
    'אפיק גבייה':  'קישור ישיר',
    'מקור':        'מייל',
    'סיכום ותובנות': payments > 1 ? 'שולם ב-' + payments + ' תשלומים' : '',
  });
  if (ok) ensureContact_(name, field_(body, f.phone), field_(body, f.address));
  return ok;
}

/**
 * האם העסקה הזו היא בעצם הוראת קבע שכבר רשומה אצלנו?
 *
 * שלושה תנאים ביחד, וכולם נחוצים: אותו אדם, אותו סכום חודשי (סטייה של עד
 * ₪1 בגלל עיגול), **ותאריך פתיחה סמוך**. בלי תנאי התאריך, תורם שיש לו
 * הוראת קבע ותיקה על ₪100 ותרם בנפרד ₪1,200 בשנים-עשר תשלומים היה מאבד
 * את התרומה — היא הייתה נראית כמו אותה הוראה.
 */
function hasMatchingStandingOrder_(name, monthly, when) {
  var t = table_(SH.HK);
  for (var i = 0; i < t.rows.length; i++) {
    if (standardName(get_(t.rows[i], t, 'שם')) !== name) continue;
    if (Math.abs(asNumber_(get_(t.rows[i], t, 'סכום')) - monthly) > 1) continue;

    if (when) {
      var start = toDate_(get_(t.rows[i], t, 'תאריך פתיחה'));
      if (start && Math.abs(start.getTime() - when.getTime()) > 35 * 86400000) continue;
    }
    return true;
  }
  return false;
}

function handleFailureEmail_(body, msgDate, f) {
  var name = standardName(field_(body, f.name));
  var order = field_(body, f.order);
  if (!name) return false;

  // מפתח כשל = הוראה + חודש, כדי שאותו כשל לא יירשם פעמיים
  var t = table_(SH.FAILURES);
  var key = order + '|' + msgDate.getFullYear() + '-' + msgDate.getMonth();
  var exists = t.rows.some(function (r) {
    var d = toDate_(get_(r, t, 'תאריך'));
    return String(get_(r, t, 'מזהה הוראה') || '') === String(order) && d &&
           (d.getFullYear() + '-' + d.getMonth()) === (msgDate.getFullYear() + '-' + msgDate.getMonth());
  });
  if (exists) return false;

  var amount = field_(body, f.amount);
  var reason = field_(body, f.reason);

  appendByName_(SH.FAILURES, {
    'תאריך': msgDate, 'שם': name, 'מזהה הוראה': order, 'סכום': amount, 'סיבה': reason,
  });
  if (order) markChargeFailed_(order, msgDate, reason, amount, name);
  return true;
}

/**
 * מנקה תווים בלתי נראים מגוף המייל.
 * מיילים בעברית מלאים בסימני כיווניות (RLM/LRM) ובכוכביות עיצוב, והם
 * נדבקים לערכים ושוברים את הפענוח. חייב לרוץ לפני כל שליפת שדה.
 */
function cleanBody_(body) {
  return String(body || '').replace(/[\u200B-\u200F\u202A-\u202E\uFEFF*]/g, '');
}

/** שולף כתובת מייל תקינה מתוך טקסט חופשי. */
function emailIn_(text) {
  var m = String(text || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}

/** שולף ערך מגוף מייל לפי התווית שלפניו. */
function field_(body, label) {
  if (!body || !label) return '';
  var m = body.match(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(.*)'));
  return m ? m[1].replace(/\*/g, '').trim() : '';
}

// ═══════════════════════════════════════════════════════════════════════════
//  הגירה מהגיליון הישן
// ═══════════════════════════════════════════════════════════════════════════

/**
 * מעביר נתונים מהמבנה הישן למבנה החדש, בתוך אותו קובץ.
 * בטוח להרצה חוזרת — הכל עובר דרך המזהים הייחודיים.
 *
 * מה קורה לחיובי הוראות הקבע: בגרסה הישנה הם ישבו בלשונית נפרדת ולא
 * נספרו ככסף באפליקציה. כאן הם נכנסים ליומן עם המזהה הקבוע שלהם, ולכן
 * נספרים פעם אחת בדיוק — גם אם הם קיימים גם בלשונית הישנה וגם ביומן הישן.
 */
function migrateFromLegacy() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var L = {
    contacts: '📝 יומן פרטים אישיים',
    log:      '📅 יומן מפגשים ותרומות',
    hk:       'הוראות קבע - מעקב',
    auto:     'הוראות קבע - אוטומטי',
    failures: '❌ הוראות קבע - שגיאות',
    aliases:  '🔄 מיפוי שמות',
    sync:     '🔄 סנכרון נתונים',
  };
  var report = [];

  // ── מיפוי שמות (ראשון! כל השאר מסתמך עליו) ──
  var src = ss.getSheetByName(L.aliases);
  if (src) {
    var rows = src.getDataRange().getValues().slice(1);
    var existing = {};
    table_(SH.ALIASES).rows.forEach(function (r) { existing[String(r[0]).trim()] = true; });
    var n = 0;
    rows.forEach(function (r) {
      var bad = String(r[0] || '').trim(), good = String(r[1] || '').trim();
      if (bad && good && !existing[bad]) { appendByName_(SH.ALIASES, { 'שם שגוי / כפילות': bad, 'השם התקין': good }); n++; }
    });
    flushWrites_();  // חייב להיכתב עכשיו — כל שאר ההגירה מסתמכת עליו
    _aliases = null;  // לטעון מחדש מהגיליון
    report.push('מיפוי שמות: ' + n);
  }

  // ── אנשי קשר (בישן: שורה 1 דוגמה, שורה 2 כותרות, מ-3 נתונים) ──
  src = ss.getSheetByName(L.contacts);
  if (src) {
    var v = src.getDataRange().getValues();
    var head = (v[1] || []).map(function (h) { return String(h).trim(); });
    var n2 = 0;
    for (var i = 2; i < v.length; i++) {
      var name = standardName(v[i][0]);
      if (!name) continue;
      var obj = {};
      head.forEach(function (h, c) {
        if (h && v[i][c] !== '' && v[i][c] != null) obj[h] = fmt_(v[i][c]);
      });
      obj['שם מלא'] = name;
      migrateContact_(obj);
      n2++;
    }
    report.push('אנשי קשר: ' + n2);
  }

  // ── יומן תרומות ומפגשים ──
  src = ss.getSheetByName(L.log);
  if (src) {
    var lv = src.getDataRange().getValues().slice(1);
    var n3 = 0;
    lv.forEach(function (r, i) {
      var name = standardName(r[0]);
      if (!name) return;
      var ok = addLogRow_({
        'מזהה':          'legacy:log:' + i,
        'שם':            name,
        'תאריך תרומה':   r[1] || '',
        'סכום':          asNumber_(r[2]),
        'ייעוד':         fmt_(r[3]),
        'אפיק גבייה':    fmt_(r[4]),
        'תאריך מפגש':    r[5] || '',
        'מיקום מפגש':    fmt_(r[6]),
        'מטרת המפגש':    fmt_(r[7]),
        'סיכום ותובנות': fmt_(r[8]),
        'מקור':          'הגירה',
      });
      if (ok) n3++;
    });
    report.push('שורות יומן: ' + n3);
  }

  // ── הוראות קבע (בישן: שתי שורות כותרת) ──
  src = ss.getSheetByName(L.hk);
  if (src) {
    var hv = src.getDataRange().getValues().slice(2);
    var existingHk = {};
    table_(SH.HK).rows.forEach(function (r) { existingHk[String(r[0]).trim()] = true; });
    var n4 = 0;
    hv.forEach(function (r) {
      var id = String(r[0] || '').trim();
      var name = standardName(r[3]);
      if (!id || !name || existingHk[id]) return;
      appendByName_(SH.HK, {
        'מזהה': id, 'שם': name, 'תאריך פתיחה': r[1] || '',
        'סכום': asNumber_(r[8]), 'מספר תשלומים': asNumber_(r[13]),
        'טלפון': fmt_(r[4]), 'אימייל': fmt_(r[5]), 'קמפיין': fmt_(r[6]),
      });
      existingHk[id] = true;
      n4++;
    });
    report.push('הוראות קבע: ' + n4);
  }

  // ── חיובי הו"ק שכבר בוצעו (מהלשונית "אוטומטי") ──
  src = ss.getSheetByName(L.auto);
  if (src) {
    var av = src.getDataRange().getValues().slice(1);
    var n5 = 0;
    av.forEach(function (r) {
      var id = String(r[0] || '').trim();
      var d = toDate_(r[1]);
      var name = standardName(r[3]);
      if (!id || !d || !name) return;
      var ok = addLogRow_({
        'מזהה':        hkChargeId_(id, d.getFullYear(), d.getMonth()),
        'שם':          name,
        'תאריך תרומה': d,
        'סכום':        asNumber_(r[8]),
        'ייעוד':       fmt_(r[6]),
        'אפיק גבייה':  'הוראת קבע',
        'מקור':        'הוראת קבע ' + id,
      });
      if (ok) n5++;
    });
    report.push('חיובי הוראת קבע: ' + n5);
  }

  // ── כשלי חיוב ──
  src = ss.getSheetByName(L.failures);
  if (src) {
    var fv = src.getDataRange().getValues();
    var n6 = 0;
    fv.forEach(function (r) {
      var name = standardName(r[1]);
      if (!name) return;
      appendByName_(SH.FAILURES, {
        'תאריך': r[0] || '', 'שם': name, 'מזהה הוראה': fmt_(r[2]),
        'סכום': fmt_(r[3]), 'סיבה': fmt_(r[4]),
      });
      n6++;
    });
    report.push('כשלי חיוב: ' + n6);
  }

  // ── נתוני האפליקציה (CRM, אירועים, משימות) ──
  src = ss.getSheetByName(L.sync);
  if (src) {
    var sv = src.getDataRange().getValues();
    var n7 = 0;
    sv.forEach(function (r) {
      var k = String(r[0] || '').trim();
      if (!k || k === 'מפתח' || !r[1]) return;
      writeSyncRaw_(k, String(r[1]));
      n7++;
    });
    report.push('מפתחות סנכרון: ' + n7);
  }

  // כל מה שנצבר עד כאן נכתב עכשיו — ההוראות חייבות להיות בגיליון
  // לפני שהמנוע מחפש להן חיובים חסרים.
  flushWrites_();
  _contactIndex = null;

  var created = generateStandingOrderCharges();
  report.push('חיובים חסרים שהושלמו: ' + created);

  alert_('ההגירה הושלמה ✅\n\n' + report.join('\n') +
         '\n\nהלשוניות הישנות לא נמחקו. בדוק שהכל תקין באפליקציה, ורק אז מחק אותן.');
}

/**
 * מוסיף איש קשר מהגיליון הישן, על כל עמודותיו.
 * עמודות שאינן קיימות בכותרות נוספות אוטומטית ב-flushWrites_.
 */
function migrateContact_(obj) {
  var name = obj['שם מלא'];
  if (!name) return;
  var idx = contactIndex_();
  if (idx[name]) return; // כבר קיים
  idx[name] = { row: 0, data: [] };
  appendByName_(SH.CONTACTS, obj);
}

// ═══════════════════════════════════════════════════════════════════════════
//  "ארון" נתוני האפליקציה
// ═══════════════════════════════════════════════════════════════════════════

function readSync_(key) {
  var t = table_(SH.SYNC);
  for (var i = 0; i < t.rows.length; i++) {
    if (String(t.rows[i][0]).trim() !== key) continue;
    var raw = t.rows[i][1];
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.__overflow) {
        return JSON.parse(DriveApp.getFileById(parsed.__overflow).getBlob().getDataAsString());
      }
      return parsed;
    } catch (e) { return raw; }
  }
  return null;
}

function writeSync_(key, data) {
  writeSyncRaw_(key, typeof data === 'string' ? data : JSON.stringify(data));
}

function writeSyncRaw_(key, payload) {
  // תא בגיליון מוגבל ל-50,000 תווים. מעבר לזה שומרים קובץ ב-Drive
  // ומשאירים בתא רק מצביע אליו.
  if (payload.length > 45000) {
    payload = JSON.stringify({ __overflow: writeOverflow_(key, payload) });
  }
  var t = table_(SH.SYNC);
  if (!t.sheet) return;
  for (var i = 0; i < t.rows.length; i++) {
    if (String(t.rows[i][0]).trim() === key) { t.sheet.getRange(i + 2, 2).setValue(payload); return; }
  }
  t.sheet.appendRow([key, payload]);
}

function writeOverflow_(key, payload) {
  var name = 'kehila-crm-' + key + '.json';
  var it = DriveApp.getFilesByName(name);
  var file = it.hasNext() ? it.next() : null;
  if (file) file.setContent(payload);
  else file = DriveApp.createFile(name, payload, MimeType.PLAIN_TEXT);
  return file.getId();
}

// ═══════════════════════════════════════════════════════════════════════════
//  עזרים
// ═══════════════════════════════════════════════════════════════════════════

function fmt_(v) {
  if (v === undefined || v === null) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return asDate_(v);
  return String(v).trim();
}

/** כל התאריכים חוזרים לאפליקציה בפורמט dd/MM/yyyy. */
function asDate_(v) {
  if (v === undefined || v === null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  return String(v).trim();
}

/** מפרש ערך תאריך מהגיליון. תומך גם ב-dd/MM/yyyy כטקסט. */
function toDate_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return v;
  var s = String(v).trim();

  // yyyy-MM-dd — הפורמט ששדה תאריך בדפדפן שולח.
  //
  // חייבים לפרק אותו ידנית. new Date('2026-03-05') מפרש את המחרוזת כחצות
  // ב**שעון גריניץ'**, בעוד שכל התאריכים בגיליון הם חצות בשעון ישראל.
  // הפער של שעתיים-שלוש הופך תאריך ביטול ל"רגע אחרי" החיוב של אותו יום,
  // והחיוב שאמור להתבטל ממשיך להיספר ככסף שנכנס.
  var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);

  var m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);

  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function asNumber_(v) {
  if (typeof v === 'number') return v;
  var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function todayStr_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

// ═══════════════════════════════════════════════════════════════════════════
//  תפריט בגיליון
// ═══════════════════════════════════════════════════════════════════════════

/**
 * מציג את המספרים המרכזיים בחלון קופץ — לבדיקה אחרי הגירה, בלי צורך
 * לפתוח את האפליקציה או לחשב ידנית.
 */
function showSummary() {
  var s = getSummary_();
  var hk = getHK_();
  var log = table_(SH.LOG);
  var contacts = table_(SH.CONTACTS);

  var lines = [
    '📊 מצב הנתונים',
    '',
    'סך כל התרומות:  ₪' + Math.round(s.total).toLocaleString(),
    'הוראות קבע פעילות:  ' + s.hkActive + ' מתוך ' + hk.length,
    '',
    'אנשי קשר:  ' + contacts.rows.length,
    'שורות ביומן:  ' + log.rows.length,
    'כשלי חיוב:  ' + s.failureCount,
    '',
    'פילוח לפי אפיק גבייה:',
  ];
  Object.keys(s.byMethod).sort(function (a, b) { return s.byMethod[b] - s.byMethod[a]; })
    .forEach(function (m) {
      lines.push('   ' + m + ':  ₪' + Math.round(s.byMethod[m]).toLocaleString());
    });

  lines.push('', 'הוראות קבע פעילות:');
  hk.filter(function (h) { return h.active; }).forEach(function (h) {
    lines.push('   ' + h.name + ' — נותרו ' + h.remaining + ' מתוך ' + h.payments + ' · ₪' + h.amount);
  });

  alert_(lines.join('\n'));
}

/** גרסת התפריט של syncRebbeDate_ — מדווחת מה קרה במקום לרוץ בשקט. */
function refreshRebbeDate() {
  var found = syncRebbeDate_();
  var current = readSync_('rebbeDate');
  if (found) {
    alert_('תאריך הכתיבה לרבי עודכן ל-' + asDate_(found) + ' ✅');
  } else if (current) {
    alert_('לא נמצאה כתיבה מאוחרת יותר.\nהתאריך הרשום נשאר ' + current + '.');
  } else {
    alert_('לא נמצא אף מייל שנשלח אל ' + REBBE_EMAIL + '.\n\n' +
           'אם אתה שולח לכתובת אחרת — שנה את REBBE_EMAIL בראש הקובץ.');
  }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('לוח בקרה')
    .addItem('התקנה ראשונית', 'setupSheet')
    .addItem('הגירה מגיליון ישן', 'migrateFromLegacy')
    .addItem('בדיקת נתונים', 'showSummary')
    .addItem('רענון כללי מייל', 'refreshMailRules')
    .addItem('אבחון קליטת מיילים', 'debugMailRules')
    .addSeparator()
    .addItem('סנכרון עכשיו', 'dailySync')
    .addItem('סריקת כל היסטוריית המיילים', 'syncAllEmailHistory')
    .addItem('השלמת חיובי הוראות קבע', 'generateStandingOrderCharges')
    .addItem('רענון תאריך הכתיבה לרבי', 'refreshRebbeDate')
    .addToUi();
}
