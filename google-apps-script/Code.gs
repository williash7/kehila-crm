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
 *  ── עדכון הקובץ הזה בהמשך ─────────────────────────────────────────────────
 *
 *  ⚠️  **"פריסה חדשה" היא רק לפעם הראשונה.** בכל עדכון אחר כך:
 *
 *        פריסה ← נהל פריסות ← ✏️ עריכה ← גרסה: **גרסה חדשה** ← פרוס
 *
 *  לחיצה על "פריסה חדשה" מייצרת **כתובת חדשה** שהאפליקציה לא מכירה, וכל
 *  הבקשות יחזרו כשגיאת 404. הדרך הנכונה משאירה את אותה כתובת ומחליפה רק
 *  את הקוד. Apps Script מגיש תמונת מצב מרגע הפריסה, ולא את מה שעל המסך —
 *  ולכן שמירה לבדה אינה מספיקה.
 *
 *  ── מה רץ לבד מכאן ואילך ──────────────────────────────────────────────────
 *
 *  אין עוד פונקציה שצריך להריץ ידנית. שלוש שכבות מכסות הכל:
 *    · כל טעינה של האפליקציה  → maybeSync_  מתזמנת סריקה שרצה ברקע
 *    · כל יום ב-06:00         → dailySync   סריקה, חיובי הו"ק, כתיבה לרבי
 *    · כל עריכה בגיליון       → onEditHandler
 *  כל שאר הפריטים בתפריט הם לשעת הצורך בלבד.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * חותמת הגרסה של הקובץ הזה.
 *
 * הבעיה שהיא פותרת: אחרי הדבקה ופריסה אין שום דרך לדעת אם הגיליון באמת
 * מריץ את הקוד החדש. Apps Script מגיש תמונת מצב מרגע הפריסה, ולכן קוד
 * שנשמר אבל לא נפרס נראה מעודכן בעורך ומיושן בפועל — וכל הבדיקות
 * נראות תקינות בזמן שהאפליקציה מדברת עם גרסה בת שבוע.
 *
 * החותמת מוחזרת ב-ping ובסיכום, ומוצגת באפליקציה תחת הגדרות. אחרי כל
 * פריסה אפשר לוודא בחמש שניות שהמספר השתנה.
 *
 * **מעדכנים אותה בכל שינוי מהותי בקובץ.**
 */
var CODE_VERSION = '2026-08-23c';
var EXPORT_SCHEMA_VERSION = 1;
var EXPORT_MAX_LIMIT = 500;

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
  //
  // "חידוש של" מחזיק את מספר ההוראה הקודמת של אותו תורם. חידוש אינו עדכון
  // של השורה הישנה אלא שורה חדשה — כי בפועל זו הוראה אחרת אצל הספק, עם
  // מספר משלה, תאריך משלה ולעיתים סכום אחר. השדה הזה הוא מה שמונע מהאפליקציה
  // "להתחיל מאפס": דרכו היא מחברת חזרה את כל שרשרת ההוראות של אותו אדם.
  HK: ['מזהה', 'שם', 'תאריך פתיחה', 'סכום', 'מספר תשלומים',
       'טלפון', 'אימייל', 'קמפיין', 'תאריך ביטול', 'חידוש של', 'הערות'],

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
/**
 * מטמון לכל ריצה.
 *
 * בקשת getAll אחת קוראת ל-readSync_ שבע פעמים, וכל אחת מהן קראה את
 * לשונית הסנכרון מחדש — שבע קריאות רשת לגוגל לאותם נתונים בדיוק.
 * getDataRange().getValues() הוא הדבר היקר ביותר כאן, והוא נמדד
 * בעשיריות שנייה.
 *
 * המטמון חי בתוך ריצה אחת בלבד. Apps Script מפעילה תהליך חדש לכל בקשה,
 * ולכן אין סכנה שנגיש נתון ישן לבקשה הבאה.
 */
var __tableCache = {};

/**
 * המטמון פעיל **רק בבקשות קריאה**.
 *
 * זו החלטה מכוונת. יש בקוד יותר מעשרים מקומות שכותבים ישירות ללשונית
 * (setValue, appendRow, deleteRow), וכל אחד מהם היה חייב לזכור לפסול את
 * המטמון. מספיק שאחד יישכח כדי לקבל באג שקט שקורא נתונים שכבר השתנו —
 * וזה בדיוק סוג הבאג שהכי קשה למצוא, כי הוא נראה כמו "הגיליון לא התעדכן".
 *
 * בקשת קריאה לא משנה כלום, ולכן שם המטמון בטוח לחלוטין. ושם גם נמצא כל
 * הרווח: בקשת getAll קוראת את אותה לשונית שבע פעמים.
 */
var __cacheOn = false;

/** מנקה את המטמון. חובה אחרי כתיבה, אחרת נקרא את המצב שלפניה. */
function invalidateTable_(name) {
  if (name) delete __tableCache[name];
  else __tableCache = {};
}

function table_(name) {
  if (__cacheOn && __tableCache[name]) return __tableCache[name];

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) return { headers: [], rows: [], sheet: null, col: function () { return -1; } };

  var values = sh.getDataRange().getValues();
  var headers = (values[0] || []).map(function (h) { return String(h).trim(); });
  var index = {};
  headers.forEach(function (h, i) { if (h) index[h] = i; });

  var built = {
    sheet: sh,
    headers: headers,
    rows: values.slice(1).filter(function (r) { return r.join('').trim() !== ''; }),
    col: function (n) { return index[n] === undefined ? -1 : index[n]; },
  };
  if (__cacheOn) __tableCache[name] = built;
  return built;
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

    // הלשונית עומדת להשתנות, ולכן מה ששמור עליה במטמון כבר לא נכון.
    invalidateTable_(sheetName);

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

/**
 * מחלץ את מספר ההוראה ממזהה של חיוב.
 *
 * ── הבאג שזה מתקן ─────────────────────────────────────────────────────────
 *
 * הקוד פירק את המזהה ב-split(':')[1]. זה עבד כל עוד מספרי ההוראות היו
 * מספרים, ונשבר ברגע שחידוש ייצר מזהה כמו `ren:1866314:2` — שהמזהה של
 * החיוב שלו הוא `hk:ren:1866314:2:2026-08`, והאיבר השני בו הוא "ren".
 *
 * התוצאה על המסך הייתה סתירה מוחלטת: **"שולמו 0 מתוך 12" לצד "נותרו 11"**.
 * שני המספרים חושבו ממקורות שונים — "נותרו" מלוח השנה, ולכן היה נכון;
 * "שולמו" מהיומן, ולא מצא אף חיוב כי חיפש הוראה בשם "ren".
 *
 * כאן קוראים את המזהה מהסוף: מסירים את הקידומת ואת חותמת החודש, וכל מה
 * שבאמצע הוא מספר ההוראה — יהיו בו נקודתיים כמה שיהיו.
 */
function orderIdFromChargeId_(chargeId) {
  var m = String(chargeId || '').match(/^hk:(.+):(\d{4})-(\d{2})$/);
  return m ? m[1] : '';
}

// ═══════════════════════════════════════════════════════════════════════════
//  נקודות כניסה מהאפליקציה
// ═══════════════════════════════════════════════════════════════════════════

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  __cacheOn = true;          // בקשת קריאה — בטוח למחזר לשוניות
  __tableCache = {};
  return json_(safe_(function () {
    // פרמטרי GET נדרשים לייצוא המדורג (sheet/offset/limit/syncKey).
    // מעבירים עותק פשוט ולא את אובייקט האירוע של Apps Script.
    var params = (e && e.parameter) || {};
    var res = route_(action, params);
    flushWrites_();
    return res;
  }));
}

function doPost(e) {
  __cacheOn = false;         // בקשת כתיבה — תמיד לקרוא את המצב האמיתי
  __tableCache = {};
  return json_(safe_(function () {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // ── בקשת כתיבה שמותר לשלוח שוב ──────────────────────────────────────
    //
    // תשובה של גוגל יכולה ללכת לאיבוד בדרך — עומס רגעי, רשת, או תוסף
    // בדפדפן שמשכפל בקשות. האפליקציה לא יכולה לדעת אם הפעולה נרשמה או
    // לא, ולכן לא העזנו לשלוח שוב: תרומה שנרשמה פעמיים גרועה מתרומה
    // שנכשלה. התוצאה הייתה שכל תקלה רגעית הפילה כל פעולת כתיבה.
    //
    // הפתרון: האפליקציה מצרפת מזהה ייחודי לכל בקשה. אם אותו מזהה חוזר,
    // מחזירים את התשובה השמורה בלי לבצע שוב. כך שליחה חוזרת בטוחה
    // לחלוטין, וגם אם הבקשה נשלחה שלוש פעמים היא בוצעה בדיוק פעם אחת.
    var reqId = String(body.reqId || '').trim();
    if (reqId) {
      var cached = recallRequest_(reqId);
      if (cached) return cached;
    }

    var res = route_(body.action || '', body);
    flushWrites_();
    if (reqId) rememberRequest_(reqId, res);
    return res;
  }));
}

var REQ_LIST_KEY = 'recentRequests';
var REQ_KEEP = 40;   // מספיק לכיסוי ניסיונות חוזרים, בלי לנפח את האחסון

function recallRequest_(id) {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty('req:' + id);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;   // ספק — עדיף לבצע מחדש מאשר להיתקע
  }
}

