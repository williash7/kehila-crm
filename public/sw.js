// ─────────────────────────────────────────────────────────────────────────────
// עובד השירות — כדי שהאפליקציה תיפתח גם בלי רשת.
//
// ── מה היה כאן קודם ───────────────────────────────────────────────────────
//
// שתי שורות: skipWaiting ו-clients.claim. **אפס מטמון.** האפליקציה נרשמה
// כ-PWA, אפשר היה להוסיף אותה למסך הבית, היא נראתה כמו אפליקציה — ובלי
// קליטה היא הציגה מסך לבן. מי שנוסע לביקור בית בשכונה עם קליטה גרועה גילה
// את זה בדיוק ברגע שהיה צריך את הכתובת.
//
// ── מה שמור ומה לא, וזה העיקר ─────────────────────────────────────────────
//
// **הקונכייה נשמרת. הנתונים לא.**
//
// קבצי ה-JS, ה-CSS והאייקונים הם אותם קבצים בדיוק בכל טעינה, ו-Vite מוסיף
// לשמם חתימה שמשתנה בכל בנייה — כך שקובץ שמור לעולם אינו „ישן”, ואפשר
// להגיש אותו מיד.
//
// תשובות מהגיליון הן ההפך הגמור. תרומה שנרשמה לפני דקה, סכום שהשתנה,
// הוראת קבע שבוטלה — **הגשה של עותק שמור כאן היא בדיוק אותו באג שתור
// הכתיבות בא לתקן**: מסך שמראה מצב ישן בלי לומר שהוא ישן. לכן כל פנייה
// לגיליון ולשירותי חוץ עוברת לרשת בלבד, ואם אין רשת — היא נכשלת בגלוי,
// והאפליקציה מציגה את מה שנשמר מקומית עם המנגנון שכבר קיים לכך.
//
// ── עדכונים ───────────────────────────────────────────────────────────────
//
// הניווט הוא „רשת קודם”: כשיש חיבור מגיעה תמיד הגרסה החדשה, ואין מצב שבו
// אשר מעדכן את האפליקציה ומקבל את הישנה. המטמון נכנס לתמונה רק כשהרשת
// נכשלת.
// ─────────────────────────────────────────────────────────────────────────────

const VERSION = 'v2';
const SHELL = `kehila-shell-${VERSION}`;

/** כמה להמתין לרשת בניווט לפני שמגישים עותק שמור. */
const NAV_TIMEOUT_MS = 4000;

self.addEventListener('install', event => {
  self.skipWaiting();
  // מנסים למשוך את דף הפתיחה כבר עכשיו, כדי שהפעם הראשונה בלי רשת תעבוד.
  event.waitUntil(
    caches.open(SHELL)
      .then(c => c.add(new Request('./', { cache: 'reload' })))
      .catch(() => { /* אין רשת בהתקנה — יישמר בטעינה הראשונה המוצלחת */ })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // מטמונים של גרסאות קודמות אינם נחוצים, ותופסים מכסה.
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('kehila-shell-') && n !== SHELL)
                           .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

/**
 * האם הבקשה היא נתונים חיים שאסור להגיש ממטמון.
 *
 * הרשימה מכוונת להיות **רחבה**: עדיף לפספס הזדמנות למטמון מאשר להגיש
 * למשתמש סכום תרומות ישן שנראה עדכני.
 */
function isLiveData(url) {
  return url.hostname.includes('script.google.com')
      || url.hostname.includes('googleusercontent.com')
      || url.hostname.includes('hebcal.com')
      || url.hostname.includes('graph.facebook.com')
      || url.hostname.includes('googleapis.com');
}

self.addEventListener('fetch', event => {
  const req = event.request;

  // כתיבות לעולם לא נוגעות במטמון. ה-Cache API בכלל אינו תומך ב-POST,
  // אבל עדיף לומר את זה במפורש מאשר להסתמך על כך.
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  if (isLiveData(url)) return;               // לרשת בלבד
  if (url.origin !== self.location.origin) return;

  // ── ניווט: רשת קודם, מטמון כרשת ביטחון ──
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await Promise.race([
          fetch(req),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NAV_TIMEOUT_MS)),
        ]);
        const cache = await caches.open(SHELL);
        cache.put('./', fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match('./', { ignoreSearch: true });
        if (cached) return cached;
        return new Response(
          '<!doctype html><html dir="rtl" lang="he"><meta charset="utf-8">' +
          '<body style="font-family:system-ui;text-align:center;padding:48px;color:#0D1B2A">' +
          '<h2>אין חיבור לאינטרנט</h2><p>נסה שוב כשהחיבור יחזור.</p></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
        );
      }
    })());
    return;
  }

  // ── נכסים: מטמון קודם ──
  //
  // בטוח דווקא משום ששמות הקבצים חתומים: תוכן חדש = שם חדש = החמצה
  // במטמון = משיכה מהרשת. אין מצב של קובץ „שמור וישן”.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok && fresh.type === 'basic') {
        const cache = await caches.open(SHELL);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      throw e;
    }
  })());
});

// לחיצה על התזכורת היומית מחזירה למסך האפליקציה הקיים, ואם אין כזה פותחת
// אותו. אין כאן קריאת נתונים או כתיבה ברקע.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.length) return windows[0].focus();
    return self.clients.openWindow(event.notification.data?.url || './');
  })());
});
