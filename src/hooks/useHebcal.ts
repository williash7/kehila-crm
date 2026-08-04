import { useState, useEffect } from 'react';
import { hebcalUrl } from '../lib/orgConfig';

export function useHebcal() {
  const [shabbat, setShabbat] = useState<any>(null);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [hebrewDate, setHebrewDate] = useState<string>('טוען...');

  useEffect(() => {
    // זמני שבת לפי המיקום שהוגדר בהגדרות הארגון.
    // מנהג הדלקת הנרות (כמה דקות לפני השקיעה) נשלח ל-Hebcal בפרמטר b=,
    // ולכן אין יותר צורך ב"תיקון ידני" של הזמן כמו בגרסה המקורית.
    fetch(hebcalUrl('shabbat'))
      .then(r => r.json())
      .then(setShabbat)
      .catch(console.error);

    // חגי השנה הנוכחית
    fetch(hebcalUrl('hebcal', { v: 1, year: new Date().getFullYear(), month: 'x', mf: 'on', c: 'on', s: 'on' }))
      .then(r => r.json())
      .then(data => {
        if (data.items) {
          setHolidays(data.items.filter((item: any) =>
            item.category === 'holiday' || item.category === 'roshchodesh'
          ));
        }
      })
      .catch(console.error);

    // התאריך העברי של היום
    const today = new Date();
    fetch(`https://www.hebcal.com/converter?cfg=json&gy=${today.getFullYear()}&gm=${today.getMonth() + 1}&gd=${today.getDate()}&g2h=1`)
      .then(r => r.json())
      .then(data => {
        if (data.hebrew) {
          setHebrewDate(data.hebrew);
        }
      })
      .catch(console.error);
  }, []);

  return { shabbat, holidays, hebrewDate };
}
