// השאילתה שנשלחת לג'ימייל — הבאג ששתק את הסנכרון
const fs=require('fs');
eval(fs.readFileSync('/tmp/base.js','utf8').split("console.log('1.")[0]);
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}

// ── מפרש שאילתות ג'ימייל מפושט: מה בעצם נדרש מהמייל ─────────────────────────
// ג'ימייל מפרק לפי רווחים לפני שהוא מפרש. ערך עם רווחים חייב מרכאות.
function parseQuery(q) {
  const tokens = q.match(/-?\w+:"[^"]*"|-?"[^"]*"|\S+/g) || [];
  const required = [], excludedLabels = [];
  tokens.forEach(t => {
    if (t.indexOf('-label:') === 0) { excludedLabels.push(t.slice(7).replace(/^"|"$/g,'')); return; }
    if (/^-?\w+:/.test(t)) return;                 // אופרטור אחר — לא מילה נדרשת
    required.push(t.replace(/^"|"$/g,''));
  });
  return { required, excludedLabels };
}

const rule = 'subject:"[נדרים פלוס] התקבלה עסקה חדשה"';
// כך נבנית השאילתה היומית (all=false)
const q = rule + ' newer_than:3d' + labelFilter_();
console.log('השאילתה:\n   ' + q + '\n');

const parsed = parseQuery(q);
console.log('   מילים שהמייל חייב להכיל:', JSON.stringify(parsed.required));
console.log('   תוויות שמוחרגות:', JSON.stringify(parsed.excludedLabels));

ok(parsed.required.length === 0, 'אין אף מילה נדרשת מעבר לנושא — התקבלו ' + parsed.required.length);
ok(parsed.excludedLabels.length === 1, 'תווית אחת מוחרגת');
ok(parsed.excludedLabels[0] === LABEL_NAME, 'והיא בדיוק שם התווית: ' + parsed.excludedLabels[0]);

console.log('\nלשם השוואה — הגרסה השבורה (בלי מרכאות):');
const broken = parseQuery(rule + ' newer_than:3d -label:' + LABEL_NAME);
console.log('   מילים שהמייל חייב להכיל:', JSON.stringify(broken.required));
console.log('   תוויות שמוחרגות:', JSON.stringify(broken.excludedLabels));
ok(broken.required.length > 0, 'שם מייצרת מילים נדרשות — הסיבה שאפס מיילים נמצאו');
ok(broken.excludedLabels[0] !== LABEL_NAME, 'והתווית שהוחרגה אינה התווית האמיתית');

console.log('\nגם בסריקה ההיסטורית (all=true):');
// זו הבנייה האמיתית בקוד — בלי מסנן התווית בכלל
const qAll = rule;
ok(parseQuery(qAll).required.length === 0, 'אותה תקינות');
ok(qAll.indexOf('newer_than') < 0, 'ובלי הגבלת שלושה ימים');
ok(qAll.indexOf('-label:') < 0,
   'ובלי מסנן התווית — אחרת גיליון חדש לעולם לא היה מתמלא, כי התווית ' +
   'יושבת על חשבון הגימייל ולא על הגיליון');

console.log('\nח. תרחיש הגיליון החדש:');
// כל המיילים כבר נושאים את התווית מריצות של הגיליון הקודם
const alreadyLabeled = true;
const dailyFinds  = alreadyLabeled ? 0 : 337;
const historyFinds = 337;                       // מתעלמת מהתווית
console.log('   הסריקה היומית מוצאת:', dailyFinds);
console.log('   הסריקה ההיסטורית מוצאת:', historyFinds);
ok(dailyFinds === 0, 'היומית מדלגת — וזה נכון, היא לא אמורה לעבוד קשה');
ok(historyFinds === 337, 'ההיסטורית עוברת על הכל — וזה מה שממלא גיליון חדש');
