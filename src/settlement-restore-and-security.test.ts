import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalRepository } from './services/localRepository';
import { idbGetAll, idbPut, idbClear, STORES } from './services/indexedDB';
import { syncEngine } from './services/syncEngine';
import { calculateGroupMembersWithBalances } from './utils/balanceEngine';
import { enqueueMutation } from './services/syncQueue';
import { Settlement, Expense, Group, RegisteredUser } from './types';

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

describe('Settlement Restoration, Sync & Security Regression Suite', () => {
  const groupId = 'grp_1790006522192_bf12470d33bf';
  const lemonId = 'usr_reg_1789939746901';
  const jackId = 'usr_reg_1790264690739_27sig4i';
  const shahidId = 'usr_reg_1790264485433_6j9ak4u';

  // The 5 canonical settlements
  const settlement1: Settlement = {
    id: 'stl_1790499889530',
    groupId,
    groupName: 'Khaddo',
    fromUserId: lemonId,
    fromUserName: 'Lemon',
    toUserId: jackId,
    toUserName: 'Jack sparrow',
    amount: 160,
    amount_paisa: 16000,
    currency: 'BDT',
    paymentMethod: 'bKash',
    status: 'Cancelled',
    createdAt: '2026-09-27',
    updatedAt: '2026-09-29T19:57:54.316Z',
  };

  const settlement2: Settlement = {
    id: 'stl_1790504687839',
    groupId,
    groupName: 'Khaddo',
    fromUserId: lemonId,
    fromUserName: 'Lemon',
    toUserId: shahidId,
    toUserName: 'Shahid',
    amount: 100,
    amount_paisa: 10000,
    currency: 'BDT',
    paymentMethod: 'bKash',
    status: 'Accepted',
    createdAt: '2026-09-27T10:24:47.840Z',
    updatedAt: '2026-09-29T19:57:54.316Z',
  };

  const settlement3: Settlement = {
    id: 'stl_1790504857565',
    groupId,
    groupName: 'Khaddo',
    fromUserId: jackId,
    fromUserName: 'Jack sparrow',
    toUserId: lemonId,
    toUserName: 'Lemon',
    amount: 160,
    amount_paisa: 16000,
    currency: 'BDT',
    paymentMethod: 'bKash',
    status: 'Accepted',
    createdAt: '2026-09-27T10:27:37.565Z',
    updatedAt: '2026-09-29T19:57:54.316Z',
  };

  const settlement4: Settlement = {
    id: 'stl_1790743471116',
    groupId,
    groupName: 'Khaddo',
    fromUserId: jackId,
    fromUserName: 'Jack sparrow',
    toUserId: lemonId,
    toUserName: 'Lemon',
    amount: 160,
    amount_paisa: 16000,
    currency: 'BDT',
    paymentMethod: 'bKash',
    status: 'Rejected',
    createdAt: '2026-09-30T04:44:31.116Z',
    updatedAt: '2026-09-30T04:47:54.664Z',
  };

  const settlement5: Settlement = {
    id: 'stl_1790743488530',
    groupId,
    groupName: 'Khaddo',
    fromUserId: lemonId,
    fromUserName: 'Lemon',
    toUserId: shahidId,
    toUserName: 'Shahid',
    amount: 100,
    amount_paisa: 10000,
    currency: 'BDT',
    paymentMethod: 'bKash',
    status: 'Cancelled',
    createdAt: '2026-09-30T04:44:48.530Z',
    updatedAt: '2026-09-30T04:47:58.067Z',
  };

  const mockGroup: Group = {
    id: groupId,
    name: 'Khaddo',
    description: 'Food squad',
    category: 'Food',
    currency: 'BDT',
    inviteCode: 'KHADDO26',
    avatarGradient: 'from-amber-500 to-orange-500',
    members: [
      { id: lemonId, name: 'Lemon', email: 'lemonshahebb121@gmail.com', role: 'Admin', balance: 0 },
      { id: shahidId, name: 'Shahid', email: 'mdshahidhossen50@gmail.com', role: 'Member', balance: 0 },
      { id: jackId, name: 'Jack sparrow', email: 'xanonymous221b@gmail.com', role: 'Member', balance: 0 },
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
    amount_paisa: 120000,
    currency: 'BDT',
    category: 'Food',
    date: '2026-09-27',
    paidByUserId: lemonId,
    paidByName: 'Lemon',
    paymentMethod: 'bkash',
    status: 'Settled',
    isShared: true,
    createdBy: lemonId,
    createdAt: '2026-09-27T10:00:00Z',
    updatedAt: '2026-09-27T10:00:00Z',
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

  it('1. Sync pull does not send restored settlement IDs as deletedSettlementIds and restores them into IndexedDB', async () => {
    vi.spyOn(syncEngine, 'checkReachability').mockResolvedValue(true);
    syncEngine.setUserId(lemonId);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = input.toString();
      if (url.includes('/api/sync/pull')) {
        return new Response(
          JSON.stringify({
            success: true,
            serverTimestamp: '2026-09-30T19:00:00.000Z',
            expenses: [mockSharedExpense],
            groups: [mockGroup],
            settlements: [settlement1, settlement2, settlement3, settlement4, settlement5],
            registeredUsers: [],
            deletedExpenseIds: [],
            deletedGroupIds: [],
            deletedSettlementIds: [], // Clean: No accidental deletion IDs!
            deletedUserIds: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    const syncRes = await syncEngine.triggerSync();
    expect(syncRes.success).toBe(true);

    const storedSettlements = await LocalRepository.getAllSettlements();
    expect(storedSettlements.length).toBe(5);

    // Verify all 5 exist with exact IDs and no duplicates
    const ids = storedSettlements.map((s) => s.id).sort();
    expect(ids).toEqual([
      'stl_1790499889530',
      'stl_1790504687839',
      'stl_1790504857565',
      'stl_1790743471116',
      'stl_1790743488530',
    ]);
  });

  it('2. Exact statuses are preserved: stl_1790499889530 (Cancelled), stl_1790504687839 (Accepted), stl_1790504857565 (Accepted)', async () => {
    await idbPut(STORES.SETTLEMENTS, settlement1);
    await idbPut(STORES.SETTLEMENTS, settlement2);
    await idbPut(STORES.SETTLEMENTS, settlement3);
    await idbPut(STORES.SETTLEMENTS, settlement4);
    await idbPut(STORES.SETTLEMENTS, settlement5);

    const settlements = await LocalRepository.getAllSettlements();
    const s1 = settlements.find((s) => s.id === 'stl_1790499889530');
    const s2 = settlements.find((s) => s.id === 'stl_1790504687839');
    const s3 = settlements.find((s) => s.id === 'stl_1790504857565');
    const s4 = settlements.find((s) => s.id === 'stl_1790743471116');
    const s5 = settlements.find((s) => s.id === 'stl_1790743488530');

    expect(s1?.status).toBe('Cancelled');
    expect(s2?.status).toBe('Accepted');
    expect(s3?.status).toBe('Accepted');
    expect(s4?.status).toBe('Rejected');
    expect(s5?.status).toBe('Cancelled');
  });

  it('3. Accepted settlements participate in balance calculations, while Cancelled & Rejected remain excluded', () => {
    // 3 members: Lemon, Shahid, Jack sparrow
    // Lemon paid 1200 for equal 3-way split (400 each)
    // Baseline balances before settlements:
    // Lemon: spent 1200 - share 400 = +800
    // Shahid: spent 0 - share 400 = -400
    // Jack: spent 0 - share 400 = -400
    //
    // Settlements:
    // stl_1790499889530: Cancelled (Lemon -> Jack, 160) => Ignored
    // stl_1790504687839: Accepted (Lemon -> Shahid, 100) => Lemon sent 100 (+100 to Lemon balance, -100 to Shahid balance)
    // stl_1790504857565: Accepted (Jack -> Lemon, 160) => Jack sent 160 (+160 to Jack balance, -160 to Lemon balance)
    // stl_1790743471116: Rejected (Jack -> Lemon, 160) => Ignored
    // stl_1790743488530: Cancelled (Lemon -> Shahid, 100) => Ignored
    //
    // Final balances:
    // Lemon: 800 + 100 (sent) - 160 (received) = +740
    // Shahid: -400 - 100 (received) = -500
    // Jack: -400 + 160 (sent) = -240
    // Sum: 740 - 500 - 240 = 0 (Balanced!)

    const membersWithBalances = calculateGroupMembersWithBalances(
      mockGroup,
      [mockSharedExpense],
      [settlement1, settlement2, settlement3, settlement4, settlement5]
    );

    const lemonMember = membersWithBalances.find((m) => m.id === lemonId);
    const shahidMember = membersWithBalances.find((m) => m.id === shahidId);
    const jackMember = membersWithBalances.find((m) => m.id === jackId);

    expect(lemonMember?.balance).toBe(740);
    expect(shahidMember?.balance).toBe(-500);
    expect(jackMember?.balance).toBe(-240);

    // Sum of all balances must be exactly 0
    const sum = (lemonMember?.balance || 0) + (shahidMember?.balance || 0) + (jackMember?.balance || 0);
    expect(sum).toBe(0);
  });

  it('4. Re-initialization does not create duplicate settlement records in IndexedDB', async () => {
    // Seed initial 5
    for (const s of [settlement1, settlement2, settlement3, settlement4, settlement5]) {
      await idbPut(STORES.SETTLEMENTS, s);
    }

    // Call LocalRepository.initialize multiple times
    await LocalRepository.initialize({
      expenses: [],
      groups: [],
      settlements: [settlement1, settlement2, settlement3, settlement4, settlement5],
      registeredUsers: [],
      auditLogs: [],
      guestVisits: [],
    });

    await LocalRepository.initialize({
      expenses: [],
      groups: [],
      settlements: [settlement1, settlement2, settlement3, settlement4, settlement5],
      registeredUsers: [],
      auditLogs: [],
      guestVisits: [],
    });

    const allSettlements = await LocalRepository.getAllSettlements();
    expect(allSettlements.length).toBe(5);

    const uniqueIds = new Set(allSettlements.map((s) => s.id));
    expect(uniqueIds.size).toBe(5);
  });

  it('5. Sync engine push attaches Authorization and X-User-Id headers for authenticated caller', async () => {
    let capturedHeaders: HeadersInit | undefined;
    vi.spyOn(syncEngine, 'checkReachability').mockResolvedValue(true);
    (syncEngine as any).currentUserId = lemonId;
    (syncEngine as any).isSyncInProgress = false;
    syncEngine.stopPeriodicSync();

    // Enqueue a test mutation
    const enqueued = await enqueueMutation({
      entityType: 'expense',
      entityId: 'exp_1',
      operation: 'CREATE',
      payload: { id: 'exp_1', amount: 100 },
      userId: lemonId,
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: RequestInit) => {
      const url = input.toString();
      if (url.includes('/api/sync/push')) {
        capturedHeaders = init?.headers;
        return new Response(
          JSON.stringify({
            success: true,
            processedMutationIds: [enqueued.mutationId],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ success: true, serverTimestamp: new Date().toISOString() }), { status: 200 });
    });

    await syncEngine.triggerSync();
    expect(capturedHeaders).toBeDefined();
    const headers = capturedHeaders as Record<string, string>;
    expect(headers['Authorization']).toBe(`Bearer ${lemonId}`);
    expect(headers['X-User-Id']).toBe(lemonId);
  });
});
