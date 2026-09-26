import { readFileSync, writeFileSync } from 'node:fs';

function patchFile(path, replacements) {
  let text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  for (const { label, from, to } of replacements) {
    const count = text.split(from).length - 1;
    if (count !== 1) throw new Error(`${path}: expected exactly one match for ${label}, found ${count}`);
    text = text.replace(from, to);
  }
  writeFileSync(path, text);
}

patchFile('src/lib/tasks.ts', [
  {
    label: 'event reminder carries event time',
    from: `export function createEventReminderTask(eventName: string, occurrenceDateISO: string): TaskItem {\n  return stampCreated({ text: \`🔔 מחר — \${eventName}\`, done: false, kind: 'eventReminder' as const, dueDate: occurrenceDateISO });\n}`,
    to: `export function createEventReminderTask(eventName: string, occurrenceDateISO: string, occurrenceTime?: string): TaskItem {\n  return stampCreated({\n    text: \`🔔 מחר — \${eventName}\`,\n    done: false,\n    kind: 'eventReminder' as const,\n    dueDate: occurrenceDateISO,\n    ...(occurrenceTime ? { time: occurrenceTime } : {}),\n  });\n}`,
  },
]);

patchFile('src/lib/eventAutoTasks.ts', [
  {
    label: 'event reminder result type',
    from: `): { id: string; name: string; occurrenceDateISO: string }[] {\n  const result: { id: string; name: string; occurrenceDateISO: string }[] = [];`,
    to: `): { id: string; name: string; occurrenceDateISO: string; occurrenceTime?: string }[] {\n  const result: { id: string; name: string; occurrenceDateISO: string; occurrenceTime?: string }[] = [];`,
  },
  {
    label: 'event reminder result time',
    from: `    if (!exists) result.push({ id: ev.id, name: ev.name, occurrenceDateISO });`,
    to: `    if (!exists) result.push({ id: ev.id, name: ev.name, occurrenceDateISO, occurrenceTime: ev.time || undefined });`,
  },
]);

patchFile('src/store/AppContext.tsx', [
  {
    label: 'create event reminder with time',
    from: `        return { ...ev, tasks: [...(ev.tasks || []), createEventReminderTask(m.name, m.occurrenceDateISO)] };`,
    to: `        return { ...ev, tasks: [...(ev.tasks || []), createEventReminderTask(m.name, m.occurrenceDateISO, m.occurrenceTime)] };`,
  },
]);

patchFile('src/lib/activities.ts', [
  {
    label: 'backfill reminder time from activity',
    from: `    tasks: raw?.tasks || [],`,
    to: `    // תזכורת אוטומטית של פעילות סופרת עד שעת הפעילות, לא עד 00:00.\n    // כך גם תזכורות ישנות שנוצרו לפני שנשמרה בהן שעה מקבלות את השעה מההורה.\n    tasks: (raw?.tasks || []).map((task: any) =>\n      task?.kind === 'eventReminder' && !task.time && raw?.time\n        ? { ...task, time: String(raw.time) }\n        : task\n    ),`,
  },
]);

