import React, { useState, useMemo, useCallback } from 'react';
import { Group, Expense, Settlement, UserProfile } from '../types';
import { calculateGroupMembersWithBalances, isMemberMatch } from '../utils/balanceEngine';
import { toPaisa, fromPaisa, sumExactAmounts } from '../utils/money';
import {
  Users,
  Plus,
  Check,
  TrendingUp,
  UserPlus,
  Trash2,
  AlertTriangle,
  Copy,
  UserX,
  Scale,
  Edit,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  HelpCircle,
  ChevronRight,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useLanguage } from '../i18n/LanguageContext';

interface SharedGroupsViewProps {
  groups: Group[];
  expenses: Expense[];
  allExpenses?: Expense[];
  settlements?: Settlement[];
  selectedGroupId: string | null;
  setSelectedGroupId: (id: string | null) => void;
  currentUser?: UserProfile | null;
  onOpenNewGroup: () => void;
  onOpenJoinGroup: () => void;
  onOpenNewTransaction: () => void;
  onOpenSettleUp?: (groupId?: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onRemoveMember?: (groupId: string, memberId: string) => void;
  onDeleteExpense?: (expenseId: string) => void;
  onEditExpense?: (expense: Expense) => void;
  onAcceptSettlement?: (settlementId: string) => void;
  onRejectSettlement?: (settlementId: string) => void;
}

const MEMBER_LINE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export const SharedGroupsView: React.FC<SharedGroupsViewProps> = ({
  groups,
  expenses,
  allExpenses,
  settlements = [],
  selectedGroupId,
  setSelectedGroupId,
  currentUser,
  onOpenNewGroup,
  onOpenJoinGroup,
  onOpenNewTransaction,
  onOpenSettleUp,
  onDeleteGroup,
  onRemoveMember,
  onDeleteExpense,
  onEditExpense,
  onAcceptSettlement,
  onRejectSettlement,
}) => {
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null);
  const [squadToDelete, setSquadToDelete] = useState<Group | null>(null);
  const [spendingViewMode, setSpendingViewMode] = useState<'donut' | 'timeline'>('donut');

  const { t, formatCurrency, formatNumber, formatDate } = useLanguage();

