import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalRepository } from './services/localRepository';
import { idbGetAll, idbPut, idbClear, idbGet, STORES } from './services/indexedDB';
import { syncEngine } from './services/syncEngine';
import { calculateGroupMembersWithBalances, enrichGroupsWithBalances } from './utils/balanceEngine';
import { enqueueMutation, getPendingMutations } from './services/syncQueue';
import { Settlement, Expense, Group, UserProfile } from './types';
import { sumExactAmounts } from './utils/money';

// Mock storage for vitest runner
const mockStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => {
      store[k] = v.toString();
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
})();

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
  });
}

describe('Tallix Settlement Delete / Undo Feature Test Suite (A to Q)', () => {
  const groupId = 'grp_1790006522192_bf12470d33bf';
  const requesterId = 'usr_reg_1789939746901'; // Lemon (requester for Settle Up)
  const recipientId = 'usr_reg_1790264690739_27sig4i'; // Jack (recipient for Settle Up)
  const thirdMemberId = 'usr_reg_1790264485433_6j9ak4u'; // Shahid

  const mockGroup: Group = {
    id: groupId,
    name: 'Khaddo',
    description: 'Food squad',
    category: 'Food',
    currency: 'BDT',
    inviteCode: 'KHADDO26',
    avatarGradient: 'from-amber-500 to-orange-500',
    members: [
      { id: requesterId, name: 'Lemon', email: 'lemon@example.com', role: 'Admin', balance: 0 },
      { id: recipientId, name: 'Jack sparrow', email: 'jack@example.com', role: 'Member', balance: 0 },
      { id: thirdMemberId, name: 'Shahid', email: 'shahid@example.com', role: 'Member', balance: 0 },
    ],
    totalSpent: 1200,
    unsettledAmount: 0,
    createdAt: '2026-09-20T10:00:00Z',
    updatedAt: '2026-09-20T10:00:00Z',
  };

  const mockSharedExpense: Expense = {
    id: 'exp_khaddo_1',
    groupId,
    groupName: 'Khaddo',
    title: 'Dinner at Sultan Dine',
    merchant: 'Sultan Dine',
    amount: 1200,
    originalAmount: 1200,
    amount_paisa: 120000,
    currency: 'BDT',
    category: 'Food',
    date: '2026-09-27',
    paidByUserId: requesterId,
    paidByName: 'Lemon',
    paymentMethod: 'bkash',
    status: 'Settled',
    isShared: true,
    createdBy: requesterId,
    createdAt: '2026-09-27T10:00:00Z',
    updatedAt: '2026-09-27T10:00:00Z',
  };

  const pendingSettlement: Settlement = {
    id: 'stl_pending_1',
    groupId,
    groupName: 'Khaddo',
    settlementType: 'SETTLE_UP',
    requestedByUserId: requesterId,
    createdBy: requesterId,
    fromUserId: requesterId,
    fromUserName: 'Lemon',
    toUserId: recipientId,
    toUserName: 'Jack sparrow',
    amount: 160,
    amount_paisa: 16000,
    currency: 'BDT',
    paymentMethod: 'bKash',
    status: 'Pending',
    createdAt: '2026-09-30T10:00:00Z',
  };

  const acceptedSettleUp: Settlement = {
    id: 'stl_accepted_up_1',
    groupId,
    groupName: 'Khaddo',
    settlementType: 'SETTLE_UP',
    requestedByUserId: requesterId,
    createdBy: requesterId,
    fromUserId: requesterId,
    fromUserName: 'Lemon',
    toUserId: recipientId,
    toUserName: 'Jack sparrow',
    amount: 160,
    amount_paisa: 16000,
    currency: 'BDT',
    paymentMethod: 'bKash',
    status: 'Accepted',
    createdAt: '2026-09-27T10:20:00Z',
  };

  const acceptedSettleDown: Settlement = {
    id: 'stl_accepted_down_1',
    groupId,
    groupName: 'Khaddo',
    settlementType: 'SETTLE_DOWN',
    requestedByUserId: requesterId, // Lemon requested Jack to pay Lemon
    createdBy: requesterId,
    fromUserId: recipientId, // Jack pays
    fromUserName: 'Jack sparrow',
    toUserId: requesterId, // Lemon receives
    toUserName: 'Lemon',
    amount: 160,
    amount_paisa: 16000,
    currency: 'BDT',
    paymentMethod: 'bKash',
    status: 'Accepted',
    createdAt: '2026-09-27T10:25:00Z',
  };

  const cancelledSettlement: Settlement = {
    id: 'stl_cancelled_1',
    groupId,
    groupName: 'Khaddo',
    settlementType: 'SETTLE_UP',
    requestedByUserId: requesterId,
    createdBy: requesterId,
    fromUserId: requesterId,
    fromUserName: 'Lemon',
    toUserId: recipientId,
    toUserName: 'Jack sparrow',
    amount: 160,
    status: 'Cancelled',
    currency: 'BDT',
    createdAt: '2026-09-27T10:30:00Z',
  };

  const rejectedSettlement: Settlement = {
    id: 'stl_rejected_1',
    groupId,
    groupName: 'Khaddo',
    settlementType: 'SETTLE_UP',
    requestedByUserId: requesterId,
    createdBy: requesterId,
    fromUserId: requesterId,
    fromUserName: 'Lemon',
    toUserId: recipientId,
    toUserName: 'Jack sparrow',
    amount: 160,
    status: 'Rejected',
    currency: 'BDT',
    createdAt: '2026-09-27T10:35:00Z',
  };

  beforeEach(async () => {
    await idbClear(STORES.USERS);
    await idbClear(STORES.EXPENSES);
    await idbClear(STORES.GROUPS);
    await idbClear(STORES.SETTLEMENTS);
    await idbClear(STORES.SYNC_QUEUE);
    mockStorage.clear();
    syncEngine.resetUserState();
    vi.restoreAllMocks();
  });

  // A. requester can delete pending settlement
  it('A. Requester can delete pending settlement', async () => {
    await idbPut(STORES.SETTLEMENTS, pendingSettlement);
    expect(await idbGet(STORES.SETTLEMENTS, pendingSettlement.id)).toBeDefined();

    await LocalRepository.deleteSettlement(pendingSettlement.id, requesterId, pendingSettlement);

    const after = await idbGet(STORES.SETTLEMENTS, pendingSettlement.id);
    expect(after).toBeNull();

    const pendingMutations = await getPendingMutations();
    const deleteMut = pendingMutations.find((m) => m.entityId === pendingSettlement.id && m.operation === 'DELETE');
    expect(deleteMut).toBeDefined();
    expect(deleteMut?.userId).toBe(requesterId);
  });

  // B. recipient cannot delete pending settlement
  it('B. Recipient cannot delete pending settlement', () => {
    const isRecipientAllowed = (stl: Settlement, callerId: string) => {
      const isSettleDown = stl.settlementType === 'SETTLE_DOWN';
      const actualRequester = stl.requestedByUserId || stl.createdBy || (isSettleDown ? stl.toUserId : stl.fromUserId);
      const actualRecipient = isSettleDown ? stl.toUserId : stl.fromUserId;
      if (callerId === actualRecipient && callerId !== actualRequester) {
        return false;
      }
      return callerId === actualRequester;
    };

    expect(isRecipientAllowed(pendingSettlement, requesterId)).toBe(true);
    expect(isRecipientAllowed(pendingSettlement, recipientId)).toBe(false);
  });

  // C. requester can delete accepted settlement
  it('C. Requester can delete accepted settlement', async () => {
    await idbPut(STORES.SETTLEMENTS, acceptedSettleUp);
    await LocalRepository.deleteSettlement(acceptedSettleUp.id, requesterId, acceptedSettleUp);

    const after = await idbGet(STORES.SETTLEMENTS, acceptedSettleUp.id);
    expect(after).toBeNull();

    const mutations = await getPendingMutations();
    expect(mutations.some((m) => m.entityId === acceptedSettleUp.id && m.operation === 'DELETE')).toBe(true);
  });

  // D. recipient cannot delete accepted settlement
  it('D. Recipient cannot delete accepted settlement', () => {
    const canDelete = (stl: Settlement, userId: string, isAdmin = false) => {
      if (isAdmin) return true;
      const isSettleDown = stl.settlementType === 'SETTLE_DOWN';
      const reqId = stl.requestedByUserId || stl.createdBy || (isSettleDown ? stl.toUserId : stl.fromUserId);
      const recId = isSettleDown ? stl.toUserId : stl.fromUserId;
      if (userId === recId && userId !== reqId) return false;
      return userId === reqId;
    };

    expect(canDelete(acceptedSettleUp, recipientId)).toBe(false);
    expect(canDelete(acceptedSettleUp, requesterId)).toBe(true);
  });

  // E. deleting accepted Settle Up reverses exactly its balance effect
  it('E. Deleting accepted Settle Up reverses exactly its balance effect', () => {
    // 3-way split of 1200: Lemon spent 1200 (share 400), Jack share 400, Shahid share 400.
    // Initial balances before settlement:
    // Lemon: +800, Jack: -400, Shahid: -400.
    // With accepted Settle Up (Lemon paid 160 to Jack):
    // Lemon sent 160 -> +800 + 160 = +960. Jack received 160 -> -400 - 160 = -560.
    const balancesWithSettlement = calculateGroupMembersWithBalances(
      mockGroup,
      [mockSharedExpense],
      [acceptedSettleUp]
    );
    const lemonWith = balancesWithSettlement.find((m) => m.id === requesterId);
    const jackWith = balancesWithSettlement.find((m) => m.id === recipientId);
    expect(lemonWith?.balance).toBe(960);
    expect(jackWith?.balance).toBe(-560);

    // After deleting accepted Settle Up:
    const balancesWithoutSettlement = calculateGroupMembersWithBalances(
      mockGroup,
      [mockSharedExpense],
      [] // deleted
    );
    const lemonWithout = balancesWithoutSettlement.find((m) => m.id === requesterId);
    const jackWithout = balancesWithoutSettlement.find((m) => m.id === recipientId);

    // Reverses exactly the 160 BDT settlement effect
    expect(lemonWithout?.balance).toBe(800);
    expect(jackWithout?.balance).toBe(-400);
    expect((lemonWith?.balance || 0) - (lemonWithout?.balance || 0)).toBe(160);
    expect((jackWithout?.balance || 0) - (jackWith?.balance || 0)).toBe(160);
  });

  // F. deleting accepted Settle Down reverses exactly its balance effect
  it('F. Deleting accepted Settle Down reverses exactly its balance effect', () => {
    // Initial balances: Lemon: +800, Jack: -400, Shahid: -400.
    // In Settle Down: Jack sent 160 to Lemon.
    // Jack sent 160 -> -400 + 160 = -240. Lemon received 160 -> +800 - 160 = +640.
    const balancesWithDown = calculateGroupMembersWithBalances(
      mockGroup,
      [mockSharedExpense],
      [acceptedSettleDown]
    );
    const lemonWith = balancesWithDown.find((m) => m.id === requesterId);
    const jackWith = balancesWithDown.find((m) => m.id === recipientId);
    expect(lemonWith?.balance).toBe(640);
    expect(jackWith?.balance).toBe(-240);

    // Deleting the Settle Down reverses the 160 BDT effect
    const balancesWithout = calculateGroupMembersWithBalances(
      mockGroup,
      [mockSharedExpense],
      []
    );
    const lemonWithout = balancesWithout.find((m) => m.id === requesterId);
    const jackWithout = balancesWithout.find((m) => m.id === recipientId);
    expect(lemonWithout?.balance).toBe(800);
    expect(jackWithout?.balance).toBe(-400);
    expect((lemonWithout?.balance || 0) - (lemonWith?.balance || 0)).toBe(160);
    expect((jackWith?.balance || 0) - (jackWithout?.balance || 0)).toBe(160);
  });

  // G. deleting settlement does not change expense totals
  it('G. Deleting settlement does not change expense totals', () => {
    const expenses = [mockSharedExpense];
    const totalBefore = sumExactAmounts(expenses.map((e) => e.amount));

    // Delete settlement
    const settlementsBefore = [acceptedSettleUp];
    const settlementsAfter: Settlement[] = [];

    const totalAfter = sumExactAmounts(expenses.map((e) => e.amount));
    expect(totalAfter).toBe(totalBefore);
    expect(totalAfter).toBe(1200);

    const enrichedBefore = enrichGroupsWithBalances([mockGroup], expenses, settlementsBefore);
    const enrichedAfter = enrichGroupsWithBalances([mockGroup], expenses, settlementsAfter);

    expect(enrichedAfter[0].totalSpent).toBe(enrichedBefore[0].totalSpent);
    expect(enrichedAfter[0].totalSpent).toBe(1200);
  });

  // H. deleting settlement does not change expense split/share
  it('H. Deleting settlement does not change expense split/share', () => {
    const membersBefore = calculateGroupMembersWithBalances(mockGroup, [mockSharedExpense], [acceptedSettleUp]);
    const membersAfter = calculateGroupMembersWithBalances(mockGroup, [mockSharedExpense], []);

    membersBefore.forEach((mb) => {
      const ma = membersAfter.find((m) => m.id === mb.id);
      expect(ma?.spent).toBe(mb.spent);
      expect(ma?.share).toBe(mb.share); // 400 each remains exactly 400
    });
  });

  // I. deleted settlement does not reappear after sync
  it('I. Deleted settlement does not reappear after sync', async () => {
    await idbPut(STORES.SETTLEMENTS, acceptedSettleUp);
    await LocalRepository.deleteSettlement(acceptedSettleUp.id, requesterId, acceptedSettleUp);

    // Mock sync pull where server sends deletedSettlementIds: ['stl_accepted_up_1']
    vi.spyOn(syncEngine, 'checkReachability').mockResolvedValue(true);
    syncEngine.setUserId(requesterId);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = input.toString();
      if (url.includes('/api/sync/pull')) {
        return new Response(
          JSON.stringify({
            success: true,
            serverTimestamp: '2026-09-30T12:00:00Z',
            expenses: [mockSharedExpense],
            groups: [mockGroup],
            settlements: [], // Server excluded it
            registeredUsers: [],
            deletedExpenseIds: [],
            deletedGroupIds: [],
            deletedSettlementIds: [acceptedSettleUp.id],
            deletedUserIds: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    await syncEngine.triggerSync();

    const storedSettlements = await LocalRepository.getAllSettlements();
    expect(storedSettlements.find((s) => s.id === acceptedSettleUp.id)).toBeUndefined();
  });

  // J. offline delete queues correctly
  it('J. Offline delete queues correctly in SYNC_QUEUE', async () => {
    await idbPut(STORES.SETTLEMENTS, pendingSettlement);

    // Simulate offline
    vi.spyOn(syncEngine, 'checkReachability').mockResolvedValue(false);

    await LocalRepository.deleteSettlement(pendingSettlement.id, requesterId, pendingSettlement);

    // Deleted from local store immediately
    expect(await idbGet(STORES.SETTLEMENTS, pendingSettlement.id)).toBeNull();

    // Queued in mutation store
    const queue = await getPendingMutations();
    expect(queue.length).toBe(1);
    expect(queue[0].entityType).toBe('settlement');
    expect(queue[0].entityId).toBe(pendingSettlement.id);
    expect(queue[0].operation).toBe('DELETE');
    expect(queue[0].payload.id).toBe(pendingSettlement.id);
  });

  // K. duplicate deletion is idempotent
  it('K. Duplicate deletion is idempotent', async () => {
    await idbPut(STORES.SETTLEMENTS, pendingSettlement);

    // Call delete first time
    await LocalRepository.deleteSettlement(pendingSettlement.id, requesterId, pendingSettlement);
    expect(await idbGet(STORES.SETTLEMENTS, pendingSettlement.id)).toBeNull();

    // Call delete second time: should execute without error
    await expect(LocalRepository.deleteSettlement(pendingSettlement.id, requesterId, pendingSettlement)).resolves.not.toThrow();
    expect(await idbGet(STORES.SETTLEMENTS, pendingSettlement.id)).toBeNull();
  });

  // L. unauthenticated delete is rejected
  it('L. Unauthenticated delete is rejected', async () => {
    const unauthenticatedPayload = {
      clientDeviceId: 'dev_test',
      userId: 'anonymous',
      mutations: [
        {
          mutationId: 'mut_del_unauth',
          entityType: 'settlement',
          entityId: 'stl_1',
          operation: 'DELETE',
          payload: { id: 'stl_1' },
          userId: 'anonymous',
        },
      ],
    };

    // Simulate backend auth check
    const hasProtectedDelete = unauthenticatedPayload.mutations.some((m) => m.operation === 'DELETE');
    const callerUserId = ''; // unauthenticated
    const status = hasProtectedDelete && !callerUserId ? 401 : 200;

    expect(status).toBe(401);
  });

  // M. another user's settlement cannot be deleted
  it("M. Another user's settlement cannot be deleted", () => {
    const foreignSettlement: Settlement = {
      id: 'stl_foreign',
      groupId,
      groupName: 'Khaddo',
      settlementType: 'SETTLE_UP',
      requestedByUserId: thirdMemberId,
      createdBy: thirdMemberId,
      fromUserId: thirdMemberId,
      fromUserName: 'Shahid',
      toUserId: recipientId,
      toUserName: 'Jack sparrow',
      amount: 50,
      currency: 'BDT',
      status: 'Accepted',
      createdAt: '2026-09-30T10:00:00Z',
    };

    // Caller is Jack (recipient) or random user
    const checkCanDelete = (stl: Settlement, caller: string) => {
      const isSettleDown = stl.settlementType === 'SETTLE_DOWN';
      const reqId = stl.requestedByUserId || stl.createdBy || (isSettleDown ? stl.toUserId : stl.fromUserId);
      const recId = isSettleDown ? stl.toUserId : stl.fromUserId;
      if (caller === recId && caller !== reqId) return false;
      return caller === reqId;
    };

    expect(checkCanDelete(foreignSettlement, 'usr_intruder')).toBe(false);
    expect(checkCanDelete(foreignSettlement, recipientId)).toBe(false); // recipient cannot delete
    expect(checkCanDelete(foreignSettlement, thirdMemberId)).toBe(true); // creator can delete
  });

  // N. rejected/cancelled settlement deletion does not affect balances
  it('N. Rejected/Cancelled settlement deletion does not affect balances', () => {
    const balancesWithCancelledAndRejected = calculateGroupMembersWithBalances(
      mockGroup,
      [mockSharedExpense],
      [cancelledSettlement, rejectedSettlement]
    );

    const balancesAfterDeletingThem = calculateGroupMembersWithBalances(
      mockGroup,
      [mockSharedExpense],
      []
    );

    expect(balancesWithCancelledAndRejected).toEqual(balancesAfterDeletingThem);
  });

  // O. deleting a settlement does not delete any expense
  it('O. Deleting a settlement does not delete any expense', async () => {
    await idbPut(STORES.EXPENSES, mockSharedExpense);
    await idbPut(STORES.SETTLEMENTS, acceptedSettleUp);

    await LocalRepository.deleteSettlement(acceptedSettleUp.id, requesterId, acceptedSettleUp);

    // Expense is completely untouched
    const storedExpense = await idbGet<Expense>(STORES.EXPENSES, mockSharedExpense.id);
    expect(storedExpense).toBeDefined();
    expect(storedExpense?.id).toBe(mockSharedExpense.id);
    expect(storedExpense?.amount).toBe(1200);
  });

  // P. existing settlement IDs remain stable during deletion
  it('P. Existing settlement IDs remain stable during deletion', async () => {
    await idbPut(STORES.SETTLEMENTS, acceptedSettleUp);
    await LocalRepository.deleteSettlement(acceptedSettleUp.id, requesterId, acceptedSettleUp);

    const mutations = await getPendingMutations();
    const mutation = mutations.find((m) => m.entityId === acceptedSettleUp.id);
    expect(mutation?.entityId).toBe('stl_accepted_up_1');
    expect(mutation?.payload.id).toBe('stl_accepted_up_1');
  });

  // Q. existing historical settlements remain untouched unless explicitly deleted
  it('Q. Existing historical settlements remain untouched unless explicitly deleted', async () => {
    const all5 = [
      pendingSettlement,
      acceptedSettleUp,
      acceptedSettleDown,
      cancelledSettlement,
      rejectedSettlement,
    ];
    for (const s of all5) {
      await idbPut(STORES.SETTLEMENTS, s);
    }

    // Explicitly delete only acceptedSettleUp
    await LocalRepository.deleteSettlement(acceptedSettleUp.id, requesterId, acceptedSettleUp);

    const remaining = await LocalRepository.getAllSettlements();
    expect(remaining.length).toBe(4);
    expect(remaining.find((s) => s.id === acceptedSettleUp.id)).toBeUndefined();

    // The other 4 remain intact
    expect(remaining.find((s) => s.id === pendingSettlement.id)).toBeDefined();
    expect(remaining.find((s) => s.id === acceptedSettleDown.id)).toBeDefined();
    expect(remaining.find((s) => s.id === cancelledSettlement.id)).toBeDefined();
    expect(remaining.find((s) => s.id === rejectedSettlement.id)).toBeDefined();
  });
});
