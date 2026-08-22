#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# מריץ את כל בדיקות הלוגיקה.
#
# ── למה יש כאן שלב בנייה ─────────────────────────────────────────────────
#
# הבדיקות בודקות ספריות TypeScript שיושבות בתוך אפליקציית React, ולכן הן
# צריכות אותן כמודולים של Node. esbuild אורז כל ספרייה בנפרד, עם דמה
# ל-react ול-lucide-react — הלוגיקה עצמה לא נוגעת בהם ממילא.
#
# עד היום השלב הזה נעשה ביד בכל פעם מחדש, וכל אתחול של הסביבה מחק את
# התוצרים והפיל 21 בדיקות בבת אחת. עכשיו זה פקודה אחת.
#
# הרצה:  bash scripts/run-tests.sh
# ═══════════════════════════════════════════════════════════════════════════

set -u
cd "$(dirname "$0")/.."
APP="$PWD"
TESTS="${TESTS_DIR:-$APP/tests}"
OUT=/tmp/stub

# ── דמה ל-react ול-lucide-react ─────────────────────────────────────────
mkdir -p "$OUT/node_modules/react" "$OUT/node_modules/lucide-react"
echo 'module.exports={};'                                   > "$OUT/node_modules/react/index.js"
echo '{"name":"react","main":"index.js"}'                   > "$OUT/node_modules/react/package.json"
echo 'module.exports=new Proxy({},{get:()=>()=>null});'     > "$OUT/node_modules/lucide-react/index.js"
echo '{"name":"lucide-react","main":"index.js"}'            > "$OUT/node_modules/lucide-react/package.json"
# רכיבי TSX מתקמפלים ל-jsx-runtime, גם כשהבדיקה נוגעת רק בלוגיקה שבתוכם.
mkdir -p "$OUT/node_modules/react/jsx-runtime"
echo 'module.exports={jsx:()=>null,jsxs:()=>null,Fragment:Symbol("F")};' \
  > "$OUT/node_modules/react/jsx-runtime/index.js"
echo '{"name":"react/jsx-runtime","main":"index.js"}' \
  > "$OUT/node_modules/react/jsx-runtime/package.json"

# מאתרים את esbuild פעם אחת. npx פותר את החבילה מחדש בכל קריאה, וזה
# הופך אחת-עשרה אריזות מהירות לדקות של המתנה.
# ה-node_modules של הפרויקט הותקן ב-Windows, ולכן הבינארי של esbuild שבו
# אינו רץ כאן. מתקינים עותק משלנו פעם אחת ומשתמשים בו.
ESBUILD=/tmp/node_modules/.bin/esbuild
if [ ! -x "$ESBUILD" ]; then
  echo "── מתקין esbuild ──"
  (cd /tmp && npm install esbuild --no-audit --no-fund --silent >/dev/null 2>&1)
fi
[ -x "$ESBUILD" ] || ESBUILD="npx esbuild"

bundle() {  # bundle <קובץ-מקור> <יעד>
  $ESBUILD "$APP/src/lib/$1" --bundle --format=cjs --outfile="$2" \
    --log-level=error 2>&1 | grep -v '^$' || true
}

echo "── אורז ──"
# Code.gs מקבל דמה לסביבת גוגל ונטען ב-eval, כי אין בו exports.
node "$APP/scripts/build-gas-harness.mjs"

bundle dashboardCards.ts  /tmp/dash.js
bundle dashboardCards.ts  "$OUT/dash.js"
bundle settings.ts        /tmp/settings.js
bundle standingOrders.ts  "$OUT/standingOrders.js"
bundle projects.ts        "$OUT/proj.js"
bundle allDates.ts        "$OUT/alldates.js"
bundle api.ts             "$OUT/api.js"
bundle manualDonations.ts "$OUT/md.js"
bundle nameMerges.ts      "$OUT/nm.js"
# version.ts קורא לקבועים ש-vite מזריק בבנייה. בלעדיהם הבדיקה בודקת
# את הנפילה האחורית במקום את ההתנהגות האמיתית.
$ESBUILD "$APP/src/lib/version.ts" --bundle --format=cjs --outfile="$OUT/ver.js" \
  --log-level=error \
  --define:__BUILD_TIME__="'$(date -u +%Y-%m-%dT%H:%M:%SZ)'" \
  --define:__BUILD_COMMIT__="'$(git -C "$APP" rev-parse --short HEAD 2>/dev/null || echo test)'" \
  2>&1 | grep -v '^$' || true
bundle donationFilter.ts  "$OUT/df.js"
(cd "$OUT" && $ESBUILD "$APP/src/components/FullScreenView.tsx" --bundle \
  --format=cjs --outfile="$OUT/fsv.js" --log-level=error 2>&1 | grep -v '^$') || true

echo "── מריץ ──"
pass=0; fail=0
for t in "$TESTS"/test_*.cjs; do
  name=$(basename "$t" .cjs)
  if out=$(node "$t" 2>&1); then
    pass=$((pass+1))
    [ -n "${VERBOSE:-}" ] && echo "  $out"
  else
    fail=$((fail+1))
    echo "✗ $name"
    echo "$out" | grep -E 'AssertionError|Error:' | head -2 | sed 's/^/    /'
  fi
done

echo
echo "עברו: $pass   נכשלו: $fail"
[ "$fail" -eq 0 ]
