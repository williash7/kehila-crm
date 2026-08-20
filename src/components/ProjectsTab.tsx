import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/AppContext';
import { Plus, X, Target, Wallet, Users, Trash2, Search, CheckCircle2, MessageSquare} from 'lucide-react';
import { FullScreenView } from './FullScreenView';
import { AddHkDialog } from './AddHkDialog';
import { BudgetEditor, emptyBudget } from './BudgetEditor';
import {
  Project, Solicitation, SolicitationStatus, emptyProject, projectProgress,
  projectDonations, syncSolicitationsWithDonations, buildGivingIndex, suggestedAsk, totalAsk,
  SOLICITATION_LABEL, SOLICITATION_COLOR, SOLICITATION_ORDER, normalizeStatus,
  buildSolicitationRows, sumSolicitationRows, unlinkedHkFor, explicitHkIds, SolicitationRow,
  breakdownFor, BreakdownMetric, BREAKDOWN_LABEL, BREAKDOWN_HINT,
} from '../lib/projects';
import { logAction } from '../lib/score';

// ─────────────────────────────────────────────────────────────────────────────
// פרויקטי גיוס.
//
// פרויקט נפתח כשמגייסים מאנשים מול יעד. אם רק סופרים הוצאות והכנסות של
// אירוע — תקציב באירוע מספיק.
//
// הכסף לא נשמר כאן: "גויס" מחושב מיומן התרומות לפי הייעוד. כך תרומה
// נספרת פעם אחת בדיוק, גם בדוח הכללי וגם בפרויקט.
// ─────────────────────────────────────────────────────────────────────────────

