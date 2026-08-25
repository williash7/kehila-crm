const fs = require('fs');
const path = require('path');
const assert = require('assert');

const engine = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'dailyReminder.ts'), 'utf8');
const card = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'DailyReminderCard.tsx'), 'utf8');
const agent = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'DailyReminderAgent.tsx'), 'utf8');
const settings = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'settings.ts'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');

assert.ok(/dailyReminderEnabled: false/.test(settings), 'התזכורת כבויה כברירת מחדל');
assert.ok(/counts\.total === 0/.test(engine), 'לא נשלחת התראה כשאין משהו לטיפול');
assert.ok(/lastSentDate !== today/.test(engine), 'נשלחת לכל היותר התראה אחת ביום');
assert.ok(/Notification\.requestPermission/.test(card), 'הרשאה מתבקשת רק בלחיצה מפורשת');
assert.ok(/אינו מבטיח להעיר אפליקציה/.test(card), 'המגבלה של אפליקציה סגורה מוסברת');
assert.ok(/showNotification/.test(agent), 'הסיכום מוצג כהתראת מערכת');
assert.ok(/notificationclick/.test(sw), 'לחיצה על ההתראה מחזירה לאפליקציה');

console.log('✓ תזכורת יומית כבויה כברירת מחדל, מרוכזת ושקופה לגבי מגבלות הרקע');