function rememberRequest_(id, res) {
  try {
    var props = PropertiesService.getScriptProperties();
    props.setProperty('req:' + id, JSON.stringify(res));

    var list = (props.getProperty(REQ_LIST_KEY) || '').split(',').filter(String);
    list.push(id);
    while (list.length > REQ_KEEP) props.deleteProperty('req:' + list.shift());
    props.setProperty(REQ_LIST_KEY, list.join(','));
  } catch (err) {
    Logger.log('שמירת מזהה הבקשה נכשלה: ' + err);
  }
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
  // דוח תקינות הוא אבחון קריאה-בלבד. אסור שקריאתו תתזמן סנכרון רקע
  // שיכתוב לגיליון בזמן שהדוח קורא אותו.
  if (action.indexOf('get') === 0 && action !== 'getIntegrity') maybeSync_();

  switch (action) {
    // קריאה
    case 'ping':             return { ok: true, version: CODE_VERSION,
                                      sheet: SpreadsheetApp.getActiveSpreadsheet().getName() };
    case 'getAll':           return getAll_();
    case 'exportAll':        return exportAll_(body);
    case 'getIntegrity':     return getIntegrity_();
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
    case 'updateDonation':     return updateDonation_(body);
    case 'deleteDonation':     return deleteDonation_(body);
    case 'addMeeting':         return addMeeting_(body);
    case 'addStandingOrder':   return addStandingOrder_(body);
    case 'cancelStandingOrder': return cancelStandingOrder_(body);
    case 'updateStandingOrderAmount': return updateStandingOrderAmount_(body);
    case 'renewStandingOrder': return renewStandingOrder_(body);
    case 'updateStandingOrder': return updateStandingOrder_(body);
    case 'previewStandingOrderUpdate': return previewStandingOrderUpdate_(body);
    case 'previewRenewalDate': return previewRenewalDate_(body);
    case 'updateDonorField':   return updateDonorField_(body);
    case 'deleteContactColumns': return deleteContactColumns_(body);
    case 'updatePersonalDate': return updateDonorField_(body);
    case 'createHolidayDoc':   return createHolidayDoc_(body);
    case 'importRows':         return importRows_(body);
    case 'undoImport':         return { success: true, deleted: undoImport(String(body.tag || '')) };
    case 'restoreBegin':       return restoreBegin_(body);
    case 'restoreSheet':       return restoreSheet_(body);
    case 'restoreSync':        return restoreSync_(body);
    case 'restoreFinish':      return restoreFinish_(body);
    case 'restoreRollback':    return restoreRollback_(body);

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
      nextCharge: (function () {
        var d = nextChargeDate_(start, payments, unlimited, today, cancelDate);
        return d ? asDate_(d) : '';
      })(),
      cancelDate: asDate_(get_(r, t, 'תאריך ביטול')),
      renewalOf:  String(get_(r, t, 'חידוש של') || '').trim(),
      // הקמפיין הוא מה שמשייך הוראה לפרויקט. בלעדיו האפליקציה לא יכולה
      // לדעת שההוראה שייכת לקמפיין, וגם לא להציג אותו במסך העריכה.
      campaign:   fmt_(get_(r, t, 'קמפיין')),
      phone:      fmt_(get_(r, t, 'טלפון')),
      email:      fmt_(get_(r, t, 'אימייל')),
      notes:      fmt_(get_(r, t, 'הערות')),
      active:     !cancelDate && (unlimited || remaining > 0),
    };
  }).filter(function (h) { return h.name; });
}

/**
 * כמה ממועדי החיוב של ההוראה עוד לא הגיעו.
 * אותו לוח זמנים בדיוק שמייצר generateStandingOrderCharges — יום החיוב
 * הוא יום הפתיחה, ובחודש קצר מדי נופל ליום האחרון בו.
 */
/**
 * מועד החיוב הבא שעוד לא הגיע.
 *
 * "חיוב אחרון" לבדו עונה על השאלה הלא נכונה. מי שמתקשר לתורם צריך לדעת
 * **מתי ייגבה הבא** — זה מה שנאמר בשיחה, וזה מה שקובע אם כדאי לחכות או
 * לבקש עכשיו.
 */
function nextChargeDate_(start, payments, unlimited, today, cancelDate) {
  if (!start) return null;
  if (cancelDate) return null;                 // הוראה מבוטלת לא תיגבה שוב
  var billingDay = start.getDate();
  var cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  var rounds = unlimited ? 600 : (payments || 0);

  for (var i = 0; i < rounds; i++) {
    var y = cursor.getFullYear(), m = cursor.getMonth();
    var d = new Date(y, m, Math.min(billingDay, daysInMonth_(y, m)));
    if (d > today) return d;
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return null;
}

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
    var orderId = orderIdFromChargeId_(id);
    if (!orderId) return;
    if (!map[orderId]) map[orderId] = { count: 0, last: null };
    map[orderId].count++;
    // toDate_ ולא instanceof: התא יכול לחזור גם כטקסט, וגם אובייקט תאריך
    // שנוצר בהקשר אחר אינו עובר את instanceof. הבדיקה הזו החזירה "חיוב
    // אחרון: —" על הוראות שהיו להן חיובים לרוב.
    var d = toDate_(get_(r, t, 'תאריך תרומה'));
    if (d && (!map[orderId].last || d > map[orderId].last)) map[orderId].last = d;
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
/** חלון הזמן שבו כשל חיוב נחשב "דורש טיפול" בדשבורד. */
var FAILURE_WINDOW_DAYS = 30;

function recentFailureCount_(now) {
  var t = table_(SH.FAILURES);
  var cutoff = now.getTime() - FAILURE_WINDOW_DAYS * 86400000;
  var n = 0;
  t.rows.forEach(function (r) {
    if (!fmt_(get_(r, t, 'שם'))) return;
    var d = toDate_(get_(r, t, 'תאריך'));
    if (!d || d.getTime() >= cutoff) n++;   // בלי תאריך — סופרים, לא מסתירים
  });
  return n;
}

/**
 * כל מה שהאפליקציה צריכה בפתיחה — בבקשה אחת.
 *
 * ── למה זה קיים ─────────────────────────────────────────────────────────
 *
 * הפתיחה ירתה **שתים־עשרה** בקשות נפרדות. Apps Script מגבילה ריצות
 * במקביל, ולכן הלקוח שולח לכל היותר שלוש בו-זמנית — כלומר ארבעה גלים,
 * וכל גל משלם מחדש את זמן ההתנעה של הסקריפט. זה מה שנראה כמו "האפליקציה
 * איטית": לא החישוב, אלא ארבע המתנות ברצף.
 *
 * גרוע מכך, שבע מהן היו readSync_ — כולן קוראות את **אותה לשונית**.
 * שבע נסיעות הלוך-חזור לאותם נתונים בדיוק.
 *
 * כאן הכול נקרא פעם אחת, מעל מטמון הלשוניות, ונשלח יחד. אם חלק נכשל,
 * השאר עדיין מגיעים — שדה ריק עדיף על פתיחה שנופלת כולה.
 */
function getAll_() {
  function attempt(fn, fallback) {
    try { return fn(); } catch (e) { return fallback; }
  }

  var summary = attempt(getSummary_, {});

  return {
    version:       CODE_VERSION,
    summary:       summary,
    donations:     attempt(getDonations_, []),
    donors:        attempt(getDonors_, {}),
    hk:            attempt(getHK_, []),
    failures:      attempt(getFailures_, []),
    rebbeDate:     attempt(function () { return readSync_('rebbeDate') || ''; }, ''),
    crm:           attempt(function () { return readSync_('crm') || {}; }, {}),
    events:        attempt(function () { return readSync_('events') || []; }, []),
    holidayExtras: attempt(function () { return readSync_('holidayExtras') || {}; }, {}),
    history:       attempt(function () { return readSync_('history') || []; }, []),
    homeVisits:    attempt(function () { return readSync_('homeVisits') || { rounds: [] }; }, { rounds: [] }),
    projects:      attempt(function () { return readSync_('projects') || []; }, []),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  גיבוי ותקינות — קריאה בלבד
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ערך תא בתוך גיבוי.
 *
 * תאריכים נשמרים עם מעטפת טיפוס במקום להפוך למחרוזת רגילה. כך פעולת
 * שחזור עתידית תוכל להחזיר תאריך כתאריך ולא לנחש לפי צורת הטקסט. שאר
 * הטיפוסים הבסיסיים נשארים כפי שהם.
 */
function exportCell_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return { __type: 'date', value: value.toISOString() };
  }
  if (value === undefined || value === null) return '';
  return value;
}

/** מטריצה נקייה ל-JSON, בלי לשנות דבר בגיליון. */
function exportMatrix_(values) {
  return (values || []).map(function (row) {
    return (row || []).map(exportCell_);
  });
}

/** שמות לשוניות שמותר לחשוף דרך הגיבוי. */
function exportSheetNames_() {
  var names = [];
  Object.keys(SH).forEach(function (key) {
    if (names.indexOf(SH[key]) < 0) names.push(SH[key]);
  });
  return names;
}

/** כותרות ומספר שורות בלי לקרוא את כל תוכן הלשונית לזיכרון. */
function exportSheetMeta_(sheet) {
  if (!sheet) return { present: false, headers: [], rowCount: 0 };
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  var headers = [];
  if (lastRow > 0 && lastColumn > 0) {
    headers = exportMatrix_(sheet.getRange(1, 1, 1, lastColumn).getValues())[0] || [];
  }
  return {
    present: true,
    headers: headers,
    rowCount: Math.max(lastRow - 1, 0),
  };
}

/** רשימת מפתחות בלבד; ערכי overflow נקראים בבקשות נפרדות. */
function exportSyncKeys_() {
  var keys = [];
  var sync = table_(SH.SYNC);
  sync.rows.forEach(function (row) {
    var key = String(get_(row, sync, 'מפתח') || row[0] || '').trim();
    if (key && keys.indexOf(key) < 0) keys.push(key);
  });
  return keys;
}

/**
 * גרסת גיבוי מחמירה של readSync_. הקריאה הרגילה מחזירה את המצביע הגולמי
 * כשקובץ overflow חסר כדי שהאפליקציה תמשיך לעלות; בגיבוי חייבים לדווח
 * על הכשל, אחרת המשתמש יוריד קובץ שנראה תקין אך חסר בו המידע האמיתי.
 */
function exportReadSync_(key) {
  var sync = table_(SH.SYNC);
  for (var i = 0; i < sync.rows.length; i++) {
    if (String(sync.rows[i][0] || '').trim() !== key) continue;
    var raw = sync.rows[i][1];
    if (!raw) return null;
    var parsed;
    try { parsed = JSON.parse(raw); }
    catch (parseError) { return raw; }
    if (parsed && parsed.__overflow) {
      var content = DriveApp.getFileById(parsed.__overflow).getBlob().getDataAsString();
      return JSON.parse(content);
    }
    return parsed;
  }
  return null;
}

function exportBase_() {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    codeVersion: CODE_VERSION,
  };
}

