import { nextEventOccurrence } from './tasks';

export type ActivityKind = 'recurring' | 'special' | 'holiday';
export type ParticipantState = 'registered' | 'paid' | 'attended' | 'owed';

export interface ActivityParticipant {
  registered?: boolean;
  paid?: boolean;
  attended?: boolean;
  owed?: boolean;
  amountDue?: number;
}

export interface Activity {
  id: string;
  name: string;
  activityKind: ActivityKind;
  type: string;
  freq: string;
  date: string;
  time?: string;
  location?: string;
  holidayId?: string;
  /** כל ערכי הייעוד שמקשרים תרומה לפעילות. הראשון נשמר גם ב-purposeTag לתאימות. */
  purposeTags?: string[];
  purposeTag: string;
  entryPrice?: number | string;
  attendance?: Record<string, Record<string, boolean>>;
  participants?: Record<string, Record<string, ActivityParticipant>>;
  tasks?: any[];
  performers?: any[];
  budget?: { expenses: any[]; income: any[] };
  notes?: string;
}

export const ACTIVITY_KIND_LABEL: Record<ActivityKind, string> = {
  recurring: 'פעילות קבועה',
  special: 'אירוע מיוחד',
  holiday: 'פעילות חג',
};

export function inferActivityKind(raw: any): ActivityKind {
  if (raw?.activityKind === 'recurring' || raw?.activityKind === 'special' || raw?.activityKind === 'holiday') {
    return raw.activityKind;
  }
  if (raw?.holidayId) return 'holiday';
  return raw?.freq === 'oneoff' ? 'special' : 'recurring';
}

/** מעבר בטוח: רשומות אירוע ישנות מקבלות את השדות החדשים בלי לאבד שדה קיים. */
export function normalizeActivity(raw: any): Activity {
  const name = String(raw?.name || '').trim();
  const activityKind = inferActivityKind(raw);
  return {
    ...(raw || {}),
    id: String(raw?.id || `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    name,
    activityKind,
    type: String(raw?.type || 'other'),
    freq: activityKind === 'recurring' && ['weekly', 'biweekly', 'monthly'].includes(String(raw?.freq || ''))
      ? String(raw.freq)
      : activityKind === 'recurring' ? 'weekly' : 'oneoff',
    date: String(raw?.date || new Date().toISOString().split('T')[0]),
    time: String(raw?.time || ''),
    location: String(raw?.location || ''),
    purposeTag: activityPurposeTags({ ...raw, name } as Activity)[0] || name,
    purposeTags: activityPurposeTags({ ...raw, name } as Activity),
    attendance: raw?.attendance || {},
    participants: raw?.participants || {},
    tasks: raw?.tasks || [],
    performers: raw?.performers || [],
    budget: raw?.budget || { expenses: [], income: [] },
  };
}

export function normalizeActivities(raw: any): Activity[] {
  return Array.isArray(raw) ? raw.filter(Boolean).map(normalizeActivity) : [];
}

export function normalizePurposeTags(values: unknown, fallback = ''): string[] {
  const list = Array.isArray(values) ? values : String(values || '').split(/[,;\n]/);
  const normalized = list.map(value => String(value || '').trim()).filter(Boolean);
  if (!normalized.length && fallback.trim()) normalized.push(fallback.trim());
  return Array.from(new Set(normalized));
}

export function activityPurposeTags(activity: Pick<Activity, 'name' | 'purposeTag' | 'purposeTags'>): string[] {
  return normalizePurposeTags([
    activity.purposeTag || activity.name || '',
    ...(Array.isArray(activity.purposeTags) ? activity.purposeTags : []),
  ], activity.name || '');
}

export function activityDonations(activity: Activity, donations: any[], linkedPurposeTags: string[] = []): any[] {
  const tags = new Set(
    [...activityPurposeTags(activity), ...linkedPurposeTags]
      .map(v => String(v || '').trim())
      .filter(Boolean)
  );
  return (donations || []).filter(d => tags.has(String(d?.purpose || '').trim()) && Number(d?.amount) > 0);
}

export function activityParticipant(activity: Activity, dateKey: string, name: string): ActivityParticipant {
  const detailed = activity.participants?.[dateKey]?.[name];
  if (detailed) return detailed;
  return activity.attendance?.[dateKey]?.[name] ? { attended: true } : {};
}

export function participantCount(activity: Activity, dateKey: string, state: ParticipantState): number {
  const names = new Set([
    ...Object.keys(activity.attendance?.[dateKey] || {}),
    ...Object.keys(activity.participants?.[dateKey] || {}),
  ]);
  let count = 0;
  names.forEach(name => {
    const row = activityParticipant(activity, dateKey, name);
    if (row[state]) count++;
  });
  return count;
}

export function activityReadiness(activity: Activity, now = new Date()): { percent: number; openTasks: number; totalTasks: number } {
  const occurrence = nextEventOccurrence(activity, now);
  const relevant = (activity.tasks || []).filter(task => {
    if (!occurrence || !task?.dueDate) return true;
    return String(task.dueDate) <= occurrence.toISOString().split('T')[0];
  });
  const openTasks = relevant.filter(t => !t.done).length;
  const totalTasks = relevant.length;
  return { percent: totalTasks ? Math.round(((totalTasks - openTasks) / totalTasks) * 100) : 100, openTasks, totalTasks };
}

export function upcomingActivities(activities: Activity[], now = new Date(), days = 45): { activity: Activity; date: Date }[] {
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  return normalizeActivities(activities)
    .map(activity => ({ activity, date: nextEventOccurrence(activity, now) }))
    .filter((x): x is { activity: Activity; date: Date } => !!x.date && x.date <= end)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
