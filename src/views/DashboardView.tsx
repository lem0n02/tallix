import React, { useState } from 'react';
import { Expense, Group, Settlement, UserProfile } from '../types';
import { isMemberMatch } from '../utils/balanceEngine';
import { ActiveTab } from '../components/Sidebar';
import {
  ArrowUpRight,
  Search,
  Eye,
  Radio,
  Plus,
  ArrowUpDown,
  User,
  Users,
  Trash2,
  BarChart2,
  TrendingUp,
  Receipt,
  Calendar,
  Activity,
  ArrowRight
} from 'lucide-react';
import { TransactionDetailsModal } from '../components/TransactionDetailsModal';
import { useLanguage } from '../i18n/LanguageContext';

interface DashboardViewProps {
  user: UserProfile;
  expenses: Expense[];
  groups: Group[];
  settlements: Settlement[];
  onSelectTab: (tab: ActiveTab) => void;
  onOpenNewTransaction: () => void;
  onOpenSettleUp: () => void;
  onSaveExpense: (expense: Omit<Expense, 'id'>) => void;
  onUpdateExpenseStatus: (id: string, status: 'Settled' | 'Pending' | 'Flagged') => void;
  onDeleteExpense: (id: string) => void;
  lang?: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  expenses,
  groups,
  settlements,
  onSelectTab,
  onOpenNewTransaction,
  onOpenSettleUp,
  onSaveExpense,
  onUpdateExpenseStatus,
  onDeleteExpense,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Personal' | 'Shared'>('All');
  const [selectedTxForDetails, setSelectedTxForDetails] = useState<Expense | null>(null);

  const { t, formatCurrency, formatNumber, formatDate, toBengaliNumerals } = useLanguage();

  // Aggregated Stats
  const totalExpensesAmount = Math.round(expenses.reduce((sum, exp) => sum + exp.amount, 0) * 100) / 100;

