import React from 'react';
import { useAppStore } from '../store/AppContext';
import { activeProjects, projectPurposeMatches } from '../lib/projects';

// ─────────────────────────────────────────────────────────────────────────────
// תווית הקמפיין.
//
// אותו שדה בדיוק מקשר תרומה לפרויקט ומקשר הוראת קבע לפרויקט — הייעוד.
// עד כאן הוא הוצג כטקסט אפור קטן בין שאר הפרטים, ולא היה שום הבדל ויזואלי
// בין "שיוך לקמפיין פעיל" לבין "כתבתי כאן משהו".
//
// ההבחנה הזו חשובה: שיוך שגוי בגלל שגיאת כתיב הוא בדיוק סוג התקלה שאי
// אפשר לראות. תווית זהובה = מזוהה כפרויקט פעיל, ונספרת בו. תווית אפורה =
// טקסט חופשי, ולא נספר בשום מקום.
// ─────────────────────────────────────────────────────────────────────────────

export function CampaignTag({ value, size = 'sm' }: { value?: string | null; size?: 'xs' | 'sm' }) {
  const { projects } = useAppStore();
  const tag = String(value || '').trim();
  if (!tag) return null;

  const match = activeProjects(projects as any).find(
    p => projectPurposeMatches(p, tag)
  );

  const pad = size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]';

  return (
    <span
      title={match ? `משויך לפרויקט "${match.name}"` : 'ייעוד חופשי — אינו משויך לפרויקט פעיל'}
      className={`${pad} rounded-md font-bold whitespace-nowrap border inline-flex items-center gap-1 ${
        match
          ? 'bg-[#C9A84C]/15 text-[#9B7A2F] border-[#C9A84C]/40'
          : 'bg-gray-100 text-gray-500 border-gray-200'
      }`}
    >
      {match ? '🎯' : '🏷️'} {tag}
    </span>
  );
}
