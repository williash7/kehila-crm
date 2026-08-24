// מריץ בדיקות חוצה־פלטפורמות. אין תלות ב-Bash, grep, sed או dirname.
// תוצרי האריזה נכתבים בתיקייה הזמנית של מערכת ההפעלה. שכבת תאימות קטנה
// ממפה אליה את הפניות הישנות ל-/tmp, בלי לדרוש הרשאה ל-C:\\tmp ב-Windows.

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TESTS = process.env.TESTS_DIR ? resolve(process.env.TESTS_DIR) : join(ROOT, 'tests');
const TMP = join(tmpdir(), 'kehila-crm-test');
const OUT = join(TMP, 'stub');
const PATH_COMPAT = join(ROOT, 'scripts', 'test-paths.cjs');

let esbuild;
try {
  ({ build: esbuild } = await import('esbuild'));
} catch {
  console.error('חסר esbuild. הריצו npm install ואז נסו שוב.');
  process.exit(1);
}

mkdirSync(join(OUT, 'node_modules', 'react', 'jsx-runtime'), { recursive: true });
mkdirSync(join(OUT, 'node_modules', 'lucide-react'), { recursive: true });
writeFileSync(join(OUT, 'node_modules', 'react', 'index.js'), 'module.exports={};');
writeFileSync(join(OUT, 'node_modules', 'react', 'package.json'), '{"name":"react","main":"index.js"}');
writeFileSync(join(OUT, 'node_modules', 'react', 'jsx-runtime', 'index.js'),
  'module.exports={jsx:()=>null,jsxs:()=>null,Fragment:Symbol("F")};');
writeFileSync(join(OUT, 'node_modules', 'react', 'jsx-runtime', 'package.json'),
  '{"name":"react/jsx-runtime","main":"index.js"}');
writeFileSync(join(OUT, 'node_modules', 'lucide-react', 'index.js'),
  'module.exports=new Proxy({},{get:()=>()=>null});');
writeFileSync(join(OUT, 'node_modules', 'lucide-react', 'package.json'),
  '{"name":"lucide-react","main":"index.js"}');

const run = (command, args, options = {}) => {
  const { env = {}, ...rest } = options;
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    ...rest,
    env: { ...process.env, KEHILA_TEST_TMP: TMP, ...env },
  });
};

console.log('── אורז ──');
const harness = run(process.execPath, [join(ROOT, 'scripts', 'build-gas-harness.mjs')]);
if (harness.stdout) process.stdout.write(harness.stdout);
if (harness.status !== 0) {
  if (harness.stderr) process.stderr.write(harness.stderr);
  process.exit(harness.status || 1);
}

async function bundle(source, outfile, extra = {}) {
  await esbuild({
    entryPoints: [join(ROOT, 'src', source)],
    outfile,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    logLevel: 'silent',
    ...extra,
  });
}

const libBundles = [
  ['lib/dashboardCards.ts', join(TMP, 'dash.js')],
  ['lib/dashboardCards.ts', join(OUT, 'dash.js')],
  ['lib/settings.ts', join(TMP, 'settings.js')],
  ['lib/standingOrders.ts', join(OUT, 'standingOrders.js')],
  ['lib/projects.ts', join(OUT, 'proj.js')],
  ['lib/allDates.ts', join(OUT, 'alldates.js')],
  ['lib/api.ts', join(OUT, 'api.js')],
  ['lib/manualDonations.ts', join(OUT, 'md.js')],
  ['lib/nameMerges.ts', join(OUT, 'nm.js')],
  ['lib/importDupes.ts', join(OUT, 'dupes.js')],
  ['lib/backup.ts', join(OUT, 'backup.js')],
  ['lib/backupHistory.ts', join(OUT, 'backupHistory.js')],
  ['lib/restore.ts', join(OUT, 'restore.js')],
  ['lib/paymentLedger.ts', join(OUT, 'paymentLedger.js')],
  ['lib/reconciliation.ts', join(OUT, 'reconciliation.js')],
  ['lib/todayFocus.ts', join(OUT, 'todayFocus.js')],
  ['lib/donationFilter.ts', join(OUT, 'df.js')],
  ['lib/finance.ts', join(OUT, 'finance.js')],
  ['lib/activities.ts', join(OUT, 'activities.js')],
  ['lib/history.ts', join(OUT, 'history.js')],
  ['lib/homeVisits.ts', join(OUT, 'homeVisits.js')],
  ['lib/dataOnboarding.ts', join(OUT, 'dataOnboarding.js')],
  ['lib/navigation.ts', join(OUT, 'navigation.js')],
];
for (const [source, outfile] of libBundles) await bundle(source, outfile);

const git = run('git', ['rev-parse', '--short', 'HEAD']);
const commit = git.status === 0 ? git.stdout.trim() : 'test';
await bundle('lib/version.ts', join(OUT, 'ver.js'), {
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_COMMIT__: JSON.stringify(commit),
  },
});
await bundle('components/FullScreenView.tsx', join(OUT, 'fsv.js'));

console.log('── מריץ ──');
let pass = 0;
let fail = 0;
const tests = readdirSync(TESTS).filter(name => /^test_.*\.cjs$/.test(name)).sort();
if (!tests.length) {
  console.error(`לא נמצאו בדיקות בתיקייה: ${TESTS}`);
  process.exit(1);
}
for (const name of tests) {
  const result = run(process.execPath, ['--require', PATH_COMPAT, join(TESTS, name)]);
  if (result.status === 0) {
    pass++;
    if (process.env.VERBOSE && result.stdout) process.stdout.write(`  ${result.stdout}`);
  } else {
    fail++;
    console.log(`✗ ${name.replace(/\.cjs$/, '')}`);
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
    const useful = output.split(/\r?\n/).filter(line => /AssertionError|Error:|FAIL|✗/.test(line));
    console.log((useful.slice(0, 3).length ? useful.slice(0, 3) : output.split(/\r?\n/).slice(-5))
      .map(line => `    ${line}`).join('\n'));
  }
}

console.log(`\nעברו: ${pass}   נכשלו: ${fail}`);
process.exitCode = fail ? 1 : 0;
