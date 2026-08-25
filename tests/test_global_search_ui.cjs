const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const nav = read('src/lib/navigation.ts');
const bottom = read('src/components/BottomNav.tsx');
const side = read('src/components/SideNav.tsx');
const app = read('src/App.tsx');
const ui = read('src/components/GlobalSearchTab.tsx');

assert.match(nav, /\{ id: 'search', label: 'חיפוש' \}/, 'החיפוש הוא מסך ניווט שניתן לסדר או להסתיר');
assert.doesNotMatch(nav, /DEFAULT_BOTTOM_NAV_PRIMARY[^;]*search/s,
  'החיפוש אינו מעמיס כברירת מחדל על ארבעת הכפתורים הראשיים');
assert.match(bottom, /search: Search/);
assert.match(side, /id: 'search'.*label: 'חיפוש'/);
assert.match(app, /activeTab === 'search'.*<GlobalSearchTab/s);
assert.match(app, /result\.kind === 'contact'[\s\S]*setOpenContact\(\{ name: result\.target\.entityId, from: 'search' \}\)/,
  'תוצאת איש קשר פותחת את הכרטיס עצמו, ומסמנת שהמקור הוא החיפוש');
assert.match(ui, /buildGlobalSearchIndex/);
assert.match(ui, /searchGlobalIndex/);
assert.match(ui, /אנשים, תרומות, פעילויות, קמפיינים ומשימות/);


// ═══════════════════════════════════════════════════════════════════════════
// הניווט מתוצאה אל **הפריט**, לא אל המסך.
//
// הגרסה הראשונה החליפה לשונית וזרקה את `entityId`. מי שחיפש „מאור” וקיבל
// תרומה של ₪500 נחת ברשימת התרומות בלי סינון ובלי סימון — כלומר הפעולה
// שהחיפוש בא לחסוך, „לחפש בתוך המסך”, נשארה בדיוק כפי שהייתה.
// ═══════════════════════════════════════════════════════════════════════════

const donations = read('src/components/DonationsTab.tsx');
const events = read('src/components/EventsTab.tsx');
const projects = read('src/components/ProjectsTab.tsx');
const openTarget = read('src/lib/openTarget.ts');

