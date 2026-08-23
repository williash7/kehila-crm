// תאימות לבדיקות הוותיקות שמפנות ל-/tmp באופן קשיח.
//
// ב-Unix זה היה תמיד נתיב מערכת רגיל. ב-Windows, Node מפרש אותו כ-C:\\tmp,
// שאינו בהכרח קיים או ניתן לכתיבה. מריץ הבדיקות קובע KEHILA_TEST_TMP
// לתיקייה הזמנית של המערכת, והקובץ הזה ממפה אליה גם require וגם readFileSync.

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const targetRoot = process.env.KEHILA_TEST_TMP;

function mapped(value) {
  if (!targetRoot || typeof value !== 'string' || !value.startsWith('/tmp/')) return value;
  return path.join(targetRoot, value.slice('/tmp/'.length));
}

const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  return resolveFilename.call(this, mapped(request), parent, isMain, options);
};

const readFileSync = fs.readFileSync;
fs.readFileSync = function (file, ...args) {
  return readFileSync.call(this, mapped(file), ...args);
};

