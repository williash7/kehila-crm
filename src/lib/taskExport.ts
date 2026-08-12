import { STANDALONE_TASKS_ID, PERSONAL_DATE_EXTRAS_ID } from './tasks';

export interface ExportableTask {
  category: 'holiday' | 'event' | 'standalone' | 'homeVisit' | 'prep';
  categoryLabel: string;
  source: string;
  text: string;
  dueDate?: string;
  done: boolean;
}

export const TASK_CATEGORY_LABELS: Record<ExportableTask['category'], string> = {
  holiday: 'חג',
  event: 'אירוע',
  standalone: 'חד-פעמית',
  homeVisit: 'ביקור בית',
  prep: 'הכנה לביקורי בית',
};

export function collectAllTasks(holidayExtras: Record<string, any>, eventsData: any[], homeVisits: { rounds: any[] }): ExportableTask[] {
  const rows: ExportableTask[] = [];

  Object.keys(holidayExtras).forEach(id => {
    if (id === STANDALONE_TASKS_ID || id === PERSONAL_DATE_EXTRAS_ID) return;
    (holidayExtras[id]?.tasks || []).forEach((t: any) => {
      rows.push({ category: 'holiday', categoryLabel: TASK_CATEGORY_LABELS.holiday, source: id, text: t.text, dueDate: t.dueDate, done: !!t.done });
    });
  });

  eventsData.forEach((e: any) => {
    (e.tasks || []).forEach((t: any) => {
      rows.push({ category: 'event', categoryLabel: TASK_CATEGORY_LABELS.event, source: e.name, text: t.text, dueDate: t.dueDate, done: !!t.done });
    });
  });

  (holidayExtras[STANDALONE_TASKS_ID]?.tasks || []).forEach((t: any) => {
    const isHomeVisit = t.kind === 'homeVisit';
    rows.push({
      category: isHomeVisit ? 'homeVisit' : 'standalone',
      categoryLabel: isHomeVisit ? TASK_CATEGORY_LABELS.homeVisit : TASK_CATEGORY_LABELS.standalone,
      source: isHomeVisit ? (t.personName || '') : '',
      text: t.text,
      dueDate: t.dueDate,
      done: !!t.done,
    });
  });

  (homeVisits.rounds || []).forEach((r: any) => {
    (r.prepTasks || []).forEach((pt: any) => {
      rows.push({ category: 'prep', categoryLabel: TASK_CATEGORY_LABELS.prep, source: r.purpose || '', text: pt.text, done: !!pt.done });
    });
  });

  return rows;
}