  const handleCopyInvite = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedInvite(code);
    setTimeout(() => setCopiedInvite(null), 2500);
  };

  const handleConfirmDelete = () => {
    if (squadToDelete && onDeleteGroup) {
      onDeleteGroup(squadToDelete.id);
      setSquadToDelete(null);
    }
  };

  // Authoritative selected squad
  const activeGroup = useMemo(() => {
    if (!groups || groups.length === 0) return null;
    return (
      groups.find(
        (g) =>
          g.id === selectedGroupId ||
          (selectedGroupId && g.inviteCode && g.inviteCode.toUpperCase() === selectedGroupId.toUpperCase())
      ) || groups[0]
    );
  }, [groups, selectedGroupId]);

  // Use allExpenses when available so month filtering on dashboard does not strip squad history
  const groupSourceExpenses = useMemo(() => {
    return allExpenses && allExpenses.length > 0 ? allExpenses : expenses;
  }, [allExpenses, expenses]);

  // Expenses for the currently selected squad
  const groupExpenses = useMemo(() => {
    if (!activeGroup) return [];
    return groupSourceExpenses.filter((exp) => exp.isShared && exp.groupId === activeGroup.id);
  }, [groupSourceExpenses, activeGroup]);

  // Settlements for the currently selected squad
  const groupSettlements = useMemo(() => {
    if (!activeGroup) return [];
    return settlements.filter((stl) => stl.groupId === activeGroup.id);
  }, [settlements, activeGroup]);

  const pendingSettlements = useMemo(() => {
    return groupSettlements.filter((stl) => {
      const st = (stl.status || '').toLowerCase();
      return st === 'pending' || st === 'pending approval';
    });
  }, [groupSettlements]);

  // Helper to sanitize stored member names (strip accidental hardcoded '(You)')
  const cleanMemberName = useCallback((name: string): string => {
    return (name || '').replace(/\s*\(\s*you\s*\)\s*/gi, '').trim();
  }, []);

  // Compute member balances using the authoritative balanceEngine
  const updatedMembers = useMemo(() => {
    if (!activeGroup) return [];
    return calculateGroupMembersWithBalances(activeGroup, groupSourceExpenses, settlements);
  }, [activeGroup, groupSourceExpenses, settlements]);

  // Identify the current authenticated user's corresponding squad member
  const currentUserMember = useMemo(() => {
    if (!updatedMembers || updatedMembers.length === 0 || !currentUser) return null;
    return (
      updatedMembers.find((m) =>
        isMemberMatch(m, currentUser.id, currentUser.name)
      ) || null
    );
  }, [updatedMembers, currentUser]);

  // 1. TOTAL SQUAD SPENDING
  const totalSpent = useMemo(() => {
    return sumExactAmounts(groupExpenses.map((exp) => exp.originalAmount ?? exp.amount));
  }, [groupExpenses]);

  // 2. MY PAID: Directly from balanceEngine's calculated member spent
  const myPaid = useMemo(() => {
    return currentUserMember?.spent || 0;
  }, [currentUserMember]);

  // 3. OTHERS PAID: Total squad spending minus My Paid
  const othersPaid = useMemo(() => {
    const diff = toPaisa(totalSpent) - toPaisa(myPaid);
    return fromPaisa(Math.max(0, diff));
  }, [totalSpent, myPaid]);

  // 4. AMOUNT OWED TO ME: Directly from balanceEngine's calculated member balance
  const youAreOwed = useMemo(() => {
    return currentUserMember && currentUserMember.balance > 0 ? currentUserMember.balance : 0;
  }, [currentUserMember]);

  // 5. AMOUNT I OWE: Directly from balanceEngine's calculated member balance
  const youOwe = useMemo(() => {
    return currentUserMember && currentUserMember.balance < 0 ? Math.abs(currentUserMember.balance) : 0;
  }, [currentUserMember]);

  // Permission check for squad admin
  const isSquadAdmin = useMemo(() => {
    if (!activeGroup) return false;
    if (currentUser?.systemRole === 'Admin') return true;
    if (currentUserMember && currentUserMember.role === 'Admin') return true;
    return activeGroup.members.some(
      (m) =>
        m.role === 'Admin' &&
        currentUser &&
        (m.id === currentUser.id || isMemberMatch(m, currentUser.id, currentUser.name))
    );
  }, [activeGroup, currentUser, currentUserMember]);

  // Dynamic clean display name helper
  const getMemberDisplayName = useCallback(
    (m: { id: string; name: string }) => {
      const isMe =
        (currentUserMember && m.id === currentUserMember.id) ||
        (currentUser && (m.id === currentUser.id || isMemberMatch(m, currentUser.id, currentUser.name))) ||
        (currentUser && cleanMemberName(m.name).toLowerCase() === cleanMemberName(currentUser.name).toLowerCase());
      const clean = cleanMemberName(m.name);
      return isMe ? `${clean} (You)` : clean;
    },
    [currentUser, currentUserMember, cleanMemberName]
  );

  // Donut chart arc segments calculation
  const donutSegments = useMemo(() => {
    if (!activeGroup || totalSpent <= 0) return [];
    const circumference = 364.42; // 2 * PI * 58
    let currentOffset = 0;

    return updatedMembers
      .filter((m) => (m.spent || 0) > 0)
      .map((m, idx) => {
        const spent = m.spent || 0;
        const ratio = spent / totalSpent;
        const strokeLength = ratio * circumference;
        const seg = {
          color: MEMBER_LINE_COLORS[idx % MEMBER_LINE_COLORS.length],
          strokeLength,
          offset: currentOffset,
          memberId: m.id,
        };
        currentOffset += strokeLength;
        return seg;
      });
  }, [activeGroup, totalSpent, updatedMembers]);

  // Cumulative timeline graph data (preserved for historical timeline mode)
  const memberGraphData = useMemo(() => {
    if (!activeGroup) return [];

    const datesSet = new Set<string>();
    groupExpenses.forEach((exp) => datesSet.add(exp.date));

    let dates = Array.from(datesSet).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    if (dates.length === 0) {
      dates = [new Date().toISOString().split('T')[0]];
    }

    return dates.map((d) => {
      const row: Record<string, any> = {
        date: d,
        displayDate: new Date(d).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      };

      activeGroup.members.forEach((m) => {
        const spentUpToDate = groupExpenses
          .filter(
            (exp) =>
              new Date(exp.date).getTime() <= new Date(d).getTime() &&
              isMemberMatch(m, exp.paidByUserId, exp.paidByName)
          )
          .reduce((sum, exp) => sum + exp.amount, 0);

        row[cleanMemberName(m.name)] = spentUpToDate;
      });

      return row;
    });
  }, [activeGroup, groupExpenses, cleanMemberName]);

  // Empty state if user has no squads
  if (groups.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#fafafa]">{t('noSquads')}</h2>
            <p className="text-xs text-[#a1a1aa] mt-1">
              {t('sharedGroupsSubtitle')}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenNewGroup}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>{t('createGroup')}</span>
            </button>
            <button
              onClick={onOpenJoinGroup}
              className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer border border-[#3f3f46]"
            >
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>{t('joinGroup')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 flex-1 overflow-y-auto custom-scrollbar">
      {/* 1. SQUAD SWITCHER / HEADER: Single consolidated squad-management area */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#fafafa]">
              {t('yourSquads')}
            </span>
            <span className="text-[11px] font-mono font-bold bg-[#27272a] text-[#a1a1aa] px-2 py-0.5 rounded-full">
              {formatNumber(groups.length)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenJoinGroup}
              className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-[#3f3f46]/40"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('exploreAndJoin')}</span>
            </button>
            <button
              onClick={onOpenNewGroup}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('createGroup')}</span>
              <span className="sm:hidden">{t('newSquad')}</span>
            </button>
          </div>
        </div>

        {/* Squad Selector Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {groups.map((group) => {
            const isSelected = activeGroup?.id === group.id;

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedGroupId(group.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2.5 relative select-none ${
                  isSelected
                    ? 'bg-[#18181b] border-emerald-500/80 ring-1 ring-emerald-500/50 shadow-md shadow-emerald-500/10'
                    : 'bg-[#18181b]/60 border-[#27272a] hover:border-[#3f3f46] hover:bg-[#18181b]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl overflow-hidden border border-[#27272a] bg-[#09090b] flex items-center justify-center shrink-0 shadow-sm">
                    {group.imageUrl ? (
                      <img src={group.imageUrl} alt={group.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-tr ${group.avatarGradient} flex items-center justify-center font-bold text-xs text-white`}>
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm text-[#fafafa] truncate">{group.name}</h3>
                    <div className="flex items-center gap-1 text-[10px] text-[#71717a]">
                      <span>{formatNumber(group.members.length)} {t('membersCount')}</span>
                      {isSelected && (
                        <span className="text-emerald-400 font-bold ml-1">• LIVE</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center">
                  {isSelected ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <Check className="w-3 h-3" />
                    </span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[#71717a]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SELECTED SQUAD DASHBOARD CONTENT */}
      {activeGroup && (
        <div className="space-y-4 sm:space-y-5">
          {/* 2. Selected Squad Header with Quick Actions */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-[#27272a] border border-[#3f3f46] flex items-center justify-center shrink-0 shadow-md">
                  {activeGroup.imageUrl ? (
                    <img src={activeGroup.imageUrl} alt={activeGroup.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-tr ${activeGroup.avatarGradient} flex items-center justify-center font-bold text-base sm:text-lg text-white`}>
                      {activeGroup.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-[#fafafa] truncate">{activeGroup.name}</h2>
                    <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      LIVE
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#a1a1aa] mt-0.5 flex-wrap">
                    <span>{formatNumber(activeGroup.members.length)} {t('membersCount')}</span>
                    <span>•</span>
                    <button
                      onClick={() => handleCopyInvite(activeGroup.inviteCode)}
                      className="font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer transition-colors"
                      title={t('copyInviteCode')}
                    >
                      {copiedInvite === activeGroup.inviteCode ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" /> {t('codeCopied')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          {t('inviteCode')}: <strong className="text-white font-mono">{activeGroup.inviteCode}</strong>
                          <Copy className="w-3 h-3 ml-0.5 text-blue-400" />
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {onDeleteGroup && isSquadAdmin && (
                <button
                  onClick={() => setSquadToDelete(activeGroup)}
                  className="p-2 text-[#71717a] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                  title={t('deleteSquad')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {onOpenSettleUp ? (
                <button
                  onClick={() => onOpenSettleUp(activeGroup.id)}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-600/20 active:scale-[0.98]"
                >
                  <Scale className="w-4 h-4" />
                  <span>{t('settleUp')}</span>
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={onOpenNewTransaction}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-600/25 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>{t('addExpenseToSquad')}</span>
              </button>
            </div>
          </div>

          {/* 3. Compact Financial Summary Card (Total + 2x2 Grid) */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#71717a] uppercase tracking-wider block">
                  {t('totalSquadSpending')}
                </span>
                <p className="text-2xl sm:text-3xl font-mono font-bold text-[#fafafa] mt-1 tracking-tight">
                  {formatCurrency(totalSpent)}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#27272a]/60 border border-[#3f3f46]/40 flex items-center justify-center text-[#a1a1aa]">
                <Receipt className="w-4 h-4" />
              </div>
            </div>

            {/* 2x2 Grid */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {/* My Paid */}
              <div className="bg-[#09090b] border border-[#27272a] p-3 rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block truncate">
                    {t('myPaid')}
                  </span>
                  <p className="text-sm sm:text-base font-mono font-bold text-[#fafafa] truncate">
                    {formatCurrency(myPaid)}
                  </p>
                </div>
              </div>

              {/* Others Paid */}
              <div className="bg-[#09090b] border border-[#27272a] p-3 rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 text-purple-400">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block truncate">
                    {t('othersPaid')}
                  </span>
                  <p className="text-sm sm:text-base font-mono font-bold text-[#fafafa] truncate">
                    {formatCurrency(othersPaid)}
                  </p>
                </div>
              </div>

              {/* Owed to Me */}
              <div className="bg-[#09090b] border border-[#27272a] p-3 rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-400">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block truncate">
                    {t('amountOwedToMe')}
                  </span>
                  <p className="text-sm sm:text-base font-mono font-bold text-emerald-400 truncate">
                    {formatCurrency(youAreOwed)}
                  </p>
                </div>
              </div>

              {/* I Owe */}
              <div className="bg-[#09090b] border border-[#27272a] p-3 rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0 text-rose-400">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block truncate">
                    {t('amountIOwe')}
                  </span>
                  <p className="text-sm sm:text-base font-mono font-bold text-rose-400 truncate">
                    {formatCurrency(youOwe)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Settlement Requests (if any) */}
          {pendingSettlements.length > 0 && (
            <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-4 sm:p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>{t('pendingDebtRequests')} ({formatNumber(pendingSettlements.length)})</span>
                </h3>
                <span className="text-[10px] text-amber-300 font-mono">
                  {t('settlementsNote')}
                </span>
              </div>

              <div className="space-y-2.5">
                {pendingSettlements.map((stl) => {
                  const isIncoming =
                    currentUserMember &&
                    isMemberMatch(currentUserMember, stl.toUserId, stl.toUserName);

                  return (
                    <div
                      key={stl.id}
                      className="p-3.5 rounded-lg bg-[#09090b] border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#fafafa] flex-wrap">
                          <span className="text-amber-400 font-bold">{stl.fromUserName}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#71717a]" />
                          <span className="text-emerald-400 font-bold">{stl.toUserName}</span>
                          <span className="font-mono text-white font-bold bg-[#27272a] px-2 py-0.5 rounded text-xs">
                            {formatCurrency(stl.amount)}
                          </span>
                          <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-mono">
                            Via {stl.paymentMethod || 'bKash'}
                          </span>
                        </div>
                        {stl.note && <p className="text-[11px] text-[#a1a1aa]">{stl.note}</p>}
                        <span className="text-[10px] text-[#71717a] block">{formatDate(stl.createdAt)}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isIncoming || currentUser?.systemRole === 'Admin' ? (
                          <>
                            <button
                              onClick={() => onAcceptSettlement && onAcceptSettlement(stl.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>{t('acceptSettlement')}</span>
                            </button>
                            <button
                              onClick={() => onRejectSettlement && onRejectSettlement(stl.id)}
                              className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>{t('reject')}</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-amber-400/80 font-mono italic">
                            {t('pending')} ({stl.toUserName})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Desktop/Tablet 2-Column Responsive Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Left Column: Per-Member Spending & Members Roster */}
            <div className="space-y-4 sm:space-y-6">
              {/* 4. Per-Member Spending (Donut Chart + Legend) */}
              <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#27272a]/80 pb-2.5">
                  <h3 className="text-xs font-bold text-[#fafafa] uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                    <span>{t('perMemberSpending')}</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-[#a1a1aa] bg-[#27272a] px-2 py-0.5 rounded-md">
                      {t('thisSquad')}
                    </span>
                    {groupExpenses.length > 0 && (
                      <div className="flex bg-[#09090b] border border-[#27272a] rounded-lg p-0.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setSpendingViewMode('donut')}
                          className={`px-2 py-0.5 rounded font-medium transition-colors ${
                            spendingViewMode === 'donut'
                              ? 'bg-blue-600 text-white'
                              : 'text-[#71717a] hover:text-[#fafafa]'
                          }`}
                        >
                          {t('chart')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpendingViewMode('timeline')}
                          className={`px-2 py-0.5 rounded font-medium transition-colors ${
                            spendingViewMode === 'timeline'
                              ? 'bg-blue-600 text-white'
                              : 'text-[#71717a] hover:text-[#fafafa]'
                          }`}
                        >
                          {t('timeline')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {spendingViewMode === 'donut' ? (
                  <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-2 pb-1">
                    {/* Donut Chart SVG */}
                    <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                        {/* Base track */}
                        <circle
                          cx="80"
                          cy="80"
                          r="58"
                          fill="transparent"
                          stroke="#27272a"
                          strokeWidth="14"
                        />
                        {totalSpent > 0 &&
                          donutSegments.map((seg, idx) => (
                            <circle
                              key={idx}
                              cx="80"
                              cy="80"
                              r="58"
                              fill="transparent"
                              stroke={seg.color}
                              strokeWidth="14"
                              strokeDasharray={`${seg.strokeLength} 364.42`}
                              strokeDashoffset={-seg.offset}
                              strokeLinecap="round"
                              className="transition-all duration-500"
                            />
                          ))}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                        <span className="text-base sm:text-lg font-mono font-bold text-[#fafafa] leading-tight px-2 truncate max-w-[110px]">
                          {formatCurrency(totalSpent)}
                        </span>
                        <span className="text-[10px] text-[#71717a] font-medium mt-0.5 uppercase tracking-wider">
                          Total
                        </span>
                      </div>
                    </div>

                    {/* Member breakdown list */}
                    <div className="flex flex-col justify-center space-y-2.5 flex-1 w-full max-w-sm">
                      {updatedMembers.map((m, idx) => {
                        const displayName = getMemberDisplayName(m);
                        const color = MEMBER_LINE_COLORS[idx % MEMBER_LINE_COLORS.length];

                        return (
                          <div key={m.id} className="flex items-center justify-between text-xs gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-[#fafafa] font-medium truncate">{displayName}</span>
                            </div>
                            <span className="font-mono font-bold text-[#fafafa] shrink-0">
                              {formatCurrency(m.spent || 0)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Recharts LineChart for Timeline */
                  <div className="h-60 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={memberGraphData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis
                          dataKey="displayDate"
                          stroke="#71717a"
                          fontSize={11}
                          tickLine={false}
                          axisLine={{ stroke: '#27272a' }}
                        />
                        <YAxis
                          stroke="#71717a"
                          fontSize={11}
                          tickLine={false}
                          axisLine={{ stroke: '#27272a' }}
                          tickFormatter={(val) => formatCurrency(val)}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#09090b',
                            borderColor: '#27272a',
                            borderRadius: '8px',
                            color: '#fafafa',
                            fontSize: '12px',
                          }}
                          formatter={(value: any, name: any) => [formatCurrency(value), name]}
                          labelFormatter={(label) => `${t('date')}: ${label}`}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                          iconType="circle"
                        />
                        {activeGroup.members.map((member, idx) => (
                          <Line
                            key={member.id}
                            type="monotone"
                            dataKey={cleanMemberName(member.name)}
                            stroke={MEMBER_LINE_COLORS[idx % MEMBER_LINE_COLORS.length]}
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: MEMBER_LINE_COLORS[idx % MEMBER_LINE_COLORS.length] }}
                            activeDot={{ r: 5 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* 5. Members Roster */}
              <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b border-[#27272a]/80 pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#fafafa] flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>{t('members')}</span>
                  </h3>
                  <span className="text-[11px] text-[#71717a] font-mono">
                    {formatNumber(updatedMembers.length)} {t('membersCount')}
                  </span>
                </div>

                <div className="space-y-2">
                  {updatedMembers.map((m, idx) => {
                    const isMe =
                      (currentUserMember && m.id === currentUserMember.id) ||
                      (currentUser && (m.id === currentUser.id || isMemberMatch(m, currentUser.id, currentUser.name))) ||
                      (currentUser && cleanMemberName(m.name).toLowerCase() === cleanMemberName(currentUser.name).toLowerCase());
                    const displayName = getMemberDisplayName(m);
                    const cleanName = cleanMemberName(m.name);

                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-[#09090b] border border-[#27272a] hover:border-[#3f3f46] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden"
                            style={{
                              backgroundColor: m.avatarUrl ? 'transparent' : MEMBER_LINE_COLORS[idx % MEMBER_LINE_COLORS.length],
                            }}
                          >
                            {m.avatarUrl ? (
                              <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />
                            ) : (
                              cleanName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-[#fafafa] truncate flex items-center gap-1.5">
                              <span>{displayName}</span>
                              {m.role === 'Admin' && (
                                <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                                  Admin
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            {m.balance > 0 && (
                              <span className="text-xs sm:text-sm font-mono font-bold text-emerald-400 block">
                                +{formatCurrency(m.balance)}
                              </span>
                            )}
                            {m.balance < 0 && (
                              <span className="text-xs sm:text-sm font-mono font-bold text-rose-400 block">
                                -{formatCurrency(Math.abs(m.balance))}
                              </span>
                            )}
                            {m.balance === 0 && (
                              <span className="text-xs sm:text-sm font-mono text-[#71717a] block">
                                {formatCurrency(0)}
                              </span>
                            )}
                          </div>

                          {onRemoveMember && !isMe && isSquadAdmin && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to remove ${cleanName} from "${activeGroup.name}"?`)) {
                                  onRemoveMember(activeGroup.id, m.id);
                                }
                              }}
                              className="p-1.5 text-[#71717a] hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                              title={`Remove ${cleanName}`}
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Recent Shared Expenses & Settlement History */}
            <div className="space-y-4 sm:space-y-6">
              {/* 6. Recent Shared Expenses */}
              <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b border-[#27272a]/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#fafafa]">
                      {t('recentSharedExpenses')}
                    </h3>
                    <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
                      {formatNumber(groupExpenses.length)}
                    </span>
                  </div>
                  <button
                    onClick={onOpenNewTransaction}
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('logExpense')}</span>
                  </button>
                </div>

                {groupExpenses.length === 0 ? (
                  <div className="text-center py-6 text-[#71717a] space-y-2 bg-[#09090b] rounded-xl border border-[#27272a]">
                    <Receipt className="w-6 h-6 mx-auto text-[#3f3f46]" />
                    <p className="text-xs font-medium">{t('noSharedTxRecorded')}</p>
                    <button
                      onClick={onOpenNewTransaction}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> {t('addFirstExpense')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groupExpenses.slice(0, 10).map((exp) => {
                      const isPayerMe = Boolean(
                        (currentUserMember && isMemberMatch(currentUserMember, exp.paidByUserId, exp.paidByName)) ||
                        (currentUser && isMemberMatch({ id: currentUser.id, name: currentUser.name, email: currentUser.email }, exp.paidByUserId, exp.paidByName))
                      );
                      const cleanPayer = cleanMemberName(exp.paidByName);
                      const payerDisplay = isPayerMe ? `${cleanPayer} (You)` : cleanPayer;

                      return (
                        <div
                          key={exp.id}
                          onClick={() => onEditExpense && onEditExpense(exp)}
                          className="p-3 rounded-xl bg-[#09090b] border border-[#27272a] hover:border-[#3f3f46] transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-[#18181b] border border-[#27272a] flex items-center justify-center text-sm shrink-0 font-semibold text-blue-400 group-hover:border-blue-500/40 transition-colors">
                              {exp.category?.charAt(0) || '🥤'}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs sm:text-sm font-bold text-[#fafafa] truncate group-hover:text-blue-400 transition-colors">
                                {exp.title || exp.merchant}
                              </h4>
                              <div className="flex items-center gap-1.5 text-[11px] text-[#71717a] mt-0.5 truncate">
                                <span>Paid by: <strong className="text-[#a1a1aa] font-medium">{payerDisplay}</strong></span>
                                <span>•</span>
                                <span>{formatDate(exp.date)}</span>
                                <span>•</span>
                                <span>{formatNumber(activeGroup.members.length)} {t('membersCount')}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <span className="font-mono text-xs sm:text-sm font-bold text-[#fafafa] block">
                                {formatCurrency(exp.amount)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {onDeleteExpense && isSquadAdmin && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Delete expense "${exp.title}"? Balances will be recalculated.`)) {
                                      onDeleteExpense(exp.id);
                                    }
                                  }}
                                  className="p-1 text-[#71717a] hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                                  title="Delete Expense"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <ChevronRight className="w-4 h-4 text-[#71717a] group-hover:text-white transition-colors" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 7. Settlement History */}
              <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b border-[#27272a]/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#fafafa] flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-amber-400" />
                      <span>{t('settlementHistory')}</span>
                    </h3>
                    <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                      {formatNumber(groupSettlements.length)}
                    </span>
                  </div>
                  {onOpenSettleUp && (
                    <button
                      onClick={() => onOpenSettleUp(activeGroup.id)}
                      className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('settleUp')}</span>
                    </button>
                  )}
                </div>

                {groupSettlements.length === 0 ? (
                  <div className="text-center py-6 text-[#71717a] space-y-2 bg-[#09090b] rounded-xl border border-[#27272a]">
                    <Scale className="w-5 h-5 mx-auto text-[#3f3f46]" />
                    <p className="text-xs font-medium">{t('noSettlementsRecorded')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groupSettlements.map((stl) => {
                      const isAccepted = stl.status === 'Accepted' || stl.status === 'Completed';
                      const isRejected = stl.status === 'Rejected';
                      const isPending = stl.status === 'Pending' || stl.status === 'Pending Approval';

                      return (
                        <div
                          key={stl.id}
                          className="p-3 rounded-xl bg-[#09090b] border border-[#27272a] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-semibold text-[#fafafa]">
                              <span className="text-amber-400 font-bold">{stl.fromUserName}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-[#71717a]" />
                              <span className="text-emerald-400 font-bold">{stl.toUserName}</span>
                              <span className="font-mono text-white font-bold bg-[#27272a] px-2 py-0.5 rounded text-xs">
                                {formatCurrency(stl.amount)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-[#71717a]">
                              <span>Method: <strong className="text-[#a1a1aa] font-semibold">{stl.paymentMethod || 'bKash'}</strong></span>
                              <span>•</span>
                              <span>{formatDate(stl.createdAt)}</span>
                              {stl.note && (
                                <>
                                  <span>•</span>
                                  <span className="italic">{stl.note}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {isAccepted && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full font-mono">
                                <CheckCircle className="w-3.5 h-3.5" /> {t('accepted')}
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full font-mono">
                                <XCircle className="w-3.5 h-3.5" /> {t('rejected')}
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full font-mono">
                                <Clock className="w-3.5 h-3.5" /> {t('pending')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Squad Confirmation Modal */}
      {squadToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#fafafa]">{t('deleteSquad')}</h3>
                <p className="text-xs text-[#a1a1aa]">{t('allSquadDataRemoved')}</p>
              </div>
            </div>

            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              {t('areYouSureDeleteSquad')} <span className="font-bold text-[#fafafa]">{squadToDelete.name}</span>? {t('allSquadDataRemoved')}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#27272a]">
              <button
                onClick={() => setSquadToDelete(null)}
                className="px-4 py-2 text-xs font-semibold bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] rounded-lg transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('deleteSquad')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
