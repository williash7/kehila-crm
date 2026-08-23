#!/usr/bin/env bash
# עטיפת תאימות למי שרגיל להריץ דרך Git Bash או Linux.
# הליבה ב-Node, ולכן npm test עובד באותה צורה גם ב-Windows.
set -e
cd "$(dirname "$0")/.."
exec node scripts/run-tests.mjs