assert.match(app, /setOpenTarget\(\{ id: result\.target\.entityId, parentId: result\.target\.parentId/,
  'המזהה וההקשר עוברים הלאה ולא נזרקים');
assert.doesNotMatch(app, /setActiveTab\(targetTabs\[result\.target\.tab\] \|\| 'home'\)/,
  'החיבור הישן — החלפת לשונית בלבד — הוסר');

// סוג לא מוכר לא יזרוק את המשתמש לדשבורד.
assert.match(app, /if \(!tab\) return;/,
  'יעד שאינו מוכר אינו מנווט לשום מקום במקום לקפוץ לדשבורד');

// ── שלושת המסכים שמקבלים את היעד ──
[['DonationsTab', donations], ['EventsTab', events], ['ProjectsTab', projects]].forEach(([name, src]) => {
  assert.match(src, /OpenTargetProps/, `${name} מקבל את חוזה היעד`);
});

// תרומה וקמפיין נפתחים **ממש**, כי יש להם חוזה פתיחה קיים.
assert.match(donations, /setSelectedDonation\(match\)/,
  'תרומה: חלון הפרטים נפתח, לא רק מוצגת הרשימה');
assert.match(donations, /setMainTab\('donations'\)/,
  'ומוחלפת הלשונית, אחרת החלון נפתח מאחורי מסך אחר');
assert.match(projects, /setOpenId\(openTarget\.id\)/,
  'קמפיין: נפתח לפי החוזה הקיים');
assert.match(projects, /setShowClosed\(true\)/,
  'וקמפיין סגור מוצג — אחרת „לחצתי ולא קרה כלום”');

// פעילות: אין חוזה פתיחה, ולכן גלילה והדגשה.
assert.match(events, /useRevealEntity\(openTarget/, 'פעילות: מגוללים ומדגישים');
assert.match(events, /data-entity-id=\{ev\.id\}/, 'והכרטיס מסמן את עצמו כיעד');

// ── משימות: החרגה מכוונת ──
//
// למשימה אין מזהה יציב (`globalSearch` נופל ל-`parent:index`), ומיקום
// ברשימה משתנה בכל סינון. סימון לפי מזהה כזה היה מדגיש את המשימה הלא
// נכונה — גרוע יותר מלא להדגיש כלל.
assert.doesNotMatch(app, /<TasksTab[^>]*openTarget/,
  'משימות אינן מקבלות יעד עד שיהיה להן מזהה יציב');
assert.match(app, /מזהה יציב/, 'וההחרגה מתועדת במקום להיראות כשכחה');

// ── ההדגשה עצמה ──
assert.match(openTarget, /CSS\.escape/, 'מזהה עם תווים מיוחדים אינו שובר את הבורר');
assert.match(openTarget, /tries > 12/, 'ויתור אחרי מספר ניסיונות — לא לולאה אינסופית');
const css = read('src/index.css');
assert.match(css, /\.entity-highlight/, 'מחלקת ההדגשה מוגדרת');
assert.match(css, /var\(--c-gold/, 'וצבעה נגזר מטוקן הערכה, כדי שתתאים לכל ערכת נושא');
assert.match(css, /prefers-reduced-motion/, 'ומכובדת העדפת תנועה מופחתת');

// ═══════════════════════════════════════════════════════════════════════════
// תווית החזרה אומרת את האמת.
//
// המצב נוצר במקור למסך הניקוד והתווית הייתה מקובעת ל„ניקוד”. מי שהגיע
// לכרטיס מהחיפוש קיבל הצעה לחזור למסך שלא היה בו מעולם.
// ═══════════════════════════════════════════════════════════════════════════

assert.match(app, /from: 'score' \| 'search'/, 'מקור הפתיחה נשמר במפורש');
assert.match(app, /backLabel=\{openContact\.from === 'search' \? 'חיפוש' : 'ניקוד'\}/,
  'והתווית נגזרת ממנו');
assert.doesNotMatch(app, /backLabel="ניקוד"/, 'התווית המקובעת הוסרה');
assert.match(app, /onContactClick=\{name => setOpenContact\(\{ name, from: 'score' \}\)\}/,
  'מסך הניקוד ממשיך לסמן את עצמו כמקור');


// ═══════════════════════════════════════════════════════════════════════════
// היעד נצרך פעם אחת.
//
// בלי צריכה, היעד נשאר תלוי ב-App. מעבר למסך אחר וחזרה מרכיב מחדש את רכיב
// היעד, ה-effect רץ שוב — **ותרומה שנפתחה לפני שעה נפתחת שוב מעצמה.**
// המשתמש נכנס לרשימת התרומות ומקבל חלון שלא ביקש.
// ═══════════════════════════════════════════════════════════════════════════

assert.match(app, /const consumeOpenTarget = \(\) => setOpenTarget\(null\)/,
  'קיימת צריכה מפורשת');
[['DonationsTab', donations], ['EventsTab', events], ['ProjectsTab', projects]].forEach(([name, src]) => {
  assert.match(app, new RegExp(`<${name}[\\s\\S]*?onOpenTargetConsumed=\\{consumeOpenTarget\\}`),
    `${name} מקבל את הצריכה`);
  assert.match(src, /onOpenTargetConsumed/, `${name} משתמש בה`);
});
assert.match(donations, /onOpenTargetConsumed\?\.\(\)/, 'תרומה נצרכת אחרי פתיחה');
assert.match(projects, /onOpenTargetConsumed\?\.\(\)/, 'קמפיין נצרך אחרי פתיחה');
assert.match(events, /useRevealEntity\(openTarget, !!openTarget\?\.id, onOpenTargetConsumed\)/,
  'פעילות נצרכת דרך ההדגשה');

// גם ויתור צורך. יעד שלא נמצא — נמחק או סונן — אסור שיישאר תלוי לנצח
// וינסה שוב בכל כניסה עתידית למסך.
assert.match(openTarget, /const finish = \(\) =>/, 'קיימת צריכה משותפת');
assert.match(openTarget, /if \(\+\+tries > 12\) \{ finish\(\); return; \}/,
  'גם ויתור צורך את היעד, לא רק הצלחה');
assert.match(openTarget, /if \(revealEntity\(target\.id\)\) \{ finish\(\); return; \}/,
  'והצלחה צורכת אותו');
assert.match(openTarget, /if \(!done\)/, 'ולא צורכים פעמיים');

// ═══════════════════════════════════════════════════════════════════════════
// פעילות שהמסנן מסתיר.
//
// אם המשתמש נמצא בתצוגת „חגים” ומחפש פעילות שבועית, היא כלל אינה ברשימה.
// הגלילה הייתה מוותרת בשקט, ומבחינתו: „לחצתי על התוצאה והמסך רק התחלף.”
// ═══════════════════════════════════════════════════════════════════════════

assert.match(events, /if \(openTarget\?\.id\) setFilter\('all'\)/,
  'המסנן נפתח ל„הכל” לפני הניסיון להגיע לפעילות');
const filterIdx = events.indexOf("setFilter('all')");
const revealIdx = events.indexOf('useRevealEntity(openTarget');
assert.ok(filterIdx > 0 && revealIdx > filterIdx,
  'ופתיחת המסנן קורית לפני ההדגשה, לא אחריה');

console.log('✓ החיפוש מוביל לפריט עצמו, היעד נצרך פעם אחת, והמסנן אינו מסתיר אותו');
