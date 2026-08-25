import type { NavItemId } from './navigation';

export type FeatureCategoryId = 'start' | 'people' | 'money' | 'activities' | 'planning' | 'tools';
export type SettingsGroupId = 'organization' | 'navigation' | 'appearance' | 'people' | 'data';

export interface SettingsTarget {
  group: SettingsGroupId;
  section: string;
}

export interface FeatureDefinition {
  id: string;
  icon: string;
  title: string;
  category: FeatureCategoryId;
  /** מה הפונקציה עושה, בשפה של המשתמש. */
  summary: string;
  /** התועלת המעשית, לא תיאור טכני. */
  practical: string;
  /** המסך שבו משתמשים בפונקציה. */
  tab?: NavItemId;
  /** ההגדרה המדויקת שמשפיעה עליה, אם קיימת. */
  settings?: SettingsTarget;
  /** מה חייב להישמר כדי שהפונקציה תחזור בדיוק בשחזור. */
  data: string[];
  keywords?: string[];
}

export const FEATURE_CATEGORIES: { id: FeatureCategoryId; icon: string; title: string; hint: string }[] = [
  { id: 'start', icon: '🏠', title: 'פתיחה, ניווט ותצוגה', hint: 'איך מגיעים למידע ואיך בוחרים מה יופיע' },
  { id: 'people', icon: '👥', title: 'אנשים וקשר', hint: 'אנשי קשר, משפחות, תאריכים וביקורי בית' },
  { id: 'money', icon: '💰', title: 'תרומות וכספים', hint: 'תרומות, הוראות קבע, תזרים, תקציבים ודוחות' },
  { id: 'activities', icon: '📅', title: 'פעילויות, חגים וקמפיינים', hint: 'כל מה שמארגנים, מבצעים ומסכמים' },
  { id: 'planning', icon: '✅', title: 'משימות, קליטה ותכנון', hint: 'עבודה שוטפת, תזכורות וייבוא מידע' },
  { id: 'tools', icon: '🧰', title: 'כלים, מדריך והגנה על המידע', hint: 'חיפוש, ייצוא, גיבוי, שחזור ואבחון' },
];

/**
 * מקור האמת של הפונקציות באפליקציה.
 *
 * הקטלוג משרת יחד את המדריך, הקישור להגדרה ובדיקת כיסוי הגיבוי. כשנוספת
 * פונקציה, מוסיפים אותה כאן — ובדיקה אוטומטית מוודאת שלא נשאר מסך בלי תיעוד.
 */
