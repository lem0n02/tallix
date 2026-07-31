import React from 'react';

export const FooterStatusBar: React.FC = () => {
  return (
    <footer className="h-8 border-t border-[#27272a] bg-[#09090b] px-6 flex items-center justify-between text-[10px] text-[#71717a] font-medium select-none shrink-0 z-10">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          ENV: PRODUCTION
        </span>
        <span className="hidden sm:inline">REGION: US-EAST-1</span>
        <span className="font-mono">v1.2.4-stable</span>
      </div>
      <div className="flex items-center gap-4 font-mono">
        <span className="hidden sm:inline text-[#a1a1aa]">NEXT.JS APP ROUTER</span>
        <span className="text-emerald-500 font-bold flex items-center gap-1">
          ● AUTHENTICATED
        </span>
      </div>
    </footer>
  );
};
