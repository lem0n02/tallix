import React, { useState } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Users,
  BarChart3,
  Sparkles,
  Terminal,
  Activity,
  ChevronRight,
  Plus,
  User,
  LogOut,
  Edit3,
  Sun,
  Moon,
  Monitor,
  Globe
} from 'lucide-react';
import { UserProfile, Group, ThemeMode, LanguageMode } from '../types';
import { getTranslation } from '../i18n/translations';
import tallixLogo from '../assets/images/tallix_brand_app_logo_1785406274692.jpg';

export type ActiveTab =
  | 'dashboard'
  | 'personal-expenses'
  | 'shared-groups'
  | 'analytics'
  | 'ai-advisor'
  | 'activity'
  | 'system-admin';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  user: UserProfile;
  groups: Group[];
  selectedGroupId: string | null;
  setSelectedGroupId: (id: string | null) => void;
  onOpenNewGroup: () => void;
  onOpenEditProfile: () => void;
  onLogout: () => void;
  isMobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  lang: LanguageMode;
  onLangChange: (lang: LanguageMode) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  user,
  groups,
  selectedGroupId,
  setSelectedGroupId,
  onOpenNewGroup,
  onOpenEditProfile,
  onLogout,
  isMobileMenuOpen = false,
  onCloseMobileMenu,
  theme,
  onThemeChange,
  lang,
  onLangChange,
}) => {
  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(lang, key);

  const getInitials = (str: string) => {
    if (!str) return 'U';
    const parts = str.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return str.slice(0, 2).toUpperCase();
  };

  const handleNavClick = (action: () => void) => {
    action();
    if (onCloseMobileMenu) onCloseMobileMenu();
  };

  const coreNavItems = [
    { id: 'dashboard' as ActiveTab, label: t('dashboard'), icon: LayoutDashboard },
    { id: 'personal-expenses' as ActiveTab, label: t('personalExpenses'), icon: Receipt },
    { id: 'shared-groups' as ActiveTab, label: t('sharedGroups'), icon: Users, badge: groups.length },
    { id: 'analytics' as ActiveTab, label: t('analytics'), icon: BarChart3 },
    { id: 'ai-advisor' as ActiveTab, label: t('aiCopilot'), icon: Sparkles, highlight: true },
  ];

  const isAdminUser = user.systemRole === 'Admin';

  const adminNavItems = [
    { id: 'system-admin' as ActiveTab, label: t('adminDashboard'), icon: Terminal },
  ];

  const sidebarContent = (
    <aside className="w-64 border-r border-[#27272a] bg-[#09090b] flex flex-col h-full select-none shrink-0">
      {/* Brand Header */}
      <div className="p-6 flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => handleNavClick(() => setActiveTab('dashboard'))}
        >
          <div className="w-9 h-9 bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg flex items-center justify-center shrink-0">
            <img
              src={tallixLogo}
              alt="Tallix Logo"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-semibold tracking-tight text-[#fafafa]">{t('brandName')}</span>
            <span className="text-[9px] uppercase tracking-widest text-[#71717a] font-bold">{t('brandTagline')}</span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 space-y-6 overflow-y-auto custom-scrollbar">
        {/* Core Modules */}
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#71717a] font-bold px-2 mb-2">
            {t('coreModules')}
          </div>
          <div className="space-y-1">
            {coreNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() =>
                    handleNavClick(() => {
                      setActiveTab(item.id);
                      setSelectedGroupId(null);
                    })
                  }
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#27272a] text-[#fafafa] font-semibold border-l-2 border-blue-500 pl-2.5'
                      : 'text-[#a1a1aa] hover:text-white hover:bg-[#18181b]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${item.highlight ? 'text-blue-400 animate-pulse' : 'text-[#71717a]'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="text-[10px] bg-[#27272a] text-[#a1a1aa] px-1.5 py-0.5 rounded font-mono">
                      {item.badge}
                    </span>
                  )}
                  {item.highlight && (
                    <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/30 px-1.5 py-0.2 rounded uppercase font-bold">
                      AI
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Group Shortcuts */}
        <div>
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[10px] uppercase tracking-widest text-[#71717a] font-bold">
              {t('sharedSquads')}
            </span>
            <button
              onClick={() => handleNavClick(onOpenNewGroup)}
              className="text-[#71717a] hover:text-white transition-colors cursor-pointer"
              title={t('newSquad')}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {groups.map((group) => {
              const isSelected = activeTab === 'shared-groups' && selectedGroupId === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() =>
                    handleNavClick(() => {
                      setSelectedGroupId(group.id);
                      setActiveTab('shared-groups');
                    })
                  }
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#27272a] text-[#fafafa] font-semibold'
                      : 'text-[#a1a1aa] hover:text-white hover:bg-[#18181b]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-tr ${group.avatarGradient} shrink-0`} />
                    <span className="truncate">{group.name}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-[#52525b]" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Admin Section (If systemRole === 'Admin') */}
        {isAdminUser && (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold px-2 mb-2 flex items-center gap-1">
              <Terminal className="w-3 h-3 text-emerald-400" />
              <span>Super Admin</span>
            </div>
            <div className="space-y-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(() => setActiveTab(item.id))}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-300 font-semibold border-l-2 border-emerald-500 pl-2.5'
                        : 'text-[#a1a1aa] hover:text-white hover:bg-[#18181b]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-emerald-400" />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Footer Controls & User Card */}
      <div className="p-4 border-t border-[#27272a] space-y-3">
        {/* Quick Theme & Lang Controls */}
        <div className="flex items-center justify-between gap-2 bg-[#18181b] border border-[#27272a] p-1.5 rounded-xl text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onThemeChange('light')}
              className={`p-1 rounded-lg transition-colors cursor-pointer ${theme === 'light' ? 'bg-[#27272a] text-amber-400 font-bold' : 'text-[#71717a]'}`}
              title="Light Theme"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onThemeChange('dark')}
              className={`p-1 rounded-lg transition-colors cursor-pointer ${theme === 'dark' ? 'bg-[#27272a] text-blue-400 font-bold' : 'text-[#71717a]'}`}
              title="Dark Theme"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onThemeChange('system')}
              className={`p-1 rounded-lg transition-colors cursor-pointer ${theme === 'system' ? 'bg-[#27272a] text-emerald-400 font-bold' : 'text-[#71717a]'}`}
              title="System Theme"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => onLangChange(lang === 'en' ? 'bn' : 'en')}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] text-[11px] font-bold cursor-pointer transition-colors"
          >
            <Globe className="w-3 h-3 text-emerald-400" />
            <span>{lang === 'en' ? 'EN' : 'বাংলা'}</span>
          </button>
        </div>

        {/* User Card */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-[#18181b]/70 border border-[#27272a] hover:border-[#3f3f46] transition-colors">
          <div
            onClick={() => handleNavClick(onOpenEditProfile)}
            className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
            title="Click to edit profile"
          >
            <div
              className={`w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr ${user.avatarGradient || 'from-emerald-500 to-teal-500'} flex items-center justify-center font-bold text-xs text-white shadow-sm shrink-0`}
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
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#fafafa] truncate">{user.name}</p>
              <p className="text-[10px] text-[#71717a] truncate font-mono">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleNavClick(onOpenEditProfile)}
              className="p-1.5 text-[#71717a] hover:text-[#fafafa] hover:bg-[#27272a] rounded-md transition-colors cursor-pointer"
              title={t('editProfile')}
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
            </button>
            <button
              onClick={() => handleNavClick(onLogout)}
              className="p-1.5 text-[#71717a] hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer"
              title={t('logout')}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:flex h-screen shrink-0">{sidebarContent}</div>

      {/* Mobile Slide-Over Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobileMenu}
          />
          <div className="relative flex-1 max-w-xs w-full bg-[#09090b] h-full z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