export const FEATURE_CATALOG: FeatureDefinition[] = [
  {
    id: 'dashboard', icon: '🏠', title: 'דשבורד אישי', category: 'start', tab: 'home',
    summary: 'מרכז במקום אחד את הנתונים והפעולות החשובים ליום הזה.',
    practical: 'רואים מיד מה דורש טיפול ונכנסים לפעולה בלי לעבור בין מסכים.',
    settings: { group: 'appearance', section: 'dashboard-cards' },
    data: ['סדר וכרטיסי הדשבורד', 'סיכומי תרומות', 'משימות ותאריכים קרובים'],
  },
  {
    id: 'global-search', icon: '🔎', title: 'חיפוש בכל האפליקציה', category: 'start', tab: 'search',
    summary: 'מחפש יחד אנשי קשר, תרומות, פעילויות, קמפיינים ומשימות.',
    practical: 'לחיצה על תוצאה פותחת ומדגישה את הפריט המדויק.',
    data: ['מזהי אנשי קשר', 'מזהי תרומות', 'מזהי פעילויות וקמפיינים', 'מזהי משימות והקשר ההורה'],
  },
  {
    id: 'bottom-navigation', icon: '🧭', title: 'סרגל הניווט', category: 'start', tab: 'settings',
    summary: 'קובע אילו מסכים יופיעו בסרגל, באיזה סדר, ומה יישאר תחת „עוד”.',
    practical: 'המסכים השימושיים ביותר נשארים נגישים בלי להעמיס.',
    settings: { group: 'navigation', section: 'bottom-navigation' },
    data: ['סדר המסכים', 'המסכים הראשיים'],
  },
  {
    id: 'appearance', icon: '🎨', title: 'מראה וגודל', category: 'start', tab: 'settings',
    summary: 'בחירת צבעים, גופנים, גודל, צפיפות, פינות ואייקונים.',
    practical: 'אפשר להתאים את האפליקציה למסך קטן, למסך גדול ולסגנון האישי.',
    settings: { group: 'appearance', section: 'appearance' },
    data: ['ערכת מראה', 'גופן', 'גודל וצפיפות', 'סגנון משטחים ואייקונים'],
  },
  {
    id: 'organization', icon: '🏛️', title: 'פרטי הארגון', category: 'start', tab: 'settings',
    summary: 'שם הארגון, כתובת, עיר, טלפון, שפות, זמני שבת והחיבור לגיליון.',
    practical: 'הפרטים מוזנים פעם אחת ומשמשים בפוסטרים, במכתבים ובחישובים.',
    settings: { group: 'organization', section: 'organization' },
    data: ['הגדרות הארגון', 'כתובת החיבור', 'מיקום וזמני שבת'],
  },
  {
    id: 'initial-setup', icon: '🚀', title: 'התקנה וקליטת נתוני התחלה', category: 'start', tab: 'settings',
    summary: 'אשף שמגדיר את הארגון וקולט פעילויות, משימות, אירועים וקמפיינים ראשונים.',
    practical: 'אפשר להתחיל מסודר וגם לפתוח את האשף שוב לאחר שכבר נכנסו לאפליקציה.',
    settings: { group: 'organization', section: 'data-onboarding' },
    data: ['מצב השלמת האשף', 'כל הרשומות שנשמרו ממנו', 'פרטי הארגון והחיבור'],
  },
  {
    id: 'contacts', icon: '👥', title: 'אנשי קשר', category: 'people', tab: 'donors',
    summary: 'כרטיס מלא לכל אדם עם טלפון, כתובת, משפחה, הערות, תאריכים והיסטוריה.',
    practical: 'כל המידע על האדם נמצא במקום אחד ומתחבר אוטומטית לתרומות ולקשר.',
    data: ['כל עמודות אנשי הקשר', 'פרטי CRM', 'תרומות ומפגשים מקושרים'],
  },
  {
    id: 'contact-filters', icon: '🧹', title: 'סינון אנשי קשר', category: 'people', tab: 'donors',
    summary: 'סינון לפי מעגל קרבה, כתובת, טלפון, תרומה או סימון יעד.',
    practical: 'מציגים רק את הקבוצה שרלוונטית כרגע בלי למחוק אף אדם.',
    settings: { group: 'people', section: 'people-filters' },
    data: ['מעגלי קרבה', 'מסנני התצוגה האחרונים'],
  },
  {
    id: 'contact-merge', icon: '🔗', title: 'מיזוג והצעות לשמות כפולים', category: 'people', tab: 'donors',
    summary: 'מציע שמות דומים ומאחד כמה צורות כתיבה לאיש קשר אחד בלחיצה.',
    practical: 'תרומות והיסטוריה אינן מתפצלות בין „כהן מאור” ו„מאור כהן”.',
    data: ['מיפוי שמות', 'מיזוגי אנשי קשר', 'אפשרות ביטול מיזוג'],
  },
  {
    id: 'family-dates', icon: '🎂', title: 'משפחה ותאריכים אישיים', category: 'people', tab: 'dates',
    summary: 'ימי הולדת, יארצייטים, בן או בת זוג ותאריכים עבריים ולועזיים.',
    practical: 'מקבלים תזכורת בזמן ויודעים למי לפנות ובאיזה הקשר.',
    data: ['תאריכי איש הקשר', 'רשומות משפחה', 'הערות ותזכורות אישיות'],
  },
  {
    id: 'date-converter', icon: '🔄', title: 'המרת תאריך עברי ולועזי', category: 'people', tab: 'dates',
    summary: 'ממיר תאריך בין הלוח העברי ללועזי בעת הזנת תאריך אישי.',
    practical: 'לא צריך לחשב ידנית יום הולדת או יארצייט, ושני התאריכים נשמרים יחד.',
    data: ['התאריך המקורי', 'התאריך המקביל', 'סוג האירוע והאדם המקושר'],
  },
  {
    id: 'meeting-log', icon: '📝', title: 'רישום מפגש ויצירת קשר', category: 'people', tab: 'donors',
    summary: 'רושם שיחה, ביקור או מפגש עם מיקום, מטרה, סיכום ותובנות.',
    practical: 'בפעם הבאה יודעים בדיוק על מה דיברתם ומה הובטח.',
    data: ['האדם המקושר', 'תאריך ומיקום', 'מטרת המפגש', 'סיכום ותובנות'],
  },
  {
    id: 'thank-you-followup', icon: '💌', title: 'תודה ומכתב לתורם', category: 'people', tab: 'donors',
    summary: 'יצירת הודעת תודה או מכתב מסודר לאחר תרומה ומעקב אם נשלח.',
    practical: 'תרומה אינה מסתיימת בקליטה; נשמר קשר אישי והמשך טיפול ברור.',
    data: ['התרומה והאדם המקושרים', 'נוסח המכתב', 'משימת המעקב ומצבה'],
  },
  {
    id: 'contact-map', icon: '🗺️', title: 'מפת אנשי קשר', category: 'people', tab: 'donors',
    summary: 'מציגה את אנשי הקשר על מפה לפי הכתובות השמורות.',
    practical: 'עוזרת לתכנן ביקורים לפי אזורים ולא לנסוע הלוך ושוב.',
    data: ['כתובות אנשי קשר', 'העיר והכתובת של הארגון'],
  },
  {
    id: 'relationship-tracking', icon: '🤝', title: 'מעקב קשר', category: 'people', tab: 'score',
    summary: 'מציג פעילות קשר, רצף, סטטיסטיקה והמלצות למי כדאי לפנות.',
    practical: 'עוזר לשמור על קשר עקבי ולא לגלות שאדם נשכח במשך חודשים.',
    data: ['יומן פעולות אישי', 'ניקוד ורצף', 'מפגשים ותאריכי קשר'],
  },
  {
    id: 'home-visits', icon: '🚪', title: 'מערכי ביקורי בית', category: 'people', tab: 'homevisits',
    summary: 'בניית סבב ביקורים עם אנשים, הכנות, נושאים, סטטוס ותאריכים.',
    practical: 'אפשר לעקוב מי תוכנן, מי בוקר ומה צריך לעשות לפני הביקור הבא.',
    data: ['מערכי ביקורים', 'אנשים וקטגוריות', 'משימות הכנה', 'משימות ביקור וקישורי אנשי קשר'],
  },
  {
    id: 'donations', icon: '🤲', title: 'תרומות', category: 'money', tab: 'donations',
    summary: 'רישום וצפייה בתרומות עם סכום, תאריך, אמצעי תשלום, ייעוד והערות.',
    practical: 'יודעים מי נתן, כמה, מתי, עבור מה והיכן הכסף נמצא.',
    data: ['כל עמודות יומן התרומות', 'אפיק גבייה', 'ייעוד', 'מיקום מזומן', 'מזהה וקישור לתורם'],
  },
  {
    id: 'donation-edit', icon: '✏️', title: 'עריכת תרומה', category: 'money', tab: 'donations',
    summary: 'תיקון סכום, תאריך, אמצעי תשלום, ייעוד, מזומן ושיוך שגוי.',
    practical: 'טעות בקליטה אינה נשארת בדוחות או בהתחשבנות.',
    data: ['מזהה התרומה', 'כל השדות לפני ואחרי העריכה', 'יומן ביקורת'],
  },
  {
    id: 'donation-purpose-links', icon: '🎯', title: 'ייעוד וקישור תרומות', category: 'money', tab: 'donations',
    summary: 'מקשר ייעוד של תרומה לפעילות או לקמפיין.',
    practical: 'תרומה מקישור „פסח” יכולה להופיע אוטומטית בתקציב ליל הסדר.',
    data: ['ייעוד התרומה', 'ייעודי הפעילות והקמפיין', 'מזהי הקישורים'],
  },
  {
    id: 'cash-location', icon: '💵', title: 'מעקב מזומן', category: 'money', tab: 'donations',
    summary: 'מציין האם מזומן נמצא אצלך, הופקד בעמותה או הועבר למקום אחר.',
    practical: 'מונע מצב שבו תרומה במזומן נחשבת בטעות למשכורת או להחזר.',
    data: ['מיקום מזומן', 'אמצעי תשלום', 'העברות והתחשבנות קשורות'],
  },
  {
    id: 'standing-orders', icon: '🔁', title: 'הוראות קבע', category: 'money', tab: 'donations',
    summary: 'מעקב אחרי הוראות פעילות, תשלומים, חידושים, ביטולים וכשלים.',
    practical: 'רואים מה ממשיך, מה עומד להסתיים ומה דורש פנייה לתורם.',
    data: ['כל פרטי הוראת הקבע', 'שרשרת חידושים', 'חיובים וכשלים מקושרים'],
  },
  {
    id: 'payment-control', icon: '🧾', title: 'בקרת תשלומים', category: 'money', tab: 'donations',
    summary: 'תצוגה אופציונלית של מצבי תשלום והתאמה חודשית.',
    practical: 'מבדילים בין כסף שנקלט, עתידי, נכשל או בוטל.',
    settings: { group: 'organization', section: 'payment-statuses' },
    data: ['סטטוס כל שורת יומן', 'כשלי חיוב', 'הגדרת הצגת הבקרה'],
  },
  {
    id: 'donation-range', icon: '📆', title: 'טווח סכומי תרומות', category: 'money', tab: 'reports',
    summary: 'קובע מאיזה תאריך יחושבו הסכומים המוצגים.',
    practical: 'אפשר להציג את השנה הנוכחית בלי למחוק את ההיסטוריה.',
    settings: { group: 'organization', section: 'donation-range' },
    data: ['תאריך תחילת החישוב', 'כל היסטוריית התרומות המקורית'],
  },
  {
    id: 'finance-center', icon: '💼', title: 'מרכז כספי', category: 'money', tab: 'finance',
    summary: 'מרכז הכנסות, הוצאות, התחייבויות, תזרים והתחשבנות אישית.',
    practical: 'יודעים כמה באמת יש, מה עתיד לצאת והאם אפשר להתחייב לפעילות חדשה.',
    settings: { group: 'organization', section: 'finance-center' },
    data: ['כל התנועות הכספיות', 'מקורות חשבון וכיס', 'התחייבויות', 'תנועות צפויות וקבועות'],
  },
  {
    id: 'cashflow', icon: '📈', title: 'תזרים לפי חודשים וייעודים', category: 'money', tab: 'finance',
    summary: 'מציג כמה נכנס וכמה יצא לאורך זמן, עם סינון לפי חודש, ייעוד ומקור.',
    practical: 'רואים מראש נקודת מחסור ולא רק יתרה של היום.',
    data: ['תאריכי תנועות', 'סכומים', 'ייעודים', 'מקורות ותנועות צפויות'],
  },
  {
    id: 'personal-reimbursements', icon: '🙋', title: 'הוצאות מהכיס והחזרים', category: 'money', tab: 'finance',
    summary: 'מבדיל בין משכורת לבין הוצאה פרטית ששולמה עבור הפעילות.',
    practical: 'רואים כמה בית חב״ד צריך להחזיר לך בלי לערבב זאת במשכורת.',
    data: ['מקור התשלום', 'סוג התנועה', 'קישור להחזר', 'יתרת התחשבנות'],
  },
  {
    id: 'budgets', icon: '👛', title: 'תקציבי פעילות וקמפיין', category: 'money', tab: 'events',
    summary: 'הוצאות והכנסות צפויות ובפועל עבור פעילות, חג או קמפיין.',
    practical: 'רואים כמה האירוע עלה, האם כיסה את עצמו וכמה צריך לגייס לפעם הבאה.',
    data: ['סעיפי תקציב', 'צפוי ובפועל', 'תרומות משויכות', 'מזהה הפעילות או הקמפיין'],
  },
  {
    id: 'finance-planning', icon: '🧮', title: 'תכנון כספי וסגירת חודש', category: 'money', tab: 'finance',
    summary: 'מרכז תחזית, תנועות חוזרות, התחייבויות וסיכום סוף חודש.',
    practical: 'אפשר להחליט מה מותר להוציא ומה צריך לגייס לפני שמתחייבים.',
    data: ['תרחישי תכנון', 'תנועות צפויות וחוזרות', 'יתרות וסיכומי חודש'],
  },
  {
    id: 'monthly-reconciliation', icon: '⚖️', title: 'התאמה וסגירה מול דוחות', category: 'money', tab: 'finance',
    summary: 'משווה את התנועות באפליקציה לקובץ מנהל החשבונות או חברת הסליקה.',
    practical: 'מוצאים סכום חסר, כפילות או תנועה שלא נקלטה לפני שסוגרים חודש.',
    data: ['רשומות ההתאמה', 'מזהי עסקאות', 'הפרשים ותוצאות הבדיקה'],
  },
  {
    id: 'activities', icon: '📅', title: 'פעילויות קבועות ומיוחדות', category: 'activities', tab: 'events',
    summary: 'ניהול שיעורים ותפילות חוזרים לצד אירועים חד־פעמיים.',
    practical: 'אותו מקום מרכז נוכחות, משימות, תרומות, תקציב ותדירות.',
    data: ['פרטי הפעילות', 'תדירות ומופעים', 'נוכחות', 'משימות', 'תקציב וייעודים'],
  },
  {
    id: 'ai-activity-planning', icon: '🧠', title: 'תכנון פעילות בעזרת בינה מלאכותית', category: 'activities', tab: 'events',
    summary: 'מכין תוכנית עבודה, משימות ותקציב ראשוני מתוך תיאור הפעילות.',
    practical: 'מקבלים נקודת פתיחה מפורטת במהירות ואז בוחרים מה לשמור בפועל.',
    data: ['תיאור התכנון', 'הצעות שנבחרו', 'משימות וסעיפי תקציב שנשמרו'],
  },
  {
    id: 'recurring-cycles', icon: '♻️', title: 'מחזור חוזר ושכפול לשנה הבאה', category: 'activities', tab: 'events',
    summary: 'יוצר מופע חדש מפעילות או חג קודמים בלי למחוק את ההיסטוריה.',
    practical: 'משתמשים בתבנית שכבר עבדה ומקבלים משימות חדשות עם מזהים חדשים.',
    data: ['המקור והמחזור החדש', 'משימות משוכפלות', 'תאריכים וקישורי ההורה'],
  },
  {
    id: 'attendance', icon: '🙋‍♂️', title: 'נוכחות ומשתתפים', category: 'activities', tab: 'events',
    summary: 'רישום מוזמנים, נוכחים, מתעניינים ומעקב אחרי כל מופע.',
    practical: 'אפשר להשוות בין מפגשים ולדעת עם מי נוצר קשר בפועל.',
    data: ['תאריך המופע', 'מזהי ושמות משתתפים', 'מצבי השתתפות', 'רשומות קשר שנוצרו'],
  },
  {
    id: 'holidays', icon: '🕯️', title: 'חגים ואירועי חג', category: 'activities', tab: 'calendar',
    summary: 'לוח חגים עם אירועים קבועים, הכנות, תקציבים ונוכחות.',
    practical: 'משמרים את מבנה ליל הסדר או ההקפות לשנה הבאה ולא מתחילים מאפס.',
    settings: { group: 'navigation', section: 'holiday-visibility' },
    data: ['חגים מובנים ומותאמים', 'משימות ותקציבי חג', 'מופעים והיסטוריה'],
  },
  {
    id: 'campaigns', icon: '🎯', title: 'קמפיינים', category: 'activities', tab: 'projects',
    summary: 'ניהול התרמה שנתית או ממוקדת עם יעד, תורמים, פניות ומשימות.',
    practical: 'רואים כמה גויס, ממי, עבור מה ומה נשאר לעשות.',
    data: ['פרטי הקמפיין', 'יעדים וייעודים', 'תרומות מקושרות', 'פניות', 'משימות ופעילויות קשורות'],
  },
  {
    id: 'calendar', icon: '🗓️', title: 'לוח שנה ותאריכים', category: 'activities', tab: 'calendar',
    summary: 'מרכז חגים, פעילויות, תאריכים אישיים ותאריכים מותאמים.',
    practical: 'רואים מה מתקרב ופותחים ממנו את ההכנה הנכונה.',
    data: ['חגים מותאמים', 'תאריכי פעילויות', 'תאריכים אישיים', 'הגדרות הסתרה'],
  },
  {
    id: 'history', icon: '🗄️', title: 'היסטוריה וסיכומי עבר', category: 'activities', tab: 'history',
    summary: 'שומר אירועים וחגים שהסתיימו עם עלויות, משתתפים, משימות ורשמים.',
    practical: 'בשנה הבאה יודעים מה עבד, כמה עלה ומי הגיע.',
    data: ['צילום הפעילות שהסתיימה', 'סיכום ותובנות', 'נוכחות', 'תקציב ומשימות'],
  },
  {
    id: 'past-occurrence-summary', icon: '💡', title: 'סיכום מופע ותובנות לשנה הבאה', category: 'activities', tab: 'history',
    summary: 'מוסיף לסיום פעילות מה קרה, מי הגיע, מה עלה ומה כדאי לשנות.',
    practical: 'הניסיון אינו נשאר בזיכרון בלבד ופתיחת המחזור הבא מתחילה עם מסקנות.',
    data: ['סיכום חופשי', 'עלויות והכנסות', 'נוכחות', 'תובנות והמלצות'],
  },
  {
    id: 'tasks', icon: '✅', title: 'משימות', category: 'planning', tab: 'tasks',
    summary: 'משימות לחג, פעילות, קמפיין וביקורי בית, כולל תאריך ותתי־משימות.',
    practical: 'כל העבודה מרוכזת במקום אחד בלי לאבד את ההקשר שממנו נוצרה.',
    settings: { group: 'navigation', section: 'task-view' },
    data: ['מזהה משימה', 'טקסט ומצב', 'תאריך ושעה', 'הורה מקושר', 'תתי־משימות ואנשים'],
  },
  {
    id: 'task-views', icon: '🗂️', title: 'תצוגות משימות ופרטי משימה', category: 'planning', tab: 'tasks',
    summary: 'מעבר בין רשימה מקובצת, רשימה רגילה ולוח תאריכים, עם חלון פרטים.',
    practical: 'אותן משימות מוצגות בדרך שמתאימה לעבודה הנוכחית בלי לשכפל אותן.',
    settings: { group: 'navigation', section: 'task-view' },
    data: ['תצוגת ברירת המחדל', 'סינונים', 'פרטי המשימות והקשרים'],
  },
  {
    id: 'quick-inbox', icon: '📥', title: 'קליטה מהירה', category: 'planning', tab: 'inbox',
    summary: 'מקום זמני לרשום מידע במהירות לפני שממיינים אותו.',
    practical: 'לא מאבדים פרט באמצע יום עמוס; מסדרים אותו אחר כך במקום הנכון.',
    data: ['פריטי קליטה', 'הסוג והיעד שנבחרו בעת העברה'],
  },
  {
    id: 'ai-import', icon: '🤖', title: 'ייבוא בעזרת בינה מלאכותית', category: 'planning', tab: 'settings',
    summary: 'קליטת אנשי קשר, תרומות, כספים, משימות, ביקורי בית וסיכומי אירועים מ־JSON.',
    practical: 'אפשר להעלות קובץ גדול או להדביק פלט ולשמור הרבה מידע בפעם אחת לאחר תצוגה מקדימה.',
    settings: { group: 'data', section: 'ai-import' },
    data: ['קובץ המקור', 'כל הרשומות שיובאו', 'מזהים וקישורים שנוצרו'],
  },
  {
    id: 'daily-reminder', icon: '🔔', title: 'תזכורת יומית', category: 'planning', tab: 'settings',
    summary: 'תזכורת מקומית בשעה שנבחרה על דברים שדורשים טיפול.',
    practical: 'האפליקציה מזכירה לבד בלי להעמיס התראות לאורך היום.',
    settings: { group: 'organization', section: 'daily-reminder' },
    data: ['האם פעיל', 'שעת התזכורת'],
  },
  {
    id: 'reports', icon: '📊', title: 'דוחות', category: 'tools', tab: 'reports',
    summary: 'פילוחים של תרומות, פעילות, משימות ואנשי קשר.',
    practical: 'מקבלים תמונה מסודרת לקבלת החלטות בלי לשנות את הנתונים עצמם.',
    data: ['נתוני המקור המלאים', 'הסינונים שנבחרו לדוח'],
  },
  {
    id: 'csv-export', icon: '📄', title: 'ייצוא רשימות ל־CSV', category: 'tools', tab: 'reports',
    summary: 'מוריד רשימות מסוננות של תרומות, משימות ואנשי קשר.',
    practical: 'מתאים להעברה, הדפסה או עבודה נקודתית — אך אינו תחליף לגיבוי מלא.',
    data: ['השורות והשדות שנבחרו לייצוא'],
  },
  {
    id: 'poster', icon: '🖼️', title: 'פוסטר שבת', category: 'tools', tab: 'poster',
    summary: 'יוצר מודעת זמני שבת בעברית, רוסית או אנגלית עם רקע מותאם.',
    practical: 'מכינים תמונה מוכנה לפרסום בלי להקליד מחדש את הזמנים בכל שבוע.',
    data: ['פרטי הארגון', 'שפת הפוסטר', 'רקע ושקיפות', 'מיקום ומנהג הזמנים'],
  },
  {
    id: 'facebook-post', icon: '📣', title: 'סיוע בהכנת פוסט לפייסבוק', category: 'tools', tab: 'settings',
    summary: 'מכין נוסח פרסום מתוך פרטי פעילות או אירוע ומאפשר התאמה לפני שימוש.',
    practical: 'חוסך הקלדה מחדש ושומר שהפרטים בפרסום תואמים למה שנקבע באפליקציה.',
    settings: { group: 'data', section: 'facebook' },
    data: ['פרטי המקור לפוסט', 'הגדרות השפה והחיבור; אסימון הגישה אינו נכנס לגיבוי'],
  },
  {
    id: 'sync-and-pending-writes', icon: '☁️', title: 'סנכרון ותור כתיבות', category: 'tools', tab: 'settings',
    summary: 'שומר פעולות שנעשו בזמן תקלה ומנסה לשלוח אותן שוב כשהחיבור חוזר.',
    practical: 'רישום שנעשה ברגע של ניתוק אינו נעלם בשקט.',
    settings: { group: 'organization', section: 'system-status' },
    data: ['תור הכתיבות הממתינות', 'מזהי בקשות למניעת כפילות', 'מצב החיבור'],
  },
  {
    id: 'guide', icon: '📚', title: 'המדריך וקטלוג הפונקציות', category: 'tools', tab: 'guide',
    summary: 'מדריך מלא וממוין שמסביר מה יש, למה זה עוזר ומה נשמר.',
    practical: 'אפשר למצוא פונקציה, לפתוח את המסך שלה או להגיע ישירות להגדרה הרלוונטית.',
    data: ['קטלוג הפונקציות וגרסת המדריך'],
  },
  {
    id: 'backup-restore', icon: '🛟', title: 'גיבוי ושחזור מלא', category: 'tools', tab: 'settings',
    summary: 'מוריד צילום מלא של נתוני האפליקציה ומחזיר אותו בשחזור מבוקר.',
    practical: 'אם האפליקציה או הגיליון נמחקו, אפשר להחזיר את הנתונים, הקשרים וההגדרות למצב הגיבוי.',
    settings: { group: 'data', section: 'backup' },
    data: ['כל לשוניות האפליקציה', 'כל נתוני הסנכרון', 'הגדרות ומידע מקומי חשוב', 'מפת כיסוי וספירות'],
  },
  {
    id: 'integrity-check', icon: '🛡️', title: 'בדיקת תקינות', category: 'tools', tab: 'settings',
    summary: 'בודקת כפילויות, קישורים חסרים, שורות פגומות ונתונים לא מוכרים.',
    practical: 'מגלים בעיה בזמן, לפני שהיא משפיעה על דוחות או שחזור.',
    settings: { group: 'data', section: 'backup' },
    data: ['דוח ממצאים וספירות; הבדיקה עצמה אינה משנה נתונים'],
  },
  {
    id: 'audit-log', icon: '🧾', title: 'יומן שינויים', category: 'tools', tab: 'settings',
    summary: 'רושם פעולות משמעותיות שנעשו בנתונים.',
    practical: 'אפשר להבין מה השתנה ומתי, במיוחד לאחר עריכה או שחזור.',
    settings: { group: 'data', section: 'audit-log' },
    data: ['סוג הפעולה', 'זמן', 'פרטי שינוי והקשר'],
  },
  {
    id: 'system-status', icon: '🩺', title: 'מצב המערכת', category: 'tools', tab: 'settings',
    summary: 'מציג אם האפליקציה מחוברת ואם גרסת הסקריפט תואמת.',
    practical: 'מבדילים במהירות בין תקלה בנתונים לבין גרסה שלא נפרסה.',
    settings: { group: 'organization', section: 'system-status' },
    data: ['כתובת החיבור', 'גרסת האפליקציה והסקריפט'],
  },
  {
    id: 'settings', icon: '⚙️', title: 'הגדרות', category: 'tools', tab: 'settings',
    summary: 'מרכז את כל בחירות הארגון, הניווט, המראה, האנשים והמידע.',
    practical: 'כל פונקציה בקטלוג שמושפעת מהגדרה מובילה ישירות לסעיף הנכון.',
    data: ['כל הגדרות האפליקציה והארגון'],
  },
];

export function featureById(id: string): FeatureDefinition | undefined {
  return FEATURE_CATALOG.find(feature => feature.id === id);
}

export function featuresByCategory(category: FeatureCategoryId): FeatureDefinition[] {
  return FEATURE_CATALOG.filter(feature => feature.category === category);
}
