// ═══════════════════════════════════════════════════════════════════════════
// יוצר את מפת הצבעים: מחלקת Tailwind עם צבע קשיח → משתנה CSS של הערכה.
//
// ── למה סקריפט ולא קובץ שכתוב ביד ─────────────────────────────────────────
//
// הגרסה הראשונה מיפתה 20 מחלקות ביד: bg-[#0D1B2A], text-[#C9A84C] וכו'.
// זה כיסה את הרוב המוחלט של המופעים — ובכל זאת החלפת ערכה נראתה כמו
// "גוון אחר" ולא כמו ערכה אחרת. הסיבה: המחלקות שמשנות את **התחושה** הן
// דווקא הווריאנטים — focus:border-[#C9A84C] (145 מופעים), bg-[#C9A84C]/10,
// hover:bg-[#FAF6EE]. כל אחת מהן היא שם-מחלקה נפרד, ואף אחת מהן לא מופתה.
// יחד: יותר מ-300 מופעים שנשארו בצבע המקורי בכל ערכה.
//
// למפות גם אותם ביד פירושו רשימה שתתיישן ברגע שמישהו יכתוב מחלקה חדשה.
// לכן הקובץ הזה **סורק את הקוד** ומייצר את המפה מחדש. מחלקה חדשה נכנסת
// לבד; מחלקה שנמחקה נופלת לבד.
//
// הרצה: npm run theme   (וגם אוטומטית לפני build)
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const OUT = join(SRC, 'theme-map.css');

// הצבעים שהם "הערכה". צבע שאינו כאן (ירוק הצלחה, אדום שגיאה, ירוק וואטסאפ)
// נשאר כפי שהוא בכוונה — משמעות, לא עיצוב.
const VAR = {
  '#0D1B2A': '--c-navy',
  '#1A2E45': '--c-navy-mid',
  '#16283D': '--c-navy-mid',
  '#1A2D44': '--c-navy-mid',
  '#C9A84C': '--c-gold',
  '#E8C97A': '--c-gold-light',
  '#F5E7C4': '--c-gold-light',
  '#9B7A2F': '--c-gold-dark',
  '#FAF6EE': '--c-cream',
  '#FDF6E3': '--c-cream',
  '#EDE6D6': '--c-border',
};

// קידומת המחלקה → תכונת ה-CSS שהיא קובעת.
const PROP = {
  bg: 'background-color',
  text: 'color',
  border: 'border-color',
  ring: '--tw-ring-color',
  fill: 'fill',
  stroke: 'stroke',
  from: '--tw-gradient-from',
  via: '--tw-gradient-via',
  to: '--tw-gradient-to',
  decoration: 'text-decoration-color',
  outline: 'outline-color',
  caret: 'caret-color',
  accent: 'accent-color',
  placeholder: 'color',
};

// וריאנט → מה הוא עושה לסלקטור.
const VARIANT = {
  hover: s => `${s}:hover`,
  focus: s => `${s}:focus`,
  'focus-visible': s => `${s}:focus-visible`,
  'focus-within': s => `${s}:focus-within`,
  active: s => `${s}:active`,
  disabled: s => `${s}:disabled`,
  checked: s => `${s}:checked`,
  'group-hover': s => `.group:hover ${s}`,
  'peer-focus': s => `.peer:focus ~ ${s}`,
};

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(p)) files.push(p);
  }
})(SRC);

const source = files.map(f => readFileSync(f, 'utf8')).join('\n');

// מחלקה מלאה: וריאנטים אופציונליים, קידומת, צבע, ושקיפות אופציונלית.
const CLASS_RE = /(?<![\w:-])((?:[a-z-]+:)*)(bg|text|border|ring|fill|stroke|from|via|to|decoration|outline|caret|accent|placeholder)-\[(#[0-9A-Fa-f]{6})\](\/\d{1,3})?(?![\w[])/g;

const esc = c => c.replace(/([.[\]#/:])/g, '\\$1');
const rules = new Map();
let skippedVariants = new Set();

for (const m of source.matchAll(CLASS_RE)) {
  const [, variantStr, prefix, hexRaw, alphaRaw] = m;
  const hex = hexRaw.toUpperCase();
  const v = VAR[hex];
  if (!v) continue; // צבע סמנטי — לא נוגעים

  const variants = variantStr ? variantStr.slice(0, -1).split(':') : [];
  // וריאנט רספונסיבי (md:, lg:) לא משנה את הצבע עצמו, רק מתי הוא חל.
  // הכלל שלנו חל תמיד ממילא, ולכן אפשר להתעלם ממנו — חוץ מהמקרה שבו
  // הוא היחיד, ואז המחלקה הבסיסית כבר מכוסה.
  const active = variants.filter(x => !['sm', 'md', 'lg', 'xl', '2xl', 'rtl', 'ltr', 'dark', 'print'].includes(x));
  if (active.some(x => !VARIANT[x])) { active.forEach(x => !VARIANT[x] && skippedVariants.add(x)); continue; }

  const cls = m[0];
  let sel = '.' + esc(cls);
  for (const x of active) sel = VARIANT[x](sel);

  const alpha = alphaRaw ? Number(alphaRaw.slice(1)) : null;
  const value = alpha === null
    ? `var(${v})`
    : `color-mix(in srgb, var(${v}) ${alpha}%, transparent)`;

  const prop = prefix === 'placeholder' ? null : PROP[prefix];
  const full = prefix === 'placeholder'
    ? `[data-theme] ${sel}::placeholder { color: ${value}; }`
    : `[data-theme] ${sel} { ${prop}: ${value}; }`;
  rules.set(full, true);
}

const out = `/* ═══ נוצר אוטומטית על ידי scripts/gen-theme-map.mjs — אין לערוך ביד ═══
   ${rules.size} כללים, מתוך סריקה של ${files.length} קבצים.
   לעדכון: npm run theme
   ═════════════════════════════════════════════════════════════════════ */

${[...rules.keys()].sort().join('\n')}
`;

writeFileSync(OUT, out, 'utf8');
console.log(`theme-map.css: ${rules.size} כללים`);
if (skippedVariants.size) console.log('וריאנטים שלא מופו:', [...skippedVariants].join(', '));
