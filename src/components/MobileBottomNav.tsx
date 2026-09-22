import React from 'react';
import { Home, User, Users, BarChart3, Sparkles } from 'lucide-react';
import { ActiveTab } from './Sidebar';
import { UserProfile } from '../types';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  user: UserProfile;
  onOpenEditProfile: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  user,
  onOpenEditProfile,
}) => {
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#050811]/95 backdrop-blur-lg border-t border-[#1e293b]/90 px-1 select-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="grid grid-cols-6 items-center h-16 max-w-lg mx-auto">
        {/* Tab 1: Home */}
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-0.5 transition-all cursor-pointer ${
            activeTab === 'dashboard' ? 'text-[#10b981]' : 'text-[#64748b] hover:text-[#94a3b8]'
          }`}
          aria-label="Home"
        >
          <Home className="w-5 h-5 shrink-0" />
          <span className="text-[10px] font-medium mt-1 leading-tight">Home</span>
          {activeTab === 'dashboard' ? (
            <span className="w-6 h-0.5 bg-[#10b981] rounded-full mt-0.5" />
          ) : (
            <span className="w-6 h-0.5 bg-transparent mt-0.5" />
          )}
        </button>

        {/* Tab 2: Personal Expenses */}
        <button
          onClick={() => onSelectTab('personal-expenses')}
          className={`flex flex-col items-center justify-center py-1 px-0.5 transition-all cursor-pointer ${
            activeTab === 'personal-expenses' ? 'text-[#10b981]' : 'text-[#64748b] hover:text-[#94a3b8]'
          }`}
          aria-label="Personal Expenses"
        >
          <User className="w-5 h-5 shrink-0" />
          <span className="text-[9px] font-medium mt-1 leading-tight text-center">
            Personal<br />Experiences
          </span>
          {activeTab === 'personal-expenses' ? (
            <span className="w-6 h-0.5 bg-[#10b981] rounded-full mt-0.5" />
          ) : (
            <span className="w-6 h-0.5 bg-transparent mt-0.5" />
          )}
        </button>

        {/* Tab 3: Shared Group */}
        <button
          onClick={() => onSelectTab('shared-groups')}
          className={`flex flex-col items-center justify-center py-1 px-0.5 transition-all cursor-pointer ${
            activeTab === 'shared-groups' ? 'text-[#10b981]' : 'text-[#64748b] hover:text-[#94a3b8]'
          }`}
          aria-label="Shared Group"
        >
          <Users className="w-5 h-5 shrink-0" />
          <span className="text-[9px] font-medium mt-1 leading-tight text-center">
            Shared<br />Group
          </span>
          {activeTab === 'shared-groups' ? (
            <span className="w-6 h-0.5 bg-[#10b981] rounded-full mt-0.5" />
          ) : (
            <span className="w-6 h-0.5 bg-transparent mt-0.5" />
          )}
        </button>

        {/* Tab 4: Analytics */}
        <button
          onClick={() => onSelectTab('analytics')}
          className={`flex flex-col items-center justify-center py-1 px-0.5 transition-all cursor-pointer ${
            activeTab === 'analytics' ? 'text-[#10b981]' : 'text-[#64748b] hover:text-[#94a3b8]'
          }`}
          aria-label="Analytics"
        >
          <BarChart3 className="w-5 h-5 shrink-0" />
          <span className="text-[10px] font-medium mt-1 leading-tight">Analytics</span>
          {activeTab === 'analytics' ? (
            <span className="w-6 h-0.5 bg-[#10b981] rounded-full mt-0.5" />
          ) : (
            <span className="w-6 h-0.5 bg-transparent mt-0.5" />
          )}
        </button>

        {/* Tab 5: Talix AI Copilot */}
        <button
          onClick={() => onSelectTab('ai-advisor')}
          className={`flex flex-col items-center justify-center py-1 px-0.5 transition-all cursor-pointer ${
            activeTab === 'ai-advisor' ? 'text-[#10b981]' : 'text-[#64748b] hover:text-[#94a3b8]'
          }`}
          aria-label="Talix AI Copilot"
        >
          <Sparkles className="w-5 h-5 shrink-0" />
          <span className="text-[9px] font-medium mt-1 leading-tight text-center">
            Talix AI<br />Copilot
          </span>
          {activeTab === 'ai-advisor' ? (
            <span className="w-6 h-0.5 bg-[#10b981] rounded-full mt-0.5" />
          ) : (
            <span className="w-6 h-0.5 bg-transparent mt-0.5" />
          )}
        </button>

        {/* Tab 6: User Avatar */}
        <button
          onClick={onOpenEditProfile}
          className="flex flex-col items-center justify-center py-1 px-0.5 transition-all cursor-pointer group"
          aria-label="User Account"
          title={user?.name || 'Account Settings'}
        >
          <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm overflow-hidden border border-blue-400/40 group-hover:border-blue-300">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span>{getInitials(user?.name)}</span>
            )}
          </div>
          <span className="w-6 h-0.5 bg-transparent mt-1" />
        </button>
      </div>
    </nav>
  );
};
