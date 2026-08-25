export type GlobalSearchKind = 'contact' | 'donation' | 'activity' | 'project' | 'task';

export interface GlobalSearchTarget {
  tab: 'contacts' | 'donations' | 'activities' | 'campaigns' | 'tasks';
  entityId: string;
  parentId?: string;
}

export interface GlobalSearchDocument {
  id: string;
  kind: GlobalSearchKind;
  title: string;
  subtitle: string;
  target: GlobalSearchTarget;
  keywords: string[];
  date?: string;
  amount?: number;
}

export interface GlobalSearchResult extends GlobalSearchDocument {
  score: number;
}

export interface GlobalSearchInput {
  donors?: Record<string, any>;
  crm?: Record<string, any>;
  donations?: any[];
  activities?: any[];
  projects?: any[];
  holidayExtras?: Record<string, any>;
  holidayNames?: Record<string, string>;
}

const compact = (values: unknown[]): string[] => values
  .flatMap(value => Array.isArray(value) ? value : [value])
  .map(value => String(value ?? '').trim())
  .filter(Boolean);

/** חיפוש עברי עמיד לניקוד, גרשיים שונים, מקפים ורווחים כפולים. */
export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/[״“”„]/g, '"')
    .replace(/[׳‘’`]/g, "'")
    .replace(/[-‐‑–—_/\\.,:;!?()[\]{}]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('he');
}

function taskTitle(task: any): string {
  return String(task?.title || task?.text || task?.name || task?.label || '').trim();
}

function taskDocuments(tasks: any[], parent: { id: string; name: string; kind: string }): GlobalSearchDocument[] {
  const docs: GlobalSearchDocument[] = [];
  (tasks || []).forEach((task, index) => {
    const title = taskTitle(task);
    if (!title) return;
    const taskId = String(task?.id || `${parent.id}:${index}`);
    const due = String(task?.dueDate || task?.date || '').trim();
    docs.push({
      id: `task:${parent.kind}:${parent.id}:${taskId}`,
      kind: 'task',
      title,
      subtitle: `${parent.name}${due ? ` · ${due}` : ''}${task?.done ? ' · הושלם' : ''}`,
      target: { tab: 'tasks', entityId: taskId, parentId: parent.id },
      keywords: compact([title, task?.notes, task?.assignee, parent.name, parent.kind, due]),
      date: due || undefined,
    });
  });
  return docs;
}

/** בונה אינדקס פעם אחת; אין כאן שינוי נתונים ואין תלות ברכיבי המסך. */
export function buildGlobalSearchIndex(input: GlobalSearchInput): GlobalSearchDocument[] {
  const docs: GlobalSearchDocument[] = [];
  const donors = input.donors || {};
  const crm = input.crm || {};
  const contactNames = new Set([...Object.keys(donors), ...Object.keys(crm)]);

  contactNames.forEach(name => {
    const donor = donors[name] || {};
    const details = crm[name] || {};
    docs.push({
      id: `contact:${name}`,
      kind: 'contact',
      title: name,
      subtitle: compact([details.phone || donor.phone, details.city || details.address || donor.address]).join(' · '),
      target: { tab: 'contacts', entityId: name },
      keywords: compact([
        name, details.phone, details.email, details.address, details.city,
        details.notes, donor.phone, donor.email, donor.address,
      ]),
    });
  });

  (input.donations || []).forEach((donation, index) => {
    const id = String(donation?.id || `${donation?.name || 'donation'}:${donation?.date || ''}:${index}`);
    const amount = Number(donation?.amount) || 0;
    const date = String(donation?.date || '');
    const purpose = String(donation?.purpose || '').trim();
    docs.push({
      id: `donation:${id}`,
      kind: 'donation',
      title: String(donation?.name || 'תרומה'),
      subtitle: compact([amount ? `₪${amount.toLocaleString('he-IL')}` : '', date, purpose]).join(' · '),
      target: { tab: 'donations', entityId: id },
      keywords: compact([donation?.name, amount, date, purpose, donation?.method, donation?.notes]),
      date: date || undefined,
      amount,
    });
  });

  (input.activities || []).forEach((activity, index) => {
    const id = String(activity?.id || `activity:${index}`);
    const name = String(activity?.name || activity?.title || 'פעילות');
    docs.push({
      id: `activity:${id}`,
      kind: 'activity',
      title: name,
      subtitle: compact([activity?.date, activity?.time, activity?.location]).join(' · '),
      target: { tab: 'activities', entityId: id },
      keywords: compact([
        name, activity?.type, activity?.activityKind, activity?.freq,
        activity?.date, activity?.location, activity?.purposeTag,
        activity?.purposeTags, activity?.notes,
      ]),
      date: activity?.date || undefined,
    });
    docs.push(...taskDocuments(activity?.tasks || [], { id, name, kind: 'activity' }));
  });

  (input.projects || []).forEach((project, index) => {
    const id = String(project?.id || `project:${index}`);
    const name = String(project?.title || project?.name || 'קמפיין');
    docs.push({
      id: `project:${id}`,
      kind: 'project',
      title: name,
      subtitle: compact([project?.startDate, project?.endDate, project?.status]).join(' · '),
      target: { tab: 'campaigns', entityId: id },
      keywords: compact([
        name, project?.purposeTag, project?.purposeTags, project?.notes,
        project?.solicitations?.map((row: any) => row?.name),
      ]),
      date: project?.startDate || undefined,
    });
    docs.push(...taskDocuments(project?.tasks || [], { id, name, kind: 'project' }));
  });

  Object.entries(input.holidayExtras || {}).forEach(([id, extra]) => {
    const name = input.holidayNames?.[id] || String((extra as any)?.name || (extra as any)?.title || 'משימות כלליות');
    docs.push(...taskDocuments((extra as any)?.tasks || [], { id, name, kind: 'holiday' }));
  });

  // מזהה יציב מונע תוצאה כפולה אם אותה רשומה הגיעה משני חיבורים למנוע.
  const unique = new Map<string, GlobalSearchDocument>();
  docs.forEach(doc => { if (!unique.has(doc.id)) unique.set(doc.id, doc); });
  return [...unique.values()];
}

const KIND_PRIORITY: Record<GlobalSearchKind, number> = {
  contact: 5, activity: 4, project: 3, donation: 2, task: 1,
};

function scoreDocument(doc: GlobalSearchDocument, query: string, tokens: string[]): number {
  const title = normalizeSearchText(doc.title);
  const subtitle = normalizeSearchText(doc.subtitle);
  const keywords = normalizeSearchText(doc.keywords.join(' '));
  const haystack = `${title} ${subtitle} ${keywords}`;
  if (!tokens.every(token => haystack.includes(token))) return 0;

  let score = 30 + KIND_PRIORITY[doc.kind];
  if (title === query) score += 100;
  else if (title.startsWith(query)) score += 75;
  else if (title.includes(query)) score += 55;
  tokens.forEach(token => {
    if (title.split(' ').some(word => word === token)) score += 14;
    else if (title.split(' ').some(word => word.startsWith(token))) score += 8;
    else if (subtitle.includes(token)) score += 3;
  });
  return score;
}

export function searchGlobalIndex(
  index: GlobalSearchDocument[],
  rawQuery: string,
  limit = 30,
): GlobalSearchResult[] {
  const query = normalizeSearchText(rawQuery);
  if (!query) return [];
  const tokens = query.split(' ').filter(Boolean);
  return (index || [])
    .map(doc => ({ ...doc, score: scoreDocument(doc, query, tokens) }))
    .filter(doc => doc.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'he'))
    .slice(0, Math.max(1, Math.min(100, limit)));
}
