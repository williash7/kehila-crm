let taskCounter = 0;

/** מזהה חדש למשימה חדשה. אינו תלוי בטקסט, במיון או במיקום ברשימה. */
export function createTaskId(): string {
  try {
    if (globalThis.crypto?.randomUUID) return `tsk_${globalThis.crypto.randomUUID()}`;
  } catch { /* דפדפן ישן — נופלים למזהה המקומי */ }
  taskCounter = (taskCounter + 1) % 1_000_000;
  return `tsk_${Date.now().toString(36)}_${taskCounter.toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/** שני גיבובים קצרים נותנים מזהה דטרמיניסטי עם סיכוי זניח להתנגשות. */
function stableHash(value: string): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x85ebca6b);
  }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}

function legacyTaskId(parentKey: string, index: number, task: any): string {
  const fingerprint = [
    parentKey, index, task?.createdAt, task?.text, task?.title,
    task?.kind, task?.dueDate, task?.personName,
  ].map(value => String(value ?? '')).join('\u0000');
  return `tsk_legacy_${stableHash(fingerprint)}`;
}

export interface TaskListIdentityResult {
  tasks: any[];
  changed: boolean;
  added: number;
}

/**
 * משלים מזהים בלי לשנות סדר או תוכן. מזהה חסר נגזר מההורה ומהמיקום
 * המקורי ולכן שני מכשירים שרואים אותו מצב ישן ייצרו בדיוק אותו מזהה.
 */
export function ensureTaskListIds(tasks: unknown, parentKey: string): TaskListIdentityResult {
  if (!Array.isArray(tasks)) return { tasks: [], changed: false, added: 0 };
  const seen = new Set<string>();
  let changed = false;
  let added = 0;
  const next = tasks.map((raw, index) => {
    const task = raw && typeof raw === 'object' ? raw as any : { text: String(raw ?? '') };
    let id = String(task.id || '').trim();
    if (!id || seen.has(id)) {
      const base = legacyTaskId(parentKey, index, task);
      id = base;
      let suffix = 2;
      while (seen.has(id)) id = `${base}_${suffix++}`;
      changed = true;
      added++;
    } else if (task.id !== id) {
      changed = true;
    }
    seen.add(id);
    return task.id === id ? task : { ...task, id };
  });
  return { tasks: changed ? next : tasks, changed, added };
}

export interface TaskCollectionsIdentityResult {
  holidayExtras: Record<string, any>;
  events: any[];
  projects: any[];
  changedHolidayExtras: boolean;
  changedEvents: boolean;
  changedProjects: boolean;
  added: number;
}

/** משלים מזהים בכל שלושת המקומות שבהם משימות רגילות נשמרות. */
export function ensureTaskIdsInCollections(input: {
  holidayExtras?: Record<string, any>;
  events?: any[];
  projects?: any[];
}): TaskCollectionsIdentityResult {
  let added = 0;
  let changedHolidayExtras = false;
  const holidayExtras: Record<string, any> = {};
  Object.entries(input.holidayExtras || {}).forEach(([key, extra]: [string, any]) => {
    if (!Array.isArray(extra?.tasks)) { holidayExtras[key] = extra; return; }
    const result = ensureTaskListIds(extra.tasks, `holiday:${key}`);
    holidayExtras[key] = result.changed ? { ...extra, tasks: result.tasks } : extra;
    changedHolidayExtras ||= result.changed;
    added += result.added;
  });

  let changedEvents = false;
  const events = (Array.isArray(input.events) ? input.events : []).map((event: any, index) => {
    const result = ensureTaskListIds(event?.tasks, `activity:${event?.id || index}`);
    changedEvents ||= result.changed;
    added += result.added;
    return result.changed ? { ...event, tasks: result.tasks } : event;
  });

  let changedProjects = false;
  const projects = (Array.isArray(input.projects) ? input.projects : []).map((project: any, index) => {
    const result = ensureTaskListIds(project?.tasks, `project:${project?.id || index}`);
    changedProjects ||= result.changed;
    added += result.added;
    return result.changed ? { ...project, tasks: result.tasks } : project;
  });

  return {
    holidayExtras: changedHolidayExtras ? holidayExtras : (input.holidayExtras || {}),
    events: changedEvents ? events : (input.events || []),
    projects: changedProjects ? projects : (input.projects || []),
    changedHolidayExtras, changedEvents, changedProjects, added,
  };
}
