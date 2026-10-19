// מקור אחד לטלפון של איש קשר — לכל כפתורי ההתקשרות והוואטסאפ.
//
// עד כה הטלפון נקרא משלושה מקומות שונים, וכל מסך בחר אחר: "ערוך הכל"
// שמר לשדות הכרטיס (customFields), אבל כפתור הוואטסאפ קרא את crm.phone
// הישן — ולכן תיקון בכרטיס לא תיקן כלום. ועוד: מכל טקסט חולצו הספרות
// בעיוורון, כך ש"מייל: 6441770@gmail.com" שנכנס בטעות לעמודת הטלפון הפך
// למספר 6441770, ווואטסאפ דחה אותו.
//
// הכלל עכשיו: עוברים על המקורות לפי סדר העדיפות, ולוקחים את הראשון
// **שהוא מספר תקין**. מספר שגוי לא חוסם מספר טוב שנמצא במקור אחר.

/**
 * מנרמל לפורמט בינלאומי בלי + (972501234567), כמו ש-wa.me דורש.
 * מחזיר ריק לכל דבר שאינו מספר טלפון סביר — כולל כתובת מייל.
 */
export function normalizePhone(raw: unknown): string {
  // כתובות מייל מוסרות קודם: הספרות שבהן אינן מספר טלפון
  const text = String(raw ?? '').replace(/\S+@\S+/g, ' ');
  let p = text.replace(/\D/g, '');
  if (!p) return '';
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('0')) p = '972' + p.slice(1);
  else if (/^5\d{8}$/.test(p)) p = '972' + p;
  // ישראל: 972 ואחריו 8 ספרות (קווי) או 9 (נייד)
  if (p.startsWith('972')) return p.length === 11 || p.length === 12 ? p : '';
  // חו"ל: קידומת מדינה ומספר — 10 עד 15 ספרות
  return p.length >= 10 && p.length <= 15 ? p : '';
}

/** הטקסט הגולמי של הטלפון לפי סדר העדיפות: תיקון ידני בכרטיס, ואז השאר */
export function phoneCandidates(crmData: any, donor: any, ...extra: unknown[]): unknown[] {
  return [crmData?.customFields?.['טלפון'], crmData?.phone, ...extra, donor?.['טלפון']];
}

/** הטלפון התקין הראשון, מנורמל ל-wa.me. ריק אם אין אף אחד תקין. */
export function contactPhone(crmData: any, donor: any, ...extra: unknown[]): string {
  for (const c of phoneCandidates(crmData, donor, ...extra)) {
    const p = normalizePhone(c);
    if (p) return p;
  }
  return '';
}

/** הטקסט הגולמי הראשון שאינו ריק — כדי להציג למשתמש מה שמור כרגע כשהוא לא תקין */
export function rawPhoneText(crmData: any, donor: any): string {
  for (const c of phoneCandidates(crmData, donor)) {
    const s = String(c ?? '').trim();
    if (s) return s;
  }
  return '';
}
