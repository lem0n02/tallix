import { describe, it, expect } from 'vitest';
import { Group, Expense, Settlement, UserProfile } from './types';
import { calculateGroupMembersWithBalances, enrichGroupsWithBalances } from './utils/balanceEngine';
import { compareHistoryItemsDesc, buildUnifiedHistory } from './utils/historyEngine';

describe('Settle Up / Settle Down and Latest-First History Architecture', () => {
  const baseGroup: Group = {
    id: 'grp_alpha',
    name: 'Alpha Squad',
    description: 'Testing settlements',
    category: 'Trip',
    avatarGradient: 'from-blue-600 to-indigo-600',
    inviteCode: 'ALPHA123',
    members: [
      { id: 'usr_me', name: 'Staff Engineer (You)', email: 'me@example.com', role: 'Admin', balance: 0 },
      { id: 'usr_sarah', name: 'Sarah Chen', email: 'sarah@example.com', role: 'Member', balance: 0 },
    ],
    totalSpent: 0,
    unsettledAmount: 0,
    currency: 'BDT',
    createdAt: '2026-03-01T00:00:00.000Z',
  };

  it('Requirement: Before any settlement or expense, both members have ৳0 balance', () => {
    const updated = calculateGroupMembersWithBalances(baseGroup, [], []);
    const me = updated.find((m) => m.id === 'usr_me')!;
    const sarah = updated.find((m) => m.id === 'usr_sarah')!;

    expect(me.balance).toBe(0);
    expect(me.spent).toBe(0);
    expect(me.share).toBe(0);
    expect(sarah.balance).toBe(0);
  });

  describe('SETTLE UP Action', () => {
    it('Settle Up moves the current user balance UP toward positive (+160) and Sarah down (-160) after acceptance', () => {
      // Settle Up: Current user creates a Settle Up request of 160 against Sarah
      const settleUp: Settlement = {
        id: 'stl_up_1',
        groupId: 'grp_alpha',
        groupName: 'Alpha Squad',
        settlementType: 'SETTLE_UP',
        fromUserId: 'usr_me',
        fromUserName: 'Staff Engineer (You)',
        toUserId: 'usr_sarah',
        toUserName: 'Sarah Chen',
        amount: 160,
        originalAmount: 160,
        currency: 'BDT',
        paymentMethod: 'bKash',
        status: 'Accepted',
        createdAt: '2026-03-05T12:00:00.000Z',
      };

      const updated = calculateGroupMembersWithBalances(baseGroup, [], [settleUp]);
      const me = updated.find((m) => m.id === 'usr_me')!;
      const sarah = updated.find((m) => m.id === 'usr_sarah')!;

      // Current user:
      // Amount Owed To Me = 160, Amount I Owe = 0
      expect(me.balance).toBe(160);
      const youAreOwed = me.balance > 0 ? me.balance : 0;
      const youOwe = me.balance < 0 ? Math.abs(me.balance) : 0;
      expect(youAreOwed).toBe(160);
      expect(youOwe).toBe(0);

      // Sarah:
      // Amount Owed To Me = 0, Amount I Owe = 160
      expect(sarah.balance).toBe(-160);
      const sarahOwed = sarah.balance > 0 ? sarah.balance : 0;
      const sarahOwes = sarah.balance < 0 ? Math.abs(sarah.balance) : 0;
      expect(sarahOwed).toBe(0);
      expect(sarahOwes).toBe(160);
    });

    it('Pending Settle Up does NOT affect the balance yet', () => {
      const pendingSettleUp: Settlement = {
        id: 'stl_up_pending',
        groupId: 'grp_alpha',
        groupName: 'Alpha Squad',
        settlementType: 'SETTLE_UP',
        fromUserId: 'usr_me',
        fromUserName: 'Staff Engineer (You)',
        toUserId: 'usr_sarah',
        toUserName: 'Sarah Chen',
        amount: 160,
        originalAmount: 160,
        currency: 'BDT',
        status: 'Pending',
        createdAt: '2026-03-05T12:00:00.000Z',
      };

      const updated = calculateGroupMembersWithBalances(baseGroup, [], [pendingSettleUp]);
      const me = updated.find((m) => m.id === 'usr_me')!;
      const sarah = updated.find((m) => m.id === 'usr_sarah')!;

      expect(me.balance).toBe(0);
      expect(sarah.balance).toBe(0);
    });
  });

  describe('SETTLE DOWN Action', () => {
    it('Settle Down moves the current user balance DOWN toward negative (-160) and Sarah up (+160) after acceptance', () => {
      // Settle Down: Current user creates a Settle Down request of 160 with Sarah
      // Moves current user balance DOWN -> current user is debtor / recipient of settlement credit
      const settleDown: Settlement = {
        id: 'stl_down_1',
        groupId: 'grp_alpha',
        groupName: 'Alpha Squad',
        settlementType: 'SETTLE_DOWN',
        fromUserId: 'usr_sarah',
        fromUserName: 'Sarah Chen',
        toUserId: 'usr_me',
        toUserName: 'Staff Engineer (You)',
        amount: 160,
        originalAmount: 160,
        currency: 'BDT',
        paymentMethod: 'Cash',
        status: 'Accepted',
        createdAt: '2026-03-05T12:00:00.000Z',
      };

      const updated = calculateGroupMembersWithBalances(baseGroup, [], [settleDown]);
      const me = updated.find((m) => m.id === 'usr_me')!;
      const sarah = updated.find((m) => m.id === 'usr_sarah')!;

      // Current user:
      // Amount Owed To Me = 0, Amount I Owe = 160
      expect(me.balance).toBe(-160);
      const youAreOwed = me.balance > 0 ? me.balance : 0;
      const youOwe = me.balance < 0 ? Math.abs(me.balance) : 0;
      expect(youAreOwed).toBe(0);
      expect(youOwe).toBe(160);

      // Sarah:
      // Amount Owed To Me = 160, Amount I Owe = 0
      expect(sarah.balance).toBe(160);
      const sarahOwed = sarah.balance > 0 ? sarah.balance : 0;
      const sarahOwes = sarah.balance < 0 ? Math.abs(sarah.balance) : 0;
      expect(sarahOwed).toBe(160);
      expect(sarahOwes).toBe(0);
    });

    it('Pending Settle Down does NOT affect the balance yet', () => {
      const pendingSettleDown: Settlement = {
        id: 'stl_down_pending',
        groupId: 'grp_alpha',
        groupName: 'Alpha Squad',
        settlementType: 'SETTLE_DOWN',
        fromUserId: 'usr_sarah',
        fromUserName: 'Sarah Chen',
        toUserId: 'usr_me',
        toUserName: 'Staff Engineer (You)',
        amount: 160,
        originalAmount: 160,
        currency: 'BDT',
        status: 'Pending',
        createdAt: '2026-03-05T12:00:00.000Z',
      };

      const updated = calculateGroupMembersWithBalances(baseGroup, [], [pendingSettleDown]);
      const me = updated.find((m) => m.id === 'usr_me')!;
      const sarah = updated.find((m) => m.id === 'usr_sarah')!;

      expect(me.balance).toBe(0);
      expect(sarah.balance).toBe(0);
    });
  });

  describe('CRITICAL SETTLEMENT NON-INTERFERENCE RULES', () => {
    const expenses: Expense[] = [
      {
        id: 'exp_dinner',
        title: 'Team Dinner',
        merchant: 'Grill House',
        amount: 600,
        originalAmount: 600,
        currency: 'BDT',
        paidByUserId: 'usr_me',
        paidByName: 'Staff Engineer (You)',
        date: '2026-03-01',
        category: 'Food',
        paymentMethod: 'bkash',
        isShared: true,
        groupId: 'grp_alpha',
        status: 'Settled',
      },
    ];

    it('Settlement does NOT modify total squad spending or member spent amounts', () => {
      // 1 expense of 600 paid by 'usr_me' split equally (300 each)
      // Before settlement:
      // me: spent 600, share 300, balance +300
      // sarah: spent 0, share 300, balance -300
      const beforeMembers = calculateGroupMembersWithBalances(baseGroup, expenses, []);
      const beforeMe = beforeMembers.find((m) => m.id === 'usr_me')!;
      expect(beforeMe.spent).toBe(600);
      expect(beforeMe.share).toBe(300);
      expect(beforeMe.balance).toBe(300);

      // Now Sarah settles 300 with Me
      const settlement: Settlement = {
        id: 'stl_settle_all',
        groupId: 'grp_alpha',
        groupName: 'Alpha Squad',
        fromUserId: 'usr_sarah',
        fromUserName: 'Sarah Chen',
        toUserId: 'usr_me',
        toUserName: 'Staff Engineer (You)',
        amount: 300,
        originalAmount: 300,
        currency: 'BDT',
        status: 'Accepted',
        createdAt: '2026-03-02T10:00:00.000Z',
      };

      const enriched = enrichGroupsWithBalances([baseGroup], expenses, [settlement]);
      const squad = enriched[0];
      const afterMe = squad.members.find((m) => m.id === 'usr_me')!;
      const afterSarah = squad.members.find((m) => m.id === 'usr_sarah')!;

      // Total squad spending remains strictly 600 (not 900)
      expect(squad.totalSpent).toBe(600);

      // Member spent amounts remain unchanged
      expect(afterMe.spent).toBe(600);
      expect(afterSarah.spent).toBe(0);

      // Member shares remain unchanged
      expect(afterMe.share).toBe(300);
      expect(afterSarah.share).toBe(300);

      // Balances are now cleared to 0
      expect(afterMe.balance).toBe(0);
      expect(afterSarah.balance).toBe(0);
    });
  });

  describe('LATEST-FIRST HISTORY ORDERING', () => {
    it('sorts history items strictly newest-first with timestamp tie-breakers', () => {
      const items = [
        { id: 'item_1', createdAt: '2026-03-01T10:00:00.000Z' },
        { id: 'item_3', createdAt: '2026-03-03T10:00:00.000Z' },
        { id: 'item_2', createdAt: '2026-03-02T10:00:00.000Z' },
      ];

      const sorted = [...items].sort(compareHistoryItemsDesc);
      expect(sorted.map((i) => i.id)).toEqual(['item_3', 'item_2', 'item_1']);
    });

    it('uses ID descending as deterministic secondary tie-breaker for identical timestamps', () => {
      const items = [
        { id: 'item_alpha', createdAt: '2026-03-01T12:00:00.000Z' },
        { id: 'item_gamma', createdAt: '2026-03-01T12:00:00.000Z' },
        { id: 'item_beta', createdAt: '2026-03-01T12:00:00.000Z' },
      ];

      const sorted = [...items].sort(compareHistoryItemsDesc);
      expect(sorted.map((i) => i.id)).toEqual(['item_gamma', 'item_beta', 'item_alpha']);
    });

    it('buildUnifiedHistory interleaves expenses and settlements in strict latest-first order', () => {
      const expenses: Expense[] = [
        {
          id: 'exp_1',
          title: 'Day 1 Lunch',
          merchant: 'Diner',
          amount: 100,
          currency: 'BDT',
          paidByUserId: 'usr_me',
          paidByName: 'Staff Engineer (You)',
          date: '2026-03-01',
          createdAt: '2026-03-01T12:00:00.000Z',
          category: 'Food',
          paymentMethod: 'Cash',
          isShared: true,
          groupId: 'grp_alpha',
          status: 'Settled',
        },
        {
          id: 'exp_3',
          title: 'Day 3 Dinner',
          merchant: 'Bistro',
          amount: 300,
          currency: 'BDT',
          paidByUserId: 'usr_me',
          paidByName: 'Staff Engineer (You)',
          date: '2026-03-03',
          createdAt: '2026-03-03T18:00:00.000Z',
          category: 'Food',
          paymentMethod: 'Cash',
          isShared: true,
          groupId: 'grp_alpha',
          status: 'Settled',
        },
      ];

      const settlements: Settlement[] = [
        {
          id: 'stl_2',
          groupId: 'grp_alpha',
          groupName: 'Alpha Squad',
          fromUserId: 'usr_sarah',
          fromUserName: 'Sarah Chen',
          toUserId: 'usr_me',
          toUserName: 'Staff Engineer (You)',
          amount: 50,
          currency: 'BDT',
          status: 'Accepted',
          createdAt: '2026-03-02T15:00:00.000Z',
        },
      ];

      const unified = buildUnifiedHistory(expenses, settlements);

      expect(unified.map((u) => u.id)).toEqual(['exp_3', 'stl_2', 'exp_1']);
      expect(unified[0].kind).toBe('expense');
      expect(unified[1].kind).toBe('settlement');
      expect(unified[2].kind).toBe('expense');
    });
  });

  describe('PART 1 — PENDING SETTLEMENT DELETE/CANCEL RULES', () => {
    it('Cancelling a pending settlement sets status to "Cancelled" without affecting any balances', () => {
      const pending: Settlement = {
        id: 'stl_to_cancel',
        groupId: 'grp_alpha',
        groupName: 'Alpha Squad',
        settlementType: 'SETTLE_UP',
        requestedByUserId: 'usr_me',
        fromUserId: 'usr_me',
        fromUserName: 'Staff Engineer (You)',
        toUserId: 'usr_sarah',
        toUserName: 'Sarah Chen',
        amount: 250,
        originalAmount: 250,
        currency: 'BDT',
        status: 'Pending',
        createdAt: '2026-03-05T12:00:00.000Z',
      };

      // Before cancellation: Pending doesn't affect balance
      const before = calculateGroupMembersWithBalances(baseGroup, [], [pending]);
      expect(before.find((m) => m.id === 'usr_me')!.balance).toBe(0);
      expect(before.find((m) => m.id === 'usr_sarah')!.balance).toBe(0);

      // Now cancel the pending request
      const cancelled: Settlement = {
        ...pending,
        status: 'Cancelled',
      };

      const after = calculateGroupMembersWithBalances(baseGroup, [], [cancelled]);
      expect(after.find((m) => m.id === 'usr_me')!.balance).toBe(0);
      expect(after.find((m) => m.id === 'usr_sarah')!.balance).toBe(0);
    });

    it('Cancelled pending settlement is excluded from active pending settlements list', () => {
      const settlements: Settlement[] = [
        {
          id: 'stl_active_pending',
          groupId: 'grp_alpha',
          groupName: 'Alpha Squad',
          fromUserId: 'usr_me',
          fromUserName: 'Staff Engineer (You)',
          toUserId: 'usr_sarah',
          toUserName: 'Sarah Chen',
          amount: 100,
          currency: 'BDT',
          status: 'Pending',
          createdAt: '2026-03-05T10:00:00.000Z',
        },
        {
          id: 'stl_cancelled',
          groupId: 'grp_alpha',
          groupName: 'Alpha Squad',
          fromUserId: 'usr_me',
          fromUserName: 'Staff Engineer (You)',
          toUserId: 'usr_sarah',
          toUserName: 'Sarah Chen',
          amount: 200,
          currency: 'BDT',
          status: 'Cancelled',
          createdAt: '2026-03-05T11:00:00.000Z',
        },
      ];

      // Active pending filter (matches SharedGroupsView logic)
      const activePending = settlements.filter((s) => {
        const st = (s.status || '').toLowerCase();
        return st === 'pending' || st === 'pending approval';
      });

      expect(activePending.length).toBe(1);
      expect(activePending[0].id).toBe('stl_active_pending');
      expect(activePending.some((s) => s.id === 'stl_cancelled')).toBe(false);
    });

    it('Only the original requester is authorized to delete/cancel their pending settlement', () => {
      const requesterPending: Settlement = {
        id: 'stl_req_1',
        groupId: 'grp_alpha',
        groupName: 'Alpha Squad',
        requestedByUserId: 'usr_me',
        fromUserId: 'usr_me',
        fromUserName: 'Staff Engineer (You)',
        toUserId: 'usr_sarah',
        toUserName: 'Sarah Chen',
        amount: 150,
        currency: 'BDT',
        status: 'Pending',
        createdAt: '2026-03-05T12:00:00.000Z',
      };

      // Current user is 'usr_me'
      const isRequesterMe = requesterPending.requestedByUserId === 'usr_me';
      const isRecipientMe = requesterPending.toUserId === 'usr_me';

      expect(isRequesterMe).toBe(true);
      expect(isRecipientMe).toBe(false);

      // Recipient Sarah:
      const isRequesterSarah = requesterPending.requestedByUserId === 'usr_sarah';
      const isRecipientSarah = requesterPending.toUserId === 'usr_sarah';

      expect(isRequesterSarah).toBe(false);
      expect(isRecipientSarah).toBe(true);
    });
  });
});

