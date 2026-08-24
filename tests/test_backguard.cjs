// כפתור "אחורה" של הטלפון סוגר כרטיס — כולל כרטיס בתוך כרטיס
const { createBackGuard } = require('/tmp/stub/fsv.js');
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}

function makeWindow() {
  const stack = ['/app'];
  const listeners = {};
  return {
    stack, listeners,
    history: {
      pushState: () => stack.push('#card'),
      back() { stack.pop(); (listeners['popstate']||[]).slice().forEach(f => f()); },
    },
    addEventListener: (t,f) => { (listeners[t] = listeners[t] || []).push(f); },
    removeEventListener: (t,f) => { listeners[t] = (listeners[t]||[]).filter(x => x !== f); },
    press: key => (listeners['keydown']||[]).slice().forEach(f => f({ key })),
  };
}

function makeAsyncWindow() {
  const stack = ['/app'];
  const listeners = {};
  const pending = [];
  return {
    stack, listeners, pending,
    history: {
      pushState: () => stack.push('#card'),
      back() { stack.pop(); pending.push(() => (listeners['popstate']||[]).slice().forEach(f => f())); },
    },
    addEventListener: (t,f) => { (listeners[t] = listeners[t] || []).push(f); },
    removeEventListener: (t,f) => { listeners[t] = (listeners[t]||[]).filter(x => x !== f); },
    flush: () => { while (pending.length) pending.shift()(); },
  };
}

console.log('1. פתיחה וסגירה בכפתור שבמסך:');
let w = makeWindow(), closed = 0;
let cleanup = createBackGuard(w, () => closed++);
ok(w.stack.length === 2, 'נרשמה כניסה להיסטוריה');
cleanup();
ok(w.stack.length === 1, 'הכניסה הוסרה — "אחורה" הבא לא יבוזבז');
ok(closed === 0, 'אין סגירה כפולה');
ok((w.listeners['popstate']||[]).length === 0, 'המאזין נוקה');

console.log('\n2. סגירה בכפתור אחורה של הטלפון:');
w = makeWindow(); closed = 0;
cleanup = createBackGuard(w, () => closed++);
w.history.back();
ok(closed === 1, 'הכרטיס נסגר');
ok(w.stack.length === 1, 'חזרנו לרמת האפליקציה');
cleanup();
ok(w.stack.length === 1, 'הניקוי לא מקפיץ אחורה שוב — לא יוצאים מהאפליקציה');

console.log('\n3. Escape:');
w = makeWindow(); closed = 0;
cleanup = createBackGuard(w, () => closed++);
w.press('a'); ok(closed === 0, 'מקש אחר לא סוגר');
w.press('Escape'); ok(closed === 1, 'Escape סוגר');
cleanup();

console.log('\n4. כרטיס בתוך כרטיס (איש קשר מתוך חג):');
w = makeWindow();
const log = [];
const outer = createBackGuard(w, () => log.push('חג'));
const inner = createBackGuard(w, () => log.push('איש קשר'));
ok(w.stack.length === 3, 'שתי כניסות בהיסטוריה');
w.history.back();
console.log('    נסגרו:', JSON.stringify(log));
ok(log.length === 1 && log[0] === 'איש קשר', 'אחורה סוגר רק את הכרטיס העליון — החג נשאר פתוח');
inner();                                    // React מנקה את הפנימי שנסגר
ok(w.stack.length === 2, 'נשארה כניסה אחת — של החג');
w.history.back();                           // אחורה שוב
ok(log.length === 2 && log[1] === 'חג', 'הלחיצה הבאה סוגרת את החג');
outer();
ok(w.stack.length === 1, 'ההיסטוריה חוזרת בדיוק למקום שממנו יצאנו');

console.log('\n5. סגירת הפנימי בכפתור שבמסך — החיצוני נשאר:');
w = makeWindow();
const log2 = [];
const o2 = createBackGuard(w, () => log2.push('חג'));
const i2 = createBackGuard(w, () => log2.push('איש קשר'));
i2();                                       // נסגר מהכפתור
console.log('    נסגרו:', JSON.stringify(log2), '| בהיסטוריה:', w.stack.length);
ok(log2.length === 0, 'לא נסגר שום כרטיס נוסף בעקבות הניקוי');
ok(w.stack.length === 2, 'נשארה הכניסה של החג');
w.history.back();
ok(log2.length === 1 && log2[0] === 'חג', 'אחורה עכשיו סוגר את החג');
o2();
ok(w.stack.length === 1, 'ההיסטוריה נקייה');

console.log('\n6. פתיחת כרטיס חדש לפני ש-popstate של הסגירה הקודמת הגיע:');
w = makeAsyncWindow();
const asyncLog = [];
const first = createBackGuard(w, () => asyncLog.push('ראשון'));
first();
const second = createBackGuard(w, () => asyncLog.push('שני'));
w.flush();
ok(asyncLog.length === 0, 'אירוע הסגירה הישן נצרך ואינו סוגר את הכרטיס החדש');
ok(w.stack.length === 2, 'הכרטיס החדש נשאר פתוח');
second(); w.flush();
ok(w.stack.length === 1, 'גם הכרטיס החדש נסגר וניקה את ההיסטוריה');
