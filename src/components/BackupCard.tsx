import React, { useRef, useState } from 'react';
import { Download, ShieldCheck, AlertTriangle, CheckCircle2, Loader2, RefreshCw, Upload } from 'lucide-react';
import { CardTitle } from './Explain';
import {
  exportManifest, exportChunk, exportSync, fetchIntegrity, isNotDeployed,
  restoreBegin, restoreSheet, restoreSync, restoreFinish, restoreRollback,
} from '../lib/api';
import {
  collectBackup, backupFileName, backupSummary, BackupIncomplete,
  sortIssues, headline, ISSUE_HELP, SEVERITY_LABEL,
  Issue, IntegrityReport, Progress,
} from '../lib/backup';
import {
  BackupStamp, makeBackupStamp, readBackupStamp, writeBackupStamp,
} from '../lib/backupHistory';
import {
  RestorePlan, RESTORE_CONFIRM_WORD, restoreManifest, sheetChunks, validateBackupForRestore,
} from '../lib/restore';
import { useAppStore } from '../store/AppContext';

// ─────────────────────────────────────────────────────────────────────────────
// גיבוי מלא ובדיקת תקינות.
//
// שתי פעולות שנוגעות באותה שאלה — "האם הנתונים שלי בסדר, ומה יקרה אם
// משהו יישבר" — ולכן הן יושבות יחד.
//
// שתיהן **קריאה בלבד**, ושתיהן רצות רק בלחיצה. אף אחת מהן לא מופעלת
// כשנכנסים למסך: דוח שרץ לבד הופך לרעש רקע, וגיבוי שמתחיל לבד מבזבז
// עשרות בקשות למי שרק רצה לשנות הגדרה.
// ─────────────────────────────────────────────────────────────────────────────

/** ההודעה שמופיעה כשהגיליון עדיין מריץ קוד ישן. */
function NeedsDeploy() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed">
      <div className="font-bold mb-1">הסקריפט בגיליון עדיין לא מכיר את הפעולה הזו</div>
      בגיליון: תוספים ← Apps Script ← להדביק את Code.gs המעודכן ← פריסה ←
      נהל פריסות ← עריכה (עיפרון) ← גרסה: <b>גרסה חדשה</b> ← פרוס.
      <br />
      <b>לא</b> "פריסה חדשה" — היא יוצרת כתובת אחרת שהאפליקציה לא מכירה.
    </div>
  );
}

