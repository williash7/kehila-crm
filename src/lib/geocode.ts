import { getOrg } from './orgConfig';
// Geocoding חינמי דרך Nominatim (OpenStreetMap) — הופך כתובת טקסט לקואורדינטות (lat/lon).
// כדי לא להציף את השירות החינמי (שמאפשר בערך בקשה אחת בשנייה) ולא לבצע
// geocoding חוזר לאותה כתובת, יש כאן שני שכבות שמירה:
//  1. מטמון בזיכרון (Map) — תקף לכל משך הפעלת האפליקציה בדפדפן.
//  2. מטמון ב-localStorage — נשאר גם אחרי רענון הדף, כך שפתיחת המפה בפעם
//     השנייה כמעט מיידית ולא צריך לחכות שוב לכל התורמים.

export interface GeoPoint {
  lat: number;
  lon: number;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const STORAGE_KEY = 'geocode_cache_v1';
const MIN_INTERVAL_MS = 1100; // Nominatim usage policy: מקסימום בקשה אחת בשנייה

const memoryCache = new Map<string, GeoPoint | null>();

function loadPersistedCache(): Record<string, GeoPoint | null> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function savePersistedCache(cache: Record<string, GeoPoint | null>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage מלא או לא זמין — לא קריטי, נמשיך עם מטמון הזיכרון בלבד
  }
}

let persistedCache: Record<string, GeoPoint | null> | null = null;
function getPersistedCache() {
  if (!persistedCache) persistedCache = loadPersistedCache();
  return persistedCache;
}

function normalizeAddress(address: string): string {
  return address.trim().replace(/\s+/g, ' ');
}

// תור בקשות גלובלי כדי לשמור על מרווח מינימלי בין קריאות ל-Nominatim,
// גם אם כמה רכיבים מבקשים geocoding באותו זמן.
let queueTail: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

function scheduleRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise(res => setTimeout(res, wait));
    lastRequestAt = Date.now();
    return fn();
  });
  // מבטיחים שהתור ימשיך גם אם הבקשה הזו נכשלת
  queueTail = run.then(() => undefined, () => undefined);
  return run;
}

/**
 * הופך כתובת טקסט לקואורדינטות. מחזיר null אם לא נמצאה התאמה.
 * תוצאות נשמרות במטמון (זיכרון + localStorage) לפי הכתובת המנורמלת,
 * כך שאותה כתובת לעולם לא תבוצע לה geocoding פעמיים.
 */
export async function geocodeAddress(address: string, cityHint = getOrg().city): Promise<GeoPoint | null> {
  const key = normalizeAddress(address);
  if (!key) return null;

  if (memoryCache.has(key)) return memoryCache.get(key)!;

  const persisted = getPersistedCache();
  if (Object.prototype.hasOwnProperty.call(persisted, key)) {
    const val = persisted[key];
    memoryCache.set(key, val);
    return val;
  }

  const query = key.includes(cityHint) ? key : `${key}, ${cityHint}`;

  const result = await scheduleRequest(async () => {
    try {
      const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } as GeoPoint;
      }
      return null;
    } catch {
      return null;
    }
  });

  memoryCache.set(key, result);
  persisted[key] = result;
  savePersistedCache(persisted);

  return result;
}
