import React, { useEffect, useState } from 'react';
import { syncEngine } from '../services/syncEngine';
import { SyncStatusInfo } from '../services/syncTypes';

export const FooterStatusBar: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatusInfo>(syncEngine.getStatus());

  useEffect(() => {
    return syncEngine.subscribeStatus((st) => setSyncStatus(st));
  }, []);

  return (
    <footer className="h-8 border-t border-[#27272a] bg-[#09090b] px-3 sm:px-6 flex items-center justify-between text-[10px] text-[#71717a] font-medium select-none shrink-0 z-10">
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${syncStatus.isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
          {syncStatus.isOnline ? 'CLOUDFLARE: CONNECTED' : 'CLOUDFLARE: DISCONNECTED'}
        </span>
        <span className="hidden sm:inline">ENGINE: INDEXEDDB LOCAL-FIRST</span>
        <span className="font-mono hidden md:inline">SYNC QUEUE: {syncStatus.pendingCount}</span>
      </div>
      <div className="flex items-center gap-3 sm:gap-4 font-mono">
        <span className="hidden sm:inline text-[#a1a1aa]">EDGE WORKER D1</span>
        <span className={`font-bold flex items-center gap-1 ${syncStatus.isOnline ? 'text-emerald-500' : 'text-amber-500'}`}>
          ● {syncStatus.isOnline ? 'ONLINE SYNC' : 'OFFLINE MODE'}
        </span>
      </div>
    </footer>
  );
};
