// ─────────────────────────────────────────────────────────────────────────────
// כניסה עם חשבון גוגל.
//
// המטרה: משתמש מגדיר פעם אחת, ובכל מכשיר נוסף רק מתחבר. ההגדרות נשמרות
// בתיקייה הפרטית של האפליקציה בתוך ה-Drive של המשתמש (appDataFolder).
//
// למה דווקא ההרשאה הזו: drive.appdata נותנת גישה **אך ורק** לתיקייה
// המוסתרת של האפליקציה — לא לקבצים של המשתמש, לא לגיליונות שלו, לכלום.
// מסך ההרשאות של גוגל לא מבקש "לראות את כל הקבצים שלך", וזה ההבדל בין
// שליח שמתחבר לשליח שנרתע. הגיליון עצמו ממשיך להיות מונגש דרך ה-Apps
// Script בדיוק כמו קודם.
//
// כדי שזה יעבוד צריך Client ID של גוגל, שמוזרק בזמן בנייה
// (VITE_GOOGLE_CLIENT_ID). מזהה כזה נועד להיות גלוי בקוד צד-לקוח ואינו
// סוד. בלעדיו הכפתור פשוט לא מוצג והאפליקציה עובדת כמו קודם.
// ─────────────────────────────────────────────────────────────────────────────

export const GOOGLE_CLIENT_ID: string = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export function isGoogleLoginAvailable(): boolean {
  return !!GOOGLE_CLIENT_ID;
}

const TOKEN_KEY = 'google_token_v1';
const EMAIL_KEY = 'google_email_v1';

interface StoredToken {
  token: string;
  expiresAt: number;
}

function readToken(): StoredToken | null {
  try {
    const raw = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
    if (raw?.token && raw.expiresAt > Date.now()) return raw;
  } catch { /* מתעלמים */ }
  return null;
}

export function currentAccount(): string {
  return localStorage.getItem(EMAIL_KEY) || '';
}

export function isSignedIn(): boolean {
  return !!readToken();
}

/** טוען את ספריית Google Identity פעם אחת. */
let gisPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('לא הצלחתי לטעון את ספריית Google'));
    document.head.appendChild(s);
  });
  return gisPromise;
}

/**
 * מבקש טוקן גישה. prompt='' מנסה בשקט (בלי חלון) — כך משתמש שכבר אישר
 * פעם אחת מתחבר בלי לראות שום דבר.
 */
export async function signIn(interactive = true): Promise<string> {
  if (!GOOGLE_CLIENT_ID) throw new Error('לא הוגדר Client ID של גוגל');

  const existing = readToken();
  if (existing) return existing.token;

  await loadGis();

  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      prompt: interactive ? '' : 'none',
      callback: (resp: any) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error_description || resp.error || 'ההתחברות בוטלה'));
          return;
        }
        const expiresAt = Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000;
        localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: resp.access_token, expiresAt }));
        fetchEmail(resp.access_token).catch(() => undefined);
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken();
  });
}

/** שם החשבון המחובר — לתצוגה בלבד. נכשל בשקט אם אין הרשאה. */
async function fetchEmail(token: string) {
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;
  const data = await res.json();
  if (data?.user?.emailAddress) localStorage.setItem(EMAIL_KEY, data.user.emailAddress);
}

export function signOut() {
  const t = readToken();
  if (t) {
    try { (window as any).google?.accounts?.oauth2?.revoke(t.token, () => undefined); } catch { /* noop */ }
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

/** טוקן תקף, או null. לא פותח חלון. */
export function accessToken(): string | null {
  return readToken()?.token || null;
}
