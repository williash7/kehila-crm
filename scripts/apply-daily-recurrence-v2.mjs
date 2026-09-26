import { readFileSync, writeFileSync } from 'node:fs';

// Wrapper used only to make the one-time source patch match the current EventsTab text exactly.
const path = 'src/components/EventsTab.tsx';
let text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const original = "                   `מסגרת: ${ACTIVITY_KIND_LABEL[currentTasksEvent.activityKind as ActivityKind]}, תוכן: ${typeLabels[currentTasksEvent.type] || currentTasksEvent.type}, תדירות: ${freqLabels[currentTasksEvent.freq] || currentTasksEvent.freq}`,";
const compatible = "                   `מסגרת: ${ACTIVITY_KIND_LABEL[currentTasksEvent.activityKind as ActivityKind]}, תוכן: ${typeLabels[currentTasksEvent.type] || currentTasksEvent.type}, תדירות: ${freqLabels[currentTasksEvent.freq] || currentTasksEvent.freq}` ,";
const count = text.split(original).length - 1;
if (count !== 1) throw new Error(`EventsTab AI context pre-patch: expected 1 match, found ${count}`);
writeFileSync(path, text.replace(original, compatible));

await import('./apply-daily-recurrence.mjs');
