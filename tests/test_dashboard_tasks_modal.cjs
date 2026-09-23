const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src/components/HomeTab.tsx'), 'utf8');

assert.match(src, /onClick=\{\(\) => setIsTasksSummaryOpen\(true\)\}/,
  'לחיצה על כרטיס המשימות פותחת חלון ולא עוברת מסך');
assert.doesNotMatch(src, /const renderTasksSummary[\s\S]{0,700}onClick=\{\(\) => setTab\('tasks'\)\}/,
  'כרטיס המשימות אינו מנווט ישירות למסך המלא');
assert.match(src, /משימות פתוחות[\s\S]*tasksSummary\.items\.map/,
  'החלון מציג את המשימות עצמן');
assert.match(src, /פתח את מסך המשימות המלא/,
  'מי שרוצה עדיין יכול לעבור למסך המלא');
assert.match(src, /STANDALONE_TASKS_ID.*tasks/,
  'גם משימות כלליות נכללות ולא רק חגים ופעילויות');

console.log('✓ כרטיס המשימות בדשבורד פותח רשימה מקומית מלאה');
