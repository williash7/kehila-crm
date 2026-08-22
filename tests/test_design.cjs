const fs = require('fs');
const assert = require('assert');
const S = require('/tmp/settings.js');
const root = __dirname + '/..';
const theme = fs.readFileSync(root + '/src/theme.css', 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// מערכת העיצוב: חמישה צירים בלתי תלויים.
//
// הבדיקה הזו נולדה מתלונה מדויקת: "הצבע לא באמת משתנה, רק יש עליו כאילו
// שכבה נוספת". הסיבה הייתה שסרגל הצד נבנה מצבע בסיס + שכבות לבן-שקוף
// קבועות, ולכן רק הבסיס התחלף. כאן מוודאים שזה לא יחזור.
// ─────────────────────────────────────────────────────────────────────────────

// ── כל ציר מוגדר גם בקוד וגם ב-CSS ──
const axes = [
  ['data-theme',  S.THEMES,      'theme'],
  ['data-finish', S.FINISHES,    'finish'],
  ['data-surface',S.SURFACES,    'surface'],
  ['data-icons',  S.ICON_STYLES, 'icons'],
  ['data-font',   S.FONTS,       'font'],
];

axes.forEach(([attr, list, key]) => {
  assert.ok(list.length >= 3, `הציר ${attr} חייב לפחות שלוש אפשרויות`);
  list.forEach(o => {
    assert.ok(o.label && o.label.trim(), `לאפשרות ${o.id} ב-${attr} אין תווית`);
    // 'classic' ו-'auto' הן בכוונה חסרות בלוק: הראשונה יורדת מ-:root,
    // והשנייה פירושה "אל תדרוס — הערכה כבר קבעה".
    const byDesign = ['classic', 'auto'].includes(o.id);
    if (!byDesign) {
      assert.ok(theme.includes(`[${attr}='${o.id}']`),
        `אין כלל CSS עבור [${attr}='${o.id}'] — הבחירה תוצג ולא תעשה כלום`);
    }
  });
  // הערך השמור חייב להיות אחד מהרשימה
  const ids = list.map(o => o.id);
  assert.ok(ids.includes(S.DEFAULT_SETTINGS[key]),
    `ברירת המחדל של ${key} אינה ברשימת האפשרויות`);
});

// ── כל ערכת צבע מגדירה את מלוא הטוקנים ──
// ערכה שחסר בה טוקן יורשת אותו בשקט מברירת המחדל, וזה נראה בדיוק כמו באג.
const REQUIRED = [
  '--c-navy', '--c-navy-mid', '--c-gold', '--c-gold-light', '--c-gold-dark',
  '--c-cream', '--c-border', '--c-card', '--c-text', '--c-text-dim',
  '--c-chrome-bg', '--c-chrome-soft', '--c-chrome-border', '--c-chrome-dim',
  '--c-chrome-text', '--c-chrome-accent', '--c-chrome-active',
];
S.THEMES.forEach(t => {
  const m = theme.match(new RegExp(`\\[data-theme='${t.id}'\\][^{]*\\{([^}]+)\\}`));
  assert.ok(m, `אין בלוק CSS לערכה ${t.id}`);
  REQUIRED.forEach(v => assert.ok(m[1].includes(v + ':'),
    `בערכה "${t.label}" חסר הטוקן ${v}`));
  assert.strictEqual(t.swatch.length, 3, `לערכה ${t.id} צריכה דוגמית של שלושה צבעים`);
});
assert.ok(S.THEMES.length >= 12, 'ציפינו ל-12 ערכות לפחות, יש ' + S.THEMES.length);

// ── כל ציר נמצא ברשימת התלויות של ה-useEffect ──
//
// באג אמיתי שקרה כאן: נוספו ארבעה צירים, ורשימת התלויות נשארה עם הארבעה
// הישנים. התכונות נכתבו על ה-html פעם אחת בטעינה, וכל בחירה של גימור,
// אייקון או גופן נשמרה בהגדרות בלי שדבר ישתנה במסך. מבחוץ זה נראה בדיוק
// כמו "האפשרות הזו לא עושה כלום".
{
  const ctxSrc = fs.readFileSync(root + '/src/store/AppContext.tsx', 'utf8');
  const i = ctxSrc.indexOf("setAttribute('data-theme'");
  const deps = ctxSrc.slice(i, ctxSrc.indexOf(']);', i));
  ['theme', 'uiSize', 'density', 'graphics', 'finish', 'surface', 'icons', 'font'].forEach(k =>
    assert.ok(new RegExp(`settings\\.${k}\\b[,\\s\\]]`).test(deps.slice(deps.indexOf('}, ['))),
      `settings.${k} חסר ברשימת התלויות — הבחירה תישמר ולא תשפיע על המסך`));
}

// ── הערכות שונות זו מזו במבנה, לא רק בגוון ──
//
// התלונה שהולידה את הבדיקה: "הצבע נשאר, פשוט הוסיפו לו שכבה בגוון אחר".
// היא הייתה נכונה — שש מתוך שתים־עשרה ההדגשות ישבו באותה רצועת זהב,
// וכל שתים־עשרה הערכות הציגו סרגל כהה. זה פילטר צבע, לא עיצוב אחר.
{
  const hexToHsl = h => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn;
    const sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    const hue = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [hue * 60, sat, l];
  };
  const tok = (id, name) => {
    const m = theme.match(new RegExp(`\\[data-theme='${id}'\\][^{]*\\{([^}]+)\\}`));
    const g = m[1].match(new RegExp(name + ':\\s*(#[0-9A-Fa-f]{6})'));
    return g && g[1];
  };

  const hues = S.THEMES.map(t => hexToHsl(tok(t.id, '--c-gold'))[0]);
  const buckets = new Set(hues.map(h => Math.floor(h / 45)));
  assert.ok(buckets.size >= 5,
    `ההדגשות מרוכזות ב-${buckets.size} רצועות גוון בלבד — הערכות ייראו כמו אותו עיצוב בגוון אחר`);

  const navL = S.THEMES.map(t => hexToHsl(tok(t.id, '--c-chrome-bg'))[2]);
  assert.ok(navL.some(l => l > 0.75), 'אף ערכה לא מגיעה עם סרגל בהיר');
  assert.ok(navL.some(l => l < 0.2), 'אף ערכה לא מגיעה עם סרגל כהה');
  assert.ok(navL.some(l => l >= 0.2 && l <= 0.6), 'אף ערכה לא מגיעה עם סרגל צבעוני בעוצמה בינונית');
}

