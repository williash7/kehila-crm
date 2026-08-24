import React, { useEffect, useRef } from 'react';
import { ChevronRight, X } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// מעטפת "מסך מלא" לכל הכרטיסים באפליקציה.
//
// עד כאן כל כרטיס נפתח כחלון קופץ: גיליון שעולה מלמטה, מוגבל ל-92% מהגובה,
// עם רקע כהה שמציץ מסביב. זה עובד לדיאלוג של שתי שאלות, אבל כרטיס איש קשר
// הוא לא דיאלוג — הוא מסך: היסטוריית תרומות, מפגשים, תאריכי משפחה, הערות.
// בתוך חלון קופץ הוא נעשה מגילה צרה שנגררת בתוך גלילה נוספת, וכל פעולה בו
// מרגישה זמנית.
//
// המעטפת הזו נותנת לכולם התנהגות אחת: כותרת שנשארת למעלה, גוף שגולל,
// ורוחב קריאה נוח במרכז המסך במקום שורות שנמתחות על כל הצג.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * כפתור "אחורה" של הטלפון סוגר את הכרטיס במקום לצאת מהאפליקציה.
 *
 * הדרך היחידה לתפוס אותו בדפדפן היא לרשום כניסה להיסטוריה בזמן הפתיחה
 * ולהאזין ל-popstate. הדקוּת היא בניקוי: אם נסגרנו בכפתור שבמסך, הכניסה
 * שלנו עדיין בהיסטוריה וצריך להסיר אותה — אחרת "אחורה" הבא לא יעשה כלום.
 * ואם נסגרנו *בגלל* popstate, היא כבר הוסרה, ו-history.back() נוסף היה
 * מקפיץ את המשתמש אחורה פעמיים.
 */
interface BackGuardWindow {
  history: { pushState: (s: any, t: string) => void; back: () => void };
  addEventListener: (type: string, fn: any) => void;
  removeEventListener: (type: string, fn: any) => void;
}

interface Guard { onClose: () => void; closedByBack: boolean }

// מחסנית הכרטיסים הפתוחים, ומאזין **אחד** לכולם.
//
// מאזין נפרד לכל כרטיס נראה נקי יותר, אבל הוא שגוי: אירוע popstate אחד מגיע
// לכל המאזינים, ולחיצה אחת על "אחורה" הייתה סוגרת גם את איש הקשר וגם את החג
// שממנו נפתח. לכן יש מאזין אחד שמפנה תמיד לכרטיס העליון בלבד.
const stack: Guard[] = [];
let host: BackGuardWindow | null = null;
// כמה אירועי popstate נגרמו על ידינו (סגירה מכפתור שבמסך) וצריך להתעלם מהם.
let selfInflicted = 0;

function detachHostIfIdle() {
  if (stack.length || selfInflicted > 0 || !host) return;
  host.removeEventListener('popstate', handlePop);
  host.removeEventListener('keydown', handleKey);
  host = null;
}

function handlePop() {
  if (selfInflicted > 0) { selfInflicted--; detachHostIfIdle(); return; }
  const g = stack.pop();
  if (!g) return;
  g.closedByBack = true;
  g.onClose();
  detachHostIfIdle();
}

function handleKey(e: { key: string }) {
  if (e.key !== 'Escape') return;
  const g = stack[stack.length - 1];
  if (g) g.onClose();
}

/**
 * הלוגיקה עצמה, מופרדת מ-React כדי שאפשר יהיה לבדוק אותה.
 * מחזירה פונקציית ניקוי.
 */
export function createBackGuard(win: BackGuardWindow, onClose: () => void): () => void {
  // אם יש popstate יזום שעדיין בדרך, המחסנית יכולה להיות ריקה בעוד המאזין
  // עדיין מחובר. אין לרשום אותו שוב — סביבת בדיקה ואף עטיפות דפדפן מסוימות
  // עלולות להפעיל מאזין כפול ולסגור את הכרטיס החדש.
  if (!host) {
    host = win;
    win.addEventListener('popstate', handlePop);
    win.addEventListener('keydown', handleKey);
  }

  const guard: Guard = { onClose, closedByBack: false };
  stack.push(guard);
  win.history.pushState({ kehilaCard: true }, '');

  return () => {
    const i = stack.indexOf(guard);
    if (i >= 0) stack.splice(i, 1);

    // נסגר מכפתור שבמסך — הכניסה שלנו עדיין בהיסטוריה וצריך להסיר אותה,
    // אחרת "אחורה" הבא היה נבלע ולא עושה כלום.
    if (!guard.closedByBack) { selfInflicted++; win.history.back(); }

    // history.back מפעיל popstate באיחור בדפדפן אמיתי. משאירים את המאזין
    // עד שהאירוע שלנו נצרך; אחרת הוא עלול להגיע אחרי שכרטיס חדש כבר נפתח
    // ולסגור דווקא אותו מיד.
    detachHostIfIdle();
  };
}

export function useCloseOnBack(onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    // רישום בסבב הבא מונע ממצב הפיתוח של React לבצע push/back מזויף בזמן
    // בדיקת mount→unmount→mount. בלי ההשהיה הכרטיס נראה פתוח, אך לחיצה על
    // „חזרה” עלולה לצאת מהאפליקציה כי רשומת ההיסטוריה כבר נצרכה ברקע.
    let cleanup: (() => void) | undefined;
    const timer = window.setTimeout(() => { cleanup = createBackGuard(window, () => onCloseRef.current()); }, 0);
    return () => { window.clearTimeout(timer); cleanup?.(); };
  }, []);
}

export interface SiblingItem {
  id: string;
  label: string;
  sub?: string;
}

