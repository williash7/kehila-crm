// ═══════════════════════════════════════════════════════════════════════════
// אורז את Code.gs להרצה תחת Node.
//
// ── מה זה עושה ──────────────────────────────────────────────────────────────
//
// Code.gs רץ בענן של גוגל ומשתמש ב-SpreadsheetApp, GmailApp, Utilities
// וחבריהם. הלוגיקה שאנחנו רוצים לבדוק — לוחות חיובים, חילוץ מזהים, בניית
// שאילתות ג'ימייל, נרמול תאריכים — אינה נוגעת בהם באמת; היא רק יושבת
// באותו קובץ.
//
// לכן: דמה מינימלית לכל גלובל של גוגל, ואחריה הקובץ עצמו. התוצאה נטענת
// בבדיקות עם eval, וכל פונקציה פנימית (עם הקו התחתון בסוף) זמינה לקריאה
// ישירה — מה שאי אפשר לעשות ב-require, כי אין ב-Code.gs שום export.
//
// הרצה: node scripts/build-gas-harness.mjs   (או דרך run-tests.sh)
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CODE = join(ROOT, 'google-apps-script', 'Code.gs');
const OUT = '/tmp/base.js';

// כל קריאה מחזירה עוד דמה, ולכן שרשרת כמו
// SpreadsheetApp.getActive().getSheetByName('x').getRange(...) לא תיפול.
const MOCKS = `
// ── דמה לסביבת Apps Script (נוצר על ידי scripts/build-gas-harness.mjs) ──
const __chain = new Proxy(function () {}, {
  get: (t, k) => {
    if (k === Symbol.toPrimitive || k === 'toString') return () => '';
    if (k === 'length') return 0;
    if (k === 'then') return undefined;          // כדי שלא ייחשב ל-Promise
    return __chain;
  },
  apply: () => __chain,
  construct: () => __chain,
});

// ── גיליון בזיכרון ────────────────────────────────────────────────────────
//
// table_() קורא getSheetByName(...).getDataRange().getValues(), ולכן די
// במימוש הצר הזה כדי שכל הלוגיקה שנשענת על טבלאות תרוץ באמת. הבדיקות
// כותבות ישירות ל-sheets['שם'].values, וזה המבנה שהן מצפות לו:
// שורה 0 = כותרות, כל השאר = נתונים.
// הגיליונות **אינם** מוגדרים כאן. Code.gs כבר מכיל את SH (שמות הלשוניות)
// ואת COLS (הכותרות), והעתקה שלהם לכאן הייתה יוצרת סכימה שנייה שמתיישנת
// בשקט ברגע שמישהו מוסיף עמודה. במקום זה, האתחול קורה בסוף הקובץ —
// אחרי ש-Code.gs נטען — ונגזר מהם.
var sheets = {};

function __sheetObj(name) {
  const store = sheets[name];
  if (!store) return null;
  const api = {
    getName: () => name,
    getDataRange: () => ({
      getValues: () => store.values,
      getNumRows: () => store.values.length,
    }),
    getLastRow: () => store.values.length,
    getLastColumn: () => (store.values[0] || []).length,
    appendRow: r => { store.values.push(r); return api; },
    // Range מחזיר **את עצמו** משרשראות עיצוב, לא את הגיליון. זה לא
    // קפדנות: הקוד כותב getRange(...).setValues(...).setFontWeight(...),
    // ומוק שמחזיר את הגיליון נופל בחוליה השנייה.
    getRange: (row, col, nRows, nCols) => {
      const rng = {
        getValues: () => store.values.slice(row - 1, row - 1 + (nRows || 1))
                            .map(r => r.slice(col - 1, col - 1 + (nCols || 1))),
        getValue: () => (store.values[row - 1] || [])[col - 1],
        getRow: () => row, getColumn: () => col,
        getNumRows: () => nRows || 1, getNumColumns: () => nCols || 1,
        setValues: v => {
          v.forEach((r, i) => {
            store.values[row - 1 + i] = store.values[row - 1 + i] || [];
            r.forEach((c, j) => { store.values[row - 1 + i][col - 1 + j] = c; });
          });
          return rng;
        },
        setValue: v => {
          store.values[row - 1] = store.values[row - 1] || [];
          store.values[row - 1][col - 1] = v;
          return rng;
        },
        clearContent: () => rng,
      };
      // כל שאר פעולות העיצוב מחזירות את ה-Range ואינן עושות דבר.
      ['setNumberFormat', 'setNumberFormats', 'setFontWeight', 'setFontColor',
       'setFontSize', 'setBackground', 'setBackgrounds', 'setHorizontalAlignment',
       'setVerticalAlignment', 'setWrap', 'setBorder', 'setFontFamily',
       'setNote', 'merge', 'setDataValidation', 'clearDataValidations',
      ].forEach(k => { rng[k] = () => rng; });
      return rng;
    },
    deleteRow: i => { store.values.splice(i - 1, 1); return api; },
    deleteColumn: () => api, insertSheet: () => api,
    setFrozenRows: () => api, autoResizeColumns: () => api,
    clear: () => { store.values = [store.values[0] || []]; return api; },
  };
  return api;
}

var SpreadsheetApp = {
  getActiveSpreadsheet: () => ({
    getSheetByName: __sheetObj,
    getSheets: () => Object.keys(sheets).map(__sheetObj),
    insertSheet: n => { sheets[n] = { values: [[]] }; return __sheetObj(n); },
    getId: () => 'test-sheet-id',
    getName: () => 'גיליון בדיקה',
  }),
  getActive: () => SpreadsheetApp.getActiveSpreadsheet(),
  getUi: () => __chain,
  flush: () => {},
};

var GmailApp         = __chain;
var DocumentApp      = __chain;
var DriveApp         = __chain;
var ScriptApp        = __chain;
var PropertiesService = __chain;
var CacheService     = __chain;
var UrlFetchApp      = __chain;
var ContentService   = __chain;
var HtmlService      = __chain;
var Logger           = { log: () => {} };
var Session = {
  getScriptTimeZone: () => 'Asia/Jerusalem',
  getActiveUser: () => ({ getEmail: () => 'test@example.com' }),
};

// Utilities.formatDate הוא היחיד שהלוגיקה באמת נשענת עליו, ולכן הוא
// ממומש ולא מדומה. התבניות שבשימוש: dd/MM/yyyy, yyyy-MM, yyyy-MM-dd.
var Utilities = {
  formatDate(date, _tz, fmt) {
    const p = n => String(n).padStart(2, '0');
    const d = p(date.getDate()), m = p(date.getMonth() + 1), y = date.getFullYear();
    return fmt
      .replace('yyyy', y).replace('dd', d).replace('MM', m)
      .replace('HH', p(date.getHours())).replace('mm', p(date.getMinutes()))
      .replace('ss', p(date.getSeconds()));
  },
  sleep: () => {},
  getUuid: () => 'uuid-' + Math.random().toString(36).slice(2),
  base64Encode: s => Buffer.from(String(s)).toString('base64'),
  base64Decode: s => Buffer.from(String(s), 'base64'),
};
`;

// אחרי הקובץ: זריעת הלשוניות מתוך ההגדרות שבו עצמו.
const SEED = `
// ── אתחול הלשוניות מתוך SH ו-COLS שב-Code.gs ────────────────────────────
Object.keys(SH).forEach(function (key) {
  sheets[SH[key]] = { values: [ (COLS[key] || []).slice() ] };
});

/** מאפס לשונית לכותרות בלבד. שימושי בין תרחישים בתוך אותה בדיקה. */
function resetSheet(name) {
  const key = Object.keys(SH).filter(function (k) { return SH[k] === name; })[0];
  sheets[name] = { values: [ (COLS[key] || []).slice() ] };
  return sheets[name];
}
`;

const code = readFileSync(CODE, 'utf8');
writeFileSync(OUT, MOCKS + '\n' + code + '\n' + SEED, 'utf8');

const fns = (code.match(/^function\s+\w+/gm) || []).length;
const version = (code.match(/CODE_VERSION\s*=\s*'([^']+)'/) || [])[1] || '?';
console.log(`base.js: ${fns} פונקציות, גרסה ${version}`);
