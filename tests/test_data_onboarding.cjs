const assert = require('assert');
const fs = require('fs');

const mem = new Map();
global.localStorage = {
  getItem: key => mem.has(key) ? mem.get(key) : null,
  setItem: (key, value) => mem.set(key, String(value)),
  removeItem: key => mem.delete(key),
};

const O = require('/tmp/stub/dataOnboarding.js');

console.log('א. אשף ההתחלה מוצג פעם אחת וניתן לסיום:');
assert.strictEqual(O.shouldShowDataOnboarding(), true);
O.markDataOnboardingDone();
assert.strictEqual(O.shouldShowDataOnboarding(), false);
O.resetDataOnboarding();
assert.strictEqual(O.shouldShowDataOnboarding(), true);

console.log('ב. שאלות קצרות יוצרות פעילויות ומשימות בלי שורות ריקות:');
const now = new Date('2026-08-23T09:00:00Z');
const activities = O.buildOnboardingActivities([
  { name: ' שיעור שבועי ', freq: 'weekly', firstDate: '2026-08-25', time: '20:00', location: 'בית חב״ד' },
  { name: ' ', freq: 'weekly', firstDate: '', time: '', location: '' },
], [
  { name: 'ערב נשים', date: '2026-09-01', time: '19:30', location: 'האולם' },
], now);
assert.strictEqual(activities.length, 2);
assert.strictEqual(activities[0].activityKind, 'recurring');
assert.strictEqual(activities[0].purposeTag, 'שיעור שבועי');
assert.strictEqual(activities[1].activityKind, 'special');

const tasks = O.parseTaskLines('1. להכין רשימה\n- להזמין כיבוד\n\n• לפרסם');
assert.deepStrictEqual(tasks.map(t => t.text), ['להכין רשימה', 'להזמין כיבוד', 'לפרסם']);
assert.ok(tasks.every(t => t.createdAt && t.done === false));

console.log('ג. קמפיינים נוצרים עם יעד מספרי ורשומה ריקה אינה נשמרת:');
const campaigns = O.buildOnboardingCampaigns([
  { name: 'קמפיין שנתי', goal: '18000', deadline: '2026-12-01' },
  { name: '', goal: '500', deadline: '' },
], now);
assert.strictEqual(campaigns.length, 1);
assert.strictEqual(campaigns[0].kind, 'campaign');
assert.strictEqual(campaigns[0].goal, 18000);

console.log('ד. החיבורים למסך הפתיחה, להגדרות ולייבוא המיידי קיימים:');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const settings = fs.readFileSync('src/components/SettingsTab.tsx', 'utf8');
const wizard = fs.readFileSync('src/components/DataOnboardingWizard.tsx', 'utf8');
const aiImport = fs.readFileSync('src/components/GlobalAIImportModal.tsx', 'utf8');
assert.ok(/shouldShowDataOnboarding/.test(app) && /DataOnboardingWizard/.test(app), 'האשף חייב להיפתח מהאפליקציה');
assert.ok(/קליטת נתוני התחלה/.test(settings) && /setDataWizardOpen\(true\)/.test(settings), 'חייב להיות כפתור חזרה בהגדרות');
assert.ok(/saveImmediately/.test(wizard), 'מסלול ה-AI באשף חייב לבקש שמירה מיידית');
assert.ok(/קלוט ושמור עכשיו/.test(aiImport) && /setAutoCommit\(saveImmediately\)/.test(aiImport), 'פלט AI תקין חייב להישמר בפעולה אחת במצב ההתחלה');
assert.ok(/עד חמש שאלות בכל פעם/.test(aiImport) && /קובצי Excel\/CSV/.test(aiImport), 'הפרומפט חייב לנהל שיחה ולקבל קבצים');

console.log('✓ אשף קליטת נתוני התחלה מחובר ושומר דרך המודלים הקיימים');
