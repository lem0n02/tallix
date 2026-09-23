import React from 'react';
import { Compass, Home, ArrowLeft } from 'lucide-react';

interface NotFoundViewProps {
  onNavigateHome: () => void;
  requestedPath?: string;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  onNavigateHome,
  requestedPath,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 shadow-lg animate-bounce">
        <Compass className="w-8 h-8" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-[#fafafa] mb-2 tracking-tight">
        Page Not Found
      </h1>
      <p className="text-xs sm:text-sm text-[#a1a1aa] max-w-md mb-6 leading-relaxed">
        The destination <code className="text-blue-400 font-mono bg-[#18181b] px-2 py-0.5 rounded border border-[#27272a]">{requestedPath || window.location.pathname}</code> does not exist or has been relocated.
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="bg-[#18181b] hover:bg-[#27272a] text-[#fafafa] text-xs font-semibold px-4 py-2.5 rounded-xl border border-[#27272a] transition-colors cursor-pointer flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4 text-[#a1a1aa]" />
          <span>Go Back</span>
        </button>
        <button
          onClick={onNavigateHome}
          className="bg-white hover:bg-[#e4e4e7] text-black text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </button>
      </div>
    </div>
  );
};