patchFile('src/components/TasksTab.tsx', [
  {
    label: 'flat row metadata type',
    from: `  const flatRows: { key: string; date: Date | null; priorityObj: any; node: React.ReactNode }[] = [];`,
    to: `  type FlatCollapseCategory = 'holidays' | 'events' | 'campaigns' | 'homevisits';\n  type FlatRow = {\n    key: string;\n    date: Date | null;\n    priorityObj: any;\n    node: React.ReactNode;\n    collapseKey?: string;\n    collapseLabel?: string;\n    collapseCategory?: FlatCollapseCategory;\n    groupOpen?: () => void;\n  };\n  const flatRows: FlatRow[] = [];`,
  },
  {
    label: 'holiday flat metadata',
    from: `        key: \`h-\${g.id}-\${idx}\`,\n        date,\n        priorityObj: t,`,
    to: `        key: \`h-\${g.id}-\${idx}\`,\n        date,\n        priorityObj: t,\n        collapseKey: \`h-\${g.id}\`,\n        collapseLabel: \`🗓️ \${g.id}\`,\n        collapseCategory: 'holidays',\n        groupOpen: () => openHolidayFull(g.id),`,
  },
  {
    label: 'holiday flat remove repeated breadcrumb',
    from: `          <div key={\`h-\${g.id}-\${idx}\`}>\n            <button onClick={() => openHolidayFull(g.id)} className="text-[10px] text-[#9B7A2F] font-bold mb-1 hover:underline flex items-center gap-1">\n              🗓️ {g.id} <ChevronLeft size={10} />\n            </button>\n            {renderTaskItem(t, () => toggleHolidayTask(g.id, idx), () => deleteHolidayTask(g.id, idx), p => toggleHolidayInvitePerson(g.id, idx, p), patch => patchHolidayTask(g.id, idx, patch), holidayExtraFor(g.id, idx, t))}\n          </div>`,
    to: `          <div key={\`h-\${g.id}-\${idx}\`}>\n            {renderTaskItem(t, () => toggleHolidayTask(g.id, idx), () => deleteHolidayTask(g.id, idx), p => toggleHolidayInvitePerson(g.id, idx, p), patch => patchHolidayTask(g.id, idx, patch), holidayExtraFor(g.id, idx, t))}\n          </div>`,
  },
  {
    label: 'event flat metadata',
    from: `        key: \`e-\${g.id}-\${idx}\`,\n        date,\n        priorityObj: t,`,
    to: `        key: \`e-\${g.id}-\${idx}\`,\n        date,\n        priorityObj: t,\n        collapseKey: \`e-\${g.id}\`,\n        collapseLabel: \`📅 \${g.name}\`,\n        collapseCategory: 'events',\n        groupOpen: () => setTab('events'),`,
  },
  {
    label: 'event flat remove repeated breadcrumb',
    from: `          <div key={\`e-\${g.id}-\${idx}\`}>\n            <button onClick={() => setTab('events')} className="text-[10px] text-[#9B7A2F] font-bold mb-1 hover:underline flex items-center gap-1">\n              📅 {g.name} <ChevronLeft size={10} />\n            </button>\n            {renderTaskItem(t, () => toggleEventTask(g.id, idx), () => deleteEventTask(g.id, idx), p => toggleEventInvitePerson(g.id, idx, p), patch => patchEventTask(g.id, idx, patch))}\n          </div>`,
    to: `          <div key={\`e-\${g.id}-\${idx}\`}>\n            {renderTaskItem(t, () => toggleEventTask(g.id, idx), () => deleteEventTask(g.id, idx), p => toggleEventInvitePerson(g.id, idx, p), patch => patchEventTask(g.id, idx, patch))}\n          </div>`,
  },
  {
    label: 'campaign flat metadata',
    from: `        key: \`c-\${group.id}-\${idx}\`,\n        date,\n        priorityObj: t,`,
    to: `        key: \`c-\${group.id}-\${idx}\`,\n        date,\n        priorityObj: t,\n        collapseKey: \`c-\${group.id}\`,\n        collapseLabel: \`🎯 \${group.name}\`,\n        collapseCategory: 'campaigns',\n        groupOpen: () => setTab('projects'),`,
  },
  {
    label: 'campaign flat remove repeated breadcrumb',
    from: `          <div key={\`c-\${group.id}-\${idx}\`}>\n            <button onClick={() => setTab('projects')} className="text-[10px] text-[#9B7A2F] font-bold mb-1 hover:underline flex items-center gap-1">\n              🎯 {group.name} <ChevronLeft size={10} />\n            </button>\n            {renderTaskItem(t, () => toggleCampaignTask(group.id, idx), () => deleteCampaignTask(group.id, idx), () => {}, patch => patchCampaignTask(group.id, idx, patch))}\n          </div>`,
    to: `          <div key={\`c-\${group.id}-\${idx}\`}>\n            {renderTaskItem(t, () => toggleCampaignTask(group.id, idx), () => deleteCampaignTask(group.id, idx), () => {}, patch => patchCampaignTask(group.id, idx, patch))}\n          </div>`,
  },
  {
    label: 'prep flat metadata',
    from: `      key: \`prep-\${pt.roundId}-\${pt.idx}\`,\n      date: null,\n      priorityObj: {},`,
    to: `      key: \`prep-\${pt.roundId}-\${pt.idx}\`,\n      date: null,\n      priorityObj: {},\n      collapseKey: 'hv-tasks',\n      collapseLabel: '🏠 ביקורי בית',\n      collapseCategory: 'homevisits',\n      groupOpen: () => setTab('homevisits'),`,
  },
  {
    label: 'prep remove repeated breadcrumb',
    from: `        <div key={\`prep-\${pt.roundId}-\${pt.idx}\`}>\n          <div className="text-[10px] text-[#9B7A2F] font-bold mb-1">🏠 הכנה לביקורי בית{pt.purpose ? \` — \${pt.purpose}\` : ''}</div>\n          <div className="bg-[#FAF6EE] rounded-xl p-3 shadow-sm border border-[#EDE6D6] flex items-center gap-3">`,
    to: `        <div key={\`prep-\${pt.roundId}-\${pt.idx}\`}>\n          <div className="bg-[#FAF6EE] rounded-xl p-3 shadow-sm border border-[#EDE6D6] flex items-center gap-3">`,
  },
  {
    label: 'standalone flat metadata',
    from: `      key: \`s-\${idx}\`,\n      date,\n      priorityObj: t,`,
    to: `      key: \`s-\${idx}\`,\n      date,\n      priorityObj: t,\n      collapseKey: t.kind === 'homeVisit' ? 'hv-tasks' : undefined,\n      collapseLabel: t.kind === 'homeVisit' ? '🏠 ביקורי בית' : undefined,\n      collapseCategory: t.kind === 'homeVisit' ? 'homevisits' : undefined,\n      groupOpen: t.kind === 'homeVisit' ? () => setTab('homevisits') : undefined,`,
  },
  {
    label: 'home visit remove repeated breadcrumb',
    from: `          <div className="text-[10px] text-[#9B7A2F] font-bold mb-1">{t.kind === 'homeVisit' ? '🏠 ביקור בית' : '📌 חד-פעמית'}</div>`,
    to: `          {t.kind !== 'homeVisit' && <div className="text-[10px] text-[#9B7A2F] font-bold mb-1">📌 חד-פעמית</div>}`,
  },
  {
    label: 'build collapsible flat groups',
    from: `  flatRows.sort((a, b) => compareTasks(a.priorityObj, b.priorityObj, sortKey, a.date, b.date));`,
    to: `  flatRows.sort((a, b) => compareTasks(a.priorityObj, b.priorityObj, sortKey, a.date, b.date));\n\n  // גם ב״רשימה אחת״ מקבצים משימות מאותו מקור תחת כותרת אחת מתקפלת.\n  // סדר הקבוצות נקבע לפי המשימה הראשונה שלהן אחרי המיון, כך שמיון לפי זמן/דחיפות\n  // עדיין קובע מה עולה למעלה — בלי לחזור על ״שמיני עצרת״ לפני כל כרטיס בנפרד.\n  type FlatDisplayGroup = {\n    key: string;\n    collapseKey?: string;\n    label?: string;\n    category?: FlatCollapseCategory;\n    groupOpen?: () => void;\n    rows: FlatRow[];\n  };\n  const flatDisplayGroups: FlatDisplayGroup[] = [];\n  const flatDisplayMap = new Map<string, FlatDisplayGroup>();\n  flatRows.forEach(row => {\n    const key = row.collapseKey || \`row-\${row.key}\`;\n    let group = flatDisplayMap.get(key);\n    if (!group) {\n      group = { key, collapseKey: row.collapseKey, label: row.collapseLabel, category: row.collapseCategory, groupOpen: row.groupOpen, rows: [] };\n      flatDisplayMap.set(key, group);\n      flatDisplayGroups.push(group);\n    }\n    group.rows.push(row);\n  });\n\n  const flatHolidayKeys = Array.from(new Set(flatRows.filter(r => r.collapseCategory === 'holidays' && r.collapseKey).map(r => r.collapseKey!)));\n  const flatHomeVisitKeys = Array.from(new Set(flatRows.filter(r => r.collapseCategory === 'homevisits' && r.collapseKey).map(r => r.collapseKey!)));\n  const flatAllCollapseKeys = Array.from(new Set(flatRows.filter(r => r.collapseKey).map(r => r.collapseKey!)));\n  const toggleGroupSet = (keys: string[]) => {\n    if (!keys.length) return;\n    setCollapsedGroups(prev => {\n      const next = new Set(prev);\n      const collapse = keys.some(key => !next.has(key));\n      keys.forEach(key => collapse ? next.add(key) : next.delete(key));\n      return next;\n    });\n  };`,
  },
  {
    label: 'flat view collapsible rendering',
    from: `            <div className="space-y-3">{flatRows.map(r => r.node)}</div>`,
    to: `            <>\n              <div className="flex items-center gap-2 flex-wrap mb-3">\n                {flatHolidayKeys.length > 0 && (\n                  <button onClick={() => toggleGroupSet(flatHolidayKeys)} className="text-[11px] px-2.5 py-1 rounded-full border bg-white text-gray-600 border-[#EDE6D6]">\n                    🗓️ {flatHolidayKeys.every(k => collapsedGroups.has(k)) ? 'פתח' : 'כווץ'} חגים\n                  </button>\n                )}\n                {flatHomeVisitKeys.length > 0 && (\n                  <button onClick={() => toggleGroupSet(flatHomeVisitKeys)} className="text-[11px] px-2.5 py-1 rounded-full border bg-white text-gray-600 border-[#EDE6D6]">\n                    🏠 {flatHomeVisitKeys.every(k => collapsedGroups.has(k)) ? 'פתח' : 'כווץ'} ביקורי בית\n                  </button>\n                )}\n                {flatAllCollapseKeys.length > 1 && (\n                  <button onClick={() => toggleGroupSet(flatAllCollapseKeys)} className="text-[11px] px-2.5 py-1 rounded-full border bg-white text-gray-600 border-[#EDE6D6]">\n                    {flatAllCollapseKeys.every(k => collapsedGroups.has(k)) ? 'פתח הכול' : 'כווץ הכול'}\n                  </button>\n                )}\n              </div>\n              <div className="space-y-4">\n                {flatDisplayGroups.map(group => {\n                  const collapsed = !!group.collapseKey && collapsedGroups.has(group.collapseKey);\n                  return (\n                    <div key={group.key}>\n                      {group.collapseKey && (\n                        <div className="flex items-center justify-between mb-1">\n                          <button onClick={group.groupOpen} className="text-[11px] text-[#9B7A2F] font-bold hover:underline flex items-center gap-1">\n                            {group.label} {group.groupOpen && <ChevronLeft size={10} />}\n                          </button>\n                          <button onClick={() => toggleGroupCollapse(group.collapseKey!)} className="flex items-center gap-1 text-[10px] text-gray-400 px-1.5 py-0.5 rounded hover:bg-[#FAF6EE] transition-colors">\n                            {group.rows.length} משימות <ChevronDown size={12} className={\`transition-transform \${collapsed ? '' : 'rotate-180'}\`} />\n                          </button>\n                        </div>\n                      )}\n                      {!collapsed && <div className="space-y-3">{group.rows.map(r => r.node)}</div>}\n                    </div>\n                  );\n                })}\n              </div>\n            </>`,
  },
]);

console.log('Task countdown + flat collapse patch applied.');
