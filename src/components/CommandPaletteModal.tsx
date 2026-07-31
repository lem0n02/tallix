import React, { useState, useEffect } from 'react';
import { Search, X, Receipt, Users, Terminal, ArrowRight } from 'lucide-react';
import { Expense, Group } from '../types';
import { ActiveTab } from './Sidebar';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: Expense[];
  groups: Group[];
  onSelectTab: (tab: ActiveTab) => void;
  onSelectGroup: (groupId: string) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  expenses,
  groups,
  onSelectTab,
  onSelectGroup,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setQuery('');
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredExpenses = expenses.filter(
    (exp) =>
      exp.title.toLowerCase().includes(query.toLowerCase()) ||
      exp.merchant.toLowerCase().includes(query.toLowerCase()) ||
      exp.category.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 4);

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-20 p-4">
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Search Bar */}
        <div className="p-4 border-b border-[#27272a] flex items-center gap-3 bg-[#09090b]">
          <Search className="w-5 h-5 text-[#71717a]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, merchant, category, or group name..."
            className="w-full bg-transparent text-[#fafafa] placeholder-[#71717a] text-sm focus:outline-none"
          />
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-[#fafafa] p-1 rounded hover:bg-[#27272a]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Results / Commands */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Quick Module Navigation */}
          {!query && (
            <div>
              <div className="text-[10px] uppercase font-bold text-[#71717a] tracking-widest px-2 mb-2">
                Quick Navigation
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    onSelectTab('dashboard');
                    onClose();
                  }}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#27272a]/50 hover:bg-[#27272a] text-xs text-[#fafafa] transition-colors text-left"
                >
                  <span className="font-medium">Go to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#71717a]" />
                </button>
                <button
                  onClick={() => {
                    onSelectTab('personal-expenses');
                    onClose();
                  }}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#27272a]/50 hover:bg-[#27272a] text-xs text-[#fafafa] transition-colors text-left"
                >
                  <span className="font-medium">Personal Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#71717a]" />
                </button>
                <button
                  onClick={() => {
                    onSelectTab('shared-groups');
                    onClose();
                  }}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#27272a]/50 hover:bg-[#27272a] text-xs text-[#fafafa] transition-colors text-left"
                >
                  <span className="font-medium">Settlements & Claims</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#71717a]" />
                </button>
                <button
                  onClick={() => {
                    onSelectTab('ai-advisor');
                    onClose();
                  }}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#27272a]/50 hover:bg-[#27272a] text-xs text-[#fafafa] transition-colors text-left"
                >
                  <span className="font-medium text-blue-400">AI Spend Auditor</span>
                  <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                </button>
              </div>
            </div>
          )}

          {/* Groups Matching */}
          {filteredGroups.length > 0 && (
            <div>
              <div className="text-[10px] uppercase font-bold text-[#71717a] tracking-widest px-2 mb-2 flex items-center gap-1.5">
                <Users className="w-3 h-3" /> Shared Squads
              </div>
              <div className="space-y-1">
                {filteredGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => {
                      onSelectTab('shared-groups');
                      onSelectGroup(group.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-[#27272a] text-xs text-[#fafafa] transition-colors text-left"
                  >
                    <div>
                      <p className="font-semibold text-sm">{group.name}</p>
                      <p className="text-[11px] text-[#a1a1aa]">{group.description}</p>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      ৳{group.totalSpent.toFixed(2)} spent
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Expenses Matching */}
          {filteredExpenses.length > 0 && (
            <div>
              <div className="text-[10px] uppercase font-bold text-[#71717a] tracking-widest px-2 mb-2 flex items-center gap-1.5">
                <Receipt className="w-3 h-3" /> Matching Ledger Entries
              </div>
              <div className="space-y-1">
                {filteredExpenses.map((exp) => (
                  <button
                    key={exp.id}
                    onClick={() => {
                      onSelectTab('personal-expenses');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-[#27272a] text-xs text-[#fafafa] transition-colors text-left"
                  >
                    <div>
                      <p className="font-medium">{exp.title}</p>
                      <p className="text-[10px] text-[#71717a]">{exp.merchant} • {exp.category}</p>
                    </div>
                    <span className="font-mono text-sm text-[#fafafa]">
                      ৳{exp.amount.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {query && filteredExpenses.length === 0 && filteredGroups.length === 0 && (
            <div className="py-8 text-center text-xs text-[#71717a]">
              No transactions or squads found matching &quot;{query}&quot;.
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-[#27272a] bg-[#09090b] text-[10px] text-[#71717a] flex justify-between items-center">
          <span>Press <kbd className="bg-[#27272a] px-1 py-0.5 rounded text-[#a1a1aa]">ESC</kbd> to close</span>
          <span className="font-mono">TALLIX SEARCH ENGINE v1.2</span>
        </div>
      </div>
    </div>
  );
};
