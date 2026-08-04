import React from 'react';
import { getOrg } from '../lib/orgConfig';

export function LoadingScreen({ text }: { text: string }) {
  const org = getOrg();
  const name = org.shortName || org.orgName.he;
  // האות הראשונה של שם הארגון כסמל טעינה, כמו ה-"ח" של הגרסה המקורית
  const initial = name.replace(/["'׳״]/g, '').trim().charAt(0) || '✦';

  return (
    <div className="fixed inset-0 bg-[#0D1B2A] flex flex-col items-center justify-center z-[999]">
      <div className="font-['Frank_Ruhl_Libre'] text-6xl text-[#C9A84C] mb-5 animate-pulse">{initial}</div>
      <div className="font-['Frank_Ruhl_Libre'] text-2xl text-white mb-2">{name}</div>
      <div className="text-sm text-white/40">{text}</div>
      <div className="w-[200px] h-[3px] bg-white/10 rounded-sm mt-6 overflow-hidden">
        <div className="h-full bg-[#C9A84C] rounded-sm w-full animate-[loadFill_3s_ease_forwards]" style={{ animationTimingFunction: 'linear' }}></div>
      </div>
    </div>
  );
}
