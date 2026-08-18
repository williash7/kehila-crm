import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/AppContext';
import { Plus, X, Target, Wallet, Users, Trash2, Search, CheckCircle2 } from 'lucide-react';
import { FullScreenView } from './FullScreenView';
import { BudgetEditor, emptyBudget } from './BudgetEditor';
import {
  Project, Solicitation, SolicitationStatus, emptyProject, projectProgress,
  projectDonations, syncSolicitationsWithDonations, buildGivingIndex, suggestedAsk, totalAsk,
  SOLICITATION_LABEL, SOLICITATION_COLOR, SOLICITATION_ORDER,
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
  const { projects, updateProjects, donations, visibleDonors, crm } = useAppStore();

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
          const prog = projectProgress(p, donations);
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
                {prog.pledged > 0 && <span className="text-amber-700">הובטח ₪{prog.pledged.toLocaleString()}</span>}
                {prog.counts.todo > 0 && <span>{prog.counts.todo} עוד לא פנית</span>}
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

function ProjectDetail({ project, donations, donorNames, crm, pane, setPane, addPersonSearch, setAddPersonSearch, onPatch, onDelete, onClose }: {
  project: Project;
  donations: any[];
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
  const prog = useMemo(() => projectProgress(project, donations), [project, donations]);
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
    onPatch({ solicitations: [...sols, { name, status: 'todo', ask: suggestedAsk(giving[name]) || '' }] });
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
        ...fresh.map(name => ({ name, status: 'todo' as SolicitationStatus, ask: suggestedAsk(giving[name]) || '' })),
      ],
    });
  };

  const gaveLastYear = donorNames.filter(n => (giving[n]?.lastYear || 0) > 0);
  const askSum = totalAsk(sols);

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
                <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-[#C9A84C] rounded-full" style={{ width: `${prog.percent}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-white/50">
                  <span>{prog.percent}% מהיעד</span>
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

              {sols.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6 leading-relaxed">
                  רשימת ההתרמה ריקה.<br />הוסף את מי שאתה מתכוון לפנות אליו, ועקוב אחרי מי הבטיח ומי כבר נתן.
                </p>
              ) : (
                SOLICITATION_ORDER.filter(st => sols.some(s => (s.status || 'todo') === st)).map(st => (
                  <div key={st}>
                    <h4 className="text-xs font-bold text-gray-500 mb-1.5">
                      {SOLICITATION_LABEL[st]} · {sols.filter(s => (s.status || 'todo') === st).length}
                    </h4>
                    <div className="bg-white rounded-xl border border-[#EDE6D6] divide-y divide-[#EDE6D6]">
                      {sols.map((s, i) => (s.status || 'todo') !== st ? null : (
                        <div key={s.name + i} className="px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-[#0D1B2A] truncate">{s.name}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {s.status === 'pledged' && (
                                <input
                                  type="number" value={s.pledged ?? ''} placeholder="הבטיח"
                                  onChange={e => setSol(i, { pledged: e.target.value })}
                                  className="w-[68px] border border-amber-200 bg-amber-50 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#C9A84C]"
                                />
                              )}
                              <select
                                value={s.status || 'todo'}
                                onChange={e => setSol(i, { status: e.target.value as SolicitationStatus })}
                                className={`text-xs font-bold rounded-lg px-2 py-1 outline-none border-0 ${SOLICITATION_COLOR[s.status || 'todo']}`}
                              >
                                {SOLICITATION_ORDER.map(o => <option key={o} value={o}>{SOLICITATION_LABEL[o]}</option>)}
                              </select>
                              <button onClick={() => onPatch({ solicitations: sols.filter((_, x) => x !== i) })}
                                      className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                            </div>
                          </div>

                          {/* כמה לבקש, ומול מה — בלי זה השורה היא שם ותו לא */}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <label className="flex items-center gap-1 text-[11px] text-gray-500">
                              לבקש
                              <input
                                type="number" value={s.ask ?? ''} placeholder="₪"
                                onChange={e => setSol(i, { ask: e.target.value })}
                                className="w-[68px] border border-[#EDE6D6] rounded-lg px-2 py-1 text-xs outline-none focus:border-[#C9A84C]"
                              />
                            </label>
                            {(() => {
                              const g = giving[s.name];
                              if (!g) return <span className="text-[11px] text-gray-400">לא תרם מעולם</span>;
                              return (
                                <span className="text-[11px] text-gray-500">
                                  שנה אחרונה <b className="text-[#0D1B2A]">₪{g.lastYear.toLocaleString()}</b>
                                  {' · '}מאז ומעולם <b className="text-[#0D1B2A]">₪{g.allTime.toLocaleString()}</b>
                                  {g.toProject > 0 && <> · <b className="text-emerald-700">₪{g.toProject.toLocaleString()} לפרויקט</b></>}
                                </span>
                              );
                            })()}
                          </div>

                          {crm[s.name]?.phone && <div className="text-[11px] text-gray-400 mt-0.5">{crm[s.name].phone}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
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
      </>
    </FullScreenView>
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
