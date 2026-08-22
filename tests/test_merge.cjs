const N = require('/tmp/stub/nm.js');
function ok(c,m){console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)process.exitCode=1;}

const alias = {
  circle: 'approach', phone: '050-1111111', target: true,
  customFields: { 'הערות': 'מהכינוי', 'כתובת': 'הרצל 5' },
  family: [{ id: 'f1', relation: 'אבא', freeName: 'פנחס', yahrzeitHebrew: 'י״ב אייר' }],
  notes: 'שדה שאיש לא חשב עליו',
};
const canonical = {
  circle: 'close', phone: '',
  customFields: { 'הערות': 'מהקנוני' },
  family: [{ id: 'f2', relation: 'אמא', freeName: 'רחל', yahrzeitHebrew: 'ג׳ תשרי' }],
};

console.log('א. מיזוג רשומות CRM:');
const m = N.mergeCrmPair(alias, canonical);
console.log('   ', JSON.stringify(m));
ok(m.circle === 'close', 'המעגל של הקנוני מנצח');
ok(m.phone === '050-1111111', 'טלפון ריק אצל הקנוני מתמלא מהכינוי');
ok(m.target === true, 'סימון "להקרב" נשמר מהכינוי');
ok(m.customFields['הערות'] === 'מהקנוני', 'שדה מותאם — הקנוני מנצח');
ok(m.customFields['כתובת'] === 'הרצל 5', 'ושדה שקיים רק אצל הכינוי נשמר');
ok(m.notes === 'שדה שאיש לא חשב עליו', 'שדה שלא מוכר לקוד לא נמחק');

console.log('\nב. רשומות משפחה — הבאג שמחק יארצייטים:');
console.log('   ', JSON.stringify(m.family.map(f => f.freeName)));
ok(m.family.length === 2, 'שתי הרשומות מצטרפות ולא נדרסות');
ok(m.family.some(f => f.id === 'f1') && m.family.some(f => f.id === 'f2'), 'שתיהן שם');

console.log('\nג. מיזוג פעמיים לא משכפל:');
const twice = N.mergeCrmPair(alias, m);
ok(twice.family.length === 2, 'עדיין שתיים');

console.log('\nד. applyMergesToCrm על מפה שלמה:');
const crm = { 'אברהם אריאל': alias, 'אברהם אריאל ציגנוב': canonical, 'מישהו אחר': { circle: 'third' } };
const applied = N.applyMergesToCrm(crm, { 'אברהם אריאל': 'אברהם אריאל ציגנוב' });
console.log('   מפתחות:', JSON.stringify(Object.keys(applied)));
ok(!applied['אברהם אריאל'], 'הכינוי נמחק');
ok(applied['אברהם אריאל ציגנוב'].family.length === 2, 'היארצייטים של שניהם נשמרו');
ok(applied['אברהם אריאל ציגנוב'].notes === 'שדה שאיש לא חשב עליו', 'ושדות אחרים גם');
ok(applied['מישהו אחר'].circle === 'third', 'מי שלא מעורב לא נגעו בו');

console.log('\nה. מקרי קצה:');
ok(JSON.stringify(N.mergeCrmPair(null, null)) === '{"customFields":{}}', 'שני צדדים ריקים');
ok(N.mergeCrmPair({ family: [{ id: 'x' }] }, {}).family.length === 1, 'רק לכינוי יש משפחה');
ok(!('family' in N.mergeCrmPair({}, {})), 'בלי משפחה — אין מפתח ריק');
ok(N.mergeCrmPair({ family: [{ relation: 'אבא' }] }, {}).family === undefined,
   'רשומה בלי מזהה לא נכנסת (היא לא ניתנת לזיהוי כפילות)');

console.log('\nו. מה שהיה קורה קודם — לשם השוואה:');
const oldWay = {
  circle: canonical.circle || alias.circle,
  target: canonical.target ?? alias.target,
  phone: canonical.phone || alias.phone,
  customFields: { ...(alias.customFields||{}), ...(canonical.customFields||{}) },
};
console.log('   מפתחות שנשארו:', JSON.stringify(Object.keys(oldWay)));
ok(!('family' in oldWay), 'היארצייטים נמחקו — בדיוק מה שקרה בפועל');
ok(!('notes' in oldWay), 'וגם כל שדה אחר');
