import React, { useState } from 'react';
import { Download, ShieldCheck, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { CardTitle } from './Explain';
import {
  exportManifest, exportChunk, exportSync, fetchIntegrity, isNotDeployed,
} from '../lib/api';
import {
  collectBackup, backupFileName, backupSummary, BackupIncomplete,
  sortIssues, headline, ISSUE_HELP, SEVERITY_LABEL,
  Issue, IntegrityReport, Progress,
} from '../lib/backup';
import {
  BackupStamp, makeBackupStamp, readBackupStamp, writeBackupStamp,
} from '../lib/backupHistory';

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
  const [busy, setBusy] = useState<'' | 'backup' | 'check'>('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState('');
  const [failures, setFailures] = useState<{ what: string; error: string }[]>([]);
  const [needsDeploy, setNeedsDeploy] = useState(false);
  const [lastBackup, setLastBackup] = useState<BackupStamp | null>(() => readBackupStamp());
  const [report, setReport] = useState<IntegrityReport | null>(null);

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

  const issues = sortIssues(report?.issues || []);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-3">
      <CardTitle title="גיבוי ובדיקת נתונים">
        שתי פעולות שאינן משנות דבר בגיליון. הגיבוי מוריד עותק מלא של כל הנתונים
        לקובץ אחד במחשב; הבדיקה סורקת את הגיליון ומדווחת על מה שנראה לא תקין.
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
