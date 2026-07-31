import { Group, GroupMember, Expense, Settlement } from '../types';

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

  return group.members.map((m) => {
    let spentByM = 0;
    let shareOfM = 0;

    groupExpenses.forEach((exp) => {
      // Did member m pay for this expense?
      if (isMemberMatch(m, exp.paidByUserId, exp.paidByName)) {
        spentByM += exp.amount;
      }

      // Calculate member m's share of this expense
      if (exp.splits && exp.splits.length > 0) {
        const split = exp.splits.find((sp) => isMemberMatch(m, sp.userId, sp.userName));
        if (split) {
          shareOfM += split.amount;
        } else {
          shareOfM += exp.amount / totalMembersCount;
        }
      } else {
        // Default split equally across all group members
        shareOfM += exp.amount / totalMembersCount;
      }
    });

    let settlementsSent = 0;
    let settlementsReceived = 0;

    acceptedSettlements.forEach((stl) => {
      if (isMemberMatch(m, stl.fromUserId, stl.fromUserName)) {
        settlementsSent += stl.amount;
      }
      if (isMemberMatch(m, stl.toUserId, stl.toUserName)) {
        settlementsReceived += stl.amount;
      }
    });

    let calculatedBalance = spentByM - shareOfM + settlementsSent - settlementsReceived;
    calculatedBalance = Math.round(calculatedBalance * 100) / 100;
    if (Math.abs(calculatedBalance) < 0.001) {
      calculatedBalance = 0;
    }

    return {
      ...m,
      spent: Math.round(spentByM * 100) / 100,
      share: Math.round(shareOfM * 100) / 100,
      balance: calculatedBalance,
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
    const totalSpent = groupExpenses.reduce((sum, e) => sum + e.amount, 0);

    const unsettledAmount = updatedMembers
      .filter((m) => m.balance > 0)
      .reduce((sum, m) => sum + m.balance, 0);

    return {
      ...g,
      members: updatedMembers,
      totalSpent: Math.round(totalSpent * 100) / 100,
      unsettledAmount: Math.round(unsettledAmount * 100) / 100,
    };
  });
};

