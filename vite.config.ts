import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

/**
 * שכבת הבהרה קטנה למסך הכספים.
 *
 * החישוב כבר כולל הוראות קבע פעילות ב„מה בטוח להוציא”, אבל עד עכשיו
 * הפירוט איחד אותן יחד עם כל שאר ההתחייבויות בשורה אחת. מבחינת המשתמש
 * זה נראה כאילו ההו״ק בכלל לא קיימות. כאן אנחנו מפרידים אותן בשורה
 * מפורשת, בלי לשנות את החישוב עצמו.
 *
 * נעשה בזמן ה-build/dev כדי לא לשכפל את לוגיקת התזרים: המקור של המספר
 * נשאר summarizeFinance, והמסך רק מציג את standingOrderIncome שכבר מחושב.
 */
function financeUiClarifier() {
  return {
    name: 'finance-ui-clarifier',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const normalizedId = id.replace(/\\/g, '/');
      if (!normalizedId.endsWith('/src/components/FinanceTab.tsx')) return null;

      let next = code;
      next = next.replace(
        `<DetailLine label="זמין כרגע" value={summary.currentBalance} />\n        <DetailLine label="השפעת כל ההתחייבויות וההכנסות המובטחות" value={summary.guaranteedBalance - summary.currentBalance} />`,
        `<DetailLine label="זמין כרגע" value={summary.currentBalance} />\n        <DetailLine label="הוראות קבע צפויות בטווח החישוב" value={summary.standingOrderIncome} />\n        <DetailLine label="שאר ההתחייבויות וההכנסות המחויבות (נטו)" value={summary.guaranteedBalance - summary.currentBalance - summary.standingOrderIncome} />`,
      );

      next = next.replace(
        'הוראת קבע יכולה להיכשל, ולכן הסכומים כאן נחשבים „צפוי” ולא „מובטח”. הם משפרים את התמונה האופטימית ואינם נכנסים לתחזית הבטוחה.',
        'הוראת קבע יכולה להיכשל, ולכן היא עדיין מסומנת „צפוי”. לפי כלל החישוב שנבחר, הוראות קבע פעילות כן נלקחות בחשבון גם ב„מה בטוח להוציא”.',
      );

      return next === code ? null : {code: next, map: null};
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: process.env.VITE_BASE_PATH ?? '/',
    plugins: [financeUiClarifier(), react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // חותמת הבנייה. בלעדיה אי אפשר לדעת אם הדפדפן מציג את הגרסה החדשה
      // או עותק שמור מלפני שבוע — והשאלה הזו חוזרת בכל עדכון.
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __BUILD_COMMIT__: JSON.stringify((process.env.GITHUB_SHA || '').slice(0, 7)),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.NODE_ENV !== 'production' && process.env.DISABLE_HMR !== 'true',
    },
  };
});
