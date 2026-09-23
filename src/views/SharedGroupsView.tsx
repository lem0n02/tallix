import React, { useState, useMemo } from 'react';
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

  const { t, formatCurrency, formatNumber, formatDate } = useLanguage();

  const activeGroup =
    groups.find(
      (g) =>
        g.id === selectedGroupId ||
        (selectedGroupId && g.inviteCode && g.inviteCode.toUpperCase() === selectedGroupId.toUpperCase())
    ) || groups[0];

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

  // 1. Group Expenses & Settlements filtering for active group (Data Isolation)
  const groupExpenses = useMemo(() => {
    if (!activeGroup) return [];
    return expenses.filter((exp) => exp.isShared && exp.groupId === activeGroup.id);
  }, [expenses, activeGroup]);

  const groupSettlements = useMemo(() => {
    if (!activeGroup) return [];
    return settlements.filter((stl) => stl.groupId === activeGroup.id);
  }, [settlements, activeGroup]);

  const acceptedSettlements = useMemo(() => {
    return groupSettlements.filter((stl) => {
      const st = (stl.status || '').toLowerCase();
      return st === 'accepted' || st === 'completed' || st === 'approved';
    });
  }, [groupSettlements]);

  const pendingSettlements = useMemo(() => {
    return groupSettlements.filter((stl) => {
      const st = (stl.status || '').toLowerCase();
      return st === 'pending' || st === 'pending approval';
    });
  }, [groupSettlements]);

  // 2. Dynamic Total Squad Spent calculation (NEVER changes on settlement)
  const totalSpent = useMemo(() => {
    return sumExactAmounts(groupExpenses.map((exp) => exp.originalAmount ?? exp.amount));
  }, [groupExpenses]);

  // 3. Calculate member balances dynamically using balanceEngine
  const updatedMembers = useMemo(() => {
    if (!activeGroup) return [];
    const memberCalcExpenses = allExpenses || expenses;
    return calculateGroupMembersWithBalances(activeGroup, memberCalcExpenses, settlements);
  }, [activeGroup, expenses, allExpenses, settlements]);

  // 5. Current User Metrics in Squad
  const currentUserMember = useMemo(() => {
    if (!updatedMembers || updatedMembers.length === 0 || !currentUser) return null;
    return (
      updatedMembers.find((m) =>
        isMemberMatch(m, currentUser.id, currentUser.name)
      ) ||
      updatedMembers.find(
        (m) =>
          m.id === currentUser.id ||
          (m.email && m.email.toLowerCase() === currentUser.email.toLowerCase())
      ) ||
      null
    );
  }, [updatedMembers, currentUser]);

  // 1. TOTAL SQUAD SPENDING: totalSpent
  // 2. MY PAID: The total amount actually paid by the currently logged-in user.
  // Formula: SUM(all valid expenses where payer = current user)
  const myPaid = useMemo(() => {
    if (currentUserMember && typeof currentUserMember.spent === 'number') {
      return currentUserMember.spent;
    }
    if (!currentUser) return 0;
    const paidExpenses = groupExpenses.filter((exp) =>
      isMemberMatch({ id: currentUser.id, name: currentUser.name, email: currentUser.email }, exp.paidByUserId, exp.paidByName)
    );
    return sumExactAmounts(paidExpenses.map((exp) => exp.originalAmount ?? exp.amount));
  }, [currentUserMember, currentUser, groupExpenses]);

  // 3. OTHERS PAID: Total amount actually paid by all other members (NOT from net balance)
  // Formula: SUM(all valid expenses where payer != current user)
  const othersPaid = useMemo(() => {
    const otherExpenses = groupExpenses.filter((exp) => {
      if (!currentUser) return true;
      return !isMemberMatch(
        { id: currentUser.id, name: currentUser.name, email: currentUser.email },
        exp.paidByUserId,
        exp.paidByName
      );
    });
    return sumExactAmounts(otherExpenses.map((exp) => exp.originalAmount ?? exp.amount));
  }, [currentUser, groupExpenses]);

  // 4. MY SHARE: The current user's actual calculated share of the group expenses according to the app's existing split rules.
  const myShare = useMemo(() => {
    if (currentUserMember && typeof currentUserMember.share === 'number') {
      return currentUserMember.share;
    }
    const memberCount = activeGroup?.members?.length || 0;
    if (memberCount === 0) return 0;
    return fromPaisa(Math.round(toPaisa(totalSpent) / memberCount));
  }, [currentUserMember, activeGroup, totalSpent]);

  // Net balance taking into account accepted settlements
  const netBalance = useMemo(() => {
    if (currentUserMember) {
      return currentUserMember.balance;
    }
    return fromPaisa(toPaisa(myPaid) - toPaisa(myShare));
  }, [currentUserMember, myPaid, myShare]);

  // 4. AMOUNT OWED TO ME: max(0, MY PAID - MY SHARE) (with settlements considered)
  const youAreOwed = useMemo(() => {
    return netBalance > 0 ? netBalance : 0;
  }, [netBalance]);

  // 5. AMOUNT I OWE: max(0, MY SHARE - MY PAID) (with settlements considered)
  const youOwe = useMemo(() => {
    return netBalance < 0 ? Math.abs(netBalance) : 0;
  }, [netBalance]);

  // 6. Member Graph Data
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

        row[m.name] = spentUpToDate;
      });

      return row;
    });
  }, [activeGroup, groupExpenses]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#18181b] border border-[#27272a] p-5 rounded-xl shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-[#fafafa] flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span>{t('sharedGroupsTitle')}</span>
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-1">
            {t('sharedGroupsSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {onOpenSettleUp && activeGroup && (
            <button
              onClick={() => onOpenSettleUp(activeGroup.id)}
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-600/20"
            >
              <Scale className="w-4 h-4" />
              <span>{t('settleUp')}</span>
            </button>
          )}
          <button
            onClick={onOpenNewGroup}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>{t('createGroup')}</span>
          </button>
          <button
            onClick={onOpenJoinGroup}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('joinGroup')}</span>
          </button>
        </div>
      </div>

      {/* Squad Switcher Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => {
          const isSelected = activeGroup?.id === group.id;

          // Compute group total spent dynamically
          const gExpenses = expenses.filter((e) => e.isShared && e.groupId === group.id);
          const gTotalSpent = gExpenses.reduce((sum, e) => sum + e.amount, 0);

          return (
            <div
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
              className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between relative group ${isSelected
                  ? 'bg-[#18181b] border-blue-500 shadow-md ring-1 ring-blue-500/50'
                  : 'bg-[#18181b]/60 border-[#27272a] hover:border-[#3f3f46]'
                }`}
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-3 min-w-0 pr-2">
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
                      <h3 className="font-bold text-sm text-[#fafafa] truncate">{group.name}</h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyInvite(group.inviteCode);
                        }}
                        className="mt-1 text-[11px] font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors cursor-pointer bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md"
                        title="Click to copy invite code"
                      >
                        {copiedInvite === group.inviteCode ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400 font-bold">{t('codeCopied')}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-blue-400" />
                            <span>{t('inviteCode')}: <strong className="font-mono text-white">{group.inviteCode}</strong></span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#a1a1aa] bg-[#27272a] px-2 py-0.5 rounded font-mono shrink-0">
                    {formatNumber(group.members.length)} {t('membersCount')}
                  </span>
                </div>
                <p className="text-xs text-[#a1a1aa] line-clamp-2 my-3">{group.description}</p>
              </div>

              <div className="pt-3 border-t border-[#27272a] flex justify-between items-center text-xs">
                <span className="text-[#71717a]">{t('totalSquadSpending')}:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[#fafafa] font-bold">
                    {formatCurrency(gTotalSpent)}
                  </span>
                  {onDeleteGroup && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSquadToDelete(group);
                      }}
                      className="p-1 text-[#71717a] hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                      title={t('deleteSquad')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Create / Join Squad Action Card */}
        <div className="p-5 rounded-xl border border-dashed border-[#3f3f46] hover:border-blue-500 bg-[#18181b]/30 flex flex-col items-center justify-center gap-3 text-center group min-h-[140px]">
          <span className="text-xs font-bold text-[#fafafa]">{t('squadsTitle')}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenNewGroup}
              className="bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-blue-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> {t('createGroup')}
            </button>
            <button
              onClick={onOpenJoinGroup}
              className="bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" /> {t('joinGroup')}
            </button>
          </div>
          <span className="text-[10px] text-[#71717a]">{t('sharedGroupsSubtitle')}</span>
        </div>
      </div>

      {/* Active Squad Live Dashboard */}
      {activeGroup && (
        <div className="space-y-6">
          {/* Live Squad Dashboard Summary */}
          <div className="bg-[#18181b] border border-[#27272a] p-5 rounded-xl space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27272a] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#27272a] border border-[#3f3f46] flex items-center justify-center shrink-0 shadow-md">
                  {activeGroup.imageUrl ? (
                    <img src={activeGroup.imageUrl} alt={activeGroup.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-tr ${activeGroup.avatarGradient} flex items-center justify-center font-bold text-base text-white`}>
                      {activeGroup.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#fafafa]">{activeGroup.name}</h2>
                    <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      LIVE
                    </span>
                  </div>
                  <p className="text-xs text-[#a1a1aa] mt-0.5">{activeGroup.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                {onOpenSettleUp && (
                  <button
                    onClick={() => onOpenSettleUp(activeGroup.id)}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Scale className="w-4 h-4" />
                    <span>{t('settleUp')}</span>
                  </button>
                )}
                <button
                  onClick={onOpenNewTransaction}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('addExpenseToSquad')}</span>
                </button>
                {onDeleteGroup && (
                  <button
                    onClick={() => setSquadToDelete(activeGroup)}
                    className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    title={t('deleteSquad')}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t('deleteSquad')}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Live Cards Row (5 Key Squad Financial Metrics) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
              <div className="bg-[#09090b] border border-[#27272a] p-3.5 rounded-lg space-y-1">
                <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">
                  {t('totalSquadSpending')}
                </span>
                <p className="text-lg font-mono font-bold text-[#fafafa]">
                  {formatCurrency(totalSpent)}
                </p>
                <span className="text-[10px] text-[#71717a]">
                  {formatNumber(groupExpenses.length)} {t('txs')}
                </span>
              </div>

              <div className="bg-[#09090b] border border-[#27272a] p-3.5 rounded-lg space-y-1">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                  {t('myPaid')}
                </span>
                <p className="text-lg font-mono font-bold text-blue-400">
                  {formatCurrency(myPaid)}
                </p>
                <span className="text-[10px] text-[#71717a]">{t('paidByYou')}</span>
              </div>

              <div className="bg-[#09090b] border border-[#27272a] p-3.5 rounded-lg space-y-1">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                  {t('othersPaid')}
                </span>
                <p className="text-lg font-mono font-bold text-purple-400">
                  {formatCurrency(othersPaid)}
                </p>
                <span className="text-[10px] text-[#71717a]">{t('paidByOthers')}</span>
              </div>

              <div className="bg-[#09090b] border border-[#27272a] p-3.5 rounded-lg space-y-1">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  {t('amountOwedToMe')}
                </span>
                <p className="text-lg font-mono font-bold text-emerald-400">
                  {formatCurrency(youAreOwed)}
                </p>
                <span className="text-[10px] text-[#71717a]">{t('isOwed')}</span>
              </div>

              <div className="bg-[#09090b] border border-[#27272a] p-3.5 rounded-lg space-y-1">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                  {t('amountIOwe')}
                </span>
                <p className="text-lg font-mono font-bold text-rose-400">
                  {formatCurrency(youOwe)}
                </p>
                <span className="text-[10px] text-[#71717a]">{t('owes')}</span>
              </div>
            </div>
          </div>

          {/* Pending Settlement Requests Section */}
          {pendingSettlements.length > 0 && (
            <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" /> {t('pendingDebtRequests')} ({formatNumber(pendingSettlements.length)})
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
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#fafafa]">
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

                      {/* Approval Actions */}
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

          {/* Member Spending Line Graph */}
          <div className="bg-[#18181b] border border-[#27272a] p-5 rounded-xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-[#fafafa] uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  {t('perMemberSpending')}
                </h2>
                <p className="text-[11px] text-[#71717a] mt-0.5">
                  {t('cumulativeExpenditure')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full font-mono">
                  {formatNumber(activeGroup.members.length)} Lines
                </span>
              </div>
            </div>

            <div className="h-64 w-full pt-2">
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
                      dataKey={member.name}
                      stroke={MEMBER_LINE_COLORS[idx % MEMBER_LINE_COLORS.length]}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: MEMBER_LINE_COLORS[idx % MEMBER_LINE_COLORS.length] }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Squad Member Balances Roster */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#fafafa] flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" /> {t('squadMemberRoster')}
              </h3>
              <span className="text-[10px] text-[#71717a] font-mono">
                {formatNumber(updatedMembers.length)} {t('members')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {updatedMembers.map((m, idx) => {
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#09090b] border border-[#27272a] hover:border-[#3f3f46] transition-colors"
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
                          m.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#fafafa] truncate flex items-center gap-1.5">
                          <span>{m.name}</span>
                          {m.role === 'Admin' && (
                            <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                              Admin
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-[#71717a] truncate">{m.email || m.role || 'Member'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        {m.balance > 0 && (
                          <span className="text-xs font-mono font-bold text-emerald-400 block">
                            +{formatCurrency(m.balance)}
                          </span>
                        )}
                        {m.balance < 0 && (
                          <span className="text-xs font-mono font-bold text-rose-400 block">
                            -{formatCurrency(Math.abs(m.balance))}
                          </span>
                        )}
                        {m.balance === 0 && (
                          <span className="text-xs font-mono text-[#71717a] block">
                            {formatCurrency(0)}
                          </span>
                        )}
                      </div>

                      {onRemoveMember && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to remove ${m.name} from "${activeGroup.name}"?`)) {
                              onRemoveMember(activeGroup.id, m.id);
                            }
                          }}
                          className="p-1.5 text-[#71717a] hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                          title={`Remove ${m.name}`}
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Shared Squad Transactions */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#fafafa] flex items-center gap-2">
                {t('recentSharedExpenses')} ({formatNumber(groupExpenses.length)})
              </h3>
              <button
                onClick={onOpenNewTransaction}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> {t('logExpense')}
              </button>
            </div>

            {groupExpenses.length === 0 ? (
              <div className="text-center py-8 text-[#71717a] space-y-2 bg-[#09090b] rounded-lg border border-[#27272a]">
                <HelpCircle className="w-8 h-8 mx-auto text-[#3f3f46]" />
                <p className="text-xs font-medium">{t('noSharedTxRecorded')}</p>
                <button
                  onClick={onOpenNewTransaction}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> {t('addFirstExpense')}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {groupExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="p-3.5 rounded-lg bg-[#09090b] border border-[#27272a] hover:border-[#3f3f46] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#18181b] border border-[#27272a] flex items-center justify-center text-sm shrink-0 font-semibold text-blue-400">
                        {exp.category?.charAt(0) || '💸'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-[#fafafa] truncate">
                          {exp.title || exp.merchant}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-[#71717a] mt-0.5">
                          <span>{t('paidBy')}: <strong className="text-[#a1a1aa] font-semibold">{exp.paidByName}</strong></span>
                          <span>•</span>
                          <span>{formatDate(exp.date)}</span>
                          <span>•</span>
                          <span className="text-purple-400">{exp.category}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                      <div className="text-right">
                        <span className="font-mono text-sm font-bold text-[#fafafa] block">
                          {formatCurrency(exp.amount)}
                        </span>
                        <span className="text-[10px] text-[#71717a] block">
                          {t('splitAmong')} {formatNumber(activeGroup.members.length)} {t('members')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onEditExpense && (
                          <button
                            onClick={() => onEditExpense(exp)}
                            className="p-1.5 text-[#71717a] hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors cursor-pointer"
                            title="Edit Expense"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {onDeleteExpense && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete expense "${exp.title}"? Balances will be recalculated.`)) {
                                onDeleteExpense(exp.id);
                              }
                            }}
                            className="p-1.5 text-[#71717a] hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                            title="Delete Expense"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Settlement History Section */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#fafafa] flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-400" /> {t('settlementHistory')} ({formatNumber(groupSettlements.length)})
              </h3>
              {onOpenSettleUp && (
                <button
                  onClick={() => onOpenSettleUp(activeGroup.id)}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> {t('settleUp')}
                </button>
              )}
            </div>

            {groupSettlements.length === 0 ? (
              <div className="text-center py-6 text-[#71717a] space-y-2 bg-[#09090b] rounded-lg border border-[#27272a]">
                <p className="text-xs font-medium">{t('noSettlementsRecorded')}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {groupSettlements.map((stl) => {
                  const isAccepted = stl.status === 'Accepted' || stl.status === 'Completed';
                  const isRejected = stl.status === 'Rejected';
                  const isPending = stl.status === 'Pending' || stl.status === 'Pending Approval';

                  return (
                    <div
                      key={stl.id}
                      className="p-3.5 rounded-lg bg-[#09090b] border border-[#27272a] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
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
