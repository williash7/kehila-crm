const fs = require('fs');
eval(fs.readFileSync('/tmp/base.js', 'utf8').split("console.log('1.")[0]);
function ok(c, m) { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; }

console.log('א. ניקוי מקור ישן בעמודת ליבה:');
appendByName_(SH.CONTACTS, { 'שם מלא': 'איש בדיקה', 'יארצייט': 'י׳ ניסן תשפ״ה' });
flushWrites_();
let before = table_(SH.CONTACTS);
ok(String(get_(before.rows.find(r => standardName(r[0]) === 'איש בדיקה'), before, 'יארצייט')).trim() !== '', 'הערך הישן קיים לפני ההעברה');
const result = deleteContactColumns_({
  columns: ['יארצייט'],
  clearCells: [{ contact: 'איש בדיקה', columns: ['יארצייט'] }],
});
ok(result.success === true && result.deleted === 0 && result.cleared === 1, 'עמודת הליבה לא נמחקה ורק התא נוקה');
const after = table_(SH.CONTACTS);
ok(String(get_(after.rows.find(r => standardName(r[0]) === 'איש בדיקה'), after, 'יארצייט')).trim() === '', 'המונה לא ימצא שוב את אותו מקור');

console.log('\nב. מניעת בן־משפחה כפול בהרצה חוזרת:');
const F = require('/tmp/stub/family.js');
const legacy = F.legacyToFamilyMember({ label: 'פנחס בן לייב', hebrew: 'י׳ ניסן תשפ״ה', columns: ['יארצייט (פנחס בן לייב)'] });
const existing = { ...legacy, id: 'old-id' };
ok(F.familyMemberFingerprint(legacy) === F.familyMemberFingerprint(existing), 'המזהה מתבסס על התוכן ולא על מזהה הרשומה');
ok(F.familyMemberFingerprint(legacy) !== F.familyMemberFingerprint({ ...legacy, yahrzeitHebrew: 'י״א ניסן תשפ״ה' }), 'תאריך שונה נשאר רשומה שונה');
const deduped = F.dedupeFamilyMembers([existing, { ...existing, id: 'duplicate-id' }, { ...existing, id: 'different', yahrzeitHebrew: 'י״א ניסן תשפ״ה' }]);
ok(deduped.removed === 1 && deduped.members.length === 2, 'רק כפילות זהה לחלוטין מוסרת; תאריך שונה נשמר');

const modal = fs.readFileSync(__dirname + '/../src/components/MigrateYahrzeitsModal.tsx', 'utf8');
ok(/familyMemberFingerprint/.test(modal), 'מסך ההעברה מסנן תוכן שכבר הועבר');
ok(/clearCells/.test(modal), 'המסך מבקש לנקות תאי מקור מוגנים לאחר השמירה');
const settings = fs.readFileSync(__dirname + '/../src/components/SettingsTab.tsx', 'utf8');
ok(/\{\(legacyYahrzeitCount > 0 \|\| missingAttendance > 0\) && \(/.test(settings), 'כלים חד־פעמיים נעלמים לגמרי כשאין מה לתקן');
ok(!/DatesRescueModal|איפה התאריכים שלי/.test(settings), 'כלי האבחון הישן אינו נשאר קבוע בהגדרות');
