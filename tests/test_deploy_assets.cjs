const assert = require('assert');
const fs = require('fs');

const workflow = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');
assert.match(workflow, /git rev-list --max-count=8 origin\/gh-pages/);
assert.match(workflow, /git show "\$\{rev\}:index\.html"/);
assert.match(workflow, /git show "\$\{rev\}:\$\{asset\}" > "dist\/\$\{asset\}"/);
assert.doesNotMatch(workflow, /keep_files:\s*true/);

console.log('✓ הפריסה שומרת מספר מוגבל של קובצי כניסה קודמים');
