import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateGroupMembersWithBalances, enrichGroupsWithBalances } from './utils/balanceEngine';
import { toPaisa, fromPaisa } from './utils/money';
import { Group, Expense, Settlement, GroupMember } from './types';
import { idbClear, idbPut, idbGetAll, STORES } from './services/indexedDB';
import { syncEngine } from './services/syncEngine';

describe('Squad Balance Reconciliation & Multi-Member Cross-Sync Suite', () => {
  const khaddoGroupId = 'grp_1790006522192_bf12470d33bf';
  const lemonId = 'usr_reg_1789939746901';
  const shahidId = 'usr_reg_1790264485433_6j9ak4u';
  const jackId = 'usr_reg_1790264690739_27sig4i';

  const khaddoMembers: GroupMember[] = [
    { id: lemonId, name: 'Lemon (You)', email: 'lemonshahebb121@gmail.com', role: 'Admin', balance: 0 },
    { id: shahidId, name: 'Shahid', email: 'mdshahidhossen50@gmail.com', role: 'Member', balance: 0 },
    { id: jackId, name: 'Jack sparrow', email: 'xanonymous221b@gmail.com', role: 'Member', balance: 0 },
  ];

  const khaddoGroup: Group = {
    id: khaddoGroupId,
    name: 'Khaddo',
    description: 'Food squad',
    category: 'Food',
    currency: 'BDT',
    inviteCode: 'KHADDO26',
    avatarGradient: 'from-amber-500 to-orange-500',
    members: khaddoMembers,
    totalSpent: 1931,
    unsettledAmount: 38.33,
    createdAt: '2026-09-21',
    updatedAt: '2026-10-01T16:37:02.631Z',
  };

  // Accepted settlements in Khaddo
  const acceptedSettlement1: Settlement = {
    id: 'stl_1790504687839',
    groupId: khaddoGroupId,
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

  const acceptedSettlement2: Settlement = {
    id: 'stl_1790504857565',
    groupId: khaddoGroupId,
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
    updatedAt: '2026-10-01T16:43:13.806Z',
  };

  const cancelledSettlement: Settlement = {
    id: 'stl_1790499889530',
    groupId: khaddoGroupId,
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

  beforeEach(async () => {
    await idbClear(STORES.USERS);
    await idbClear(STORES.EXPENSES);
    await idbClear(STORES.GROUPS);
    await idbClear(STORES.SETTLEMENTS);
    await idbClear(STORES.SYNC_QUEUE);
    syncEngine.resetUserState();
    vi.restoreAllMocks();
  });

  it('1. Reconciles squad Khaddo balances with exact mathematical zero-sum integrity', () => {
    // Shared expenses matching Khaddo production data summing to 1931 BDT
    const mockExpenses: Expense[] = [
      {
        id: 'exp_1',
        title: 'Food 1',
        merchant: 'Restaurant',
        paymentMethod: 'Cash',
        groupId: khaddoGroupId,
        isShared: true,
        amount: 691,
        paidByUserId: lemonId,
        paidByName: 'Lemon',
        currency: 'BDT',
        category: 'Food',
        date: '2026-09-27',
        status: 'Settled',
        createdAt: '2026-09-27',
        updatedAt: '2026-09-27',
        splits: [
          { userId: lemonId, userName: 'Lemon', amount: 230.34, settled: true },
          { userId: shahidId, userName: 'Shahid', amount: 230.33, settled: false },
          { userId: jackId, userName: 'Jack sparrow', amount: 230.33, settled: false },
        ],
      },
      {
        id: 'exp_2',
        title: 'Food 2',
        merchant: 'Restaurant',
        paymentMethod: 'Cash',
        groupId: khaddoGroupId,
        isShared: true,
        amount: 782,
        paidByUserId: shahidId,
        paidByName: 'Shahid',
        currency: 'BDT',
        category: 'Food',
        date: '2026-09-28',
        status: 'Settled',
        createdAt: '2026-09-28',
        updatedAt: '2026-09-28',
        splits: [
          { userId: lemonId, userName: 'Lemon', amount: 260.68, settled: false },
          { userId: shahidId, userName: 'Shahid', amount: 260.66, settled: true },
          { userId: jackId, userName: 'Jack sparrow', amount: 260.66, settled: false },
        ],
      },
      {
        id: 'exp_3',
        title: 'Food 3',
        merchant: 'Restaurant',
        paymentMethod: 'Cash',
        groupId: khaddoGroupId,
        isShared: true,
        amount: 458,
        paidByUserId: jackId,
        paidByName: 'Jack sparrow',
        currency: 'BDT',
        category: 'Food',
        date: '2026-09-29',
        status: 'Settled',
        createdAt: '2026-09-29',
        updatedAt: '2026-09-29',
        splits: [
          { userId: lemonId, userName: 'Lemon', amount: 152.68, settled: false },
          { userId: shahidId, userName: 'Shahid', amount: 152.68, settled: false },
          { userId: jackId, userName: 'Jack sparrow', amount: 152.64, settled: true },
        ],
      },
    ];

    const settlements = [acceptedSettlement1, acceptedSettlement2, cancelledSettlement];
    const computedMembers = calculateGroupMembersWithBalances(khaddoGroup, mockExpenses, settlements);

    const lemon = computedMembers.find((m) => m.id === lemonId)!;
    const shahid = computedMembers.find((m) => m.id === shahidId)!;
    const jack = computedMembers.find((m) => m.id === jackId)!;

    // Lemon: spent 691, share 643.70, sent 100, received 160 => -12.70
    expect(lemon.balance).toBe(-12.7);
    // Shahid: spent 782, share 643.67, sent 0, received 100 => +38.33
    expect(shahid.balance).toBe(38.33);
    // Jack: spent 458, share 643.63, sent 160, received 0 => -25.63
    expect(jack.balance).toBe(-25.63);

    // Exact Zero-Sum Check: -12.70 + 38.33 - 25.63 = 0.00
    const sumPaisa = toPaisa(lemon.balance) + toPaisa(shahid.balance) + toPaisa(jack.balance);
    expect(sumPaisa).toBe(0);

    const enriched = enrichGroupsWithBalances([khaddoGroup], mockExpenses, settlements)[0];
    expect(enriched.totalSpent).toBe(1931);
    expect(enriched.unsettledAmount).toBe(38.33);
  });

  it('2. Delta sync delivers cross-member settlements to non-participant squad members', async () => {
    vi.spyOn(syncEngine, 'checkReachability').mockResolvedValue(true);
    // Shahid is the user pulling sync
    syncEngine.setUserId(shahidId);

    // Mock fetch for /api/sync/pull when Shahid syncs with a delta token
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = input.toString();
      if (url.includes('/api/sync/pull')) {
        return new Response(
          JSON.stringify({
            success: true,
            serverTimestamp: '2026-10-01T20:00:00.000Z',
            expenses: [],
            groups: [khaddoGroup],
            // Shahid MUST receive the settlement between Jack and Lemon even though Shahid is neither sender nor receiver
            settlements: [acceptedSettlement1, acceptedSettlement2],
            registeredUsers: [],
            deletedExpenseIds: [],
            deletedGroupIds: [],
            deletedSettlementIds: [],
            deletedUserIds: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    const pullRes = await syncEngine.triggerSync();
    expect(pullRes.success).toBe(true);

    // Verify IndexedDB now holds both settlements on Shahid device
    const storedSettlements = await idbGetAll<Settlement>(STORES.SETTLEMENTS);
    expect(storedSettlements.length).toBe(2);
    expect(storedSettlements.some((s) => s.id === acceptedSettlement2.id)).toBe(true);
  });

  it('3. Three members of the same group receive identical settlement datasets, while non-members receive none', async () => {
    vi.spyOn(syncEngine, 'checkReachability').mockResolvedValue(true);

    const outsideGroupId = 'grp_outside_999';
    const outsideUserId = 'usr_outside_888';

    // Mock multi-member database state
    const allServerSettlements = [
      acceptedSettlement1, // Lemon -> Shahid (100)
      acceptedSettlement2, // Jack -> Lemon (160)
      cancelledSettlement, // Lemon -> Jack (160)
    ];

    // Helper to simulate server-side /api/sync/pull filtering (parity between Worker and Node)
    const simulateServerPull = (callerUserId: string) => {
      // 1. Group membership check
      const userSquads = new Set<string>();
      if ([lemonId, shahidId, jackId].includes(callerUserId)) {
        userSquads.add(khaddoGroupId);
      }
      if (callerUserId === outsideUserId) {
        userSquads.add(outsideGroupId);
      }

      // 2. Settlement authorization
      const targetSettlements = allServerSettlements.filter((stl) => {
        const gId = stl.groupId || (stl as any).group_id;
        if (gId) {
          return userSquads.has(gId);
        }
        const fromId = stl.fromUserId || (stl as any).from_user_id;
        const toId = stl.toUserId || (stl as any).to_user_id;
        return Boolean(callerUserId && (fromId === callerUserId || toId === callerUserId));
      });

      return targetSettlements;
    };

    // Sync for Member A (Shahid)
    await idbClear(STORES.SETTLEMENTS);
    syncEngine.resetUserState();
    syncEngine.setUserId(shahidId);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({
        success: true,
        serverTimestamp: '2026-10-01T20:00:00.000Z',
        expenses: [],
        groups: [khaddoGroup],
        settlements: simulateServerPull(shahidId),
        deletedSettlementIds: [],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    await syncEngine.triggerSync();
    const storedA = await idbGetAll<Settlement>(STORES.SETTLEMENTS);
    const setA = new Set(storedA.map((s) => s.id));

    // Sync for Member B (Jack)
    await idbClear(STORES.SETTLEMENTS);
    syncEngine.resetUserState();
    syncEngine.setUserId(jackId);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({
        success: true,
        serverTimestamp: '2026-10-01T20:00:00.000Z',
        expenses: [],
        groups: [khaddoGroup],
        settlements: simulateServerPull(jackId),
        deletedSettlementIds: [],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    await syncEngine.triggerSync();
    const storedB = await idbGetAll<Settlement>(STORES.SETTLEMENTS);
    const setB = new Set(storedB.map((s) => s.id));

    // Sync for Member C (Lemon)
    await idbClear(STORES.SETTLEMENTS);
    syncEngine.resetUserState();
    syncEngine.setUserId(lemonId);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({
        success: true,
        serverTimestamp: '2026-10-01T20:00:00.000Z',
        expenses: [],
        groups: [khaddoGroup],
        settlements: simulateServerPull(lemonId),
        deletedSettlementIds: [],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    await syncEngine.triggerSync();
    const storedC = await idbGetAll<Settlement>(STORES.SETTLEMENTS);
    const setC = new Set(storedC.map((s) => s.id));

    // Assert: Set(settlementIdsA) == Set(settlementIdsB) == Set(settlementIdsC)
    expect(setA).toEqual(setB);
    expect(setB).toEqual(setC);
    expect(setA.size).toBe(3);
    expect(setA.has('stl_1790499889530')).toBe(true);
    expect(setA.has('stl_1790504687839')).toBe(true);
    expect(setA.has('stl_1790504857565')).toBe(true);

    // Sync for Non-Member (outside user)
    await idbClear(STORES.SETTLEMENTS);
    syncEngine.resetUserState();
    syncEngine.setUserId(outsideUserId);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({
        success: true,
        serverTimestamp: '2026-10-01T20:00:00.000Z',
        expenses: [],
        groups: [],
        settlements: simulateServerPull(outsideUserId),
        deletedSettlementIds: [],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    await syncEngine.triggerSync();
    const storedOutside = await idbGetAll<Settlement>(STORES.SETTLEMENTS);
    // Non-member receives NONE of Khaddo settlements
    expect(storedOutside.length).toBe(0);
  });
});