export interface FullScreenViewProps {
  /** שורת-על קטנה מעל הכותרת — למשל הקטגוריה או התאריך העברי */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** מה כתוב ליד החץ. ברירת המחדל "חזרה" — עדיף למלא מאיפה באמת הגיעו. */
  backLabel?: string;
  onClose: () => void;
  /** כפתורי פעולה בצד השני של הכותרת */
  actions?: React.ReactNode;

  /** רשימת "אחים" לדילוג ישיר בלי לחזור לרשימה ולחפש מחדש */
  siblings?: SiblingItem[];
  siblingsTitle?: string;
  activeSiblingId?: string;
  onSelectSibling?: (id: string) => void;

  /**
   * פעולת סיום שנשארת מוצמדת לתחתית המסך — "שמור נוכחות" וכדומה.
   * ברשימה של מאתיים אנשים, כפתור שמירה שגולל עם התוכן הוא כפתור שמחפשים.
   */
  footer?: React.ReactNode;

  /**
   * 'reading' (ברירת מחדל) — עמודה אחת ברוחב קריאה, לטפסים ולתוכן רציף.
   * 'wide' — הכרטיס פורש את עצמו על כל הרוחב הזמין, לתוכן שמסודר בעצמו
   * לשתי עמודות. במסך של 27 אינץ' עמודה צרה במרכז היא בזבוז מקום אמיתי:
   * צריך לגלול כדי לראות מה שהיה נכנס בלי גלילה בכלל.
   */
  layout?: 'reading' | 'wide';

  children: React.ReactNode;
}

export function FullScreenView({
  eyebrow, title, backLabel = 'חזרה', onClose, actions,
  siblings, siblingsTitle = 'עוד ברשימה', activeSiblingId, onSelectSibling,
  footer, layout = 'reading', children,
}: FullScreenViewProps) {
  useCloseOnBack(onClose);

  // גלילה חזרה לראש בכל החלפת פריט. בלי זה, מעבר לאיש קשר אחר דרך הרצועה
  // הצדדית היה משאיר אותך באמצע הכרטיס הקודם, בלי שום סימן שמשהו התחלף.
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [activeSiblingId]);

  const hasRail = !!siblings && siblings.length > 1 && !!onSelectSibling;

  return (
    <div className="fixed inset-0 z-[200] bg-[#FAF6EE] flex flex-col animate-in fade-in duration-150" dir="rtl">
      {/* כותרת — נשארת למעלה תמיד, כך שתמיד יש דרך חזרה בלי לגלול */}
      <header className="bg-[#0D1B2A] shrink-0 shadow-md">
        <div className="mx-auto w-full max-w-6xl px-3 md:px-6 h-14 flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1 h-9 px-2.5 rounded-full text-white/80 hover:bg-white/10 transition-colors shrink-0"
          >
            <ChevronRight size={20} />
            <span className="text-sm font-bold">{backLabel}</span>
          </button>

          <div className="flex-1 min-w-0 text-center md:text-right md:pr-3">
            {eyebrow && (
              <div className="text-[10px] font-bold text-[#C9A84C]/80 tracking-widest truncate">{eyebrow}</div>
            )}
            <div className="font-['Frank_Ruhl_Libre'] text-base md:text-lg font-bold text-[#C9A84C] truncate leading-tight">
              {title}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {actions}
            <button
              onClick={onClose}
              className="hidden md:flex w-9 h-9 items-center justify-center rounded-full text-white/60 hover:bg-white/10 transition-colors"
              title="סגור"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* בנייד אין מקום לרצועה בצד, ולכן היא הופכת לשורת שבבים נגללת */}
        {hasRail && (
          <div className="lg:hidden border-t border-white/10">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-3 py-2">
              {siblings!.map(s => (
                <button
                  key={s.id}
                  onClick={() => onSelectSibling!(s.id)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                    s.id === activeSiblingId
                      ? 'bg-[#C9A84C] text-[#0D1B2A]'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <div ref={bodyRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-6xl px-3 md:px-6 py-4 pb-24 flex gap-6">
          {hasRail && (
            <aside className="hidden lg:block w-56 shrink-0">
              <div className="sticky top-0">
                <div className="text-[11px] font-bold text-gray-400 mb-2 px-1">{siblingsTitle}</div>
                <div className="space-y-1 max-h-[calc(100vh-8rem)] overflow-y-auto pl-1">
                  {siblings!.map(s => (
                    <button
                      key={s.id}
                      onClick={() => onSelectSibling!(s.id)}
                      className={`w-full text-right px-3 py-2 rounded-xl transition-colors border ${
                        s.id === activeSiblingId
                          ? 'bg-[#0D1B2A] text-[#E8C97A] border-[#0D1B2A]'
                          : 'bg-white text-[#0D1B2A] border-[#EDE6D6] hover:border-[#C9A84C]'
                      }`}
                    >
                      <div className="text-sm font-bold truncate">{s.label}</div>
                      {s.sub && (
                        <div className={`text-[10px] truncate ${s.id === activeSiblingId ? 'text-[#E8C97A]/60' : 'text-gray-400'}`}>
                          {s.sub}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          )}

          {/* רוחב קריאה. בלי התקרה הזו, שורת טקסט על צג רחב נמתחת לרוחב
              שהעין מאבדת בו את תחילת השורה הבאה. */}
          <main className={`flex-1 min-w-0 mx-auto w-full ${layout === 'wide' ? 'max-w-4xl' : 'max-w-2xl'}`}>{children}</main>
        </div>
      </div>

      {footer && (
        <div className="shrink-0 border-t border-[#EDE6D6] bg-[#FAF6EE]/95 backdrop-blur-sm">
          <div className={`mx-auto w-full px-3 md:px-6 py-3 ${layout === 'wide' ? 'max-w-4xl' : 'max-w-2xl'}`}>{footer}</div>
        </div>
      )}
    </div>
  );
}
