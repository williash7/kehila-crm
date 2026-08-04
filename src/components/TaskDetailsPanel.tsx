import React, { useState } from 'react';
import { ChevronDown, ChevronUp, X, Plus, Check, MapPin, Clock, CalendarDays } from 'lucide-react';
import {
  TaskItem, EisenhowerQuadrant, EISENHOWER_META, hasEisenhowerRating, eisenhowerQuadrant,
  addSubtask, toggleSubtask, removeSubtask,
} from '../lib/tasks';

const QUADRANTS: { key: EisenhowerQuadrant; urgent: boolean; important: boolean }[] = [
  { key: 'do', urgent: true, important: true },
  { key: 'delegate', urgent: true, important: false },
  { key: 'schedule', urgent: false, important: true },
  { key: 'eliminate', urgent: false, important: false },
];

// פאנל פרטים נוסף — משותף לכל סוגי המשימות (חג/אירוע/חד-פעמית/ביקור בית וכו').
// מנהל את מצב הפתיחה/סגירה שלו בעצמו, כך שכל קריאה ל-<TaskDetailsPanel> היא
// self-contained ולא דורשת ניהול state נוסף מהרכיב הקורא.
export function TaskDetailsPanel({ task, onPatch }: { task: TaskItem; onPatch: (patch: Partial<TaskItem>) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [subtaskText, setSubtaskText] = useState('');

  const rated = hasEisenhowerRating(task);
  const hasDetails = !!(task.dueDate || task.time || task.location || task.endTime || task.notes || task.subtasks?.length || rated);

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#9B7A2F]"
      >
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        פרטים נוספים
        {rated && !expanded && <span>{EISENHOWER_META[eisenhowerQuadrant(task)].emoji}</span>}
        {hasDetails && !expanded && !rated ? ' •' : ''}
      </button>

      {expanded && (
        <div className="mt-2 bg-[#FAF6EE] border border-[#EDE6D6] rounded-lg p-2.5 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            {QUADRANTS.map(q => {
              const isActive = rated && task.urgent === q.urgent && task.important === q.important;
              return (
                <button
                  key={q.key}
                  onClick={() => onPatch(isActive ? { urgent: undefined, important: undefined } : { urgent: q.urgent, important: q.important })}
                  className={`text-[11px] py-1.5 rounded-md border font-medium transition-colors ${
                    isActive ? 'bg-[#0D1B2A] text-[#E8C97A] border-[#0D1B2A]' : 'bg-white text-gray-500 border-[#EDE6D6]'
                  }`}
                >
                  {EISENHOWER_META[q.key].emoji} {EISENHOWER_META[q.key].label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-gray-500 flex flex-col gap-1">
              <span className="flex items-center gap-1"><CalendarDays size={10} /> תאריך</span>
              <input
                type="date"
                value={task.dueDate || ''}
                onChange={e => onPatch({ dueDate: e.target.value })}
                className="bg-white border border-[#EDE6D6] rounded-md px-2 py-1 text-xs outline-none focus:border-[#C9A84C]"
              />
            </label>
            <label className="text-[10px] text-gray-500 flex flex-col gap-1">
              <span className="flex items-center gap-1"><Clock size={10} /> שעה (התחלה)</span>
              <input
                type="time"
                value={task.time || ''}
                onChange={e => onPatch({ time: e.target.value })}
                className="bg-white border border-[#EDE6D6] rounded-md px-2 py-1 text-xs outline-none focus:border-[#C9A84C]"
              />
            </label>
            <label className="text-[10px] text-gray-500 flex flex-col gap-1">
              <span>עד שעה (אופציונלי)</span>
              <input
                type="time"
                value={task.endTime || ''}
                onChange={e => onPatch({ endTime: e.target.value })}
                className="bg-white border border-[#EDE6D6] rounded-md px-2 py-1 text-xs outline-none focus:border-[#C9A84C]"
              />
            </label>
            <label className="text-[10px] text-gray-500 flex flex-col gap-1">
              <span className="flex items-center gap-1"><MapPin size={10} /> מקום</span>
              <input
                type="text"
                value={task.location || ''}
                onChange={e => onPatch({ location: e.target.value })}
                placeholder="למשל: אולם בית חב״ד"
                className="bg-white border border-[#EDE6D6] rounded-md px-2 py-1 text-xs outline-none focus:border-[#C9A84C]"
              />
            </label>
          </div>

          <textarea
            value={task.notes || ''}
            onChange={e => onPatch({ notes: e.target.value })}
            placeholder="פרטים נוספים..."
            rows={2}
            className="w-full bg-white border border-[#EDE6D6] rounded-md px-2 py-1.5 text-xs outline-none focus:border-[#C9A84C] resize-none"
          />

          <div>
            <div className="text-[10px] text-gray-500 mb-1">תתי-משימות</div>
            <div className="space-y-1">
              {(task.subtasks || []).map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-white border border-[#EDE6D6] rounded-md px-2 py-1">
                  <button
                    onClick={() => onPatch(toggleSubtask(task, i))}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${s.done ? 'bg-[#C9A84C] border-[#C9A84C]' : 'border-gray-300'}`}
                  >
                    {s.done && <Check size={9} className="text-white" />}
                  </button>
                  <span className={`flex-1 text-xs ${s.done ? 'text-gray-400 line-through' : 'text-[#0D1B2A]'}`}>{s.text}</span>
                  <button onClick={() => onPatch(removeSubtask(task, i))} className="text-red-300 hover:text-red-500 shrink-0">
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 mt-1.5">
              <input
                value={subtaskText}
                onChange={e => setSubtaskText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && subtaskText.trim()) {
                    onPatch(addSubtask(task, subtaskText));
                    setSubtaskText('');
                  }
                }}
                type="text"
                placeholder="תת-משימה חדשה..."
                className="flex-1 bg-white border border-[#EDE6D6] rounded-md px-2 py-1 text-xs outline-none focus:border-[#C9A84C]"
              />
              <button
                onClick={() => {
                  if (!subtaskText.trim()) return;
                  onPatch(addSubtask(task, subtaskText));
                  setSubtaskText('');
                }}
                className="bg-[#0D1B2A] text-[#E8C97A] rounded-md px-2 shrink-0"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
