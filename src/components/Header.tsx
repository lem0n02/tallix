import React, { useState, useEffect } from 'react';
import {
  Plus,
  ShieldCheck,
  Activity,
  Edit3,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
  Globe,
  User,
  Users
} from 'lucide-react';
import { UserProfile, ThemeMode, LanguageMode } from '../types';
import { getTranslation } from '../i18n/translations';
import { SyncStatusBadge } from './SyncStatusBadge';

interface HeaderProps {
  onOpenNewTransaction: () => void;
  onOpenCommandPalette: () => void;
  user?: UserProfile;
  onOpenEditProfile?: () => void;
  onLogout?: () => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  lang: LanguageMode;
  onLangChange: (lang: LanguageMode) => void;
  onOpenGuestModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewTransaction,
  onOpenCommandPalette,
  user,
  onOpenEditProfile,
  onLogout,
  onToggleMobileMenu,
  isMobileMenuOpen = false,
  theme,
  onThemeChange,
  lang,
  onLangChange,
  onOpenGuestModal,
}) => {
  const [latency, setLatency] = useState<number>(24);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(lang, key);

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
    <header className="h-16 border-b border-[#27272a] bg-[#09090b]/80 backdrop-blur-md flex items-center justify-between px-3 sm:px-6 sticky top-0 z-20">
      {/* Left: Mobile Menu Toggle & Greeting */}
      <div className="flex items-center gap-2 sm:gap-4">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 text-[#a1a1aa] hover:text-white bg-[#18181b] border border-[#27272a] rounded-lg transition-colors cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        {/* Welcome Speech */}
        <div className="flex flex-col">
          <h2 className="text-xs sm:text-sm font-semibold text-[#fafafa] flex items-center gap-1.5">
            <span>{t('welcomeBack')}</span>
            <span className="text-blue-400 font-bold">{user?.name || 'Staff Engineer'}</span>
            <span className="inline-block">👋</span>
          </h2>
          <p className="text-[10px] sm:text-[11px] text-[#a1a1aa] hidden sm:block">
            {t('overviewSubtext')}
          </p>
        </div>
      </div>

      {/* Right: Actions, Theme, Language & User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
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

        {/* Theme Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowThemeMenu(!showThemeMenu);
              setShowLangMenu(false);
              setShowDropdown(false);
            }}
            className="p-1.5 text-[#a1a1aa] hover:text-white bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs"
            title="Switch Theme (Light, Dark, System)"
          >
            {theme === 'light' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : theme === 'dark' ? (
              <Moon className="w-4 h-4 text-blue-400" />
            ) : (
              <Monitor className="w-4 h-4 text-emerald-400" />
            )}
            <span className="hidden xl:inline text-[11px] uppercase font-semibold capitalize">{theme}</span>
          </button>

          {showThemeMenu && (
            <div className="absolute right-0 mt-2 w-36 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl py-1 z-30 animate-fadeIn">
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-[#71717a] border-b border-[#27272a]">
                {t('theme')}
              </div>
              <button
                onClick={() => {
                  onThemeChange('light');
                  setShowThemeMenu(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-[#27272a] transition-colors cursor-pointer ${
                  theme === 'light' ? 'text-amber-400 font-bold bg-[#27272a]/50' : 'text-[#a1a1aa]'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>{t('light')}</span>
              </button>
              <button
                onClick={() => {
                  onThemeChange('dark');
                  setShowThemeMenu(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-[#27272a] transition-colors cursor-pointer ${
                  theme === 'dark' ? 'text-blue-400 font-bold bg-[#27272a]/50' : 'text-[#a1a1aa]'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>{t('dark')}</span>
              </button>
              <button
                onClick={() => {
                  onThemeChange('system');
                  setShowThemeMenu(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-[#27272a] transition-colors cursor-pointer ${
                  theme === 'system' ? 'text-emerald-400 font-bold bg-[#27272a]/50' : 'text-[#a1a1aa]'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>{t('system')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Language Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowLangMenu(!showLangMenu);
              setShowThemeMenu(false);
              setShowDropdown(false);
            }}
            className="p-1.5 text-[#a1a1aa] hover:text-white bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
            title="Language Switcher"
          >
            <Globe className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] font-bold uppercase">{lang === 'en' ? 'EN' : 'বাংলা'}</span>
          </button>

          {showLangMenu && (
            <div className="absolute right-0 mt-2 w-36 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl py-1 z-30 animate-fadeIn">
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-[#71717a] border-b border-[#27272a]">
                {t('language')}
              </div>
              <button
                onClick={() => {
                  onLangChange('en');
                  setShowLangMenu(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[#27272a] transition-colors cursor-pointer ${
                  lang === 'en' ? 'text-blue-400 font-bold bg-[#27272a]/50' : 'text-[#a1a1aa]'
                }`}
              >
                <span>English</span>
                <span className="text-[10px] font-mono">EN</span>
              </button>
              <button
                onClick={() => {
                  onLangChange('bn');
                  setShowLangMenu(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[#27272a] transition-colors cursor-pointer ${
                  lang === 'bn' ? 'text-emerald-400 font-bold bg-[#27272a]/50' : 'text-[#a1a1aa]'
                }`}
              >
                <span>বাংলা</span>
                <span className="text-[10px] font-mono">BN</span>
              </button>
            </div>
          )}
        </div>

        {/* New Transaction Button */}
        <button
          onClick={onOpenNewTransaction}
          className="bg-white hover:bg-[#e4e4e7] active:scale-95 text-black text-xs font-bold px-2.5 sm:px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden xs:inline">{t('newTransaction')}</span>
          <span className="xs:hidden">{t('add')}</span>
        </button>

        {/* User Profile Quick Menu */}
        {user && (
          <div className="relative">
            <button
              onClick={() => {
                setShowDropdown(!showDropdown);
                setShowThemeMenu(false);
                setShowLangMenu(false);
              }}
              className={`w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr ${user.avatarGradient || 'from-emerald-600 to-teal-500'} flex items-center justify-center font-bold text-xs text-white shadow-md border border-[#27272a] hover:border-emerald-500 transition-all cursor-pointer`}
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
                  <div className="mt-1 inline-flex items-center gap-1 text-[9px] uppercase font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 rounded">
                    {user.systemRole} Role
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

                  {onLogout && (
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
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
