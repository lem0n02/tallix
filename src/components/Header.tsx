import React, { useState, useEffect } from 'react';
import {
  Plus,
  ShieldCheck,
  Activity,
  Edit3,
  LogOut,
  User,
  Users
} from 'lucide-react';
import { UserProfile, LanguageMode } from '../types';
import { getTranslation } from '../i18n/translations';
import { SyncStatusBadge } from './SyncStatusBadge';
import { MonthSelector } from './MonthSelector';
import { getCurrentMonthKey } from '../utils/monthFilter';

interface HeaderProps {
  onOpenNewTransaction: () => void;
  onOpenCommandPalette: () => void;
  user?: UserProfile;
  onOpenEditProfile?: () => void;
  onLogout?: () => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
  selectedMonth?: string;
  onSelectMonth?: (monthKey: string) => void;
  availableMonths?: string[];
  lang?: LanguageMode;
  onLangChange?: (lang: LanguageMode) => void;
  onOpenGuestModal?: () => void;
  isGuestSession?: boolean;
  onOpenExitGuestModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewTransaction,
  onOpenCommandPalette,
  user,
  onOpenEditProfile,
  onLogout,
  onToggleMobileMenu,
  isMobileMenuOpen = false,
  selectedMonth,
  onSelectMonth,
  availableMonths,
  lang = 'en',
  onLangChange,
  onOpenGuestModal,
  isGuestSession = false,
  onOpenExitGuestModal,
}) => {
  const [latency, setLatency] = useState<number>(24);
  const [showDropdown, setShowDropdown] = useState(false);

  const activeMonth = selectedMonth || getCurrentMonthKey();
  const monthList = availableMonths && availableMonths.length > 0 ? availableMonths : [activeMonth];

  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(lang as LanguageMode, key);

  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(Math.floor(Math.random() * 14) + 18);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const getInitials = (str?: string) => {
    if (!str) return 'U';
    const parts = str.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return str.slice(0, 2).toUpperCase();
  };

  return (
    <header className="h-14 sm:h-16 border-b border-[#1e293b] sm:border-[#27272a] bg-[#060a14]/90 sm:bg-[#09090b]/80 backdrop-blur-md flex items-center justify-between px-3 sm:px-6 sticky top-0 z-20">
      {/* Left: User Greeting */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        {/* Welcome Speech */}
        <div className="flex flex-col min-w-0">
          <h2 className="text-xs sm:text-sm font-semibold text-[#fafafa] flex items-center gap-1.5 truncate">
            <span>{t('welcomeBack')}</span>
            <span className="text-blue-400 font-bold truncate max-w-[120px] xs:max-w-[160px] sm:max-w-none">{user?.name || 'Staff Engineer'}</span>
            <span className="hidden xs:inline">👋</span>
            {(isGuestSession || user?.isGuest) && (
              <button
                type="button"
                onClick={onOpenExitGuestModal}
                title="Guest Mode active. Click to exit."
                className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 ml-1 transition-all cursor-pointer shrink-0"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Guest Mode</span>
              </button>
            )}
          </h2>
          <p className="text-[10px] sm:text-[11px] text-[#a1a1aa] hidden sm:block">
            {t('overviewSubtext')}
          </p>
        </div>
      </div>

      {/* Right: Actions, Language & User Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Offline Sync Status Badge */}
        <SyncStatusBadge />

        {/* Latency Telemetry */}
        <div className="hidden lg:flex items-center gap-2 bg-[#18181b] border border-[#27272a] px-3 py-1 rounded-full">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[11px] text-[#a1a1aa] uppercase font-bold tracking-tighter flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-400 inline" />
            {t('prodApi')}: <span className="text-[#fafafa] font-mono">{latency}ms</span>
          </span>
        </div>

        {/* Month Selector Dropdown (Replaces Language Switcher) */}
        <MonthSelector
          selectedMonth={activeMonth}
          onSelectMonth={onSelectMonth || (() => {})}
          availableMonths={monthList}
        />

        {/* New Transaction Button (Desktop header) */}
        <button
          onClick={onOpenNewTransaction}
          className="hidden sm:flex bg-white hover:bg-[#e4e4e7] active:scale-95 text-black text-xs font-bold px-2.5 sm:px-3.5 py-2 rounded-lg items-center gap-1.5 transition-all cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{t('newTransaction')}</span>
        </button>

        {/* User Profile Quick Menu */}
        {user && (
          <div className="relative">
            <button
              onClick={() => {
                setShowDropdown(!showDropdown);
              }}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-gradient-to-tr ${user.avatarGradient || 'from-emerald-600 to-teal-500'} flex items-center justify-center font-bold text-xs text-white shadow-md border border-[#27272a] hover:border-emerald-500 transition-all cursor-pointer`}
              title="Account Menu"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                getInitials(user.name)
              )}
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl py-2 z-30 animate-fadeIn">
                <div className="px-4 py-2 border-b border-[#27272a]">
                  <p className="text-xs font-bold text-[#fafafa] truncate">{user.name}</p>
                  <p className="text-[10px] text-[#71717a] truncate font-mono">{user.email}</p>
                  <div className={`mt-1 inline-flex items-center gap-1 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                    user.isGuest || isGuestSession
                      ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                      : 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
                  }`}>
                    {user.isGuest || isGuestSession ? 'Guest Session' : `${user.systemRole} Role`}
                  </div>
                </div>

                <div className="py-1">
                  {onOpenEditProfile && (
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        onOpenEditProfile();
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-[#a1a1aa] hover:text-white hover:bg-[#27272a] flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t('editProfile')}</span>
                    </button>
                  )}

                  {(isGuestSession || user.isGuest) ? (
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        if (onOpenExitGuestModal) {
                          onOpenExitGuestModal();
                        } else if (onLogout) {
                          onLogout();
                        }
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-amber-400 hover:bg-amber-500/10 flex items-center gap-2 transition-colors cursor-pointer border-t border-[#27272a] mt-1 pt-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Exit Guest Mode</span>
                    </button>
                  ) : onLogout ? (
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        onLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors cursor-pointer border-t border-[#27272a] mt-1 pt-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{t('logout')}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
