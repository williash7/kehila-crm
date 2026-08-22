// כרטיס "מה דורש טיפול" — חוזה החישוב הטהור.

const F = require('/tmp/stub/todayFocus.js');

let failed = 0;
function ok(condition, message) {
  console.log((condition ? '  ✓ ' : '  ✗ ') + message);
  if (!condition) failed = 1;
}

const today = new Date(2026, 7, 23, 12, 0, 0);
const result = F.buildTodayFocus({
  today,
  limitPerGroup: 2,
  failures: [
    { name: 'חדש', date: '22/08/2026', reason: 'סירוב', amount: 100 },
    { name: 'בגבול', date: '24/07/2026', reason: 'סירוב' },
    { name: 'ישן', date: '23/07/2026', reason: 'סירוב' },
    { name: 'בלי תאריך', reason: 'חסר תאריך' },
  ],
  taskBuckets: [
    {
      scope: 'standalone', contextId: 'standalone', tasks: [
        { text: 'תודה אחת', done: false, kind: 'thankYou', personName: 'שרה', donationDate: '22/08/2026', createdAt: '2026-08-23T08:00:00Z' },
        { text: 'נוצרה היום אך אינה דחופה', done: false, createdAt: '2026-08-23T08:00:00Z' },
        { text: 'דחופה בלי תאריך', done: false, urgent: true },
        { text: 'מועד עבר', done: false, dueDate: '2026-08-22' },
        { text: 'מחר', done: false, dueDate: '2026-08-24' },
        { text: 'בוצעה', done: true, urgent: true },
      ],
    },
    {
      scope: 'holiday', contextId: 'חג', contextDate: '2026-08-23', tasks: [
        { text: 'משימת חג להיום', done: false },
      ],
    },
  ],
  standingOrders: [
    { id: 'a', name: 'מסתיימת', active: true, amount: 50, remaining: 1, lastBilled: '' },
    { id: 'b', name: 'הסתיימה', active: false, amount: 60, remaining: 0, lastBilled: '' },
    { id: 'c', name: 'פעילה', active: true, amount: 70, remaining: 10, lastBilled: '' },
    { id: 'd', name: 'בוטלה', active: false, amount: 80, remaining: 3, lastBilled: '', cancelDate: '01/08/2026' },
    { id: 'e', name: 'חודשה', active: false, amount: 90, remaining: 0, lastBilled: '', renewedBy: 'f' },
    { id: 'g', name: 'ללא הגבלה', active: true, amount: 100, remaining: 0, lastBilled: '', unlimited: true },
  ],
  hkExpiringThreshold: 2,
  personalDates: [
    { name: 'היום', msg: 'יום הולדת היום', icon: '🎂', dist: 0, key: 'today' },
    { name: 'שבוע', msg: 'יארצייט בעוד 7 ימים', icon: '🕯️', dist: 7, key: 'week' },
    { name: 'רחוק', msg: 'בעוד 8 ימים', icon: '🎈', dist: 8, key: 'later' },
    { name: 'עבר', msg: 'אתמול', icon: '🎈', dist: -1, key: 'past' },
  ],
  overdueContacts: [
    { name: 'ראשון', msg: 'לא תועד קשר', icon: '⭐', overdueBy: Infinity, circleWeight: 0 },
    { name: 'שני', msg: '40 ימים', icon: '🔄', overdueBy: 10, circleWeight: 1 },
    { name: 'שלישי', msg: '70 ימים', icon: '⭕', overdueBy: 10, circleWeight: 2 },
  ],
});

const group = kind => result.groups.find(g => g.kind === kind);

console.log('א. קבוצות וסדר:');
ok(result.groups.map(g => g.kind).join(',') === 'failures,tasks,thanks,hk,dates,contacts', 'סדר הקבוצות קבוע');
ok(result.total === result.groups.reduce((n, g) => n + g.count, 0), 'total הוא סכום המספרים המלאים');

console.log('\nב. כשלים:');
ok(group('failures').count === 3, 'היום ה-30 ובלי תאריך נשמרים, היום ה-31 מוסתר');
ok(group('failures').items.length === 2, 'התצוגה קוצצה בלי לשנות count');
ok(group('failures').items[0].target.kind === 'contact', 'לחיצה מובילה לאיש הקשר');

console.log('\nג. משימות ותודות:');
ok(group('tasks').count === 3, 'דחופה, מועד שעבר ומשימת הקשר של היום');
ok(!group('tasks').items.some(x => /תודה/.test(x.label)), 'תודה אינה מופיעה שוב במשימות');
ok(!group('tasks').items.some(x => /נוצרה היום/.test(x.label)), 'createdAt לבדו אינו הופך משימה ללהיום');
ok(!group('tasks').items.some(x => /מחר/.test(x.label)), 'משימה עתידית רגילה אינה מוצגת');
ok(group('thanks').count === 1 && /תודה אחת/.test(group('thanks').items[0].label), 'תודה פתוחה מופיעה פעם אחת');

console.log('\nד. הוראות קבע:');
ok(group('hk').count === 2, 'רק מסתיימת והסתיימה');
ok(group('hk').items[0].label === 'מסתיימת', 'מסתיימת בקרוב קודמת להסתיימה');
ok(!group('hk').items.some(x => ['פעילה', 'בוטלה', 'חודשה', 'ללא הגבלה'].includes(x.label)), 'מצבים שאינם דורשים טיפול הוחרגו');

console.log('\nה. תאריכים וקשרים:');
ok(group('dates').count === 2, 'גבולות 0 ו-7 ימים נכללים, עבר ו-8 ימים לא');
ok(group('contacts').count === 3 && group('contacts').items.length === 2, 'נשמר המספר המלא ומוצגים הראשונים בלבד');
ok(group('contacts').items[0].target.id === 'ראשון', 'סדר computeOverdueContacts נשמר');

console.log('\nו. מצב נקי:');
const empty = F.buildTodayFocus({ today });
ok(empty.total === 0 && empty.groups.length === 0, 'אין קבוצות ריקות ואין ספירה מדומה');

console.log('\n✓ חישוב מה דורש טיפול');
process.exitCode = failed;

