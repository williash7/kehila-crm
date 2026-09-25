import { useState, useEffect } from 'react';
import { hebcalUrl } from '../lib/orgConfig';

function normalizeShabbatPayload(data: any) {
  const items = Array.isArray(data?.items) ? data.items : [];
  if (!items.length) return data;

  const parseTs = (item: any) => {
    const ts = Date.parse(String(item?.date || ''));
    return Number.isFinite(ts) ? ts : NaN;
  };

  const candles = items
    .filter((item: any) => item.category === 'candles')
    .map((item: any) => ({ item, ts: parseTs(item) }))
    .filter((entry: any) => Number.isFinite(entry.ts))
    .sort((a: any, b: any) => a.ts - b.ts);

  const havdalahs = items
    .filter((item: any) => item.category === 'havdalah')
    .map((item: any) => ({ item, ts: parseTs(item) }))
    .filter((entry: any) => Number.isFinite(entry.ts))
    .sort((a: any, b: any) => a.ts - b.ts);

  if (!candles.length || !havdalahs.length) return data;

  const now = Date.now();
  const pairs = candles
    .map((candle: any) => {
      const havdalah = havdalahs.find((entry: any) => entry.ts > candle.ts);
      return havdalah ? { candle, havdalah } : null;
    })
    .filter(Boolean) as Array<{ candle: { item: any; ts: number }; havdalah: { item: any; ts: number } }>;

  if (!pairs.length) return data;

  // Hebcal's shabbat endpoint can include a havdalah from a holiday that fell
  // earlier in the same week (for example Yom Kippur) before the upcoming
  // Friday candle-lighting. PosterTab used the first havdalah blindly, which
  // mixed two different observances. Pick one coherent candle/havdalah pair:
  // the observance we're currently inside, otherwise the next upcoming one.
  const selected =
    pairs.find(pair => pair.candle.ts <= now && now <= pair.havdalah.ts) ??
    pairs.find(pair => pair.candle.ts > now) ??
    pairs[pairs.length - 1];

  const normalizedItems = items.filter((item: any) => item.category !== 'candles' && item.category !== 'havdalah');
  normalizedItems.push(selected.candle.item, selected.havdalah.item);

  return { ...data, items: normalizedItems };
}

export function useHebcal() {
  const [shabbat, setShabbat] = useState<any>(null);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [hebrewDate, setHebrewDate] = useState<string>('טוען...');

  useEffect(() => {
    // זמני שבת לפי המיקום שהוגדר בהגדרות הארגון.
    // מנהג הדלקת הנרות (כמה דקות לפני השקיעה) נשלח ל-Hebcal בפרמטר b=,
    // ולכן אין יותר צורך ב"תיקון ידני" של הזמן כמו בגרסה המקורית.
    fetch(hebcalUrl('shabbat'), { cache: 'no-store' })
      .then(r => r.json())
      .then(data => setShabbat(normalizeShabbatPayload(data)))
      .catch(console.error);

    // חגי השנה הנוכחית
    fetch(hebcalUrl('hebcal', { v: 1, year: new Date().getFullYear(), month: 'x', mf: 'on', c: 'on', s: 'on' }), { cache: 'no-store' })
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
    fetch(`https://www.hebcal.com/converter?cfg=json&gy=${today.getFullYear()}&gm=${today.getMonth() + 1}&gd=${today.getDate()}&g2h=1`, { cache: 'no-store' })
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