  // Current Month Expenses
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthlyExpensesAmount = Math.round(expenses
    .filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, exp) => sum + exp.amount, 0) * 100) / 100;

  // Personal Expenses
  const personalExpensesList = expenses.filter((e) => !e.isShared);
  const personalExpensesAmount = Math.round(personalExpensesList.reduce((sum, exp) => sum + exp.amount, 0) * 100) / 100;

  // Shared Expenses
  const sharedExpensesList = expenses.filter((e) => e.isShared);
  const sharedExpensesAmount = Math.round(sharedExpensesList.reduce((sum, exp) => sum + exp.amount, 0) * 100) / 100;

  let owedToYou = 0;
  let youOwe = 0;

  groups.forEach((group) => {
    const myMember = group.members.find(
      (m) => isMemberMatch(m, user.id, user.name)
    );
    if (myMember) {
      if (myMember.balance > 0) {
        owedToYou += myMember.balance;
      } else if (myMember.balance < 0) {
        youOwe += Math.abs(myMember.balance);
      }
    }
  });
  owedToYou = Math.round(owedToYou * 100) / 100;
  youOwe = Math.round(youOwe * 100) / 100;

  // Filtered & Sorted Expenses
  const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredExpenses = sortedExpenses.filter((exp) => {
    const matchesSearch =
      exp.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.category.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (typeFilter === 'All') return true;
    if (typeFilter === 'Personal') return !exp.isShared;
    if (typeFilter === 'Shared') return exp.isShared;
    return true;
  });

  const recentExpenses = filteredExpenses.slice(0, 7);

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 flex-1 overflow-y-auto custom-scrollbar relative">
      {/* Primary Metrics Grid (Owed / Receivables / Debt) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        {/* Metric 1: Total Expenses */}
        <div className="bg-[#18181b] border border-[#27272a] p-3.5 sm:p-5 rounded-xl flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-1">
              <p className="text-[10px] sm:text-xs text-[#71717a] uppercase font-bold tracking-wider">
                {t('totalExpenses')}
              </p>
              <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono font-semibold">
                {formatNumber(expenses.length)} {t('txs')}
              </span>
            </div>
            <h2 className="text-xl sm:text-3xl font-light tabular-nums font-mono text-[#fafafa] tracking-tight">
              {formatCurrency(totalExpensesAmount)}
            </h2>
          </div>
          <div className="mt-2.5 sm:mt-4 flex items-center justify-between text-[10px] text-[#a1a1aa]">
            <span className="truncate">{t('personal')}: {formatCurrency(personalExpensesAmount)}</span>
            <span className="truncate ml-1">{t('shared')}: {formatCurrency(sharedExpensesAmount)}</span>
          </div>
        </div>

        {/* Metric 2: Owed to You */}
        <div className="bg-[#18181b] border border-[#27272a] p-3.5 sm:p-5 rounded-xl flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-1">
              <p className="text-[10px] sm:text-xs text-[#71717a] uppercase font-bold tracking-wider">
                {t('owedToYou')}
              </p>
              <span className="text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-semibold">
                {t('receivable')}
              </span>
            </div>
            <h2 className="text-xl sm:text-3xl font-light tabular-nums font-mono text-emerald-400 tracking-tight">
              {formatCurrency(owedToYou)}
            </h2>
          </div>
          <p className="text-[10px] text-[#a1a1aa] mt-2.5 sm:mt-4 truncate">
            {owedToYou > 0 ? t('pendingClaims') : t('noReceivables')}
          </p>
        </div>

        {/* Metric 3: You Owe */}
        <div className="bg-[#18181b] border border-[#27272a] p-3.5 sm:p-5 rounded-xl flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-1">
              <p className="text-[10px] sm:text-xs text-[#71717a] uppercase font-bold tracking-wider">
                {t('youOwe')}
              </p>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                youOwe > 0 
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' 
                  : 'text-[#71717a] bg-zinc-800 border-zinc-700'
              }`}>
                {youOwe > 0 ? t('payable') : t('settled')}
              </span>
            </div>
            <h2 className={`text-xl sm:text-3xl font-light tabular-nums font-mono tracking-tight ${
              youOwe > 0 ? 'text-amber-400' : 'text-[#fafafa]'
            }`}>
              {formatCurrency(youOwe)}
            </h2>
          </div>
          <p className="text-[10px] text-[#a1a1aa] mt-2.5 sm:mt-4 truncate">
            {youOwe > 0 ? t('outstandingBalance') : t('allDebtsCleared')}
          </p>
        </div>
      </div>

      {/* Quick Action Buttons Bar */}
      <div className="grid grid-cols-2 gap-2 w-full">
        <button
          onClick={onOpenNewTransaction}
          className="bg-white hover:bg-[#e4e4e7] active:scale-98 text-black font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('newTransaction')}</span>
        </button>
        <button
          onClick={onOpenSettleUp}
          className="bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-[#fafafa] font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <ArrowUpDown className="w-4 h-4 text-emerald-400" />
          <span>{t('settleUp')}</span>
        </button>
      </div>

      {/* Main Ledger Table Area */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        {/* Table Controls Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27272a] pb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#fafafa]">
              {t('recentExpenses')}
            </h2>
            <p className="text-xs text-[#71717a]">
              {t('liveStream')}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#71717a]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchExpenses')}
                className="bg-[#09090b] border border-[#27272a] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:border-blue-500 w-44 sm:w-56"
              />
            </div>

            {/* Type Filter Buttons */}
            <div className="flex bg-[#09090b] border border-[#27272a] rounded-xl p-0.5 text-xs">
              {(['All', 'Personal', 'Shared'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    typeFilter === type
                      ? 'bg-[#27272a] text-[#fafafa] shadow-sm'
                      : 'text-[#71717a] hover:text-[#fafafa]'
                  }`}
                >
                  {type === 'All' ? t('all') : type === 'Personal' ? t('personal') : t('shared')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Expenses Table */}
        {/* Desktop & Tablet Table Layout */}
        <div className="hidden sm:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#27272a] text-[10px] uppercase tracking-wider font-bold text-[#71717a]">
                <th className="py-2.5 px-3">{t('tableTitle')}</th>
                <th className="py-2.5 px-3">{t('category')}</th>
                <th className="py-2.5 px-3">{t('expenseType')}</th>
                <th className="py-2.5 px-3">{t('date')}</th>
                <th className="py-2.5 px-3 text-right">{t('amount')}</th>
                <th className="py-2.5 px-3 text-right w-16">{t('details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]/50 text-xs">
              {recentExpenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="hover:bg-[#27272a]/40 transition-colors group cursor-pointer"
                  onClick={() => setSelectedTxForDetails(expense)}
                >
                  <td className="py-2.5 px-3 max-w-[200px]">
                    <div className="font-semibold text-[#fafafa] truncate">{expense.merchant}</div>
                    {expense.title && expense.title !== expense.merchant && (
                      <div className="text-[11px] text-[#71717a] truncate">{expense.title}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-[#a1a1aa] whitespace-nowrap">{expense.category}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        expense.isShared
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {expense.isShared ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {expense.isShared ? t('shared') : t('personal')}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[#a1a1aa] font-mono text-[11px] whitespace-nowrap">
                    {formatDate(expense.date)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-[#fafafa] whitespace-nowrap">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTxForDetails(expense);
                      }}
                      className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                    >
                      {t('details')}
                    </button>
                  </td>
                </tr>
              ))}

              {recentExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#71717a]">
                    {t('noTxMatch')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View (< sm) — Compact, No Horizontal Scroll */}
        <div className="block sm:hidden space-y-2">
          {recentExpenses.map((expense) => (
            <div
              key={expense.id}
              onClick={() => setSelectedTxForDetails(expense)}
              className="bg-[#09090b] border border-[#27272a] hover:border-[#3f3f46] rounded-xl p-3 space-y-2 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-xs text-[#fafafa] truncate">{expense.merchant}</h4>
                  {expense.title && expense.title !== expense.merchant && (
                    <p className="text-[11px] text-[#71717a] truncate">{expense.title}</p>
                  )}
                </div>
                <span className="font-mono font-bold text-xs text-[#fafafa] shrink-0">
                  {formatCurrency(expense.amount)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#71717a] pt-1.5 border-t border-[#27272a]/60">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      expense.isShared
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}
                  >
                    {expense.isShared ? t('shared') : t('personal')}
                  </span>
                  <span className="text-[#a1a1aa] truncate max-w-[100px]">{expense.category}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[#71717a]">{formatDate(expense.date)}</span>
                  <span className="text-[11px] font-semibold text-blue-400">{t('details')}</span>
                </div>
              </div>
            </div>
          ))}

          {recentExpenses.length === 0 && (
            <div className="py-6 text-center text-xs text-[#71717a] bg-[#09090b] border border-[#27272a] rounded-xl">
              {t('noTxMatch')}
            </div>
          )}
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedTxForDetails && (
        <TransactionDetailsModal
          expense={selectedTxForDetails}
          isOpen={!!selectedTxForDetails}
          onClose={() => setSelectedTxForDetails(null)}
          onUpdateStatus={(id, status) => {
            onUpdateExpenseStatus(id, status);
            setSelectedTxForDetails(null);
          }}
          onDeleteExpense={(id) => {
            onDeleteExpense(id);
            setSelectedTxForDetails(null);
          }}
        />
      )}
    </div>
  );
};
