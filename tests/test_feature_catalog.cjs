const assert = require('assert');
const fs = require('fs');
const F = require('/tmp/stub/featureCatalog.js');
const N = require('/tmp/stub/navigation.js');

const ids = F.FEATURE_CATALOG.map(feature => feature.id);
assert.strictEqual(new Set(ids).size, ids.length, 'לכל פונקציה מזהה יחיד');
F.FEATURE_CATALOG.forEach(feature => {
  assert.ok(feature.title && feature.summary && feature.practical, `${feature.id}: חסר הסבר מלא`);
  assert.ok(Array.isArray(feature.data) && feature.data.length, `${feature.id}: חסר פירוט מה נשמר`);
});

const coveredTabs = new Set(F.FEATURE_CATALOG.map(feature => feature.tab).filter(Boolean));
const missingTabs = N.NAV_ITEMS.map(item => item.id).filter(id => !coveredTabs.has(id));
assert.deepStrictEqual(missingTabs, [], `מסכים ללא תיעוד: ${missingTabs.join(', ')}`);

const settingsSource = fs.readFileSync('src/components/SettingsTab.tsx', 'utf8');
F.FEATURE_CATALOG.filter(feature => feature.settings).forEach(feature => {
  assert.ok(settingsSource.includes(feature.settings.section),
    `${feature.id}: ההגדרה ${feature.settings.section} אינה מסומנת במסך ההגדרות`);
});

const guideSource = fs.readFileSync('src/components/GuideTab.tsx', 'utf8');
const appSource = fs.readFileSync('src/App.tsx', 'utf8');
assert.ok(guideSource.includes('FEATURE_CATALOG') && guideSource.includes('מה זה עוזר'), 'המדריך מציג את הקטלוג והתועלת');
assert.ok(guideSource.includes('onOpenSettings(feature.settings'), 'פריט במדריך פותח את ההגדרה שלו');
assert.ok(guideSource.includes("useState<string | null>('start')"), 'הפרק המעשי הראשון פתוח כברירת מחדל');
assert.ok(guideSource.includes('space-y-2.5 order-2') && guideSource.includes('no-print order-4'),
  'פרקי המדריך מוצגים לפני מפת הפונקציות הארוכה');
assert.ok(appSource.includes('openFeatureSettings') && appSource.includes('openTarget={settingsTarget}'),
  'האפליקציה מעבירה את היעד המדויק למסך ההגדרות');

console.log(`✓ קטלוג ${F.FEATURE_CATALOG.length} פונקציות מכסה את כל ${N.NAV_ITEMS.length} המסכים`);
