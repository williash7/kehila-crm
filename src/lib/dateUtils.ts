// כלי עזר קטן לתאריכים — נועד למנוע חוסר-התאמה בין פורמט התאריך ששמור
// באפליקציה (מפתחות מקומיים) לבין הפורמט שהשרת (Google Apps Script) מצפה
// לקבל בבקשות addMeeting.
//
// באג אמיתי שהתגלה: MeetingModal ו-HolidayModal שולחים תאריך בפורמט
// "dd.MM.yyyy" (נקודות — כך ש-toLocaleDateString('he-IL', {...}) מחזיר
// בפועל), בעוד ש-EventsTab השתמש בפורמט "dd/MM/yyyy" (לוכסנים, דרך
// date-fns). כשהשרת קיבל תאריך עם לוכסנים שלא ציפה להם, הוא כשל בפענוח
// ונפל בחזרה ל"היום" — בדיוק התסמין של "המפגש נראה כאילו היה היום".
//
// הפתרון: משאירים את מפתחות האחסון המקומיים (localStorage/ענן) כמו שהם
// (dd/MM/yyyy, לוכסנים — כדי לא "לשבור" נתוני נוכחות שכבר נשמרו), אבל
// לפני שליחה לשרת (addMeeting) תמיד ממירים ללוכסן→נקודה, כך שהשרת מקבל
// בדיוק את אותו פורמט שהוא כבר יודע לפרש נכון.

export function slashDateToDotDate(dmySlash: string): string {
  if (!dmySlash) return dmySlash;
  return dmySlash.replace(/\//g, '.');
}

// מפענח תאריך "dd/MM/yyyy" (או עם נקודות/מקפים) לאובייקט Date. מחזיר null אם
// אי אפשר לפענח — כך שקוד קורא יכול להחליט להתייחס לרשומה כ"לא מסוננת" במקום
// לזרוק שגיאה או להסתיר בטעות רשומה עם תאריך תקין אך בפורמט לא צפוי.
export function parseDdMmYyyy(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yyyy = y.length === 2 ? `20${y}` : y;
    const dt = new Date(Number(yyyy), Number(mo) - 1, Number(d));
    return isNaN(dt.getTime()) ? null : dt;
  }
  // ISO ("yyyy-MM-dd") או פורמטים אחרים ש-Date יודע לפענח בעצמו
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

// מזיז תאריך שחל בשבת (getDay()===6) ליום שישי שלפניו. מיועד רק לתאריכים
// שהאפליקציה עצמה מחשבת (הצעות ברירת מחדל, תזכורות אוטומטיות) — לא לתאריך
// שהמשתמש הקליד ידנית, כדי לא "לתקן" בחירה מכוונת שלו בלי לשאול.
export function shiftShabbatToFriday(date: Date): Date {
  if (date.getDay() !== 6) return date;
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d;
}
