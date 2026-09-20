import { Group, GroupMember, Expense, Settlement } from '../types';
import { toPaisa, fromPaisa, splitExactAmount } from './money';

export const isMemberMatch = (
  member: { id: string; name: string; email?: string },
  targetId?: string,
  targetName?: string
): boolean => {
  if (!member) return false;
  if (targetId && member.id && member.id === targetId) return true;
  if (member.email && targetId && member.email.toLowerCase() === targetId.toLowerCase()) return true;

  // If both targetId and member.id are valid IDs and do NOT match, prevent false matching by name
  if (targetId && member.id && targetId.trim() !== '' && member.id.trim() !== '' && targetId !== member.id) {
    if (!targetId.includes('@')) {
      return false;
    }
  }

  if (targetName && targetName.trim() !== '') {
    const mName = member.name.toLowerCase().replace(/\(you\)/gi, '').trim();
    const tName = targetName.toLowerCase().replace(/\(you\)/gi, '').trim();
    if (mName === tName) return true;
    if (mName.length > 2 && tName.length > 2 && (mName.startsWith(tName) || tName.startsWith(mName))) return true;
  }
  return false;
};

export const calculateGroupMembersWithBalances = (
  group: Group,
  expenses: Expense[],
  settlements: Settlement[]
): GroupMember[] => {
  if (!group || !group.members || group.members.length === 0) return group?.members || [];

  const groupExpenses = expenses.filter((e) => e.isShared && e.groupId === group.id);
  const acceptedSettlements = settlements.filter((s) => {
    if (s.groupId !== group.id) return false;
    const st = (s.status || '').toLowerCase();
    return st === 'accepted' || st === 'completed' || st === 'approved';
  });

  const totalMembersCount = group.members.length;

  // Map each expense to member split shares in exact paisa
  const expenseSharesMap = new Map<string, Map<string, number>>();

  groupExpenses.forEach((exp) => {
    const memberShares = new Map<string, number>();

    if (exp.splits && exp.splits.length > 0) {
      // Splits exist: use each member's split amount in paisa
      group.members.forEach((m) => {
        const split = exp.splits?.find((sp) => isMemberMatch(m, sp.userId, sp.userName));
        if (split) {
          memberShares.set(m.id, toPaisa(split.amount));
        } else {
          memberShares.set(m.id, 0);
        }
      });
    } else {
      // Default equal split: distribute exact paisa so the sum equals exp in paisa exactly
      const splitAmounts = splitExactAmount(exp.originalAmount ?? exp.amount, totalMembersCount);
      group.members.forEach((m, idx) => {
        memberShares.set(m.id, toPaisa(splitAmounts[idx]));
      });
    }

    expenseSharesMap.set(exp.id, memberShares);
  });

  return group.members.map((m) => {
    let spentPaisa = 0;
    let sharePaisa = 0;

    groupExpenses.forEach((exp) => {
      // Did member m pay for this expense?
      if (isMemberMatch(m, exp.paidByUserId, exp.paidByName)) {
        spentPaisa += toPaisa(exp.originalAmount ?? exp.amount);
      }

      // Member m's share of this expense in paisa
      const shares = expenseSharesMap.get(exp.id);
      if (shares && shares.has(m.id)) {
        sharePaisa += shares.get(m.id) || 0;
      }
    });

    let settlementsSentPaisa = 0;
    let settlementsReceivedPaisa = 0;

    acceptedSettlements.forEach((stl) => {
      const stlPaisa = toPaisa(stl.originalAmount ?? stl.amount);
      if (isMemberMatch(m, stl.fromUserId, stl.fromUserName)) {
        settlementsSentPaisa += stlPaisa;
      }
      if (isMemberMatch(m, stl.toUserId, stl.toUserName)) {
        settlementsReceivedPaisa += stlPaisa;
      }
    });

    const calculatedBalancePaisa = spentPaisa - sharePaisa + settlementsSentPaisa - settlementsReceivedPaisa;

    return {
      ...m,
      spent: fromPaisa(spentPaisa),
      share: fromPaisa(sharePaisa),
      balance: fromPaisa(calculatedBalancePaisa),
    };
  });
};

export const enrichGroupsWithBalances = (
  groups: Group[],
  expenses: Expense[],
  settlements: Settlement[]
): Group[] => {
  return groups.map((g) => {
    const updatedMembers = calculateGroupMembersWithBalances(g, expenses, settlements);
    const groupExpenses = expenses.filter((e) => e.isShared && e.groupId === g.id);
    let totalSpentPaisa = 0;
    groupExpenses.forEach((e) => {
      totalSpentPaisa += toPaisa(e.originalAmount ?? e.amount);
    });

    let unsettledPaisa = 0;
    updatedMembers
      .filter((m) => m.balance > 0)
      .forEach((m) => {
        unsettledPaisa += toPaisa(m.balance);
      });

    return {
      ...g,
      members: updatedMembers,
      totalSpent: fromPaisa(totalSpentPaisa),
      unsettledAmount: fromPaisa(unsettledPaisa),
    };
  });
};

