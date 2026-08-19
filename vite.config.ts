import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: process.env.VITE_BASE_PATH ?? '/',
    plugins: [react(), tailwindcss()],
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
