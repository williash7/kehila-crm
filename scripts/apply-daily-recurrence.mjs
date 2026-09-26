import { readFileSync, writeFileSync } from 'node:fs';

const root = process.cwd();
const lines = (...parts) => parts.join('\n');

function patchFile(relativePath, replacements) {
  const path = `${root}/${relativePath}`;
  let text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  for (const { label, from, to } of replacements) {
    const count = text.split(from).length - 1;
    if (count !== 1) {
      throw new Error(`${relativePath}: expected exactly one match for ${label}, found ${count}`);
    }
    text = text.replace(from, to);
  }
  writeFileSync(path, text);
}

patchFile('src/lib/tasks.ts', [
  {
    label: 'nextEventOccurrence',
    from: lines(
      "export function nextEventOccurrence(ev: { date?: string; freq?: string; time?: string }, from: Date): Date | null {",
      "  if (!ev.date) return null;",
      "  const base = new Date(`${ev.date}T${ev.time || '00:00'}`);",
      "  if (isNaN(base.getTime())) return null;",
      "  if (ev.freq === 'oneoff') return base;",
      "  const d = new Date(base);",
      "  const stepDays = ev.freq === 'weekly' ? 7 : ev.freq === 'biweekly' ? 14 : null;",
      "  if (stepDays) {",
      "    while (d.getTime() < from.getTime()) d.setDate(d.getDate() + stepDays);",
      "  } else {",
      "    while (d.getTime() < from.getTime()) d.setMonth(d.getMonth() + 1);",
      "  }",
      "  return d;",
      "}"
    ),
    to: lines(
      "export function nextEventOccurrence(ev: { date?: string; freq?: string; time?: string; repeatCount?: number }, from: Date): Date | null {",
      "  if (!ev.date) return null;",
      "  const base = new Date(`${ev.date}T${ev.time || '00:00'}`);",
      "  if (isNaN(base.getTime())) return null;",
      "  if (ev.freq === 'oneoff') return base;",
      "  const d = new Date(base);",
      "",
      "  // תדירות יומית יכולה להיות מוגבלת למספר מופעים. repeatCount כולל את",
      "  // תאריך הבסיס עצמו: 5 = היום הראשון ועוד ארבעה ימים רצופים.",
      "  if (ev.freq === 'daily') {",
      "    const repeatCount = Math.max(1, Math.floor(Number(ev.repeatCount) || 1));",
      "    let occurrenceIndex = 0;",
      "    while (d.getTime() < from.getTime() && occurrenceIndex < repeatCount - 1) {",
      "      d.setDate(d.getDate() + 1);",
      "      occurrenceIndex++;",
      "    }",
      "    return d.getTime() >= from.getTime() && occurrenceIndex < repeatCount ? d : null;",
      "  }",
      "",
      "  const stepDays = ev.freq === 'weekly' ? 7 : ev.freq === 'biweekly' ? 14 : null;",
      "  if (stepDays) {",
      "    while (d.getTime() < from.getTime()) d.setDate(d.getDate() + stepDays);",
      "  } else {",
      "    while (d.getTime() < from.getTime()) d.setMonth(d.getMonth() + 1);",
      "  }",
      "  return d;",
      "}"
    ),
  },
]);

patchFile('src/lib/activities.ts', [
  {
    label: 'Activity repeatCount field',
    from: lines("  time?: string;", "  location?: string;"),
    to: lines("  time?: string;", "  /** מספר המופעים הכולל לפעילות יומית, כולל תאריך הבסיס. */", "  repeatCount?: number;", "  location?: string;"),
  },
  {
    label: 'daily normalized frequency',
    from: "['weekly', 'biweekly', 'monthly'].includes(String(raw?.freq || ''))",
    to: "['daily', 'weekly', 'biweekly', 'monthly'].includes(String(raw?.freq || ''))",
  },
]);

