import React from 'react';
import { Home, User, Users, BarChart3, Sparkles } from 'lucide-react';
import { ActiveTab } from './Sidebar';
import { UserProfile } from '../types';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  user?: UserProfile;
  onOpenEditProfile?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
}) => {
  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#050811]/95 backdrop-blur-lg border-t border-[#1e293b]/90 px-1 select-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="grid grid-cols-5 items-center h-14 sm:h-16 max-w-lg mx-auto">
        {/* Tab 1: Home */}
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-0.5 transition-all cursor-pointer ${
            activeTab === 'dashboard' ? 'text-[#10b981]' : 'text-[#64748b] hover:text-[#94a3b8]'
          }`}
          aria-label="Home"
        >
          <Home className="w-5 h-5 shrink-0" />
          <span className="text-[10px] font-medium mt-0.5 leading-tight">Home</span>
          {activeTab === 'dashboard' ? (
            <span className="w-6 h-0.5 bg-[#10b981] rounded-full mt-0.5" />
          ) : (
            <span className="w-6 h-0.5 bg-transparent mt-0.5" />
          )}
        </button>

        {/* Tab 2: Expenses */}
        <button
          onClick={() => onSelectTab('personal-expenses')}
          className={`flex flex-col items-center justify-center py-1 px-0.5 transition-all cursor-pointer ${
            activeTab === 'personal-expenses' ? 'text-[#10b981]' : 'text-[#64748b] hover:text-[#94a3b8]'
          }`}
          aria-label="Expenses"
        >
          <User className="w-5 h-5 shrink-0" />
          <span className="text-[10px] font-medium mt-0.5 leading-tight">
            Expenses
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
          <span className="text-[9px] font-medium mt-0.5 leading-tight text-center">
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
          <span className="text-[10px] font-medium mt-0.5 leading-tight">Analytics</span>
          {activeTab === 'analytics' ? (
            <span className="w-6 h-0.5 bg-[#10b981] rounded-full mt-0.5" />
          ) : (
            <span className="w-6 h-0.5 bg-transparent mt-0.5" />
          )}
        </button>

        {/* Tab 5: Tallix AI */}
        <button
          onClick={() => onSelectTab('ai-advisor')}
          className={`flex flex-col items-center justify-center py-1 px-0.5 transition-all cursor-pointer ${
            activeTab === 'ai-advisor' ? 'text-[#10b981]' : 'text-[#64748b] hover:text-[#94a3b8]'
          }`}
          aria-label="Tallix AI"
        >
          <Sparkles className="w-5 h-5 shrink-0" />
          <span className="text-[10px] font-medium mt-0.5 leading-tight text-center">
            Tallix AI
          </span>
          {activeTab === 'ai-advisor' ? (
            <span className="w-6 h-0.5 bg-[#10b981] rounded-full mt-0.5" />
          ) : (
            <span className="w-6 h-0.5 bg-transparent mt-0.5" />
          )}
        </button>
      </div>
    </nav>
  );
};
