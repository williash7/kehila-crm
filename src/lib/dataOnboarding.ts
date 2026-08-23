import { normalizeActivity, Activity } from './activities';
import { emptyProject, Project } from './projects';
import { stampCreated, TaskItem } from './tasks';

const STORAGE_KEY = 'data_onboarding_v1_completed';

export interface RecurringActivityDraft {
  name: string;
  freq: 'weekly' | 'biweekly' | 'monthly';
  firstDate: string;
  time: string;
  location: string;
}

export interface SpecialActivityDraft {
  name: string;
  date: string;
  time: string;
  location: string;
}

export interface CampaignDraft {
  name: string;
  goal: string;
  deadline: string;
}

export function shouldShowDataOnboarding(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) !== 'done'; }
  catch { return true; }
}

export function markDataOnboardingDone(): void {
  try { localStorage.setItem(STORAGE_KEY, 'done'); }
  catch { /* במצב גלישה פרטית האשף יוכל להיפתח שוב דרך ההגדרות */ }
}

export function resetDataOnboarding(): void {
  try { localStorage.removeItem(STORAGE_KEY); }
  catch { /* noop */ }
}

export function todayIso(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function parseTaskLines(text: string): TaskItem[] {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*[-*•\d.)]+\s*/, '').trim())
    .filter(Boolean)
    .map(line => stampCreated({ text: line, done: false }));
}

export function buildOnboardingActivities(
  recurring: RecurringActivityDraft[],
  special: SpecialActivityDraft[],
  now = new Date()
): Activity[] {
  const stamp = now.getTime();
  const fallbackDate = todayIso(now);
  const recurringRows = recurring
    .filter(row => row.name.trim())
    .map((row, index) => normalizeActivity({
      id: `ev_onboarding_${stamp}_r${index}`,
      name: row.name.trim(),
      activityKind: 'recurring',
      type: 'other',
      freq: row.freq,
      date: row.firstDate || fallbackDate,
      time: row.time,
      location: row.location.trim(),
      purposeTag: row.name.trim(),
    }));
  const specialRows = special
    .filter(row => row.name.trim())
    .map((row, index) => normalizeActivity({
      id: `ev_onboarding_${stamp}_s${index}`,
      name: row.name.trim(),
      activityKind: 'special',
      type: 'other',
      freq: 'oneoff',
      date: row.date || fallbackDate,
      time: row.time,
      location: row.location.trim(),
      purposeTag: row.name.trim(),
    }));
  return [...recurringRows, ...specialRows];
}

export function buildOnboardingCampaigns(rows: CampaignDraft[], now = new Date()): Project[] {
  const stamp = now.getTime();
  return rows
    .filter(row => row.name.trim())
    .map((row, index) => ({
      ...emptyProject(row.name.trim()),
      id: `proj_onboarding_${stamp}_${index}`,
      kind: 'campaign' as const,
      goal: Number(row.goal) > 0 ? Number(row.goal) : '',
      deadline: row.deadline || undefined,
    }));
}