export function ProjectsTab({ addTrigger }: { addTrigger?: { tab: string; count: number } } = {}) {
  const { projects, updateProjects, donations, hk, visibleDonors, crm } = useAppStore();

  const [openId, setOpenId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [pane, setPane] = useState<'raise' | 'budget'>('raise');
  const [addPersonSearch, setAddPersonSearch] = useState('');

  React.useEffect(() => {
    if (addTrigger?.tab === 'projects' && addTrigger.count) setIsAdding(true);
  }, [addTrigger]);

  const visible = projects.filter(p => showClosed || p.status !== 'closed');
  const current = projects.find(p => p.id === openId) || null;

  const patch = (id: string, changes: Partial<Project>) =>
    updateProjects(projects.map(p => (p.id === id ? { ...p, ...changes } : p)));

  const create = () => {
    if (!newName.trim()) return;
    const p = emptyProject(newName);
    updateProjects([...projects, p]);
    logAction('project_create');
    setNewName('');
    setIsAdding(false);
    setOpenId(p.id);
  };

  return (
    <div className="animate-in fade-in pb-24 md:pb-6">
      {/* Topbar */}
      <div className="bg-[#0D1B2A] px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex-1">
          <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#C9A84C]">פרויקטים וקמפיינים</div>
          <div className="text-[11px] text-white/45 mt-[1px]">גיוס מול יעד, עם מעקב מי נתן ומי הבטיח</div>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 px-3 h-9 bg-[#C9A84C] text-[#0D1B2A] rounded-full text-xs font-bold shrink-0"
        >
          <Plus size={14} /> פרויקט
        </button>
      </div>

      <div className="p-4 md:p-6 max-w-3xl space-y-3">
        {isAdding && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] space-y-2">
            <input
              autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && create()}
              placeholder="שם הפרויקט — למשל: הדפסת לוח שנה תשפ״ו"
              className="w-full border border-[#EDE6D6] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C]"
            />
            <div className="flex gap-2">
              <button onClick={create} disabled={!newName.trim()}
                      className="flex-1 bg-[#0D1B2A] text-white py-2 rounded-lg text-sm font-bold disabled:opacity-40">
                צור
              </button>
              <button onClick={() => { setIsAdding(false); setNewName(''); }}
                      className="px-4 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold">
                בטל
              </button>
            </div>
          </div>
        )}

        {visible.length === 0 && !isAdding && (
          <div className="bg-white rounded-2xl p-6 text-center border border-[#EDE6D6]">
            <Target size={32} className="mx-auto text-[#C9A84C]/40 mb-2" />
            <p className="text-sm text-gray-500 leading-relaxed">
              אין פרויקטים פעילים.<br />
              פרויקט הוא גיוס מול יעד — הדפסת לוח שנה, שיפוץ, קמפיין שנתי.
            </p>
          </div>
        )}

        {visible.map(p => {
          const prog = projectProgress(p, donations, hk);
          return (
            <button
              key={p.id}
              onClick={() => { setOpenId(p.id); setPane('raise'); }}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-[#EDE6D6] text-right hover:border-[#C9A84C]/50 transition-colors"
            >
              <div className="flex justify-between items-start gap-3 mb-2">
                <div className="min-w-0">
                  <div className="font-bold text-[#0D1B2A] truncate">{p.name}</div>
                  <div className="text-[11px] text-gray-400">
                    {p.kind === 'campaign' ? 'קמפיין כללי' : 'פרויקט'}
                    {p.deadline ? ` · יעד: ${p.deadline}` : ''}
                    {p.status === 'closed' ? ' · סגור' : ''}
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <div className="font-['Frank_Ruhl_Libre'] text-lg font-bold text-[#0D1B2A] leading-none">
                    ₪{prog.raised.toLocaleString()}
                  </div>
                  {prog.goal > 0 && <div className="text-[11px] text-gray-400">מתוך ₪{prog.goal.toLocaleString()}</div>}
                </div>
              </div>

              {prog.goal > 0 && (
                <div className="h-2 bg-[#EDE6D6] rounded-full overflow-hidden">
                  <div className="h-full bg-[#C9A84C] rounded-full transition-all" style={{ width: `${prog.percent}%` }} />
                </div>
              )}

              <div className="flex gap-3 mt-2 text-[11px] text-gray-500">
                <span>{prog.donorCount} תורמים</span>
                {prog.pledged > 0 && <span className="text-amber-700">צפוי ₪{prog.pledged.toLocaleString()}</span>}
                {prog.counts.toSend > 0 && <span>{prog.counts.toSend} עוד לא פנית</span>}
              </div>
            </button>
          );
        })}

        {projects.some(p => p.status === 'closed') && (
          <button onClick={() => setShowClosed(!showClosed)} className="text-xs text-[#9B7A2F] font-bold">
            {showClosed ? 'הסתר פרויקטים סגורים' : 'הצג גם פרויקטים סגורים'}
          </button>
        )}
      </div>

      {current && (
        <ProjectDetail
          hk={hk}
          project={current}
          donations={donations}
          donorNames={Object.keys(visibleDonors)}
          crm={crm}
          pane={pane}
          setPane={setPane}
          addPersonSearch={addPersonSearch}
          setAddPersonSearch={setAddPersonSearch}
          onPatch={changes => patch(current.id, changes)}
          onDelete={() => {
            if (!confirm(`למחוק את "${current.name}"? רשימת ההתרמה והתקציב יימחקו. התרומות עצמן לא יימחקו.`)) return;
            updateProjects(projects.filter(p => p.id !== current.id));
            setOpenId(null);
          }}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function ProjectDetail({ project, donations, hk, donorNames, crm, pane, setPane, addPersonSearch, setAddPersonSearch, onPatch, onDelete, onClose }: {
  project: Project;
  donations: any[];
  hk: any[];
  donorNames: string[];
  crm: Record<string, any>;
  pane: 'raise' | 'budget';
  setPane: (p: 'raise' | 'budget') => void;
  addPersonSearch: string;
  setAddPersonSearch: (s: string) => void;
  onPatch: (changes: Partial<Project>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const prog = useMemo(() => projectProgress(project, donations, hk), [project, donations, hk]);
  const linked = useMemo(() => projectDonations(project, donations), [project, donations]);

  // מי שכבר תרם מסומן "נתן" אוטומטית — אין טעם לבקש מהמשתמש לעדכן
  // מה שהמערכת כבר יודעת מיומן התרומות.
  React.useEffect(() => {
    const synced = syncSolicitationsWithDonations(project, donations);
    if (synced) onPatch({ solicitations: synced });
  }, [donations, project.purposeTag]);

  const sols = project.solicitations || [];

  const setSol = (idx: number, changes: Partial<Solicitation>) =>
    onPatch({ solicitations: sols.map((s, i) => (i === idx ? { ...s, ...changes } : s)) });

  // מדד נתינה לכל תורם — נבנה פעם אחת ומשמש את כל השורות
  const giving = React.useMemo(
    () => buildGivingIndex(donations, project.purposeTag),
    [donations, project.purposeTag]
  );

  const addPerson = (name: string) => {
    if (sols.some(s => s.name === name)) return;
    onPatch({ solicitations: [...sols, { name, status: 'toSend' as SolicitationStatus, ask: suggestedAsk(giving[name]) || '' }] });
    setAddPersonSearch('');
  };

  // ── הוספה מרוכזת ────────────────────────────────────────────────────────
  // קמפיין אמיתי מתחיל מהרשימה כולה, לא מהקלדת מאתיים שמות אחד-אחד. כל
  // אדם נכנס עם סכום מוצע לפי מה שנתן בעבר — נקודת פתיחה, לא החלטה.
  const addMany = (names: string[]) => {
    const existing = new Set(sols.map(s => s.name));
    const fresh = names.filter(n => n && !existing.has(n));
    if (!fresh.length) return;
    onPatch({
      solicitations: [
        ...sols,
        ...fresh.map(name => ({ name, status: 'toSend' as SolicitationStatus, ask: suggestedAsk(giving[name]) || '' })),
      ],
    });
  };

  const gaveLastYear = donorNames.filter(n => (giving[n]?.lastYear || 0) > 0);
  const askSum = totalAsk(sols);

  // כל החישוב לכל השורות במקום אחד: מה נכנס, מה מובטח דרך הוראת קבע, ומה
  // עוד צפוי. כך אין שורה שמחשבת אחרת מהסיכום שמעליה.
  const rows = React.useMemo(
    () => buildSolicitationRows(project, donations, hk, giving),
    [project, donations, hk, giving]
  );
  const totals = React.useMemo(() => sumSolicitationRows(rows), [rows]);
  const [statusFilter, setStatusFilter] = React.useState<SolicitationStatus | 'all'>('all');
  const [rowSearch, setRowSearch] = React.useState('');
  // שורה שממנה נפתח חלון פתיחת הוראת קבע — כדי לשייך אותה חזרה לשורה
  const [hkForRow, setHkForRow] = React.useState<number | null>(null);
  // איזה מהמספרים בראש הרשימה נפתח לפירוט
  const [breakdown, setBreakdown] = React.useState<BreakdownMetric | null>(null);
  const [openNotes, setOpenNotes] = React.useState<number | null>(null);
  const shownRows = React.useMemo(() => {
    const q = rowSearch.trim().toLowerCase();
    return rows.filter(r =>
      (statusFilter === 'all' || r.status === statusFilter) &&
      (!q || r.sol.name.toLowerCase().includes(q) || (r.sol.notes || '').toLowerCase().includes(q))
    );
  }, [rows, statusFilter, rowSearch]);

  const candidates = donorNames
    .filter(n => !sols.some(s => s.name === n))
    .filter(n => !addPersonSearch || n.includes(addPersonSearch))
    .slice(0, 8);

  return (
    <FullScreenView
      eyebrow="פרויקט"
      title={project.name || 'פרויקט ללא שם'}
      backLabel="פרויקטים"
      onClose={onClose}
      layout="wide"
    >
      <>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 mb-1">שם הפרויקט</label>
          <input
            value={project.name}
            onChange={e => onPatch({ name: e.target.value })}
            className="w-full font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A] bg-white rounded-xl px-3 py-2 outline-none border border-[#EDE6D6] focus:border-[#C9A84C] mb-3"
          />

          {/* התקדמות */}
          <div className="bg-[#0D1B2A] rounded-2xl p-4 mt-3 text-white">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm text-white/60">גויס בפועל</span>
              <span className="font-['Frank_Ruhl_Libre'] text-2xl font-bold text-[#C9A84C]">₪{prog.raised.toLocaleString()}</span>
            </div>
            {prog.goal > 0 && (
              <>
                {/* שלושה מקטעים, לפי דרגת הוודאות: מה שבקופה, מה שמגובה
                    בהוראת קבע חתומה, ומה שנשען על הבטחה בעל פה בלבד. */}
                <div className="h-2.5 bg-white/10 rounded-full overflow-hidden mb-2 flex">
                  <div className="h-full bg-emerald-400" title="נכנס בפועל"
                       style={{ width: `${Math.min(100, (prog.raised / prog.goal) * 100)}%` }} />
                  <div className="h-full bg-[#C9A84C]" title="מגובה בהוראת קבע"
                       style={{ width: `${Math.min(100, (prog.hkOutstanding / prog.goal) * 100)}%` }} />
                  <div className="h-full bg-amber-300/40" title="הבטחה בעל פה"
                       style={{ width: `${Math.min(100, (prog.pledgeOutstanding / prog.goal) * 100)}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-white/55">
                  <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />נכנס ₪{prog.raised.toLocaleString()}</span>
                  {prog.hkOutstanding > 0 && (
                    <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] inline-block" />הו״ק ₪{prog.hkOutstanding.toLocaleString()}</span>
                  )}
                  {prog.pledgeOutstanding > 0 && (
                    <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-amber-300/60 inline-block" />הבטחות ₪{prog.pledgeOutstanding.toLocaleString()}</span>
                  )}
                </div>
                <div className="flex justify-between text-[11px] text-white/50 mt-1.5 pt-1.5 border-t border-white/10">
                  <span><b className="text-white/80">{prog.percent}%</b> מהיעד · מתוכם {Math.round((prog.secured / prog.goal) * 100)}% מובטחים</span>
                  <span>חסר ₪{prog.gap.toLocaleString()}</span>
                </div>
              </>
            )}
            {prog.pledged > 0 && (
              <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-amber-300">
                הובטח ועדיין לא שולם: ₪{prog.pledged.toLocaleString()}
              </div>
            )}
          </div>

          {/* פרטים */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Field label="יעד ₪">
              <input type="number" value={project.goal ?? ''} onChange={e => onPatch({ goal: e.target.value })}
                     className="w-full border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#C9A84C]" />
            </Field>
            <Field label="תאריך יעד">
              <input type="date" value={project.deadline || ''} onChange={e => onPatch({ deadline: e.target.value })}
                     className="w-full border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#C9A84C]" />
            </Field>
            <Field label="סוג">
              <select value={project.kind} onChange={e => onPatch({ kind: e.target.value as any })}
                      className="w-full border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#C9A84C]">
                <option value="project">פרויקט</option>
                <option value="campaign">קמפיין כללי</option>
              </select>
            </Field>
          </div>

          <div className="mt-2">
            <Field label="ייעוד התרומות" hint="הטקסט שנרשם בשדה הייעוד. תרומות עם הייעוד הזה נספרות לפרויקט אוטומטית.">
              <input value={project.purposeTag} onChange={e => onPatch({ purposeTag: e.target.value })}
                     className="w-full border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#C9A84C]" />
            </Field>
          </div>

          <div className="flex gap-2 mt-3">
            <TabBtn active={pane === 'raise'} onClick={() => setPane('raise')} icon={<Users size={14} />} label={`התרמה (${sols.length})`} />
            <TabBtn active={pane === 'budget'} onClick={() => setPane('budget')} icon={<Wallet size={14} />} label="תקציב" />
          </div>
        </div>

        <div className="pt-4">
          {pane === 'budget' ? (
            <BudgetEditor budget={project.budget || emptyBudget()} onChange={b => onPatch({ budget: b })} />
          ) : (
            <div className="space-y-3">
              {/* הוספת אנשים */}
              <div className="bg-white rounded-xl border border-[#EDE6D6] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Search size={14} className="text-gray-400" />
                  <input
                    value={addPersonSearch} onChange={e => setAddPersonSearch(e.target.value)}
                    placeholder="הוסף אנשים לרשימת ההתרמה"
                    className="flex-1 text-sm outline-none bg-transparent"
                  />
                </div>
                {addPersonSearch && (
                  <div className="flex flex-wrap gap-1.5">
                    {candidates.length === 0
                      ? <span className="text-xs text-gray-400">אין התאמות</span>
                      : candidates.map(n => (
                        <button key={n} onClick={() => addPerson(n)}
                                className="text-xs bg-[#C9A84C]/10 text-[#9B7A2F] px-2.5 py-1 rounded-lg font-medium">
                          + {n}
                        </button>
                      ))}
                  </div>
                )}

                {!addPersonSearch && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button onClick={() => addMany(gaveLastYear)}
                      className="text-xs font-bold bg-[#0D1B2A] text-[#C9A84C] px-2.5 py-1.5 rounded-lg">
                      + כל מי שתרם השנה ({gaveLastYear.filter(n => !sols.some(s => s.name === n)).length})
                    </button>
                    <button onClick={() => addMany(donorNames)}
                      className="text-xs font-bold bg-white border border-[#EDE6D6] text-gray-600 px-2.5 py-1.5 rounded-lg">
                      + כל אנשי הקשר ({donorNames.filter(n => !sols.some(s => s.name === n)).length})
                    </button>
                  </div>
                )}
              </div>

              {/* האם הרשימה בכלל מכסה את היעד */}
              {sols.length > 0 && (
                <div className="bg-white rounded-xl border border-[#EDE6D6] p-3 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">סה"כ מבוקש מהרשימה</div>
                    <div className="font-['Frank_Ruhl_Libre'] font-bold text-lg text-[#0D1B2A]">
                      ₪{askSum.toLocaleString()}
                    </div>
                  </div>
                  {Number(project.goal) > 0 && (
                    <div className={`text-xs font-bold px-2.5 py-1.5 rounded-lg ${
                      askSum >= Number(project.goal) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {askSum >= Number(project.goal)
                        ? 'הרשימה מכסה את היעד'
                        : `חסר ₪${(Number(project.goal) - askSum).toLocaleString()} ברשימה`}
                    </div>
                  )}
                </div>
              )}

              {/* ── סיכום הרשימה ────────────────────────────────────
                  ארבעה מספרים שעונים על ארבע שאלות שונות. "נכנס" הוא מה
                  שבקופה; "צפוי" הוא יתרת הוראות הקבע וההבטחות; "סה״כ" הוא
                  מה שנמדד מול היעד. */}
              {rows.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {([
                    { key: 'ask' as const, value: totals.ask, tone: 'text-[#0D1B2A]' },
                    { key: 'pledged' as const, value: totals.pledged, tone: 'text-indigo-700' },
                    { key: 'raised' as const, value: totals.raised, tone: 'text-emerald-700' },
                    { key: 'hkOutstanding' as const, value: totals.hkOutstanding, tone: 'text-[#9B7A2F]' },
                    { key: 'pledgeOutstanding' as const, value: totals.pledgeOutstanding, tone: 'text-amber-700' },
                    { key: 'committed' as const, value: totals.committed, tone: 'text-[#9B7A2F]' },
                  ]).map(x => (
                    /* כל מספר נפתח לרשימת מה שהרכיב אותו. מספר שאי אפשר
                       לפתוח הוא בקשה לסמוך, וברגע שהוא לא מסתדר עם מה
                       שזכרת — מפסיקים להסתכל עליו. */
                    <button
                      key={x.key}
                      onClick={() => setBreakdown(x.key)}
                      className="bg-white rounded-xl border border-[#EDE6D6] px-3 py-2 text-right hover:border-[#C9A84C] transition-colors"
                    >
                      <div className="text-[10px] text-gray-400 font-bold truncate">{BREAKDOWN_LABEL[x.key]}</div>
                      <div className={`font-['Frank_Ruhl_Libre'] text-lg font-bold ${x.tone}`}>₪{x.value.toLocaleString()}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* ברשימה של מאתיים שמות, גלילה אינה חיפוש */}
              {rows.length > 8 && (
                <div className="relative">
                  <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={rowSearch}
                    onChange={e => setRowSearch(e.target.value)}
                    placeholder={`חיפוש בין ${rows.length} השמות ברשימה...`}
                    className="w-full bg-white border border-[#EDE6D6] rounded-xl py-2 pr-9 pl-3 text-sm outline-none focus:border-[#C9A84C]"
                  />
                  {rowSearch && (
                    <button onClick={() => setRowSearch('')}
                            className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* מסנן לפי סטטוס — עבודה אמיתית היא "מי נשאר לחזור אליו" */}
              {rows.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                      statusFilter === 'all' ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]' : 'bg-white text-gray-500 border-[#EDE6D6]'
                    }`}
                  >
                    הכל ({rows.length})
                  </button>
                  {SOLICITATION_ORDER.filter(st => totals.counts[st] > 0).map(st => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                        statusFilter === st ? 'bg-[#0D1B2A] text-[#C9A84C] border-[#0D1B2A]' : SOLICITATION_COLOR[st]
                      }`}
                    >
                      {SOLICITATION_LABEL[st]} ({totals.counts[st]})
                    </button>
                  ))}
                </div>
              )}

              {rows.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6 leading-relaxed">
                  רשימת ההתרמה ריקה.<br />הוסף את מי שאתה מתכוון לפנות אליו, ועקוב אחרי מי הבטיח ומי כבר נתן.
                </p>
              ) : shownRows.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  אין תוצאות ל"{rowSearch}"{statusFilter !== 'all' ? ` בסטטוס "${SOLICITATION_LABEL[statusFilter]}"` : ''}.
                </p>
              ) : (
                <div className="bg-white rounded-xl border border-[#EDE6D6] divide-y divide-[#EDE6D6]">
                  {shownRows.map(row => {
                    const i = rows.indexOf(row);
                    const s = row.sol;
                    const g = row.history;
                    const unlinked = unlinkedHkFor(s, project, hk);
                    return (
                      <div key={s.name + i} className="px-3 py-2.5">
                        {/* שורה ראשונה: שם, סטטוס, מחיקה */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-[#0D1B2A] truncate">{s.name}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <select
                              value={row.status}
                              onChange={e => setSol(i, { status: e.target.value as SolicitationStatus })}
                              className={`text-xs font-bold rounded-lg px-2 py-1 outline-none border ${SOLICITATION_COLOR[row.status]}`}
                            >
                              {SOLICITATION_ORDER.map(o => <option key={o} value={o}>{SOLICITATION_LABEL[o]}</option>)}
                            </select>
                            <button onClick={() => setOpenNotes(openNotes === i ? null : i)}
                                    title="הערות"
                                    className={`p-1 ${s.notes ? 'text-[#9B7A2F]' : 'text-gray-300 hover:text-gray-500'}`}>
                              <MessageSquare size={13} />
                            </button>
                            <button onClick={() => onPatch({ solicitations: sols.filter((_, x) => x !== i) })}
                                    className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                          </div>
                        </div>

                        {/* שורה שנייה: הכסף */}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <label className="flex items-center gap-1 text-[11px] text-gray-500">
                            לבקש
                            <input
                              type="number" value={s.ask ?? ''} placeholder="₪"
                              onChange={e => setSol(i, { ask: e.target.value })}
                              className="w-[72px] border border-[#EDE6D6] rounded-lg px-2 py-1 text-xs outline-none focus:border-[#C9A84C]"
                            />
                          </label>

                          {/* ההבטחה — תמיד ניתנת לעריכה, גם כשיש הוראת קבע */}
                          <label className="flex items-center gap-1 text-[11px] text-gray-500">
                            הבטיח
                            <input
                              type="number" value={s.pledged ?? ''} placeholder="₪"
                              onChange={e => setSol(i, { pledged: e.target.value, pledgedDate: s.pledgedDate || new Date().toLocaleDateString('he-IL') })}
                              className="w-[72px] border border-amber-200 bg-amber-50/50 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#C9A84C]"
                            />
                          </label>

                          {row.raised > 0 && (
                            <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-2 py-1 font-bold">
                              נכנס ₪{row.raised.toLocaleString()}
                            </span>
                          )}
                          {row.pledgeRemaining > 0 && (
                            <span className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-2 py-1">
                              נותר מההבטחה ₪{row.pledgeRemaining.toLocaleString()}
                            </span>
                          )}
                          {row.pledge > 0 && row.pledgeRemaining === 0 && (
                            <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-2 py-1">
                              ✓ עמד בהבטחה
                            </span>
                          )}

                          {/* הוראת קבע = התחייבות מלאה, ולא רק מה שנגבה עד היום */}
                          {row.commitments.map(c => (
                            <span key={c.id}
                              title={`${c.paid} מתוך ${c.payments} חיובים נגבו`}
                              className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg pr-2 pl-1 py-1 inline-flex items-center gap-1.5">
                              🔄 ₪{c.monthly.toLocaleString()}×{c.unlimited ? `${c.payments} (ללא הגבלה)` : c.payments}
                              {' = '}<b>₪{c.total.toLocaleString()}</b>
                              {c.outstanding > 0 && <span className="opacity-70"> · נותרו ₪{c.outstanding.toLocaleString()}</span>}
                              {c.nextCharge && <span className="opacity-70"> · הבא {c.nextCharge}</span>}
                              <button
                                title="ההוראה הזו אינה שייכת לקמפיין"
                                onClick={() => setSol(i, {
                                  excludedHkIds: [...(s.excludedHkIds || []), c.id],
                                  hkIds: explicitHkIds(s).filter(x => x !== c.id),
                                  hkId: s.hkId === c.id ? undefined : s.hkId,
                                })}
                                className="text-indigo-400 hover:text-red-500"
                              ><X size={11} /></button>
                            </span>
                          ))}

                        </div>

                        {/* ── התשלומים שנספרים לשורה הזו ─────────────────
                            כל אחד עם ✕ להסרה: תשלום על סיור סליחות אינו
                            הקמפיין, גם אם הוא מאותו אדם ובאותו חודש. */}
                        {row.donations.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {row.donations.map(d => (
                              <span key={d.id}
                                className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg pr-2 pl-1 py-1 flex items-center gap-1.5">
                                ₪{d.amount.toLocaleString()} · {d.date}{d.method ? ` · ${d.method}` : ''}
                                {!d.auto && <span className="opacity-60">(צורף ידנית)</span>}
                                <button
                                  title="לא שייך לקמפיין הזה"
                                  onClick={() => setSol(i, {
                                    excludedDonationIds: [...(s.excludedDonationIds || []), d.id],
                                    includedDonationIds: (s.includedDonationIds || []).filter(x => x !== d.id),
                                  })}
                                  className="text-emerald-600/50 hover:text-red-500"
                                ><X size={11} /></button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* תשלומים של אותו אדם שלא סומנו לקמפיין — הצעה לצרף */}
                        {row.candidates.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {row.candidates.map(d => (
                              <button key={d.id}
                                title={d.purpose ? `ייעוד: ${d.purpose}` : 'בלי ייעוד'}
                                onClick={() => setSol(i, {
                                  includedDonationIds: [...(s.includedDonationIds || []), d.id],
                                  excludedDonationIds: (s.excludedDonationIds || []).filter(x => x !== d.id),
                                })}
                                className="text-[10px] bg-white text-gray-500 border border-dashed border-gray-300 rounded-lg px-2 py-1 hover:border-[#C9A84C] hover:text-[#9B7A2F]">
                                + ₪{d.amount.toLocaleString()} · {d.date}{d.purpose ? ` · ${d.purpose}` : ''}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* אין הו״ק לקמפיין — פתיחת אחת בלחיצה, עם השם
                            והקמפיין כבר ממולאים */}
                        {row.commitments.length === 0 && (
                          <button
                            onClick={() => setHkForRow(i)}
                            className="mt-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1 hover:bg-indigo-100"
                          >
                            🔄 + פתח הוראת קבע לקמפיין
                          </button>
                        )}

                        {/* ── הוראות קבע שקיימות בגיליון ואינן משויכות ────
                            רוב ההוראות מגיעות במייל בלי קטגוריה שתואמת את
                            שם הקמפיין, ולכן צריך לצרף אותן בלחיצה. מוצג גם
                            כשכבר יש הוראה משויכת — לתורם יכולות להיות כמה. */}
                        {unlinked.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            {unlinked.map(h => (
                              <button
                                key={h.id}
                                title={`מהגיליון · ${h.startDate || ''}${h.campaign ? ` · ${h.campaign}` : ''}`}
                                onClick={() => setSol(i, {
                                  hkIds: [...explicitHkIds(s), String(h.id)],
                                  excludedHkIds: (s.excludedHkIds || []).filter(x => x !== String(h.id)),
                                })}
                                className="text-[10px] bg-white text-indigo-700 border border-dashed border-indigo-300 rounded-lg px-2 py-1 hover:bg-indigo-50"
                              >
                                + צרף הו״ק ₪{Number(h.amount).toLocaleString()}
                                {h.unlimited ? ' (ללא הגבלה)' : `×${h.payments}`}
                                {!h.active && ' · הסתיימה'}
                              </button>
                            ))}
                          </div>
                        )}
                        {((s.excludedDonationIds?.length || 0) + (s.excludedHkIds?.length || 0)) > 0 && (
                          <button
                            onClick={() => setSol(i, { excludedDonationIds: [], excludedHkIds: [] })}
                            className="text-[10px] text-gray-400 hover:text-[#9B7A2F] mt-1"
                          >
                            ↺ החזר {(s.excludedDonationIds?.length || 0) + (s.excludedHkIds?.length || 0)} פריטים שהוסרו
                          </button>
                        )}

                        {/* היסטוריית נתינה — כדי לדעת אם הבקשה סבירה */}
                        <div className="text-[11px] text-gray-500 mt-1">
                          {!g ? 'לא תרם מעולם' : (
                            <>
                              שנה אחרונה <b className="text-[#0D1B2A]">₪{g.lastYear.toLocaleString()}</b>
                              {' · '}מאז ומעולם <b className="text-[#0D1B2A]">₪{g.allTime.toLocaleString()}</b>
                            </>
                          )}
                          {crm[s.name]?.phone && <span className="text-gray-400"> · {crm[s.name].phone}</span>}
                        </div>

                        {(openNotes === i || s.notes) && (
                          <input
                            value={s.notes ?? ''}
                            onChange={e => setSol(i, { notes: e.target.value })}
                            placeholder="הערה — למשל: לחזור בחודש 9, מעדיף שהרב יתקשר"
                            className="w-full mt-1.5 border border-[#EDE6D6] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#C9A84C]"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* התרומות שנכנסו */}
              {linked.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 mb-1.5">התרומות שנכנסו · {linked.length}</h4>
                  <div className="bg-white rounded-xl border border-[#EDE6D6] divide-y divide-[#EDE6D6]">
                    {linked.slice(0, 30).map((d, i) => (
                      <div key={i} className="px-3 py-2 flex justify-between text-sm">
                        <span className="text-[#0D1B2A] truncate">{d.name}</span>
                        <span className="text-emerald-700 font-bold shrink-0">₪{Number(d.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-[#EDE6D6] flex gap-2">
          <button
            onClick={() => onPatch({ status: project.status === 'closed' ? 'active' : 'closed' })}
            className="flex-1 py-2.5 rounded-xl bg-[#0D1B2A] text-white text-sm font-bold flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 size={15} /> {project.status === 'closed' ? 'פתח מחדש' : 'סגור פרויקט'}
          </button>
          <button onClick={onDelete} className="px-4 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-bold">מחק</button>
        </div>

        {breakdown && (
          <BreakdownModal
            metric={breakdown}
            rows={rows}
            onClose={() => setBreakdown(null)}
          />
        )}

        {hkForRow !== null && sols[hkForRow] && (
          <AddHkDialog
            presetName={sols[hkForRow].name}
            presetCampaign={project.purposeTag || project.name}
            onCreated={id => setSol(hkForRow, { hkIds: [...explicitHkIds(sols[hkForRow]), id] })}
            onClose={() => setHkForRow(null)}
          />
        )}
      </>
    </FullScreenView>
  );
}

/**
 * הפירוט שמאחורי מספר אחד בראש הרשימה.
 *
 * מסודר לפי סכום יורד ולא לפי שם: השאלה הראשונה כשפותחים מספר היא "ממי
 * מגיע רובו", ולא "מי כאן לפי אלף-בית".
 */
function BreakdownModal({ metric, rows, onClose }: {
  metric: BreakdownMetric;
  rows: SolicitationRow[];
  onClose: () => void;
}) {
  const items = React.useMemo(() => breakdownFor(rows, metric), [rows, metric]);
  const total = items.reduce((t, x) => t + x.amount, 0);
  const [q, setQ] = React.useState('');
  const shown = q.trim()
    ? items.filter(x => x.name.toLowerCase().includes(q.trim().toLowerCase()))
    : items;

  const icon: Record<string, string> = { donation: '💰', hk: '🔄', pledge: '🤝', ask: '🎯' };

  return (
    <div className="fixed inset-0 bg-black/60 z-[210] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm"
         onClick={e => e.target === e.currentTarget && onClose()} dir="rtl">
      <div className="bg-[#FAF6EE] rounded-t-3xl md:rounded-3xl p-5 pb-8 w-full max-w-[520px] max-h-[88vh] flex flex-col">
        <div className="flex justify-between items-start gap-2 mb-1 shrink-0">
          <div className="min-w-0">
            <h2 className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#0D1B2A]">{BREAKDOWN_LABEL[metric]}</h2>
            <p className="text-[11px] text-gray-400">{BREAKDOWN_HINT[metric]}</p>
          </div>
          <button onClick={onClose} className="bg-gray-200/50 p-2 rounded-full text-gray-500 shrink-0"><X size={16} /></button>
        </div>

        <div className="flex items-baseline justify-between gap-2 bg-white rounded-xl border border-[#EDE6D6] px-3 py-2 my-3 shrink-0">
          <span className="text-xs text-gray-500">{items.length} רשומות</span>
          <span className="font-['Frank_Ruhl_Libre'] text-xl font-bold text-[#9B7A2F]">₪{total.toLocaleString()}</span>
        </div>

        {items.length > 8 && (
          <div className="relative mb-2 shrink-0">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש שם..."
                   className="w-full bg-white border border-[#EDE6D6] rounded-lg py-1.5 pr-8 pl-3 text-sm outline-none focus:border-[#C9A84C]" />
          </div>
        )}

        {shown.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">אין כאן כלום עדיין.</p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {shown.map((x, i) => (
              <div key={x.name + i} className="bg-white rounded-xl border border-[#EDE6D6] px-3 py-2 flex items-center gap-2.5">
                <span className="text-base shrink-0">{icon[x.kind]}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[#0D1B2A] truncate">{x.name}</div>
                  <div className="text-[11px] text-gray-400 truncate">{x.detail}</div>
                </div>
                <span className="font-['Frank_Ruhl_Libre'] font-bold text-[#0D1B2A] shrink-0">
                  ₪{x.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose} className="w-full bg-[#0D1B2A] text-[#E8C97A] py-2.5 rounded-xl font-bold text-sm mt-3 shrink-0">
          סגור
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-500 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">{hint}</p>}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${
        active ? 'bg-[#0D1B2A] text-[#C9A84C]' : 'bg-white text-gray-500 border border-[#EDE6D6]'
      }`}
    >
      {icon} {label}
    </button>
  );
}
