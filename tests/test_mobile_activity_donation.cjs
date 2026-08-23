const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('src/App.tsx', 'utf8');
const donations = fs.readFileSync('src/components/DonationsTab.tsx', 'utf8');
const events = fs.readFileSync('src/components/EventsTab.tsx', 'utf8');
const bottom = fs.readFileSync('src/components/BottomNav.tsx', 'utf8');

console.log('א. לשונית התרומות מחוברת לפתיחת טופס תרומה:');
assert.ok(/donations: 'תרומה'/.test(app));
assert.ok(/DonationsTab onAddDonation/.test(app));
assert.ok(/aria-label="הוספת תרומה"/.test(donations));

console.log('ב. כרטיס פעילות מפריד בנייד בין הפרטים לפעולות:');
assert.ok(/grid grid-cols-2 gap-2 sm:mt-0 sm:flex/.test(events));
assert.ok(/min-w-0 flex-1/.test(events));

console.log('ג. הסרגל מציג יחידות שלמות וגולל אל המסך הפעיל:');
assert.ok(/w-\[20%\]/.test(bottom));
assert.ok(/scrollIntoView/.test(bottom) && /data-nav-id/.test(bottom));

console.log('✓ פעולות הטלפון וכפתור התרומה מותאמים למסך קטן');
