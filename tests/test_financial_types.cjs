const fs = require('fs');
const assert = require('assert');

const ctx = fs.readFileSync('src/store/AppContext.tsx', 'utf8');
const standing = fs.readFileSync('src/lib/standingOrders.ts', 'utf8');
const donations = fs.readFileSync('src/components/DonationsTab.tsx', 'utf8');
const types = fs.readFileSync('src/types.ts', 'utf8');

assert.ok(ctx.includes('hk: HkEntry[];') && ctx.includes('failures: ChargeFailure[];'));
assert.ok(ctx.includes('useState<HkEntry[]>([])') && ctx.includes('useState<ChargeFailure[]>([])'));
assert.ok(!/hk:\s*any\[\]/.test(ctx), 'הוראות הקבע במצב המרכזי אינן any[]');
assert.ok(!/failures:\s*any\[\]/.test(ctx), 'כשלי החיוב במצב המרכזי אינם any[]');
assert.ok(standing.includes('Record<string, ChargeFailure>'));
assert.ok(!standing.includes('[key: string]: any'), 'HkEntry אינו פתוח לכל שדה שרירותי');
assert.ok(donations.includes('useState<Donation | null>'));
assert.ok(!/setEditFields\(\(f:\s*any\)/.test(donations), 'שדות עריכת תרומה אינם חוזרים ל-any');
['id?: string', 'meetDate?: string', 'meetPurpose?: string', 'source?: string'].forEach(field =>
  assert.ok(types.includes(field), `Donation חסר את השדה ${field}`));

console.log('✓ טיפוסים כספיים מרכזיים נשארים מחמירים');