patchFile('src/components/EventsTab.tsx', [
  {
    label: 'repeat count state',
    from: lines("  const [evFreq, setEvFreq] = useState('weekly');", "  const [evDate, setEvDate] = useState(() => new Date().toISOString().split('T')[0]);"),
    to: lines("  const [evFreq, setEvFreq] = useState('weekly');", "  const [evRepeatCount, setEvRepeatCount] = useState('1');", "  const [evDate, setEvDate] = useState(() => new Date().toISOString().split('T')[0]);"),
  },
  {
    label: 'daily frequency label',
    from: "  const freqLabels: Record<string, string> = { weekly: 'שבועי', biweekly: 'דו-שבועי', monthly: 'חודשי', oneoff: 'חד-פעמי' };",
    to: "  const freqLabels: Record<string, string> = { daily: 'יומי', weekly: 'שבועי', biweekly: 'דו-שבועי', monthly: 'חודשי', oneoff: 'חד-פעמי' };",
  },
  {
    label: 'reset repeat count',
    from: lines("    setEvFreq('weekly');", "    setEvDate(new Date().toISOString().split('T')[0]);"),
    to: lines("    setEvFreq('weekly');", "    setEvRepeatCount('1');", "    setEvDate(new Date().toISOString().split('T')[0]);"),
  },
  {
    label: 'edit repeat count',
    from: lines("    setEvFreq(ev.freq || 'weekly');", "    setEvDate(ev.date || new Date().toISOString().split('T')[0]);"),
    to: lines("    setEvFreq(ev.freq || 'weekly');", "    setEvRepeatCount(String(ev.repeatCount || 1));", "    setEvDate(ev.date || new Date().toISOString().split('T')[0]);"),
  },
  {
    label: 'save repeat count when editing',
    from: lines("        freq: evActivityKind === 'recurring' ? evFreq : 'oneoff',", "        date: evDate,"),
    to: lines("        freq: evActivityKind === 'recurring' ? evFreq : 'oneoff',", "        repeatCount: evActivityKind === 'recurring' && evFreq === 'daily' ? Math.max(1, Math.floor(Number(evRepeatCount) || 1)) : undefined,", "        date: evDate,"),
  },
  {
    label: 'save repeat count when creating',
    from: lines(
      "      const effectiveFreq = evActivityKind === 'recurring' ? evFreq : 'oneoff';",
      "      const occ = nextEventOccurrence({ date: evDate, freq: effectiveFreq, time: evTime }, new Date());"
    ),
    to: lines(
      "      const effectiveFreq = evActivityKind === 'recurring' ? evFreq : 'oneoff';",
      "      const effectiveRepeatCount = effectiveFreq === 'daily' ? Math.max(1, Math.floor(Number(evRepeatCount) || 1)) : undefined;",
      "      const occ = nextEventOccurrence({ date: evDate, freq: effectiveFreq, time: evTime, repeatCount: effectiveRepeatCount }, new Date());"
    ),
  },
  {
    label: 'new activity repeatCount payload',
    from: lines("        freq: effectiveFreq,", "        date: evDate,"),
    to: lines("        freq: effectiveFreq,", "        repeatCount: effectiveRepeatCount,", "        date: evDate,"),
  },
  {
    label: 'daily count in activity card',
    from: "                        <div className=\"text-[11px] text-gray-500\">{ACTIVITY_KIND_LABEL[ev.activityKind as ActivityKind]} · {freqLabels[ev.freq] || ev.freq} {ev.time && `· ${ev.time}`}</div>",
    to: "                        <div className=\"text-[11px] text-gray-500\">{ACTIVITY_KIND_LABEL[ev.activityKind as ActivityKind]} · {freqLabels[ev.freq] || ev.freq}{ev.freq === 'daily' ? ` · ${ev.repeatCount || 1} פעמים` : ''} {ev.time && `· ${ev.time}`}</div>",
  },
  {
    label: 'daily repeat count input',
    from: lines(
      "                 <select value={evFreq} onChange={e => setEvFreq(e.target.value)} className=\"w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm font-bold text-gray-700 outline-none focus:border-[#C9A84C]\">",
      "                   {Object.keys(freqLabels).filter(f => f !== 'oneoff').map(f => <option key={f} value={f}>{freqLabels[f]}</option>)}",
      "                 </select>"
    ),
    to: lines(
      "                 <select value={evFreq} onChange={e => setEvFreq(e.target.value)} className=\"w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm font-bold text-gray-700 outline-none focus:border-[#C9A84C]\">",
      "                   {Object.keys(freqLabels).filter(f => f !== 'oneoff').map(f => <option key={f} value={f}>{freqLabels[f]}</option>)}",
      "                 </select>",
      "                 {evFreq === 'daily' && (",
      "                   <div className=\"mt-3\">",
      "                     <label className=\"block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5\">מספר חזרות</label>",
      "                     <input",
      "                       value={evRepeatCount}",
      "                       onChange={e => setEvRepeatCount(e.target.value)}",
      "                       type=\"number\"",
      "                       min=\"1\"",
      "                       step=\"1\"",
      "                       inputMode=\"numeric\"",
      "                       className=\"w-full bg-white border border-[#EDE6D6] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C]\"",
      "                     />",
      "                     <div className=\"text-[10px] text-gray-400 mt-1\">מספר המופעים הכולל, כולל תאריך הבסיס. למשל 5 = חמישה ימים רצופים.</div>",
      "                   </div>",
      "                 )}"
    ),
  },
  {
    label: 'AI context daily count',
    from: "                   `מסגרת: ${ACTIVITY_KIND_LABEL[currentTasksEvent.activityKind as ActivityKind]}, תוכן: ${typeLabels[currentTasksEvent.type] || currentTasksEvent.type}, תדירות: ${freqLabels[currentTasksEvent.freq] || currentTasksEvent.freq}` ,",
    to: "                   `מסגרת: ${ACTIVITY_KIND_LABEL[currentTasksEvent.activityKind as ActivityKind]}, תוכן: ${typeLabels[currentTasksEvent.type] || currentTasksEvent.type}, תדירות: ${freqLabels[currentTasksEvent.freq] || currentTasksEvent.freq}${currentTasksEvent.freq === 'daily' ? ` (${currentTasksEvent.repeatCount || 1} פעמים)` : ''}` ,",
  },
]);

console.log('Daily recurrence patch applied.');