/** מחזיר מקטע אחד בלבד, כדי שגם גיליון גדול לא יהפוך למחרוזת JSON ענקית. */
function exportSheetChunk_(sheetName, offsetRaw, limitRaw) {
  var base = exportBase_();
  var allowed = exportSheetNames_();
  if (allowed.indexOf(sheetName) < 0) {
    base.success = false;
    base.error = 'לשונית אינה שייכת לאפליקציה: ' + sheetName;
    return base;
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    base.success = false;
    base.error = 'הלשונית אינה קיימת: ' + sheetName;
    return base;
  }

  var offset = Math.max(parseInt(offsetRaw, 10) || 0, 0);
  var requestedLimit = parseInt(limitRaw, 10) || EXPORT_MAX_LIMIT;
  var limit = Math.max(1, Math.min(requestedLimit, EXPORT_MAX_LIMIT));
  var meta = exportSheetMeta_(sheet);
  var count = Math.max(Math.min(limit, meta.rowCount - offset), 0);
  var rows = [];
  if (count > 0 && meta.headers.length > 0) {
    rows = exportMatrix_(sheet.getRange(offset + 2, 1, count, meta.headers.length).getValues());
  }
  var consumed = offset + rows.length;

  base.success = true;
  base.sheet = sheetName;
  base.headers = meta.headers;
  base.rows = rows;
  base.offset = offset;
  base.limit = limit;
  base.total = meta.rowCount;
  base.nextOffset = consumed < meta.rowCount ? consumed : null;
  base.complete = base.nextOffset === null;
  return base;
}

/** קורא מפתח סנכרון בודד ומבודד כשל בקובץ overflow שנמחק. */
function exportSyncValue_(syncKey) {
  var base = exportBase_();
  base.syncKey = syncKey;
  if (exportSyncKeys_().indexOf(syncKey) < 0) {
    base.success = false;
    base.error = 'מפתח הסנכרון אינו קיים: ' + syncKey;
    return base;
  }
  try {
    var data = exportReadSync_(syncKey);
    base.success = true;
    base.data = data === undefined ? null : data;
  } catch (err) {
    base.success = false;
    base.error = String(err);
  }
  return base;
}

/**
 * גיבוי מדורג וקריאה-בלבד.
 *
 * ללא פרמטרים מוחזר manifest קטן. תוכן לשונית וערכי sync נמשכים כל אחד
 * בבקשות נפרדות, ולכן קובץ overflow פגום או לשונית גדולה אינם מפילים את
 * כל הגיבוי. אין יצירת קובץ, כתיבה ל-Drive או שינוי תאים.
 */
function exportAll_(params) {
  params = params || {};
  var sheetName = String(params.sheet || '').trim();
  var syncKey = String(params.syncKey || '').trim();
  if (sheetName && syncKey) {
    var invalid = exportBase_();
    invalid.success = false;
    invalid.error = 'יש לבקש לשונית או מפתח סנכרון, לא את שניהם יחד';
    return invalid;
  }
  if (sheetName) return exportSheetChunk_(sheetName, params.offset, params.limit);
  if (syncKey) return exportSyncValue_(syncKey);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetsOut = {};
  exportSheetNames_().forEach(function (name) {
    sheetsOut[name] = exportSheetMeta_(ss.getSheetByName(name));
  });

  return {
    success: true,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    codeVersion: CODE_VERSION,
    spreadsheet: {
      id: String(ss.getId ? ss.getId() : ''),
      name: String(ss.getName ? ss.getName() : ''),
      timeZone: Session.getScriptTimeZone(),
    },
    maxLimit: EXPORT_MAX_LIMIT,
    sheets: sheetsOut,
    syncKeys: exportSyncKeys_(),
  };
}

// ── שחזור מבוקר מגיבוי מלא ────────────────────────────────────────────────
var RESTORE_PREFIX = 'restore:';
var RESTORE_REQUEST_PREFIX = 'restore-request:';
var RESTORE_MAX_AGE_MS = 2 * 60 * 60 * 1000;
var RESTORE_SYNC_KEYS = ['crm', 'events', 'history', 'holidayExtras', 'homeVisits',
                         'orgConfig', 'projects', 'rebbeDate'];

function restoreState_(token) {
  token = String(token || '').trim();
  if (!token) throw new Error('חסר מזהה שחזור');
  var raw = PropertiesService.getScriptProperties().getProperty(RESTORE_PREFIX + token);
  if (!raw) throw new Error('השחזור אינו קיים או שפג תוקפו');
  var state = JSON.parse(raw);
  if (!state.createdAt || Date.now() - state.createdAt > RESTORE_MAX_AGE_MS) {
    PropertiesService.getScriptProperties().deleteProperty(RESTORE_PREFIX + token);
    throw new Error('השחזור פג תוקף; התחילו מחדש');
  }
  return state;
}

function saveRestoreState_(state) {
  PropertiesService.getScriptProperties().setProperty(
    RESTORE_PREFIX + state.token, JSON.stringify(state));
}

function withRestoreLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); }
  finally { lock.releaseLock(); }
}

function validateRestoreManifest_(manifest) {
  manifest = manifest || {};
  if (Number(manifest.schemaVersion) !== EXPORT_SCHEMA_VERSION) {
    throw new Error('גרסת הגיבוי אינה נתמכת');
  }
  if (!Array.isArray(manifest.sheets) || !Array.isArray(manifest.syncKeys)) {
    throw new Error('מניפסט שחזור אינו שלם');
  }
  var allowed = exportSheetNames_();
  var seen = {};
  var sheets = {};
  manifest.sheets.forEach(function (s) {
    var name = String(s && s.name || '').trim();
    if (allowed.indexOf(name) < 0 || seen[name]) throw new Error('לשונית אסורה או כפולה: ' + name);
    seen[name] = true;
    var rowCount = Number(s.rowCount), headerCount = Number(s.headerCount);
    if (!Number.isInteger(rowCount) || rowCount < 0 ||
        !Number.isInteger(headerCount) || headerCount < 0) throw new Error('ספירות לא תקינות: ' + name);
    if (s.present && headerCount < 1) throw new Error('אין כותרות בלשונית: ' + name);
    sheets[name] = { present: !!s.present, rowCount: rowCount, headerCount: headerCount,
                     nextOffset: 0, started: false, done: !s.present };
  });
  allowed.forEach(function (name) {
    if (!seen[name]) throw new Error('לשונית חסרה במניפסט: ' + name);
  });
  var sync = {};
  manifest.syncKeys.forEach(function (key) {
    key = String(key || '').trim();
    if (RESTORE_SYNC_KEYS.indexOf(key) < 0 || sync[key] !== undefined) {
      throw new Error('מפתח סנכרון אסור או כפול: ' + key);
    }
    sync[key] = false;
  });
  return { sheets: sheets, sync: sync };
}

/**
 * עותק Spreadsheet אינו משכפל קובצי overflow שאליהם לשונית הסנכרון מצביעה.
 * בלי הבידוד הזה writeOverflow_ עלול לעדכן את אותו קובץ שגם עותק הבטיחות
 * מפנה אליו, ואז ה"גיבוי" כבר אינו המצב הישן. משכפלים כל קובץ ומחליפים
 * את המצביע בתוך העותק בלבד, לפני שנוגעים בגיליון הפעיל.
 */
function isolateSnapshotOverflow_(snapshot) {
  var syncSheet = snapshot.getSheetByName(SH.SYNC);
  if (!syncSheet) return;
  var values = syncSheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    var raw = values[i][1];
    if (!raw) continue;
    var parsed;
    try { parsed = JSON.parse(raw); } catch (err) { continue; }
    if (!parsed || !parsed.__overflow) continue;
    var key = String(values[i][0] || 'data').trim();
    var copy = DriveApp.getFileById(parsed.__overflow)
      .makeCopy('kehila-crm-restore-safety-' + key + '-' + Date.now() + '.json');
    syncSheet.getRange(i + 1, 2).setValue(JSON.stringify({ __overflow: copy.getId() }));
  }
}

function restoreBegin_(body) {
  return withRestoreLock_(function () {
    var requestId = String(body.reqId || '').trim();
    var props = PropertiesService.getScriptProperties();
    var requestKey = RESTORE_REQUEST_PREFIX + requestId;
    if (requestId) {
      var previousRaw = props.getProperty(requestKey);
      if (previousRaw) {
        try {
          var previous = JSON.parse(previousRaw);
          if (previous.createdAt && Date.now() - previous.createdAt <= RESTORE_MAX_AGE_MS) {
            var previousState = restoreState_(previous.token);
            return { success: true, token: previousState.token,
                     snapshotId: previousState.snapshotId,
                     snapshotName: previousState.snapshotName };
          }
        } catch (ignored) {}
        props.deleteProperty(requestKey);
      }
    }
    var checked = validateRestoreManifest_(body.manifest);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH-mm-ss');
    var snapshot = ss.copy('גיבוי בטיחות לפני שחזור ' + stamp);
    isolateSnapshotOverflow_(snapshot);
    var token = Utilities.getUuid();
    var state = {
      token: token, createdAt: Date.now(), status: 'active',
      snapshotId: String(snapshot.getId()), snapshotName: String(snapshot.getName()),
      sheets: checked.sheets, sync: checked.sync,
    };
    saveRestoreState_(state);
    if (requestId) props.setProperty(requestKey, JSON.stringify({ token: token, createdAt: state.createdAt }));
    return { success: true, token: token, snapshotId: state.snapshotId,
             snapshotName: state.snapshotName };
  });
}

function restoreCell_(value) {
  if (value && typeof value === 'object' && value.__type === 'date') {
    var d = new Date(value.value);
    if (isNaN(d.getTime())) throw new Error('תאריך פגום בגיבוי');
    return d;
  }
  if (value && typeof value === 'object') throw new Error('ערך תא פגום בגיבוי');
  // מונע ממחרוזת שהתחילה ב-= להפוך לנוסחה פעילה בזמן setValues.
  if (typeof value === 'string' && value.charAt(0) === '=') return "'" + value;
  return value === undefined || value === null ? '' : value;
}