function IssueRow({ issue }: { key?: React.Key; issue: Issue }) {
  const [open, setOpen] = useState(false);
  const tone = issue.severity === 'error'
    ? 'bg-red-50 border-red-200 text-red-900'
    : issue.severity === 'warning'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-white border-[#EDE6D6] text-gray-700';

  return (
    <div className={`${tone} border rounded-xl p-2.5 text-[11px] leading-relaxed`}>
      <button onClick={() => setOpen(o => !o)} className="w-full text-right flex items-start gap-2">
        <span className="font-bold shrink-0">{issue.count}</span>
        <span className="flex-1 min-w-0">
          <span className="font-bold">{issue.title}</span>
          <span className="block opacity-70 text-[10px]">{SEVERITY_LABEL[issue.severity]}</span>
        </span>
        <span className="opacity-50 shrink-0">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* מה לעשות — לפני הרשימה. רשימת שמות בלי הנחיה היא רעש. */}
          {ISSUE_HELP[issue.code] && (
            <div className="bg-white/60 rounded-lg p-2">{ISSUE_HELP[issue.code]}</div>
          )}
          {issue.details && <div className="opacity-80">{issue.details}</div>}
          {issue.items?.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-0.5 opacity-90">
              {issue.items.map((it, i) => (
                <div key={i}>· {typeof it === 'string' ? it : JSON.stringify(it)}</div>
              ))}
              {issue.truncated && <div className="opacity-60">(מוצגות 50 הראשונות)</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BackupCard() {
  const { refresh } = useAppStore();
  const restoreFileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'' | 'backup' | 'check' | 'restore'>('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState('');
  const [failures, setFailures] = useState<{ what: string; error: string }[]>([]);
  const [needsDeploy, setNeedsDeploy] = useState(false);
  const [lastBackup, setLastBackup] = useState<BackupStamp | null>(() => readBackupStamp());
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [restorePlan, setRestorePlan] = useState<RestorePlan | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [restoreMessage, setRestoreMessage] = useState('');

  const reset = () => { setError(''); setFailures([]); setNeedsDeploy(false); };

  const runBackup = async () => {
    reset(); setBusy('backup'); setProgress({ ratio: 0, label: 'מתחיל...' });
    try {
      const manifest = await exportManifest();
      const file = await collectBackup(
        manifest,
        async (sheet, offset, limit) => await exportChunk(sheet, offset, limit),
        async key => await exportSync(key),
        p => setProgress(p)
      );

      // ההורדה קורית **רק** אחרי שכל מה שהמניפסט הכריז עליו התקבל.
      //
      // הבדיקה המפורשת הזו נראית מיותרת — collectBackup כבר זורקת בכל
      // כשל — וזו בדיוק הסיבה שהיא כאן: היא שער אחרון לפני כתיבת קובץ
      // שמישהו יסמוך עליו. אם מישהו ישנה בעתיד את זרימת השגיאות
      // ב-collectBackup, השורה הזו עדיין תעצור קובץ שאינו מצהיר על עצמו
      // כשלם.
      if (file?.success !== true) {
        throw new BackupIncomplete([{ what: 'הקובץ', error: 'הגיבוי לא סומן כשלם' }]);
      }

      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const fileName = backupFileName();
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);

      const s = backupSummary(file);
      const stamp = makeBackupStamp(s, fileName);
      writeBackupStamp(stamp);
      setLastBackup(stamp);
    } catch (e: any) {
      if (isNotDeployed(e)) setNeedsDeploy(true);
      else if (e instanceof BackupIncomplete || e?.name === 'BackupIncomplete') {
        setFailures(e.failures || []);
        setError('הגיבוי לא הושלם, ולכן לא הורד קובץ.');
      } else setError(String(e?.message || e));
    } finally {
      setBusy(''); setProgress(null);
    }
  };

  const runCheck = async () => {
    reset(); setReport(null); setBusy('check');
    try {
      setReport(await fetchIntegrity());
    } catch (e: any) {
      if (isNotDeployed(e)) setNeedsDeploy(true);
      else setError(String(e?.message || e));
    } finally {
      setBusy('');
    }
  };

  const chooseRestoreFile = async (file: File) => {
    setRestorePlan(null); setRestoreConfirm(''); setRestoreMessage(''); reset();
    try {
      setRestorePlan(validateBackupForRestore(JSON.parse(await file.text())));
    } catch (e: any) {
      setRestoreMessage(e?.message || String(e));
    }
  };

  const runRestore = async () => {
    if (!restorePlan || restoreConfirm.trim() !== RESTORE_CONFIRM_WORD) return;
    reset(); setRestoreMessage(''); setBusy('restore');
    let token = '';
    let snapshotName = '';
    try {
      const begin = await restoreBegin(restoreManifest(restorePlan));
      token = begin.token;
      snapshotName = begin.snapshotName || '';
      const sheetNames = Object.keys(restorePlan.backup.sheets)
        .filter(name => restorePlan.backup.sheets[name].present);
      const chunks = sheetNames.flatMap(name => sheetChunks(restorePlan, name).map(chunk => ({ name, chunk })));
      const syncEntries = Object.entries(restorePlan.backup.syncResolved);
      const totalSteps = Math.max(1, chunks.length + syncEntries.length + 1);
      let done = 0;
      const tick = (label: string) => setProgress({ ratio: ++done / totalSteps, label });

      for (const { name, chunk } of chunks) {
        await restoreSheet({ token, sheet: name, ...chunk });
        tick(`${name} · ${Math.min(chunk.offset + chunk.rows.length, chunk.total)} מתוך ${chunk.total}`);
      }
      for (const [key, data] of syncEntries) {
        await restoreSync({ token, key, data });
        tick(`נתוני ${key}`);
      }
      const finish = await restoreFinish(token);
      token = ''; // מכאן כשל רענון אינו סיבה להחזיר שחזור שכבר הושלם.
      tick('השחזור הושלם');
      setRestoreMessage(`✓ השחזור הושלם. עותק הבטיחות נשמר ב-Drive בשם „${finish.snapshotName || snapshotName}”.`);
      setRestorePlan(null); setRestoreConfirm('');
      await refresh();
    } catch (e: any) {
      if (isNotDeployed(e)) setNeedsDeploy(true);
      if (token) {
        try {
          const rolled = await restoreRollback(token);
          setRestoreMessage(`השחזור נעצר והמצב הקודם הוחזר מעותק הבטיחות „${rolled.snapshotName || snapshotName}”. ${e?.message || e}`);
        } catch (rollbackError: any) {
          setRestoreMessage(`השחזור נעצר, וגם ההחזרה האוטומטית לא הושלמה. עותק הבטיחות „${snapshotName || 'נוצר ב-Drive'}” נשמר. ${rollbackError?.message || rollbackError}`);
        }
      } else if (!isNotDeployed(e)) setRestoreMessage(e?.message || String(e));
    } finally {
      setBusy(''); setProgress(null);
    }
  };

  const issues = sortIssues(report?.issues || []);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
      <CardTitle title="גיבוי, שחזור ובדיקת נתונים">
        הגיבוי והבדיקה אינם משנים דבר בגיליון. השחזור מופעל רק לאחר בחירת קובץ
        ואישור מפורש, ולפניו נוצר אוטומטית עותק בטיחות מלא ב־Drive.
      </CardTitle>

      {needsDeploy && <NeedsDeploy />}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[11px] text-red-800 leading-relaxed">
          <div className="font-bold mb-1 flex items-center gap-1.5">
            <AlertTriangle size={13} className="shrink-0" /> {error}
          </div>
          {failures.length > 0 && (
            <>
              <div className="mb-1">מה לא התקבל:</div>
              <div className="space-y-0.5 mb-2">
                {failures.map((f, i) => <div key={i}>· <b>{f.what}</b> — {f.error}</div>)}
              </div>
              <div className="opacity-80">
                עדיף קובץ שלא ירד מאשר גיבוי חסר שנראה שלם. נסו שוב; אם זה חוזר,
                בדקו את החיבור לגיליון.
              </div>
            </>
          )}
        </div>
      )}

      {/* ── גיבוי ── */}
      <div>
        <button
          onClick={runBackup}
          disabled={!!busy}
          className="w-full flex items-center justify-center gap-2 bg-[#0D1B2A] text-[#E8C97A] text-sm font-bold py-2.5 rounded-xl disabled:opacity-50"
        >
          {busy === 'backup'
            ? <><Loader2 size={15} className="animate-spin" /> מגבה...</>
            : <><Download size={15} /> הורד גיבוי מלא</>}
        </button>

        {busy === 'backup' && progress && (
          <div className="mt-2">
            <div className="h-1.5 bg-[#EDE6D6] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C9A84C] transition-all duration-200"
                style={{ width: `${Math.round(progress.ratio * 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-400 mt-1 truncate">{progress.label}</div>
          </div>
        )}

        {lastBackup && (
          <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-[11px] text-emerald-800 flex items-start gap-1.5">
            <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
            <span>
              <b>הגיבוי האחרון במכשיר זה:</b>{' '}
              {new Date(lastBackup.completedAt).toLocaleString('he-IL')} ·{' '}
              {lastBackup.rows.toLocaleString()} שורות · {lastBackup.sheets} לשוניות ·{' '}
              {lastBackup.sync} מפתחות נתונים
            </span>
          </div>
        )}

        <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
          הנתונים יורדים במנות, ולכן זה לוקח כמה שניות. אם משהו לא מתקבל — לא
          יורד קובץ בכלל, כדי שלא יישאר גיבוי חסר שנראה שלם.
        </p>
      </div>

      {/* ── שחזור מבוקר ── */}
      <div className="pt-1 border-t border-[#EDE6D6]">
        <input
          ref={restoreFileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) chooseRestoreFile(file);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => restoreFileRef.current?.click()}
          disabled={!!busy}
          className="w-full mt-3 flex items-center justify-center gap-2 border border-[#EDE6D6] hover:border-[#C9A84C] text-[#0D1B2A] text-sm font-bold py-2.5 rounded-xl disabled:opacity-50"
        >
          <Upload size={15} /> בחר גיבוי לשחזור
        </button>

        {restorePlan && (
          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 space-y-2">
            <div className="font-bold">תצוגה מקדימה — עדיין לא השתנה דבר</div>
            <div>
              {restorePlan.totalRows.toLocaleString()} שורות · {restorePlan.sheetCount} לשוניות ·{' '}
              {restorePlan.syncCount} מפתחות נתונים
              {restorePlan.sourceName ? ` · מתוך „${restorePlan.sourceName}”` : ''}
            </div>
            <div>
              השחזור יחליף את נתוני האפליקציה. לפני הכתיבה ייווצר אוטומטית עותק מלא של
              הגיליון הנוכחי ב־Drive. לשוניות שאינן שייכות לאפליקציה לא יימחקו.
            </div>
            <label className="block">
              <span className="block mb-1">כדי לאשר, הקלד <b>{RESTORE_CONFIRM_WORD}</b></span>
              <input
                value={restoreConfirm}
                onChange={e => setRestoreConfirm(e.target.value)}
                className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-amber-500"
              />
            </label>
            <button
              onClick={runRestore}
              disabled={busy === 'restore' || restoreConfirm.trim() !== RESTORE_CONFIRM_WORD}
              className="w-full bg-red-700 text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-40"
            >
              {busy === 'restore' ? <><Loader2 size={14} className="inline animate-spin ml-1" /> משחזר...</> : 'שחזר את הנתונים'}
            </button>
          </div>
        )}

        {busy === 'restore' && progress && (
          <div className="mt-2">
            <div className="h-1.5 bg-[#EDE6D6] rounded-full overflow-hidden">
              <div className="h-full bg-amber-600" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
            </div>
            <div className="text-[10px] text-gray-500 mt-1">{progress.label}</div>
          </div>
        )}

        {restoreMessage && (
          <div className={`mt-2 rounded-xl p-2.5 text-[11px] border ${
            restoreMessage.startsWith('✓')
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>{restoreMessage}</div>
        )}
      </div>

      {/* ── בדיקה ── */}
      <div className="pt-1 border-t border-[#EDE6D6]">
        <button
          onClick={runCheck}
          disabled={!!busy}
          className="w-full mt-3 flex items-center justify-center gap-2 border border-[#EDE6D6] hover:border-[#C9A84C] text-[#0D1B2A] text-sm font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {busy === 'check'
            ? <><Loader2 size={15} className="animate-spin" /> בודק...</>
            : <><ShieldCheck size={15} /> בדוק תקינות נתונים</>}
        </button>

        {report && (
          <div className="mt-2 space-y-2">
            <div className={`rounded-xl p-3 text-[11px] border flex items-start gap-2 ${
              report.healthy
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-white border-[#EDE6D6] text-[#0D1B2A]'
            }`}>
              {report.healthy
                ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                : <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />}
              <div className="min-w-0">
                <div className="font-bold">{headline(report)}</div>
                <div className="opacity-70 text-[10px] mt-0.5">
                  נסרקו {report.summary?.contacts ?? 0} אנשי קשר ·{' '}
                  {(report.summary?.logRows ?? 0).toLocaleString()} שורות יומן ·{' '}
                  {report.summary?.standingOrders ?? 0} הוראות קבע
                </div>
              </div>
              <button
                onClick={runCheck}
                className="shrink-0 text-gray-400 hover:text-[#9B7A2F]"
                title="בדוק שוב"
              ><RefreshCw size={13} /></button>
            </div>

            {issues.map(i => <IssueRow key={i.code} issue={i} />)}

            {issues.length > 0 && (
              <p className="text-[10px] text-gray-400 leading-relaxed">
                הבדיקה אינה משנה דבר — היא רק מדווחת. כל תיקון נעשה על ידך,
                בגיליון או באפליקציה.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