// ── אותו קוד צבע, שני תפקידים, שני משתנים ──
//
// #0D1B2A הוא גם רקע של משטח כהה (137 מופעים) וגם צבע הטקסט הרגיל על
// כרטיס לבן (282 מופעים). כל עוד שניהם מופו לאותו משתנה, אי אפשר היה
// להפוך את המשטחים לבהירים בלי להפוך את הטקסט ללבן על לבן.
{
  const map = fs.readFileSync(root + '/src/theme-map.css', 'utf8');
  // הסלקטור מכיל לוכסנים בורחים; חיפוש תת-מחרוזת פשוט אמין כאן יותר
  // מביטוי רגולרי, וקריא יותר.
  const rule = prefix => map.split('\n').find(l =>
    l.includes(`.${prefix}`) && l.includes('0D1B2A') &&
    !l.includes(':hover') && !l.includes('/')) || '';
  assert.ok(rule('bg').includes('--c-chrome-bg'), 'רקע כהה חייב ללכת למשתנה המשטח');
  assert.ok(rule('text').includes('--c-text'),    'טקסט חייב ללכת למשתנה הטקסט');
  assert.ok(!rule('text').includes('--c-chrome-bg'),
    'הטקסט הרגיל עוקב אחרי המשטחים — בחירת משטח בהיר תמחק את כל הטקסט באפליקציה');
}