function restoreSheet_(body) {
  return withRestoreLock_(function () {
    var state = restoreState_(body.token);
    if (state.status !== 'active') throw new Error('השחזור אינו פעיל');
    var name = String(body.sheet || '').trim();
    var item = state.sheets[name];
    if (!item || !item.present) throw new Error('הלשונית אינה חלק מהשחזור: ' + name);
    var offset = Number(body.offset), total = Number(body.total);
    var rows = body.rows;
    if (!Number.isInteger(offset) || offset !== item.nextOffset || total !== item.rowCount) {
      throw new Error('מקטע לא רציף בלשונית ' + name);
    }
    if (!Array.isArray(rows) || rows.length > EXPORT_MAX_LIMIT || offset + rows.length > total) {
      throw new Error('גודל מקטע אינו תקין בלשונית ' + name);
    }
    var headers = body.headers;
    if (!item.started && (!Array.isArray(headers) || headers.length !== item.headerCount)) {
      throw new Error('כותרות אינן תואמות בלשונית ' + name);
    }
    if (!item.started && !headers.every(function (h) { return typeof h === 'string'; })) {
      throw new Error('כותרת אינה טקסט בלשונית ' + name);
    }
    var matrix = rows.map(function (row) {
      if (!Array.isArray(row) || row.length !== item.headerCount) {
        throw new Error('רוחב שורה אינו תואם בלשונית ' + name);
      }
      return row.map(restoreCell_);
    });
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    if (!item.started) {
      sheet.clearContents();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers.map(restoreCell_)]);
      item.started = true;
    }
    if (matrix.length) sheet.getRange(offset + 2, 1, matrix.length, item.headerCount).setValues(matrix);
    item.nextOffset += matrix.length;
    item.done = item.nextOffset === item.rowCount;
    saveRestoreState_(state);
    invalidateTable_(name);
    return { success: true, sheet: name, nextOffset: item.nextOffset, complete: item.done };
  });
}

function restoreSync_(body) {
  return withRestoreLock_(function () {
    var state = restoreState_(body.token);
    if (state.status !== 'active') throw new Error('השחזור אינו פעיל');
    var key = String(body.key || '').trim();
    if (state.sync[key] === undefined) throw new Error('מפתח אינו חלק מהשחזור: ' + key);
    writeSync_(key, body.data);
    state.sync[key] = true;
    saveRestoreState_(state);
    return { success: true, key: key };
  });
}

function restoreFinish_(body) {
  return withRestoreLock_(function () {
    var state = restoreState_(body.token);
    if (state.status !== 'active') throw new Error('השחזור אינו פעיל');
    Object.keys(state.sheets).forEach(function (name) {
      if (!state.sheets[name].done) throw new Error('השחזור טרם השלים את הלשונית: ' + name);
    });
    Object.keys(state.sync).forEach(function (key) {
      if (!state.sync[key]) throw new Error('השחזור טרם השלים את המפתח: ' + key);
    });
    state.status = 'completed';
    state.completedAt = Date.now();
    saveRestoreState_(state);
    return { success: true, snapshotId: state.snapshotId, snapshotName: state.snapshotName };
  });
}

function restoreRollback_(body) {
  return withRestoreLock_(function () {
    var state = restoreState_(body.token);
    var source = SpreadsheetApp.openById(state.snapshotId);
    var target = SpreadsheetApp.getActiveSpreadsheet();
    exportSheetNames_().forEach(function (name) {
      var from = source.getSheetByName(name);
      if (!from) return;
      var to = target.getSheetByName(name) || target.insertSheet(name);
      var values = from.getDataRange().getValues();
      to.clearContents();
      if (values.length && values[0].length) {
        to.getRange(1, 1, values.length, values[0].length).setValues(values);
      }
    });
    state.status = 'rolledBack';
    state.rolledBackAt = Date.now();
    saveRestoreState_(state);
    invalidateTable_();
    return { success: true, snapshotId: state.snapshotId, snapshotName: state.snapshotName };
  });
}

/** מפתח בטוח לאובייקט שמשמש כ-Set. */
function setKey_(value) {
  return '$' + String(value == null ? '' : value).trim();
}

/** מוסיף ממצא מצטבר ומגביל דוגמאות כדי שגיליון פגום לא ינפח את התשובה. */
function integrityIssue_(issues, code, severity, title, items, details) {
  if (!items || !items.length) return;
  issues.push({
    code: code,
    severity: severity,
    title: title,
    count: items.length,
    items: items.slice(0, 50),
    truncated: items.length > 50,
    details: details || '',
  });
}

/**
 * דוח תקינות על הנתונים החיים — קריאה בלבד.
 *
 * הדוח אינו "מתקן" דבר ואינו מפעיל את מנוע החיובים. הוא רק בונה מפות
 * בזיכרון ומחזיר ממצאים מצטברים. כך אפשר להציג אותו בבטחה גם לפני גיבוי
 * וגם על גיליון ישן: ממצא שגוי לכל היותר דורש בדיקה אנושית, ולעולם לא
 * מוחק או משנה נתון.
 */
