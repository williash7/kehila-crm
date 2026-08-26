import React from 'react';
import { Download } from 'lucide-react';
import { downloadCSV } from '../lib/csvExport';
import { ExportColumn, exportFileName, exportHeaders, toExportRows } from '../lib/exportRows';

// ─────────────────────────────────────────────────────────────────────────────
// כפתור ההורדה שיושב בכל מסך רשימה.
//
// רכיב אחד ולא שישה, מסיבה אחת: **ההבטחה חייבת להיות זהה בכל מקום.** אם כל
// מסך היה מממש הורדה משלו, מסך אחד היה מייצא את הכול ואחר את המסונן —
// והמשתמש לא היה יודע איזה מהם הוא מחזיק ביד.
//
// המספר על הכפתור אינו קישוט: הוא **ההצהרה** של מה יירד. „הורד 24” אומר
// עשרים וארבע שורות, וזה בדיוק מה שיהיה בקובץ.
// ─────────────────────────────────────────────────────────────────────────────

interface Props<T> {
  /** השורות **כפי שהן מוצגות** — כבר מסוננות וממוינות. */
  rows: T[];
  columns: ExportColumn<T>[];
  /** בסיס שם הקובץ, למשל „תרומות”. */
  fileName: string;
  /** תיאור קצר של הסינון הפעיל, נכנס לשם הקובץ. */
  filterHint?: string;
  className?: string;
  label?: string;
}

export function ExportButton<T>({ rows, columns, fileName, filterHint, className, label }: Props<T>) {
  const count = rows.length;

  const run = () => {
    downloadCSV(
      exportFileName(fileName, filterHint),
      exportHeaders(columns),
      toExportRows(rows, columns)
    );
  };

  return (
    <button
      onClick={run}
      disabled={count === 0}
      title={count === 0 ? 'אין שורות להורדה' : `הורדת ${count} שורות — בדיוק מה שמוצג כרגע`}
      className={className || 'shrink-0 flex items-center gap-1.5 bg-white border border-[#EDE6D6] hover:border-[#C9A84C] disabled:opacity-40 disabled:hover:border-[#EDE6D6] rounded-xl px-3 py-1.5 text-xs font-bold text-[#0D1B2A] shadow-sm transition-colors'}
    >
      <Download size={13} />
      {label || 'הורד'} {count > 0 && <span className="text-[#9B7A2F]">{count}</span>}
    </button>
  );
}
