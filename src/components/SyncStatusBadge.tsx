import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  HardDrive,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { syncEngine } from '../services/syncEngine';
import { SyncStatusInfo } from '../services/syncTypes';

export const SyncStatusBadge: React.FC = () => {
  const [status, setStatus] = useState<SyncStatusInfo>(syncEngine.getStatus());
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = syncEngine.subscribeStatus((newStatus) => {
      setStatus(newStatus);
    });
    return () => unsubscribe();
  }, []);

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleManualSync = (e: React.MouseEvent) => {
    e.stopPropagation();
    syncEngine.triggerSync();
  };

  // Compute visual badge parameters
  const renderBadgeContent = () => {
    if (status.state === 'syncing') {
      return (
        <span className="flex items-center gap-1.5 text-blue-400 font-medium">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
          <span className="hidden sm:inline text-[11px]">Syncing...</span>
        </span>
      );
    }

    if (!status.isOnline || status.state === 'offline') {
      return (
        <span className="flex items-center gap-1.5 text-rose-400 font-medium">
          <CloudOff className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden sm:inline text-[11px]">Offline</span>
          {status.pendingCount > 0 && (
            <span className="bg-rose-500/20 text-rose-300 text-[10px] font-mono px-1.5 py-0.2 rounded-full border border-rose-500/30">
              {status.pendingCount}
            </span>
          )}
        </span>
      );
    }

    if (status.state === 'pending' || status.pendingCount > 0) {
      return (
        <span className="flex items-center gap-1.5 text-amber-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span className="hidden sm:inline text-[11px]">{status.pendingCount} pending</span>
          <span className="sm:hidden text-[11px]">{status.pendingCount}</span>
        </span>
      );
    }

    if (status.state === 'error') {
      return (
        <span className="flex items-center gap-1.5 text-orange-400 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
          <span className="hidden sm:inline text-[11px]">Sync error</span>
        </span>
      );
    }

    // Default: Synced
    return (
      <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span className="hidden sm:inline text-[11px]">Synced</span>
      </span>
    );
  };

  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Never synced this session';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] hover:border-[#3f3f46] px-2.5 py-1.5 rounded-lg transition-all text-xs cursor-pointer select-none"
        title="Offline Sync Status (Click for details)"
      >
        {renderBadgeContent()}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl p-4 z-40 animate-fadeIn text-[#fafafa]">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#a1a1aa]">
                Offline-First Engine
              </h4>
            </div>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                status.isOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              {status.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Details List */}
          <div className="py-3 space-y-2 text-xs">
            <div className="flex items-center justify-between text-[#a1a1aa]">
              <span className="flex items-center gap-1.5">
                {status.isOnline ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                )}
                Network Link
              </span>
              <span className="font-mono text-white font-medium">
                {status.isOnline ? 'Active' : 'Disconnected'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[#a1a1aa]">
              <span className="flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-blue-400" />
                Pending Queue
              </span>
              <span className="font-mono text-white font-bold">
                {status.pendingCount} mutations
              </span>
            </div>

            <div className="flex items-center justify-between text-[#a1a1aa]">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                Last Server Sync
              </span>
              <span className="text-[11px] text-zinc-300">
                {formatLastSync(status.lastSyncedAt)}
              </span>
            </div>

            {status.lastError && (
              <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-[11px] flex items-start gap-1.5 mt-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                <span className="line-clamp-2">{status.lastError}</span>
              </div>
            )}
          </div>

          {/* Notice & Manual Action */}
          <div className="pt-2 border-t border-[#27272a] flex items-center justify-between">
            <p className="text-[10px] text-[#71717a] leading-tight max-w-[170px]">
              Local IndexedDB is the source of truth. Changes sync automatically.
            </p>
            <button
              onClick={handleManualSync}
              disabled={status.state === 'syncing' || !status.isOnline}
              className="bg-white hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed text-black text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw
                className={`w-3 h-3 ${status.state === 'syncing' ? 'animate-spin' : ''}`}
              />
              <span>Sync Now</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