function getIntegrity_() {
  var issues = [];
  var contacts = table_(SH.CONTACTS);
  var log = table_(SH.LOG);
  var hk = table_(SH.HK);
  var failures = table_(SH.FAILURES);

  var required = [SH.CONTACTS, SH.LOG, SH.HK, SH.FAILURES, SH.SYNC];
  var missingSheets = required.filter(function (name) {
    return !SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  });
  integrityIssue_(issues, 'missing_sheets', 'error', 'לשוניות מערכת חסרות', missingSheets,
                  'יש להריץ setupSheet לפני שימוש באפליקציה.');

  // ── אנשי קשר ───────────────────────────────────────────────────────────
  var contactNames = {};
  var duplicateContacts = [];
  var missingContactNames = [];
  contacts.rows.forEach(function (row, i) {
    var name = String(get_(row, contacts, 'שם מלא') || row[0] || '').trim();
    if (!name) { missingContactNames.push('שורה ' + (i + 2)); return; }
    var key = setKey_(name);
    if (contactNames[key]) duplicateContacts.push(name + ' · שורות ' + contactNames[key] + ', ' + (i + 2));
    else contactNames[key] = i + 2;
  });
  integrityIssue_(issues, 'contacts_missing_name', 'error', 'אנשי קשר ללא שם', missingContactNames);
  integrityIssue_(issues, 'contacts_duplicate_name', 'warning', 'שמות כפולים באנשי הקשר', duplicateContacts,
                  'ייתכן שאלה אנשים שונים; יש לבדוק לפני מיזוג.');

  // ── הוראות קבע ─────────────────────────────────────────────────────────
  var orderIds = {};
  var orderRows = {};
  var duplicateOrders = [];
  var invalidOrders = [];
  var orderWithoutName = [];
  hk.rows.forEach(function (row, i) {
    var rowNo = i + 2;
    var id = String(get_(row, hk, 'מזהה') || '').trim();
    var name = String(get_(row, hk, 'שם') || '').trim();
    var amount = asNumber_(get_(row, hk, 'סכום'));
    var start = toDate_(get_(row, hk, 'תאריך פתיחה'));
    var rawPayments = get_(row, hk, 'מספר תשלומים');
    var unlimited = isUnlimited_(rawPayments);
    var payments = asNumber_(rawPayments);

    if (!id) invalidOrders.push('שורה ' + rowNo + ' · חסר מזהה');
    else {
      var key = setKey_(id);
      if (orderIds[key]) duplicateOrders.push(id + ' · שורות ' + orderIds[key] + ', ' + rowNo);
      else orderIds[key] = rowNo;
      orderRows[key] = { id: id, row: row, rowNo: rowNo };
    }
    if (!name) orderWithoutName.push((id || 'שורה ' + rowNo));
    if (!start) invalidOrders.push((id || 'שורה ' + rowNo) + ' · תאריך פתיחה חסר/לא תקין');
    if (!amount || amount <= 0) invalidOrders.push((id || 'שורה ' + rowNo) + ' · סכום לא תקין');
    if (!unlimited && (!payments || payments <= 0)) {
      invalidOrders.push((id || 'שורה ' + rowNo) + ' · מספר תשלומים לא תקין');
    }
  });
  integrityIssue_(issues, 'orders_duplicate_id', 'error', 'מזהי הוראות קבע כפולים', duplicateOrders);
  integrityIssue_(issues, 'orders_invalid', 'error', 'הוראות קבע עם נתונים לא תקינים', invalidOrders);
  integrityIssue_(issues, 'orders_missing_name', 'error', 'הוראות קבע ללא שם', orderWithoutName);

  // ── יומן ────────────────────────────────────────────────────────────────
  var logIds = {};
  var duplicateLogIds = [];
  var logWithoutId = [];
  var logWithoutName = [];
  var orphanCharges = [];
  var malformedCharges = [];
  var invalidAmounts = [];
  var unknownStatuses = [];
  var orphanContactRefs = [];
  var knownStatuses = {};
  knownStatuses[setKey_('')] = true;
  knownStatuses[setKey_(STATUS_FAILED)] = true;
  knownStatuses[setKey_(STATUS_FUTURE)] = true;
  knownStatuses[setKey_(STATUS_CANCELLED)] = true;

  log.rows.forEach(function (row, i) {
    var rowNo = i + 2;
    var id = String(get_(row, log, 'מזהה') || '').trim();
    var name = String(get_(row, log, 'שם') || '').trim();
    var status = String(get_(row, log, 'סטטוס') || '').trim();
    var amountRaw = get_(row, log, 'סכום');
    var amount = asNumber_(amountRaw);
    var donationDate = get_(row, log, 'תאריך תרומה');
    var method = String(get_(row, log, 'אפיק גבייה') || '').trim();

    if (!id) logWithoutId.push('שורה ' + rowNo);
    else {
      var key = setKey_(id);
      if (logIds[key]) duplicateLogIds.push(id + ' · שורות ' + logIds[key] + ', ' + rowNo);
      else logIds[key] = rowNo;
    }
    if (!name) logWithoutName.push((id || 'שורה ' + rowNo));
    else if (!contactNames[setKey_(name)]) orphanContactRefs.push(name + ' · שורה ' + rowNo);
    if (!knownStatuses[setKey_(status)]) unknownStatuses.push((id || 'שורה ' + rowNo) + ' · ' + status);

    var looksLikeMoney = !!donationDate || !!method || id.indexOf('hk:') === 0;
    if (looksLikeMoney && (!amountRaw || amount <= 0)) invalidAmounts.push((id || 'שורה ' + rowNo));

    if (id.indexOf('hk:') === 0) {
      var orderId = orderIdFromChargeId_(id);
      if (!orderId) malformedCharges.push(id + ' · שורה ' + rowNo);
      else {
        // חיוב שנכשל נשמר בכוונה גם אחרי הסרת ההוראה, כתיעוד היסטורי.
        if (status !== STATUS_FAILED && !orderIds[setKey_(orderId)]) {
          orphanCharges.push(id + ' · שורה ' + rowNo);
        }
      }
    }
  });

  integrityIssue_(issues, 'log_duplicate_id', 'error', 'מזהים כפולים ביומן', duplicateLogIds);
  integrityIssue_(issues, 'log_missing_id', 'error', 'שורות יומן ללא מזהה', logWithoutId,
                  'ללא מזהה אי אפשר למנוע כתיבה כפולה.');
  integrityIssue_(issues, 'log_missing_name', 'error', 'שורות יומן ללא שם', logWithoutName);
  integrityIssue_(issues, 'charges_orphaned', 'error', 'חיובי הוראת קבע ללא הוראה', orphanCharges);
  integrityIssue_(issues, 'charges_malformed_id', 'error', 'מזהי חיוב הוראת קבע לא תקינים', malformedCharges);
  integrityIssue_(issues, 'log_invalid_amount', 'warning', 'רשומות כספיות עם סכום לא תקין', invalidAmounts);
  integrityIssue_(issues, 'log_unknown_status', 'warning', 'סטטוסים לא מוכרים ביומן', unknownStatuses);
  integrityIssue_(issues, 'log_unknown_contact', 'warning', 'שמות ביומן שאינם באנשי הקשר', orphanContactRefs,
                  'ייתכן שהאדם נמחק או ששמו נכתב בצורה אחרת.');

  // ── כשלים שמצביעים להוראה שאינה קיימת ────────────────────────────────
  var orphanFailures = [];
  failures.rows.forEach(function (row, i) {
    var id = String(get_(row, failures, 'מזהה הוראה') || '').trim();
    if (id && !orderIds[setKey_(id)]) orphanFailures.push(id + ' · שורה ' + (i + 2));
  });
  integrityIssue_(issues, 'failures_orphaned', 'warning', 'כשלי חיוב ללא הוראת קבע', orphanFailures);

  var totals = { error: 0, warning: 0, info: 0 };
  issues.forEach(function (issue) {
    if (totals[issue.severity] === undefined) totals[issue.severity] = 0;
    totals[issue.severity] += issue.count;
  });

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    codeVersion: CODE_VERSION,
    healthy: totals.error === 0,
    summary: {
      errors: totals.error,
      warnings: totals.warning,
      info: totals.info,
      issueGroups: issues.length,
      contacts: contacts.rows.length,
      logRows: log.rows.length,
      standingOrders: hk.rows.length,
      failures: failures.rows.length,
    },
    issues: issues,
  };
}

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
    codeVersion: CODE_VERSION,
    // רק כשלים מהחודש האחרון. הלשונית עצמה נשארת יומן היסטורי מלא, אבל
    // הדשבורד הוא מסך "מה דורש טיפול" — וסירוב מלפני חצי שנה כבר לא כזה.
    failureCount: recentFailureCount_(now),
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
function addStandingOrder_(body, options) {
  options = options || {};
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
  var created = options.skipGenerate ? 0 : generateStandingOrderCharges();
  return { success: true, id: id, created: created, deferredCharges: !!options.skipGenerate };
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
// ─────────────────────────────────────────────────────────────────────────────
// חידוש הוראת קבע.
//
// כשתורם מחדש הוראה שהסתיימה, נדרים פלוס פותחת אצלה **הוראה חדשה עם מספר
// חדש** — ולכן גם כאן זו שורה חדשה, ולא עריכה של הישנה. הפיתוי לדרוס את
// השורה הקיימת גדול (שורה אחת לכל תורם, נוח), אבל המחיר הוא בדיוק מה
// שהתלוננת עליו: תאריך הפתיחה קופץ קדימה, מונה החיובים מתאפס, וכל מה
// שהאיש נתן עד היום נמחק מהמסך.
//
// השורה החדשה מצביעה על הישנה דרך "חידוש של", וכך שתיהן נשארות שלמות:
// החיובים הישנים עם הסכום שבו באמת נגבו, החדשים עם הסכום החדש, וההיסטוריה
// מצטרפת לשרשרת אחת שהאפליקציה יודעת להציג.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ── מתי באמת ייגבה החיוב הראשון של חידוש ──────────────────────────────────
 *
 * הכלל אצל הספק, כפי שמנהל החשבונות ניסח אותו: **יום החיוב בחודש הוא תכונה
 * של ההוראה**, והחידוש נכנס למחזור בהזדמנות הקרובה של אותו יום. הוא אינו
 * "חודש אחרי החיוב האחרון", ואינו היום שבו לחצת על חידוש.
 *
 * דוגמה אמיתית: החיוב האחרון היה ב-15/7, ההוראה חודשה ב-18/8, ויום החיוב
 * של אותו תורם הוא ה-28 — לכן החיוב הראשון יוצא ב-28/8. אם יום החיוב היה
 * ה-15, הוא היה יוצא רק ב-15/9, ובלשונך: "הפסדתי חודש".
 *
 * שתי טעויות שהחישוב הזה מונע:
 *   · **תאריך בעבר.** הנוסחה הקודמת החזירה את המשבצת שאחרי ההוראה הישנה,
 *     גם אם היא כבר חלפה — והמנוע היה מייצר מיד חיוב "שנגבה" שמעולם לא
 *     נגבה, ומנפח את הכסף שנכנס.
 *   · **יום חיוב שגוי.** יום החיוב אצל הספק לא חייב להיות היום שבו נפתחה
 *     ההוראה הישנה. לכן אפשר לציין אותו במפורש.
 */
function hkNextSlot_(start, payments, unlimited, cancelDate, today, billingDay) {
  if (!start) return null;
  var now = today || new Date();
  now = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  var day = Number(billingDay) > 0 ? Math.min(31, Math.floor(Number(billingDay))) : start.getDate();

  // המשבצת ה"טבעית": מיד אחרי סוף ההוראה הקודמת
  var natural;
  if (cancelDate) {
    natural = new Date(cancelDate.getFullYear(), cancelDate.getMonth(), 1);
  } else {
    var months = unlimited
      ? (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1
      : (payments || 0);
    natural = new Date(start.getFullYear(), start.getMonth() + months, 1);
  }

  // ומכאן מתגלגלים קדימה עד ליום החיוב הקרוב שעוד לא עבר
  for (var i = 0; i < 240; i++) {
    var y = natural.getFullYear(), m = natural.getMonth();
    var d = new Date(y, m, Math.min(day, daysInMonth_(y, m)));
    if (d >= now) return d;
    natural.setMonth(natural.getMonth() + 1);
  }
  return null;
}

/**
 * מחשב מתי ייגבה החיוב הראשון — בלי לכתוב כלום.
 *
 * קיים כדי שדיאלוג החידוש יוכל להראות את התאריך **לפני** האישור. חידוש הוא
 * פעולה שקשה לתקן אחריה, ו"מתי זה ייגבה בפועל" היא בדיוק השאלה שנשאלת
 * בטלפון מול התורם.
 */
function previewRenewalDate_(body) {
  var id = String(body.id || '').trim();
  var t = table_(SH.HK);
  if (!t.sheet || !id) return { success: false, error: 'חסר מזהה הוראה' };

  for (var i = 0; i < t.rows.length; i++) {
    var r = t.rows[i];
    if (String(get_(r, t, 'מזהה') || '').trim() !== id) continue;
    var rawPay = get_(r, t, 'מספר תשלומים');
    var d = hkNextSlot_(
      toDate_(get_(r, t, 'תאריך פתיחה')),
      asNumber_(rawPay) || 0,
      isUnlimited_(rawPay),
      toDate_(get_(r, t, 'תאריך ביטול')),
      new Date(),
      Number(body.billingDay) || 0
    );
    return d
      ? { success: true, startDate: asDate_(d), billingDay: d.getDate() }
      : { success: false, error: 'לא הצלחתי לחשב תאריך' };
  }
  return { success: false, error: 'הוראת קבע ' + id + ' לא נמצאה' };
}

function renewStandingOrder_(body) {
  var id = String(body.id || '').trim();
  if (!id) return { success: false, error: 'חסר מזהה ההוראה שמחדשים' };

  var t = table_(SH.HK);
  if (!t.sheet) return { success: false, error: 'לשונית הוראות הקבע לא נמצאה' };
  if (t.col('חידוש של') < 0) {
    return { success: false, error: 'העמודה "חידוש של" חסרה — הריצו setupSheet פעם אחת' };
  }

  var row = -1, r = null;
  for (var i = 0; i < t.rows.length; i++) {
    if (String(get_(t.rows[i], t, 'מזהה') || '').trim() === id) { row = i + 2; r = t.rows[i]; break; }
  }
  if (row < 0) return { success: false, error: 'הוראת קבע ' + id + ' לא נמצאה' };

  var name = standardName(get_(r, t, 'שם'));
  var oldStart = toDate_(get_(r, t, 'תאריך פתיחה'));
  var oldCancel = toDate_(get_(r, t, 'תאריך ביטול'));
  var oldRawPay = get_(r, t, 'מספר תשלומים');
  var oldUnlimited = isUnlimited_(oldRawPay);
  var oldPayments = asNumber_(oldRawPay) || 0;
  var oldAmount = asNumber_(get_(r, t, 'סכום'));

  var amount = asNumber_(body.amount) || oldAmount;
  if (!amount || amount <= 0) return { success: false, error: 'סכום חייב להיות גדול מאפס' };

  var unlimited = body.unlimited === undefined
    ? (isUnlimited_(body.payments) || (body.payments === undefined && oldUnlimited))
    : !!body.unlimited;
  var payments = asNumber_(body.payments) || (unlimited ? 0 : oldPayments);
  if (!unlimited && !payments) return { success: false, error: 'חסר מספר תשלומים לחידוש' };

  // יום החיוב: מה שנמסר, אחרת היום שבו נפתחה ההוראה הישנה.
  var billingDay = Number(body.billingDay) > 0 ? Number(body.billingDay) : 0;
  var start = body.startDate
    ? toDate_(body.startDate)
    : hkNextSlot_(oldStart, oldPayments, oldUnlimited, oldCancel, new Date(), billingDay);
  if (!start) return { success: false, error: 'לא הצלחתי לקבוע תאריך התחלה לחידוש' };

  // מזהה חדש. אם יש בידך את מספר ההוראה האמיתי מנדרים פלוס — הוא עדיף:
  // מיילי הסירוב נושאים אותו, וזה מה שמצמיד כשל להוראה הנכונה.
  var newId = String(body.newId || '').trim();
  if (!newId) {
    // מתבססים על **המזהה השורשי** ולא על זה שמחדשים: חידוש של חידוש היה
    // מייצר "ren:ren:8002:2:2" ואחריו שרשרת שאי אפשר לקרוא בגיליון.
    // **בלי נקודתיים במזהה.** הפורמט הקודם, `ren:<מספר>:<דור>`, ייצר מזהה
    // חיוב עם ארבע נקודתיים — ומי שפירק אותו לפי התו הזה קיבל "ren" במקום
    // מספר ההוראה. עכשיו: `1866314-r2`, קריא בגיליון ובלי תווים מיוחדים.
    var rootMatch = String(id).match(/^ren:(.+):\d+$/) || String(id).match(/^(.+)-r\d+$/);
    var root = rootMatch ? rootMatch[1] : id;
    var n = 2;
    while (hkIndex_()[root + '-r' + n]) n++;
    newId = root + '-r' + n;
  }
  if (hkIndex_()[newId]) {
    return { success: false, error: 'הוראת קבע במספר ' + newId + ' כבר קיימת בגיליון' };
  }

  // ── ההוראה הישנה עדיין רצה אל תוך תקופת החידוש? ─────────────────────────
  // אז החידוש מחליף אותה מאותו יום. בלי זה שתי ההוראות היו מייצרות חיובים
  // במקביל, והתורם היה נראה כמי שמשלם פעמיים בחודש.
  var closedOld = '';
  var stillRunning = !oldCancel && (oldUnlimited || futureCharges_(oldStart, oldPayments, start, null) > 0);
  if (stillRunning) {
    var cCancel = t.col('תאריך ביטול');
    t.sheet.getRange(row, cCancel + 1).setValue(start);
    closedOld = asDate_(start);
  }

  var cNotes = t.col('הערות');
  if (cNotes >= 0) {
    var prev = String(r[cNotes] || '').trim();
    var note = 'חודשה בהוראה ' + newId + ' מ-' + asDate_(start);
    t.sheet.getRange(row, cNotes + 1).setValue(prev ? prev + ' · ' + note : note);
  }

  appendByName_(SH.HK, {
    'מזהה':          newId,
    'שם':            name,
    'תאריך פתיחה':   start,
    'סכום':          amount,
    'מספר תשלומים':  unlimited ? UNLIMITED_TEXT : payments,
    'טלפון':         fmt_(get_(r, t, 'טלפון')),
    'אימייל':        fmt_(get_(r, t, 'אימייל')),
    'קמפיין':        body.campaign || fmt_(get_(r, t, 'קמפיין')),
    'חידוש של':      id,
    'הערות':         'חידוש של הוראה ' + id +
                     (amount !== oldAmount ? ' · הסכום עודכן מ-₪' + oldAmount + ' ל-₪' + amount : ''),
  });

  flushWrites_();
  _hkIndex = null;
  _logIds = null;
  var created = generateStandingOrderCharges();

  return {
    success: true, id: newId, renewalOf: id, name: name,
    amount: amount, startDate: asDate_(start),
    payments: unlimited ? UNLIMITED_TEXT : payments,
    billingDay: start.getDate(),
    closedOld: closedOld, created: created,
  };
}

/**
 * ── עריכת הוראת קבע קיימת ─────────────────────────────────────────────────
 *
 * עד כאן אפשר היה רק **לשנות סכום** או **לבטל**. כל השאר — תאריך התחלה
 * שגוי, מספר תשלומים לא נכון, קמפיין שלא שויך, שם שהוקלד עם שגיאת כתיב —
 * חייב לרדת לגיליון ולתקן ביד, ואז לזכור שהחיובים שכבר נוצרו לא מתעדכנים
 * מעצמם.
 *
 * המקרה שהוליד את זה: חידוש נפתח בתאריך שכבר עבר, המנוע ייצר עבורו חיוב
 * מתוארך לאחור, והאפליקציה הציגה **"שולמו 1 מתוך 12" על הוראה שטרם חויבה
 * ולו פעם אחת**. תיקון התאריך לבדו לא היה מספיק — היה צריך גם לנקות את
 * החיוב הרפאים.
 *
 * לכן: שינוי בלוח הזמנים (תאריך התחלה או מספר תשלומים) **בונה מחדש את
 * החיובים**. חיוב שסומן "נכשל" נשאר — הוא אירוע אמיתי עם סיבה רשומה, ולא
 * משהו שהמנוע ייצר.
 */
function updateStandingOrder_(body) {
  var id = String(body.id || '').trim();
  if (!id) return { success: false, error: 'חסר מזהה הוראה' };

  var t = table_(SH.HK);
  if (!t.sheet) return { success: false, error: 'לשונית הוראות הקבע לא נמצאה' };

  var row = -1, r = null;
  for (var i = 0; i < t.rows.length; i++) {
    if (String(get_(t.rows[i], t, 'מזהה') || '').trim() === id) { row = i + 2; r = t.rows[i]; break; }
  }
  if (row < 0) return { success: false, error: 'הוראת קבע ' + id + ' לא נמצאה' };

  var oldStart = toDate_(get_(r, t, 'תאריך פתיחה'));
  var oldRawPay = get_(r, t, 'מספר תשלומים');

  // מה מותר לערוך. שדה שלא נשלח — לא נוגעים בו.
  var updates = {};
  if (body.name !== undefined)     updates['שם'] = standardName(body.name);
  if (body.amount !== undefined)   updates['סכום'] = asNumber_(body.amount);
  if (body.campaign !== undefined) updates['קמפיין'] = String(body.campaign || '');
  if (body.phone !== undefined)    updates['טלפון'] = String(body.phone || '');
  if (body.email !== undefined)    updates['אימייל'] = String(body.email || '');
  if (body.notes !== undefined)    updates['הערות'] = String(body.notes || '');

  var scheduleChanged = false;
  if (body.startDate !== undefined && String(body.startDate).trim()) {
    var d = toDate_(body.startDate);
    if (!d) return { success: false, error: 'תאריך התחלה לא תקין' };
    updates['תאריך פתיחה'] = d;
    scheduleChanged = scheduleChanged || !oldStart || d.getTime() !== oldStart.getTime();
  }
  if (body.payments !== undefined || body.unlimited !== undefined) {
    var unlimited = body.unlimited === undefined ? isUnlimited_(body.payments) : !!body.unlimited;
    var payments = asNumber_(body.payments);
    if (!unlimited && !payments) return { success: false, error: 'חסר מספר תשלומים' };
    var value = unlimited ? UNLIMITED_TEXT : payments;
    updates['מספר תשלומים'] = value;
    scheduleChanged = scheduleChanged || String(value) !== String(oldRawPay).trim();
  }

  var changed = [];
  Object.keys(updates).forEach(function (col) {
    var c = t.col(col);
    if (c < 0) return;
    t.sheet.getRange(row, c + 1).setValue(updates[col]);
    changed.push(col);
  });
  if (!changed.length) return { success: false, error: 'לא נשלח שום שינוי' };

  // ── בניית החיובים מחדש ────────────────────────────────────────────────
  var removed = 0;
  if (scheduleChanged) removed = clearOrderCharges_(id);

  _hkIndex = null;
  _logIds = null;
  _contactIndex = null;
  var created = generateStandingOrderCharges();

  Logger.log('הוראה ' + id + ' עודכנה: ' + changed.join(', ') +
             (scheduleChanged ? ' · לוח הזמנים נבנה מחדש' : ''));
  return { success: true, id: id, changed: changed, rebuilt: scheduleChanged,
           removed: removed, created: created };
}

/**
 * מוחק את חיובי ההוראה מהיומן — חוץ מאלה שסומנו "נכשל".
 * מוחקים מלמטה למעלה, אחרת כל מחיקה מזיזה את השורות שאחריה.
 */
function clearOrderCharges_(orderId) {
  var t = table_(SH.LOG);
  var cId = t.col('מזהה'), cStatus = t.col('סטטוס');
  if (!t.sheet || cId < 0) return 0;

  var deleted = 0;
  for (var i = t.rows.length - 1; i >= 0; i--) {
    if (orderIdFromChargeId_(t.rows[i][cId]) !== orderId) continue;
    if (cStatus >= 0 && String(t.rows[i][cStatus] || '').trim() === STATUS_FAILED) continue;
    t.sheet.deleteRow(i + 2);
    deleted++;
  }
  _logIds = null;
  return deleted;
}

/** כמה חיובים ייבנו מחדש אם ישונה לוח הזמנים — בלי לשנות כלום. */
function previewStandingOrderUpdate_(body) {
  var id = String(body.id || '').trim();
  var t = table_(SH.LOG);
  var cId = t.col('מזהה'), cStatus = t.col('סטטוס');
  if (!id || !t.sheet || cId < 0) return { success: false, error: 'חסר מזהה' };

  var existing = 0, failed = 0, collected = 0;
  t.rows.forEach(function (rr) {
    if (orderIdFromChargeId_(rr[cId]) !== id) return;
    var st = cStatus >= 0 ? String(rr[cStatus] || '').trim() : '';
    existing++;
    if (st === STATUS_FAILED) failed++;
    else if (st === '') collected++;
  });
  return { success: true, existing: existing, failed: failed, collected: collected };
}

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
 * ── עריכת שורה ביומן ──────────────────────────────────────────────────────
 *
 * טעות בהקלדה — אפיק גבייה שגוי, סכום שהוקלד לא נכון, ייעוד שנשכח — היא
 * הדבר השכיח ביותר, ועד עכשיו לא הייתה שום דרך לתקן אותה מהאפליקציה.
 *
 * מעדכנים רק שדות שנשלחו בפועל. שדה שלא נשלח נשאר כמו שהוא, כך שאפשר
 * לשנות דבר אחד בלי לדרוס בטעות את השאר.
 */
function updateDonation_(body) {
  var id = String(body.id || '').trim();
  if (!id) return { success: false, error: 'חסר מזהה התרומה' };

  var t = table_(SH.LOG);
  if (!t.sheet) return { success: false, error: 'לשונית היומן לא נמצאה' };

  var cId = t.col('מזהה');
  if (cId < 0) return { success: false, error: 'עמודת המזהה לא נמצאה' };

  var row = -1;
  for (var i = 0; i < t.rows.length; i++) {
    if (String(t.rows[i][cId] || '').trim() === id) { row = i + 2; break; }
  }
  if (row < 0) return { success: false, error: 'התרומה לא נמצאה ביומן' };

  var map = {
    'שם':            body.name === undefined ? undefined : standardName(body.name),
    'תאריך תרומה':   body.date,
    'סכום':          body.amount === undefined ? undefined : asNumber_(body.amount),
    'ייעוד':         body.purpose,
    'אפיק גבייה':    body.method,
    'סיכום ותובנות': body.notes,
  };

  var changed = [];
  Object.keys(map).forEach(function (col) {
    if (map[col] === undefined) return;
    var c = t.col(col);
    if (c < 0) return;
    t.sheet.getRange(row, c + 1).setValue(map[col]);
    changed.push(col);
  });

  if (body.name) { ensureContact_(standardName(body.name), body.phone, body.address); flushWrites_(); }
  Logger.log('תרומה ' + id + ' עודכנה: ' + changed.join(', '));
  return { success: true, id: id, changed: changed };
}

/**
 * מחיקת שורה מהיומן.
 *
 * חיוב של הוראת קבע (מזהה שמתחיל ב-hk:) חסום כאן במכוון: מנוע ההוראות
 * ייצר אותו מחדש בריצה הבאה, והמשתמש היה נלחם בו שוב ושוב בלי להבין.
 * את אלה עוצרים בתאריך ביטול או בשינוי סכום — ההודעה אומרת את זה.
 */
function deleteDonation_(body) {
  var id = String(body.id || '').trim();
  if (!id) return { success: false, error: 'חסר מזהה התרומה' };

  if (id.indexOf('hk:') === 0) {
    return { success: false, error:
      'זהו חיוב של הוראת קבע, והוא ייווצר מחדש אם יימחק. ' +
      'כדי לעצור את ההוראה השתמשו ב"בטל הוראה", ולשינוי סכום ב"שינוי סכום".' };
  }

  var t = table_(SH.LOG);
  var cId = t.col('מזהה');
  if (!t.sheet || cId < 0) return { success: false, error: 'לשונית היומן לא נמצאה' };

  for (var i = 0; i < t.rows.length; i++) {
    if (String(t.rows[i][cId] || '').trim() !== id) continue;
    t.sheet.deleteRow(i + 2);
    _logIds = null;   // המזהה פנוי שוב, אם אותו מייל ייסרק בעתיד
    Logger.log('תרומה ' + id + ' נמחקה');
    return { success: true, id: id };
  }
  return { success: false, error: 'התרומה לא נמצאה ביומן' };
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
 * ── מחיקת עמודות מלשונית אנשי הקשר ────────────────────────────────────────
 *
 * נדרש בגלל טעות תכן שתוקנה: שם הנפטר נשמר כשם של **עמודה**
 * (`יארצייט (פנחס בן לייב)`), ועמודה קיימת אצל כל אנשי הקשר. עם מאתיים
 * אנשים ושלושה נפטרים לכל אחד הגיליון הגיע למאות עמודות ריקות.
 *
 * היארצייטים עברו לרשומות בתוך הכרטיס, והפעולה הזו מנקה את מה שנשאר.
 * המחיקה מתבצעת מימין לשמאל — מחיקה משמאל מזיזה את כל האינדקסים
 * שאחריה, וכל מחיקה נוספת הייתה פוגעת בעמודה הלא נכונה.
 */
function deleteContactColumns_(body) {
  var names = (body && body.columns) || [];
  if (Object.prototype.toString.call(names) !== '[object Array]' || !names.length) {
    return { success: false, error: 'לא צוינו עמודות למחיקה' };
  }

  var t = table_(SH.CONTACTS);
  if (!t.sheet) return { success: false, error: 'לשונית אנשי הקשר לא נמצאה' };

  // אף פעם לא מוחקים עמודת ליבה, גם אם התבקשנו
  var PROTECTED = COLS.CONTACTS;
  var indices = [];
  names.forEach(function (n) {
    var name = String(n || '').trim();
    if (!name || PROTECTED.indexOf(name) >= 0) return;
    var c = t.col(name);
    if (c >= 0) indices.push(c);
  });

  indices.sort(function (a, b) { return b - a; });   // מימין לשמאל
  indices.forEach(function (c) { t.sheet.deleteColumn(c + 1); });

  Logger.log('נמחקו ' + indices.length + ' עמודות מאנשי הקשר');
  return { success: true, deleted: indices.length };
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

/** רכיבי חתימה מקודדים כדי שתווי הפרדה בתוך שם לא ייצרו התנגשות. */
function importSignature_(kind, parts) {
  return 'imp:fallback:' + kind + ':' + parts.map(function (part) {
    return encodeURIComponent(String(part == null ? '' : part));
  }).join('|');
}

/** אותו ניקוי שמפעילה אזהרת הכפילויות באפליקציה, בתוספת מפת הכינויים. */
function importCanonicalName_(value) {
  function clean(name) {
    return String(name == null ? '' : name)
      .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')
      .replace(/["'`׳״]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return clean(standardName(clean(value)));
}

/** סיומת סידורית יציבה שומרת שתי רשומות זהות אמיתיות באותו קובץ. */
function nextImportOrdinalId_(counts, base) {
  var key = setKey_(base);
  counts[key] = (counts[key] || 0) + 1;
  return base + '#' + counts[key];
}

function importDonationId_(donation, counts) {
  var sourceId = String(donation.id || '').trim();
  if (sourceId) return 'imp:' + sourceId;
  var name = importCanonicalName_(donation.name);
  var date = asDate_(donation.date || '');
  var agorot = Math.round(asNumber_(donation.amount) * 100);
  return nextImportOrdinalId_(counts, importSignature_('donation', [name, date, agorot]));
}

function importOrderId_(order, counts) {
  var sourceId = String(order.id || '').trim();
  if (sourceId) return sourceId; // מספר ספק אמיתי חייב להישאר זהה לצורך קישור כשלי חיוב
  var name = importCanonicalName_(order.name);
  var startDate = asDate_(order.startDate || '');
  var agorot = Math.round(asNumber_(order.amount) * 100);
  var unlimited = !!order.unlimited || isUnlimited_(order.payments);
  var payments = unlimited ? 'unlimited' : asNumber_(order.payments);
  return nextImportOrdinalId_(counts, importSignature_('order', [name, startDate, agorot, payments]));
}

/**
 * ייבוא מרוכז מהאפליקציה (כרטיסי הייבוא עם ה-AI).
 * body.contacts / body.donations / body.standingOrders — מערכים.
 * מזהה מקור אמיתי נשמר; בהיעדרו נבנית חתימה קנונית ויציבה. תווית `tag`
 * נשארת רק לצורך ביטול התרומות שנוספו בפעולת הייבוא הנוכחית.
 */
function importRows_(body) {
  var tag = 'imp' + new Date().getTime();
  var added = { contacts: 0, donations: 0, standingOrders: 0 };
  var rejected = { donations: [], standingOrders: [] };
  var donationOrdinals = {};
  var orderOrdinals = {};

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

  (body.donations || []).forEach(function (d) {
    if (!d || !d.name) {
      rejected.donations.push({
        id: String(d && d.id || '').trim(),
        name: String(d && d.name || '').trim() || 'ללא שם',
        reason: 'חסר שם תורם',
      });
      return;
    }
    var importId = importDonationId_(d, donationOrdinals);
    var ok = addLogRow_({
      'מזהה':        importId,
      'שם':          standardName(d.name),
      'תאריך תרומה': d.date || '',
      'סכום':        asNumber_(d.amount),
      'ייעוד':       d.purpose || '',
      'אפיק גבייה':  d.method || '',
      'סיכום ותובנות': d.notes || '',
      'מקור':        'ייבוא ' + tag,
    });
    if (ok) {
      ensureContact_(standardName(d.name), d.phone, d.address);
      added.donations++;
    } else {
      rejected.donations.push({
        id: importId,
        name: standardName(d.name),
        reason: 'תרומה במזהה זה כבר קיימת',
      });
    }
  });

  (body.standingOrders || []).forEach(function (h) {
    if (!h) {
      rejected.standingOrders.push({ id: '', name: 'ללא שם', reason: 'שורת הוראת קבע ריקה' });
      return;
    }
    var order = {};
    Object.keys(h).forEach(function (key) { order[key] = h[key]; });
    order.id = importOrderId_(order, orderOrdinals);
    var result = addStandingOrder_(order, { skipGenerate: true });
    if (result.success) {
      added.standingOrders++;
    } else {
      rejected.standingOrders.push({
        id: order.id,
        name: standardName(order.name),
        reason: result.error || 'הוראת הקבע לא נוספה',
      });
    }
  });

  // כל ההוראות כבר נשטפו לגיליון בתוך addStandingOrder_. מריצים את המנוע
  // פעם אחת בלבד במקום פעם לכל הוראה — בלי לשנות את מסלול ההוספה הרגיל.
  if (added.standingOrders > 0) generateStandingOrderCharges();

  flushWrites_();
  return { success: true, added: added, rejected: rejected, tag: tag };
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
    var found = 0, afterFilter = 0;
    try { found = GmailApp.search(query).length; } catch (e) { found = -1; }
    // גם עם המסנן שמדלג על מה שכבר נקלט — כאן מתגלה שאילתה שבורה:
    // המספר השמאלי גדול והימני אפס, בלי שום סיבה נראית לעין.
    try { afterFilter = GmailApp.search(query + labelFilter_()).length; } catch (e) { afterFilter = -1; }
    lines.push((active ? '' : '(כבוי) ') + name + ':  ' +
               (found < 0 ? 'שגיאה בחיפוש' : found + ' שיחות בסך הכל') +
               ' · לסריקה היומית: ' + (afterFilter < 0 ? 'שגיאה' : afterFilter));
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

  lines.push('',
    'הסריקה היומית מדלגת על מיילים שכבר נקלטו (תווית "' + LABEL_NAME + '").',
    'המספר הימני הוא מה שנשאר לה — אפס פירושו שהכל כבר נסרק, ולא תקלה.',
    'הסריקה ההיסטורית מהתפריט עוברת על הכל בלי קשר לתווית.',
    '');
  lines.push('סה"כ מיילים מנדרים פלוס בתיבה: ' + all);
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

/**
 * ── שם התווית בתוך שאילתת חיפוש ───────────────────────────────────────────
 *
 * **המרכאות כאן הן לא קישוט.** שם התווית מכיל רווחים, וג'ימייל מפרק שאילתה
 * לפי רווחים לפני שהוא מפרש אותה. בלי מרכאות,
 *
 *     -label:לוח בקרה — נקלט
 *
 * נקרא כ"לא בתווית *לוח*", ובנוסף **חייב להכיל** את המילים "בקרה" ו"נקלט".
 * מייל תרומה מנדרים פלוס לא מכיל אף אחת מהן — ולכן החיפוש החזיר אפס תוצאות,
 * תמיד. הסריקה רצה כסדרה, דיווחה "0 נקלטו", ושום תרומה חדשה לא נכנסה.
 *
 * זו הייתה תקלה שקטה מהסוג הגרוע: הכל נראה עובד, ופשוט אין נתונים.
 */
function labelFilter_() {
  return ' -label:"' + LABEL_NAME + '"';
}

/** התווית שמסמנת שרשור שכבר נקלט. נוצרת בפעם הראשונה. */
function processedLabel_() {
  return GmailApp.getUserLabelByName(LABEL_NAME) || GmailApp.createLabel(LABEL_NAME);
}

/**
 * ── למה הסריקה ההיסטורית מתעלמת מהתווית ───────────────────────────────────
 *
 * התווית "נקלט" יושבת על **חשבון הג'ימייל**, והנתונים יושבים **בגיליון**.
 * שני דברים נפרדים לגמרי, וזה מה שנשבר: מי שפתח גיליון חדש גילה שכל
 * המיילים כבר נושאים את התווית מהריצות של הגיליון הקודם — ולכן הסריקה
 * ההיסטורית מצאה אפס מיילים לסרוק, והגיליון החדש נשאר ריק לנצח. האבחון
 * הראה "337 שיחות · חדשות לסריקה: 0", וזה נכון וחסר תועלת בו-זמנית.
 *
 * לכן: הסריקה **היומית** מדלגת על מה שכבר נקלט (זו כל מטרתה — מהירות),
 * אבל הסריקה ההיסטורית, שמריצים ידנית ובכוונה, עוברת על **הכל**. אין בזה
 * סיכון לכפילות: כל שורה נכתבת לפי מזהה ייחודי, וכתיבה חוזרת של אותו מייל
 * פשוט לא עושה כלום.
 *
 * @param {boolean} all — true סורק את כל ההיסטוריה, false רק שלושה ימים אחרונים.
 */
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
    var q = all ? query : query + ' newer_than:3d' + labelFilter_();
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
  var nothing = !res.added && !res.orders && !res.failures;
  alert_('הסריקה ההיסטורית הושלמה ✅\n\n' +
         'תרומות שנקלטו:  ' + res.added + '\n' +
         'הוראות קבע שנקלטו:  ' + res.orders + '\n' +
         'חיובים חודשיים שנוצרו:  ' + created + '\n' +
         'כשלי חיוב:  ' + res.failures +
         (nothing
           ? '\n\nלא נוסף כלום — כלומר כל מה שבתיבה כבר נמצא בגיליון.\n' +
             'אם הגיליון נראה ריק, בדקו ב"אבחון קליטת מיילים" שהסקריפט רץ\n' +
             'בחשבון שאליו מגיעים המיילים.'
           : ''));
}

/**
 * מסיר את תווית "נקלט" מכל השרשורים.
 *
 * לשעת הצורך: אחרי מעבר לגיליון חדש, או כשרוצים לבנות הכל מאפס. הסריקה
 * ההיסטורית ממילא מתעלמת מהתווית, ולכן זה נחוץ רק כדי שגם הסריקה היומית
 * תעבור שוב על הכל.
 */
function clearProcessedLabel() {
  var label = GmailApp.getUserLabelByName(LABEL_NAME);
  if (!label) { alert_('התווית "' + LABEL_NAME + '" לא קיימת — אין מה לנקות.'); return; }
  var total = 0;
  for (var page = 0; page < 40; page++) {
    var threads = label.getThreads(0, 100);
    if (!threads.length) break;
    label.removeFromThreads(threads);
    total += threads.length;
  }
  alert_('התווית הוסרה מ-' + total + ' שיחות.\n\n' +
         'הסריקה הבאה תעבור עליהן שוב. שום דבר לא יירשם פעמיים —\n' +
         'כל שורה נכתבת לפי מזהה ייחודי.');
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
    if (String(t.rows[i][0]).trim() === key) {
      t.sheet.getRange(i + 2, 2).setValue(payload);
      invalidateTable_(SH.SYNC);
      return;
    }
  }
  t.sheet.appendRow([key, payload]);
  invalidateTable_(SH.SYNC);
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

/**
 * כל התאריכים חוזרים לאפליקציה בפורמט dd/MM/yyyy — **גם כשבגיליון הם כתובים
 * אחרת**.
 *
 * ── למה זה נחוץ ───────────────────────────────────────────────────────────
 *
 * בגיליון יושבים היום שני פורמטים זה לצד זה, וזה לא מקרי:
 *   · מיילים מנדרים פלוס מגיעים כ-17/08/2026 — לוכסנים.
 *   · מה שהאפליקציה כותבת עובר דרך toLocaleDateString בעברית, שמחזיר
 *     16.08.2026 — **נקודות**.
 *
 * שניהם נכונים, שניהם קריאים, ושניהם נשמרו כטקסט כמו שהם. התוצאה הייתה
 * רשימה שנראית תקינה לחלוטין לעין אנושית אבל בלתי ניתנת למיון: כל מקום
 * בקוד שפירק תאריך לפי '/' קיבל Invalid Date על החצי עם הנקודות, וכל
 * השוואה מול NaN מחזירה false — כלומר המיון פשוט לא קרה. בדשבורד זה נראה
 * כאילו התרומות החדשות "לא נכנסות", בזמן שהן היו שם כל הזמן.
 *
 * הנרמול נעשה **בקריאה ולא בכתיבה** במכוון: הגיליון נשאר כפי שהוא, שום
 * שורה קיימת לא נוגעים בה, וגם מה שיוקלד בעתיד ביד יתוקן בדרך החוצה.
 */
function asDate_(v) {
  if (v === undefined || v === null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }

  var s = String(v).trim();

  // רק תבניות מפורשות. אין כאן נפילה ל-new Date(s) — הוא היה "מזהה" גם
  // מחרוזות שאינן תאריך כלל ומחזיר משהו שנראה תקין.
  var m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b/);
  if (m) return pad2_(m[1]) + '/' + pad2_(m[2]) + '/' + m[3];

  var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return pad2_(iso[3]) + '/' + pad2_(iso[2]) + '/' + iso[1];

  return s;
}

function pad2_(n) { return ('0' + String(n).trim()).slice(-2); }

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
    'גרסת הסקריפט: ' + CODE_VERSION,
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

/**
 * ── התפריט ────────────────────────────────────────────────────────────────
 *
 * עשרה פריטים ברשימה אחת, שרובם נועדו לשעת תקלה, הופכים את התפריט לרשימה
 * שאי אפשר לבחור ממנה. מי שנכנס לכאן בפעם הראשונה צריך לראות שלושה דברים
 * שהוא באמת יעשה — ולא שיקול בין "אבחון קליטת מיילים" ל"הגירה מגיליון ישן".
 *
 * לכן: מה שמשתמשים בו בפועל למעלה, וכל השאר תחת "כלים מתקדמים". שום פעולה
 * לא הוסרה.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('לוח בקרה')
    .addItem('סנכרון עכשיו', 'dailySync')
    .addItem('סריקת כל היסטוריית המיילים', 'syncAllEmailHistory')
    .addItem('בדיקת נתונים', 'showSummary')
    .addSeparator()
    .addSubMenu(ui.createMenu('כלים מתקדמים')
      .addItem('התקנה ראשונית', 'setupSheet')
      .addItem('הגירה מגיליון ישן', 'migrateFromLegacy')
      .addSeparator()
      .addItem('אבחון קליטת מיילים', 'debugMailRules')
      .addItem('רענון כללי מייל', 'refreshMailRules')
      .addItem('ניקוי סימוני "נקלט" בגימייל', 'clearProcessedLabel')
      .addSeparator()
      .addItem('השלמת חיובי הוראות קבע', 'generateStandingOrderCharges')
      .addItem('רענון תאריך הכתיבה לרבי', 'refreshRebbeDate'))
    .addToUi();
}
