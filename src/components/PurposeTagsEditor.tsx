import React from 'react';
import { Plus, X } from 'lucide-react';

function clean(values: string[]): string[] {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
}

export function PurposeTagsEditor({
  values, onChange, placeholder = 'למשל: פסח',
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = React.useState('');
  const tags = clean(values || []);

  const add = () => {
    const additions = clean(draft.split(/[,;\n]/));
    if (!additions.length) return;
    onChange(clean([...tags, ...additions]));
    setDraft('');
  };

  return (
    <div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-lg bg-[#C9A84C]/15 border border-[#C9A84C]/35 text-[#7D6425] text-[11px] font-bold px-2 py-1">
              {tag}
              <button type="button" onClick={() => onChange(tags.filter(value => value !== tag))} aria-label={`הסר את הייעוד ${tag}`} className="text-[#9B7A2F]/70 hover:text-red-500"><X size={11} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(); } }}
          type="text"
          className="flex-1 min-w-0 border border-[#EDE6D6] rounded-lg px-2.5 py-2 text-sm outline-none focus:border-[#C9A84C]"
          placeholder={placeholder}
        />
        <button type="button" onClick={add} disabled={!draft.trim()} className="shrink-0 px-3 rounded-lg bg-[#0D1B2A] text-[#C9A84C] text-xs font-bold disabled:opacity-35 flex items-center gap-1">
          <Plus size={13} /> הוסף
        </button>
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5">כל תרומה שהייעוד שלה זהה לאחת התגיות תשויך אוטומטית.</p>
    </div>
  );
}