// ── ציר המשטחים נוגע ביותר מהסרגל ──
// זו הבקשה המפורשת: "השינוי בסרגל הצד צריך להשפיע גם על הכפתורים ועל
// הפס העליון". שניהם בנויים מ-bg-[#0D1B2A], ולכן די בכך שהמחלקה הזו
// עוקבת אחרי --c-chrome-bg.
{
  const home = fs.readFileSync(root + '/src/components/HomeTab.tsx', 'utf8');
  assert.ok(/bg-\[#0D1B2A\][^"]*sticky top-0/.test(home), 'הפס העליון אמור להיות משטח כהה');
  const map = fs.readFileSync(root + '/src/theme-map.css', 'utf8');
  assert.ok(map.includes('background-color: var(--c-chrome-bg)'),
    'המשטחים הכהים אינם מחוברים לציר');
  ['dark', 'light', 'color'].forEach(v =>
    assert.ok(theme.includes(`[data-surface='${v}']`), `חסר מצב משטחים: ${v}`));
}

// ── טקסט חייב להיות קריא על המשטח שלו ──
//
// זה הבאג שנראה במסך: בערכות שהמשטח שלהן בהיר מלכתחילה ("בהיר ונקי",
// "שחור־לבן", "ירושלים") הכרטיס הפך ללבן — והטקסט הלבן שעליו נעלם.
{
  const lum = h => {
    const [r, g, b] = [1, 3, 5].map(i => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const tok = (id, name) => {
    const m = theme.match(new RegExp(`\\[data-theme='${id}'\\][^{]*\\{([^}]+)\\}`));
    const g = m[1].match(new RegExp(name + ':\\s*(#[0-9A-Fa-f]{6})'));
    return g && g[1];
  };

  S.THEMES.forEach(t => {
    const bg = tok(t.id, '--c-chrome-bg');
    const ink = tok(t.id, '--c-chrome-text');
    const accent = tok(t.id, '--c-chrome-accent');
    assert.ok(ratio(bg, ink) >= 4.5,
      `בערכה "${t.label}" הטקסט על המשטח כמעט בלתי נראה (יחס ${ratio(bg, ink).toFixed(1)})`);
    assert.ok(ratio(bg, accent) >= 3,
      `בערכה "${t.label}" צבע ההדגשה נבלע במשטח (יחס ${ratio(bg, accent).toFixed(1)})`);

    // וגם הטקסט הרגיל על הכרטיס
    const card = tok(t.id, '--c-card');
    const text = tok(t.id, '--c-text');
    assert.ok(ratio(card, text) >= 4.5,
      `בערכה "${t.label}" הטקסט על הכרטיס אינו קריא (יחס ${ratio(card, text).toFixed(1)})`);
  });
}

// ── הגוון השני של הגרדיאנט הוא צבע, לא שקיפות ──
//
// #1A2E45 מופיע כ-to-[#1A2E45] בעשרה גרדיאנטים. מיפוי שלו למשתנה שקיפות
// (rgba לבן) הפך כל אחד מהם לדהייה ללבן — כרטיס כהה שנמוג באמצע.
{
  const map = fs.readFileSync(root + '/src/theme-map.css', 'utf8');
  const line = map.split('\n').find(l => l.includes('.to-') && l.includes('1A2E45')) || '';
  assert.ok(line.includes('--c-chrome-bg-2'),
    'הגוון השני של הגרדיאנט חייב להיות משטח, לא שכבת שקיפות');
  assert.ok(!line.includes('--c-chrome-soft'),
    '--c-chrome-soft הוא rgba שקוף — גרדיאנט אליו נמוג ללבן');
  assert.ok(/--c-chrome-bg-2:\s*color-mix/.test(theme),
    'הגוון השני חייב להיגזר מהמשטח, אחרת הוא ישבר בערכות בהירות');
}

// ── הסרגל והפס העליון חולקים טוקן אחד ──
// אחרת מתקבל סרגל בהיר לצד פס עליון כהה, וזה נראה כמו תקלה.
{
  const map = fs.readFileSync(root + '/src/theme-map.css', 'utf8');
  const bar = map.split('\n').find(l => l.includes('.bg-') && l.includes('0D1B2A') && !l.includes('/')) || '';
  assert.ok(bar.includes('--c-chrome-bg'), 'הפס העליון אינו קשור לציר המשטחים');
  assert.ok(/\.nav-bg\s*\{[^}]*--c-chrome-bg/.test(theme), 'הסרגל אינו קשור לציר המשטחים');
}

// ── הניווט אינו מכיל צבעים קשיחים ──
// זו הבדיקה שתופסת את הרגרסיה המקורית.
['SideNav', 'BottomNav'].forEach(name => {
  const src = fs.readFileSync(`${root}/src/components/${name}.tsx`, 'utf8');
  const bad = src.match(/(?:text|bg|border)-white\/\d+/g) || [];
  assert.strictEqual(bad.length, 0,
    `${name} עדיין משתמש בלבן-שקוף (${bad.join(', ')}) — שכבה כזו לא מתחלפת עם הערכה`);
  assert.ok(/nav-bg/.test(src), `${name} חייב להשתמש בטוקן nav-bg`);
  assert.ok(/nav-text/.test(src), `${name} חייב להשתמש בטוקן nav-text`);
});

// ── הגימור באמת נוגע בפינות, בגבול ובצל ──
['--r-2xl', '--r-xl', '--bw', '--sh-sm'].forEach(v =>
  S.FINISHES.forEach(f => {
    const m = theme.match(new RegExp(`\\[data-finish='${f.id}'\\]\\s*\\{([^}]+)\\}`));
    assert.ok(m && m[1].includes(v + ':'), `בגימור "${f.label}" חסר ${v}`);
  }));
assert.ok(/\[data-finish\] \.rounded-2xl/.test(theme), 'הגימור חייב למפות את מחלקות העיגול');
assert.ok(/\[data-finish\] \.border\s/.test(theme), 'הגימור חייב לשלוט בעובי הגבול');

// ── האייקונים נשלטים מ-CSS, בלי לגעת במאות קריאות ──
S.ICON_STYLES.forEach(i =>
  assert.ok(new RegExp(`\\[data-icons='${i.id}'\\]\\s+svg`).test(theme),
    `לסגנון האייקונים "${i.label}" אין כלל stroke-width`));

// ── הגופן מגיע מטוקן, לא קשיח ──
assert.ok(/--font-display/.test(theme) && /--font-body/.test(theme));
const indexCss = fs.readFileSync(root + '/src/index.css', 'utf8');
assert.ok(/var\(--font-body/.test(indexCss),
  'גוף הטקסט חייב לצאת מהטוקן, אחרת ציר הטיפוגרפיה לא זז');
const html = fs.readFileSync(root + '/index.html', 'utf8');
assert.ok(/Assistant/.test(html), 'הגופן "מודרני" נבחר אך לא נטען');

// ── הצירים מוחלים על ה-html ──
const ctx = fs.readFileSync(root + '/src/store/AppContext.tsx', 'utf8');
axes.forEach(([attr, , key]) => assert.ok(
  new RegExp(`setAttribute\\('${attr}'`).test(ctx),
  `${attr} אינו מוחל על העמוד — ההגדרה תישמר ולא תשפיע`));

// ── ומסך הבחירה מציע את כולם ──
const card = fs.readFileSync(root + '/src/components/AppearanceCard.tsx', 'utf8');
['THEMES', 'FINISHES', 'SURFACES', 'ICON_STYLES', 'FONTS', 'UI_SIZES', 'DENSITIES'].forEach(n =>
  assert.ok(card.includes(n), `מסך המראה אינו מציג את ${n}`));
assert.ok(/LivePreview/.test(card), 'צריך תצוגה מקדימה — שם של גימור לא אומר כלום');

const combos = axes.reduce((n, [, list]) => n * list.length, 1);
console.log(`✓ מערכת העיצוב: ${S.THEMES.length} ערכות × ${S.FINISHES.length} גימורים × ` +
            `${S.SURFACES.length} משטחים × ${S.ICON_STYLES.length} אייקונים × ${S.FONTS.length} גופנים ` +
            `= ${combos.toLocaleString()} שילובים`);
