const assert = require('assert');
const fs = require('fs');
const H = require('/tmp/stub/history.js');

console.log('א. סיכום עבר שומר תיאור, נוכחות, תקציב ותובנות:');
const entry = H.buildHistoryEntry({
  type: 'event',
  name: 'ליל הסדר',
  occurrenceDate: '2026-04-01',
  attendance: { '2026-04-01': { ישראל: true, שרה: true } },
  budget: {
    expenses: [{ name: 'קייטרינג', actual: 5400 }],
    income: [{ name: 'דמי השתתפות', actual: 1800 }],
  },
  insights: { summary: 'סעודה קהילתית', good: 'תוכנית ילדים', improve: 'הרשמה מוקדמת', plan: 'לסגור אולם מראש' },
});
assert.strictEqual(H.countAttendance(entry.attendance), 2);
assert.deepStrictEqual(H.sumBudget(entry.budget), { plannedExpense: 0, actualExpense: 5400, plannedIncome: 0, actualIncome: 1800 });
assert.strictEqual(entry.insights.summary, 'סעודה קהילתית');

console.log('ב. רשומות ישנות מקבלות שדה סיכום ריק ותוכן זהה מקבל אותה טביעה:');
const old = H.buildHistoryEntry({ type: 'holiday', name: 'פורים', insights: { good: 'שמח' } });
assert.strictEqual(old.insights.summary, '');
const same = { ...entry, id: 'אחר', archivedAt: '2030-01-01T00:00:00.000Z' };
assert.strictEqual(H.historyEntryFingerprint(entry), H.historyEntryFingerprint(same));
const paraphrased = { ...same, insights: { ...same.insights, summary: 'ניסוח אחר לאותו מופע' } };
assert.strictEqual(H.historyEntryFingerprint(entry), H.historyEntryFingerprint(paraphrased), 'שם ותאריך זהים אינם נוצרים שוב בגלל ניסוח AI שונה');

console.log('ג. מסך ההיסטוריה מציע הזנה ידנית וקליטה ממוקדת בעזרת AI:');
const historyUi = fs.readFileSync('src/components/HistoryTab.tsx', 'utf8');
const ai = fs.readFileSync('src/components/GlobalAIImportModal.tsx', 'utf8');
const events = fs.readFileSync('src/components/EventsTab.tsx', 'utf8');
const holiday = fs.readFileSync('src/components/HolidayModal.tsx', 'utf8');
assert.ok(/הוסף סיכום ידני/.test(historyUi) && /קלוט סיכומים עם AI/.test(historyUi));
assert.ok(/initialTopics=\{\['history'\]\}/.test(historyUi));
assert.ok(/סיכומי פעילויות וחגים שעברו/.test(ai) && /schema\.history/.test(ai));
assert.ok(/addHistoryEntries\(importedHistory\)/.test(ai), 'פלט ה-AI חייב להישמר במאגר ההיסטוריה');
assert.ok(/סכם מופע זה והעבר להיסטוריה/.test(events));
assert.ok(/סכם חג זה והעבר להיסטוריה/.test(holiday));

console.log('✓ סיכומי עבר ידניים ובינה מלאכותית מחוברים להיסטוריה');
