import React, { useState } from 'react';
import { Expense, Group, Settlement, UserProfile } from '../types';
import { isMemberMatch } from '../utils/balanceEngine';
import { toPaisa, fromPaisa, sumExactAmounts } from '../utils/money';
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
  expenses = [],
  groups = [],
  settlements = [],
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

  // Helper to determine if an expense was paid or owned by the current user
  const isPaidOrOwnedByCurrentUser = (exp: Expense) => {
    const cleanUserEmail = (user.email || '').toLowerCase();
    const userMember = { id: user.id, name: user.name, email: user.email };
    return (
      isMemberMatch(userMember, exp.paidByUserId, exp.paidByName) ||
      exp.paidByUserId === user.id ||
      exp.createdBy === user.id ||
      (exp as any).createdByEmail?.toLowerCase() === cleanUserEmail
    );
  };

  // Personal Expenses: money personally paid by the current user
  const personalExpensesList = expenses.filter((e) => !e.isShared && isPaidOrOwnedByCurrentUser(e));
  const personalExpensesAmount = sumExactAmounts(
    personalExpensesList.map((exp) => exp.originalAmount ?? exp.amount)
  );

  // Current User's Group Contribution / My Paid: money actually paid by current user for shared expenses
  const mySharedExpensesList = expenses.filter((e) => e.isShared && isPaidOrOwnedByCurrentUser(e));
  const mySharedExpensesAmount = sumExactAmounts(
    mySharedExpensesList.map((exp) => exp.originalAmount ?? exp.amount)
  );

  // TOTAL EXPENSES = PERSONAL EXPENSES + CURRENT USER'S GROUP CONTRIBUTION
  // Excludes other squad members' payments (e.g. ৳65 paid by others is not counted in current user's expenses)
  const totalExpensesAmount = fromPaisa(
    toPaisa(personalExpensesAmount) + toPaisa(mySharedExpensesAmount)
  );

  const myPaidTransactionsCount = personalExpensesList.length + mySharedExpensesList.length;

  let owedToYouPaisa = 0;
  let youOwePaisa = 0;

  groups.forEach((group) => {
    const myMember = group.members.find(
      (m) => isMemberMatch(m, user.id, user.name)
    );
    if (myMember) {
      const bPaisa = toPaisa(myMember.balance);
      if (bPaisa > 0) {
        owedToYouPaisa += bPaisa;
      } else if (bPaisa < 0) {
        youOwePaisa += Math.abs(bPaisa);
      }
    }
  });
  const owedToYou = fromPaisa(owedToYouPaisa);
  const youOwe = fromPaisa(youOwePaisa);

  // Dashboard transaction list: only current user's personal expenses + squad expenses paid/owned by current user
  const dashboardEligibleExpenses = React.useMemo(() => {
    return expenses.filter((exp) => isPaidOrOwnedByCurrentUser(exp));
  }, [expenses, user]);

  // Filtered & Sorted Expenses
  const sortedExpenses = React.useMemo(() => {
    return [...dashboardEligibleExpenses].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [dashboardEligibleExpenses]);

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
    <div className="px-4 py-3 sm:p-5 lg:p-6 space-y-3 sm:space-y-6 flex-1 overflow-y-auto custom-scrollbar relative pb-28 sm:pb-6">
      {/* Primary Metrics Grid (Owed / Receivables / Debt) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Metric 1: Total Expenses */}
        <div className="bg-[#0c1220] sm:bg-[#18181b] border border-[#1e293b] sm:border-[#27272a] p-4 sm:p-5 rounded-2xl sm:rounded-xl flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs sm:text-[10px] text-[#94a3b8] sm:text-[#71717a] uppercase font-semibold sm:font-bold tracking-wider">
                {t('totalExpenses')}
              </p>
              <span className="text-xs sm:text-[9px] font-medium sm:font-mono sm:font-semibold text-[#38bdf8] sm:text-blue-400 bg-[#0c2340] sm:bg-blue-500/10 border border-[#0284c7]/40 sm:border-blue-500/20 px-2.5 py-0.5 sm:px-1.5 sm:rounded rounded-md">
                {formatNumber(myPaidTransactionsCount)} {t('txs')}
              </span>
            </div>
            <h2 className="text-3xl sm:text-3xl font-bold sm:font-light tabular-nums font-sans sm:font-mono text-white sm:text-[#fafafa] tracking-tight mt-1 mb-2 sm:my-0">
              {formatCurrency(totalExpensesAmount)}
            </h2>
          </div>
          <div className="mt-2 sm:mt-4 flex items-center justify-between text-sm sm:text-[10px] text-[#94a3b8] sm:text-[#a1a1aa]">
            <span className="truncate">{t('personal')}: {formatCurrency(personalExpensesAmount)}</span>
            <span className="truncate ml-1">{t('shared')}: {formatCurrency(mySharedExpensesAmount)}</span>
          </div>
        </div>

        {/* Metric 2: Owed to You */}
        <div className="bg-[#0c1220] sm:bg-[#18181b] border border-[#1e293b] sm:border-[#27272a] p-4 sm:p-5 rounded-2xl sm:rounded-xl flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs sm:text-[10px] text-[#94a3b8] sm:text-[#71717a] uppercase font-semibold sm:font-bold tracking-wider">
                {t('owedToYou')}
              </p>
              <span className="text-xs sm:text-[9px] font-medium sm:font-mono sm:font-semibold text-[#10b981] sm:text-emerald-400 bg-[#064e3b]/50 sm:bg-emerald-500/10 border border-[#059669]/40 sm:border-emerald-500/20 px-2.5 py-0.5 sm:px-1.5 sm:rounded rounded-md">
                {t('receivable')}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold sm:font-light tabular-nums font-sans sm:font-mono text-[#10b981] sm:text-emerald-400 tracking-tight mt-1 mb-1 sm:my-0">
              {formatCurrency(owedToYou)}
            </h2>
          </div>
          <p className="text-xs sm:text-[10px] text-[#64748b] sm:text-[#a1a1aa] mt-1 sm:mt-4 truncate">
            {owedToYou > 0 ? t('pendingClaims') : t('noReceivables')}
          </p>
        </div>

        {/* Metric 3: You Owe */}
        <div className="bg-[#0c1220] sm:bg-[#18181b] border border-[#1e293b] sm:border-[#27272a] p-4 sm:p-5 rounded-2xl sm:rounded-xl flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs sm:text-[10px] text-[#94a3b8] sm:text-[#71717a] uppercase font-semibold sm:font-bold tracking-wider">
                {t('youOwe')}
              </p>
              <span
                className={`text-xs sm:text-[9px] font-medium sm:font-mono sm:font-bold px-2.5 py-0.5 sm:px-1.5 sm:rounded rounded-md border ${
                  youOwe > 0 
                    ? 'text-amber-400 bg-amber-950/50 border-amber-800/50 sm:bg-amber-500/10 sm:border-amber-500/20' 
                    : 'text-[#94a3b8] sm:text-[#71717a] bg-[#1e293b]/70 sm:bg-zinc-800 border-[#334155]/60 sm:border-zinc-700'
                }`}
              >
                {youOwe > 0 ? t('payable') : t('settled')}
              </span>
            </div>
            <h2
              className={`text-2xl sm:text-3xl font-bold sm:font-light tabular-nums font-sans sm:font-mono tracking-tight mt-1 mb-1 sm:my-0 ${
                youOwe > 0 ? 'text-amber-400' : 'text-white sm:text-[#fafafa]'
              }`}
            >
              {formatCurrency(youOwe)}
            </h2>
          </div>
          <p className="text-xs sm:text-[10px] text-[#64748b] sm:text-[#a1a1aa] mt-1 sm:mt-4 truncate">
            {youOwe > 0 ? t('outstandingBalance') : t('allDebtsCleared')}
          </p>
        </div>
      </div>

      {/* Quick Action Buttons Bar */}
      <div className="grid grid-cols-2 gap-3 sm:gap-2 w-full my-0.5 sm:my-0">
        <button
          onClick={onOpenNewTransaction}
          className="bg-white hover:bg-slate-100 sm:hover:bg-[#e4e4e7] active:scale-[0.98] text-[#090d16] sm:text-black font-semibold sm:font-bold text-sm sm:text-xs py-3.5 sm:py-2.5 px-4 rounded-2xl sm:rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm sm:shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{t('newTransaction')}</span>
        </button>
        <button
          onClick={onOpenSettleUp}
          className="bg-[#0c1220] sm:bg-[#18181b] hover:bg-[#131b2e] sm:hover:bg-[#27272a] border border-[#1e293b] sm:border-[#27272a] text-white sm:text-[#fafafa] font-semibold sm:font-bold text-sm sm:text-xs py-3.5 sm:py-2.5 px-4 rounded-2xl sm:rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
        >
          <ArrowUpDown className="w-4 h-4 text-[#10b981] sm:text-emerald-400" />
          <span>{t('settleUp')}</span>
        </button>
      </div>

      {/* Main Ledger Table Area */}
      <div className="bg-[#0c1220] sm:bg-[#18181b] border border-[#1e293b] sm:border-[#27272a] rounded-2xl p-4 sm:p-5 space-y-3.5 sm:space-y-4 shadow-xl">
        {/* Table Controls Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:border-b sm:border-[#27272a] sm:pb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white sm:text-[#fafafa]">
              {t('recentExpenses')}
            </h2>
            <p className="text-xs text-[#64748b] sm:text-[#71717a] mt-0.5">
              {t('liveStream')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-auto">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 sm:top-2.5 text-[#64748b] sm:text-[#71717a]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchExpenses')}
                className="bg-[#070b14] sm:bg-[#09090b] border border-[#1e293b] sm:border-[#27272a] rounded-xl pl-9 sm:pl-8 pr-3 py-2.5 sm:py-1.5 text-xs text-white sm:text-[#fafafa] placeholder-[#475569] sm:placeholder-[#52525b] focus:outline-none focus:border-[#38bdf8]/50 sm:focus:border-blue-500 w-full sm:w-56"
              />
            </div>

            {/* Type Filter Buttons */}
            <div className="flex items-center gap-2 sm:gap-0 sm:bg-[#09090b] sm:border sm:border-[#27272a] sm:rounded-xl sm:p-0.5 text-xs">
              {(['All', 'Personal', 'Shared'] as const).map((type) => {
                const isActive = typeFilter === type;
                const label = type === 'All' ? t('all') : type === 'Personal' ? t('personal') : t('shared');
                return (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#1e293b] text-white border border-slate-700/60 font-semibold px-4 py-1.5 rounded-full text-xs shadow-sm sm:bg-[#27272a] sm:text-[#fafafa] sm:border-0 sm:rounded-lg sm:text-[11px] sm:px-3 sm:py-1'
                        : 'text-[#94a3b8] hover:text-white font-medium px-3 py-1.5 rounded-full text-xs sm:text-[#71717a] sm:hover:text-[#fafafa] sm:rounded-lg sm:text-[11px] sm:px-3 sm:py-1'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
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
        <div className="block sm:hidden space-y-2.5">
          {recentExpenses.map((expense) => {
            const isShared = expense.isShared;
            const displayTitle = expense.title || expense.merchant;
            const hasSecondary = expense.title && expense.merchant && expense.title !== expense.merchant;
            return (
              <div
                key={expense.id}
                onClick={() => setSelectedTxForDetails(expense)}
                className="bg-[#070b14] border border-[#1e293b] hover:border-[#334155] rounded-xl p-3.5 transition-colors cursor-pointer"
              >
                {/* Top Row: Merchant/Title & Amount */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-sm text-white truncate">{displayTitle}</h4>
                    {hasSecondary && (
                      <p className="text-[11px] text-[#64748b] truncate">{expense.merchant}</p>
                    )}
                  </div>
                  <span className="font-bold text-sm text-white shrink-0">
                    {formatCurrency(expense.amount)}
                  </span>
                </div>

                {/* Bottom Row: Type badge, Category with dot, Date, Details button */}
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {isShared ? (
                      <span className="text-[10px] font-bold text-[#10b981] bg-[#064e3b]/40 border border-[#059669]/40 px-2 py-0.5 rounded shrink-0">
                        SHARED
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-[#38bdf8] bg-[#0c2340] border border-[#0284c7]/40 px-2 py-0.5 rounded shrink-0">
                        PERSONAL
                      </span>
                    )}
                    <span className="text-[#94a3b8] flex items-center gap-1.5 text-xs truncate">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0"></span>
                      <span className="truncate">{expense.category}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-xs text-[#64748b]">{formatDate(expense.date)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTxForDetails(expense);
                      }}
                      className="text-xs font-medium text-[#38bdf8] hover:text-[#7dd3fc] hover:underline cursor-pointer"
                    >
                      {t('details')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {recentExpenses.length === 0 && (
            <div className="py-6 text-center text-xs text-[#64748b] bg-[#070b14] border border-[#1e293b] rounded-xl">
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
