// מעתיק את קוד ה-Google Apps Script אל תיקיית public, כדי שאשף ההגדרה
// באפליקציה יוכל להציע למשתמש "העתק את הקוד" בלי להטמיע אותו ב-JS.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'google-apps-script/Code.gs');
const dest = resolve(root, 'public/apps-script.txt');

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log('✓ apps-script.txt updated');
