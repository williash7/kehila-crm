const fs = require('fs');
const assert = require('assert');
const root = __dirname + '/..';
const css = fs.readFileSync(root + '/src/theme-map.css', 'utf8');

// ── הכיסוי ──
// הבעיה שהבדיקה הזו שומרת עליה: ערכת צבעים שמשנה רק "גוון". היא נגרמה
// מכך שהמיפוי כיסה את המחלקות הבסיסיות בלבד, ולא את הווריאנטים —
// focus:, hover:, ושקיפות כמו /10 — שהם הרוב המכריע של הגבולות והרקעים
// העדינים במסך.
const need = [
  ['.focus\\:border-\\[\\#C9A84C\\]:focus', 'גבול המיקוד בשדות'],
  ['.hover\\:border-\\[\\#C9A84C\\]:hover', 'גבול בריחוף'],
  ['.hover\\:bg-\\[\\#FAF6EE\\]:hover',     'רקע בריחוף'],
  ['.bg-\\[\\#C9A84C\\]\\/10',              'רקע זהב שקוף'],
  [':focus-within',                                'מיקוד בתוך רכיב'],
];
need.forEach(([frag, what]) => assert.ok(css.includes(frag), 'חסר מיפוי: ' + what));

// שקיפות מתורגמת ל-color-mix ולא נופלת חזרה לצבע מלא
assert.ok(/color-mix\(in srgb, var\(--c-gold\) 10%, transparent\)/.test(css));

// ── שום צבע קשיח לא נשאר בערכים ──
const values = css.split('\n').filter(l => l.includes('{')).join('\n');
const hard = values.match(/:\s*#[0-9A-Fa-f]{6}/g) || [];
assert.strictEqual(hard.length, 0, 'ערך צבע קשיח דלף לתוך המפה: ' + hard.join(','));

// ── כל כלל מצביע על משתנה שקיים באמת ──
const theme = fs.readFileSync(root + '/src/theme.css', 'utf8');
const used = new Set([...css.matchAll(/var\((--c-[a-z-]+)\)/g)].map(m => m[1]));
used.forEach(v => assert.ok(theme.includes(v + ':'), 'משתנה ללא הגדרה: ' + v));

// ── כל ערכה מגדירה את כל המשתנים ──
// ערכה שחסר בה משתנה יורשת אותו מברירת המחדל בשקט, וזה נראה כמו באג.
const themes = [...theme.matchAll(/\[data-theme='([a-z]+)'\]\s*\{([^}]+)\}/g)];
assert.ok(themes.length >= 6, 'ציפינו לשש ערכות, נמצאו ' + themes.length);
const base = [...theme.matchAll(/(--c-[a-z-]+):/g)].map(m => m[1]);
const required = [...new Set(base)];
themes.forEach(([, name, block]) => {
  required.forEach(v => assert.ok(block.includes(v + ':'), `בערכה "${name}" חסר ${v}`));
});

// ── ערכות שהכרטיס בהן כהה הופכות את הטקסט, בעדיפות שגוברת על המפה ──
// בלי ההיפוך, טקסט כהה יושב על כרטיס כהה ופשוט נעלם.
['dark', 'midnight'].forEach(name => {
  const re = new RegExp(`html\\[data-theme='${name}'\\]\\s+\\.text-\\\\\\[\\\\\\#0D1B2A\\\\\\]`);
  assert.ok(re.test(theme), `בערכה "${name}" הטקסט הכהה אינו מתהפך`);
});

// ── המפה מסונכרנת עם הקוד ──
// אם מישהו הוסיף מחלקה ולא הריץ את הסקריפט, הבדיקה נופלת כאן.
const { execSync } = require('child_process');
const before = css;
execSync('node scripts/gen-theme-map.mjs', { cwd: root, stdio: 'pipe' });
const after = fs.readFileSync(root + '/src/theme-map.css', 'utf8');
assert.strictEqual(before, after, 'theme-map.css אינו מעודכן — הרץ npm run theme');

const count = (css.match(/^\[data-theme\]/gm) || []).length;
console.log('✓ מפת הצבעים: ' + count + ' כללים, ' + themes.length + ' ערכות, מסונכרן עם הקוד');
