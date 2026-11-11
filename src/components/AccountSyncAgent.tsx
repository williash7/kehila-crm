import React from 'react';
import { collectClientBackupState } from '../lib/clientBackup';
import { loadAccountStateFromDrive, saveAccountStateToDrive } from '../lib/driveConfig';
import { currentAccount, isSignedIn, signIn } from '../lib/googleAuth';
import { getOrg } from '../lib/orgConfig';
import {
  accountSyncLastHash, clientStateHash, isAccountSyncEnabled,
  hasAccountSyncConflict, markAccountSyncConflict, recordAccountSync, remoteChangedSinceBaseline,
} from '../lib/accountSync';

/**
 * מסנכרן את המידע המקומי הקטן שאינו נמצא בגיליון. הנתונים המרכזיים
 * ממשיכים להישמר בגיליון Google; כאן נשמרים העדפות, תור כתיבה וטיוטות.
 */
export function AccountSyncAgent() {
  React.useEffect(() => {
    let stopped = false;

    const sync = async () => {
      // כתיבת רקע מתחילה רק אחרי בחירה מפורשת של גיבוי/שחזור במכשיר הזה.
      if (!isAccountSyncEnabled() || hasAccountSyncConflict() || !currentAccount()) return;
      try {
        if (!isSignedIn()) await signIn(false);
        const clientState = collectClientBackupState();
        const hash = clientStateHash(clientState);
        if (accountSyncLastHash() === hash) return;

        // הגיבוי הוא מצב מלא, לא מיזוג שדות. לכן לפני החלפה בודקים שאף
        // מכשיר אחר לא כתב לענן מאז הפעם האחרונה שהמכשיר הזה ראה אותו.
        const remote = await loadAccountStateFromDrive();
        if (remoteChangedSinceBaseline(remote?.updatedAt || '')) {
          markAccountSyncConflict();
          return;
        }
        const saved = await saveAccountStateToDrive(getOrg(), clientState);
        if (!stopped) recordAccountSync(saved.updatedAt, hash);
      } catch {
        // סנכרון רקע לא מפריע לעבודה. במסך ההגדרות אפשר לחדש חיבור ידנית.
      }
    };

    void sync();
    const timer = window.setInterval(sync, 45_000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, []);

  return null;
}
