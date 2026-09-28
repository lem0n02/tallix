import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalRepository } from './services/localRepository';
import { deleteUserAccount, adminDeleteUser, registerUserToCloudflareD1 } from './services/authService';
import { idbGetAll, idbPut, idbClear, STORES } from './services/indexedDB';
import { enqueueMutation, getPendingMutations } from './services/syncQueue';
import { syncEngine } from './services/syncEngine';
import { RegisteredUser, Expense, Group, Settlement, AuditLog, GuestVisit } from './types';

describe('Master Data Deletion & Permanent Purge Architecture', () => {
  beforeEach(async () => {
    await idbClear(STORES.USERS);
    await idbClear(STORES.EXPENSES);
    await idbClear(STORES.GROUPS);
    await idbClear(STORES.SETTLEMENTS);
    await idbClear(STORES.AUDIT_LOGS);
    await idbClear(STORES.GUEST_VISITS);
    await idbClear(STORES.SYNC_QUEUE);
    await idbClear(STORES.SYNC_METADATA);
    (syncEngine as any).isSyncInProgress = false;
    syncEngine.stopPeriodicSync();
    vi.restoreAllMocks();
  });

  it('permanently deletes user, cascading through all stores and mutation queues', async () => {
    const userId = 'usr_delete_test_1';
    const email = 'purge_test@example.com';

    // 1. Seed user in IndexedDB
    const user: RegisteredUser = {
      id: userId,
      name: 'Purge Candidate',
      email: email,
      systemRole: 'User',
      roleTitle: 'Financial Member',
      createdAt: '2026-09-01',
      status: 'Active',
    };
    await idbPut(STORES.USERS, user);

    // 2. Seed personal expense owned by user
    const personalExpense: Expense = {
      id: 'exp_p1',
      title: 'Groceries',
      merchant: 'Supermarket',
      amount: 1500,
      currency: 'BDT',
      category: 'Food',
      status: 'Pending',
      paymentMethod: 'Cash',
      date: '2026-09-10',
      paidByUserId: userId,
      paidByName: 'Purge Candidate',
      createdBy: userId,
      isShared: false,
      createdAt: '2026-09-10T10:00:00Z',
      updatedAt: '2026-09-10T10:00:00Z',
    };
    await idbPut(STORES.EXPENSES, personalExpense);

    // 3. Seed shared expense created by user
    const sharedExpense: Expense = {
      id: 'exp_s1',
      groupId: 'grp_1',
      title: 'Team Dinner',
      merchant: 'Restaurant',
      amount: 4000,
      currency: 'BDT',
      category: 'Dining',
      status: 'Pending',
      paymentMethod: 'Cash',
      date: '2026-09-15',
      paidByUserId: userId,
      paidByName: 'Purge Candidate',
      createdBy: userId,
      isShared: true,
      splits: [
        { userId: userId, amount: 2000, settled: false },
        { userId: 'usr_other', amount: 2000, settled: false },
      ],
      createdAt: '2026-09-15T18:00:00Z',
      updatedAt: '2026-09-15T18:00:00Z',
    };
    await idbPut(STORES.EXPENSES, sharedExpense);

    // 4. Seed shared expense by someone else where user is only a split participant
    const otherExpense: Expense = {
      id: 'exp_s2',
      groupId: 'grp_1',
      title: 'Shared Wifi',
      merchant: 'ISP',
      amount: 1000,
      currency: 'BDT',
      category: 'Utilities',
      status: 'Pending',
      paymentMethod: 'Cash',
      date: '2026-09-16',
      paidByUserId: 'usr_other',
      paidByName: 'Other Member',
      createdBy: 'usr_other',
      isShared: true,
      splits: [
        { userId: userId, amount: 500, settled: false },
        { userId: 'usr_other', amount: 500, settled: false },
      ],
      createdAt: '2026-09-16T12:00:00Z',
      updatedAt: '2026-09-16T12:00:00Z',
    };
    await idbPut(STORES.EXPENSES, otherExpense);

    // 5. Seed settlement involving user
    const settlement: Settlement = {
      id: 'stl_1',
      groupId: 'grp_1',
      groupName: 'Flatmates',
      fromUserId: userId,
      fromUserName: 'Purge Candidate',
      toUserId: 'usr_other',
      toUserName: 'Other Member',
      amount: 500,
      currency: 'BDT',
      paymentMethod: 'bKash',
      status: 'Pending',
      createdAt: '2026-09-18T10:00:00Z',
      updatedAt: '2026-09-18T10:00:00Z',
    };
    await idbPut(STORES.SETTLEMENTS, settlement);

    // 6. Seed group membership
    const group: Group = {
      id: 'grp_1',
      name: 'Flatmates',
      description: 'Shared flat expenses',
      category: 'General',
      currency: 'BDT',
      avatarGradient: 'from-blue-600 to-indigo-600',
      totalSpent: 5000,
      unsettledAmount: 1000,
      inviteCode: 'FLAT123',
      members: [
        { id: userId, name: 'Purge Candidate', email: email, role: 'Member', balance: 0 },
        { id: 'usr_other', name: 'Other Member', email: 'other@example.com', role: 'Admin', balance: 0 },
      ],
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    };
    await idbPut(STORES.GROUPS, group);

    // 7. Seed audit log referencing user ID and email
    const auditLog: AuditLog = {
      id: 'log_user_action',
      userId: userId,
      level: 'INFO',
      message: `User logged in from ${email}`,
      source: 'auth-service',
      timestamp: '2026-09-20T10:00:00Z',
    };
    await idbPut(STORES.AUDIT_LOGS, auditLog);

    // 8. Seed guest visit with matching email
    const visit: GuestVisit = {
      id: 'gst_visit_1',
      name: 'Purge Candidate',
      email: email,
      ip: '127.0.0.1',
      country: 'BD',
      browser: 'Chrome',
      os: 'Linux',
      deviceType: 'Desktop',
      visitTime: '2026-08-30T10:00:00Z',
      visitedAt: '2026-08-30T10:00:00Z',
    };
    await idbPut(STORES.GUEST_VISITS, visit);

    // 9. Seed pending mutation in sync queue for this user
    await enqueueMutation({
      entityType: 'expense',
      entityId: 'exp_p1',
      operation: 'UPDATE',
      payload: personalExpense,
      userId: userId,
    });

    // Verify setup
    expect((await idbGetAll<RegisteredUser>(STORES.USERS)).length).toBe(1);
    expect((await idbGetAll<Expense>(STORES.EXPENSES)).length).toBe(3);
    expect((await idbGetAll<Settlement>(STORES.SETTLEMENTS)).length).toBe(1);
    expect((await idbGetAll<AuditLog>(STORES.AUDIT_LOGS)).length).toBe(1);
    expect((await idbGetAll<GuestVisit>(STORES.GUEST_VISITS)).length).toBe(1);

    // EXECUTE PURGE
    await LocalRepository.deleteRegisteredUser(userId, email);

    // VERIFICATIONS
    // 1. Users store has ZERO rows for deleted user or email
    const usersRemaining = await idbGetAll<RegisteredUser>(STORES.USERS);
    expect(usersRemaining.some((u) => u.id === userId || u.email.toLowerCase() === email.toLowerCase())).toBe(false);

    // 2. Personal expense and user-paid shared expense removed
    const expensesRemaining = await idbGetAll<Expense>(STORES.EXPENSES);
    expect(expensesRemaining.find((e) => e.id === 'exp_p1')).toBeUndefined();
    expect(expensesRemaining.find((e) => e.id === 'exp_s1')).toBeUndefined();

    // 3. User removed from splits of other shared expense
    const wifiExp = expensesRemaining.find((e) => e.id === 'exp_s2');
    expect(wifiExp).toBeDefined();
    expect(wifiExp?.splits?.some((s) => s.userId === userId)).toBe(false);

    // 4. Settlement involving user removed
    const settlementsRemaining = await idbGetAll<Settlement>(STORES.SETTLEMENTS);
    expect(settlementsRemaining.find((s) => s.id === 'stl_1')).toBeUndefined();

    // 5. User removed from squad membership
    const groupsRemaining = await idbGetAll<Group>(STORES.GROUPS);
    const updatedGrp = groupsRemaining.find((g) => g.id === 'grp_1');
    expect(updatedGrp?.members.some((m) => m.id === userId)).toBe(false);
    expect(updatedGrp?.members.length).toBe(1);

    // 6. Audit logs containing user ID or email purged
    const logsRemaining = await idbGetAll<AuditLog>(STORES.AUDIT_LOGS);
    expect(logsRemaining.some((l) => l.userId === userId || l.message.includes(email))).toBe(false);

    // 7. Guest visit matching user email purged
    const visitsRemaining = await idbGetAll<GuestVisit>(STORES.GUEST_VISITS);
    expect(visitsRemaining.some((v) => v.email.toLowerCase() === email.toLowerCase())).toBe(false);

    // 8. Pending sync mutations for user purged (only the registeredUser DELETE mutation is queued)
    const mutations = await getPendingMutations();
    const staleMut = mutations.find((m) => m.entityId === 'exp_p1');
    expect(staleMut).toBeUndefined();
    const deleteMut = mutations.find((m) => m.entityType === 'registeredUser' && m.operation === 'DELETE');
    expect(deleteMut).toBeDefined();
    expect(deleteMut?.entityId).toBe(userId);
  });

  it('guarantees deleted email is immediately reusable for new registration', async () => {
    const email = 'reusable_user@example.com';
    const oldUserId = 'usr_old_999';

    // Seed existing user
    await idbPut(STORES.USERS, {
      id: oldUserId,
      name: 'Old User',
      email: email,
      systemRole: 'User',
      status: 'Active',
      createdAt: '2026-01-01',
    });

    // Delete account
    await LocalRepository.deleteRegisteredUser(oldUserId, email);

    // Verify email is freed in local storage
    const allUsers = await idbGetAll<RegisteredUser>(STORES.USERS);
    expect(allUsers.find((u) => u.email.toLowerCase() === email.toLowerCase())).toBeUndefined();

    // Mock API registration response with brand new ID
    const newUserId = 'usr_new_111';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          user: {
            id: newUserId,
            name: 'Fresh Account',
            email: email,
            systemRole: 'User',
            status: 'Active',
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    );

    // Re-register with the same email
    const regResult = await registerUserToCloudflareD1({
      name: 'Fresh Account',
      email: email,
      password: 'new_secure_password',
    });

    expect(regResult.success).toBe(true);
    expect(regResult.user.id).toBe(newUserId);
    expect(regResult.user.id).not.toBe(oldUserId);

    // Verify brand new record in IndexedDB
    const reloadedUsers = await idbGetAll<RegisteredUser>(STORES.USERS);
    expect(reloadedUsers.length).toBe(1);
    expect(reloadedUsers[0].id).toBe(newUserId);
    expect(reloadedUsers[0].name).toBe('Fresh Account');
  });

  it('permanently deletes squad and cascades through expenses, settlements, and audit logs', async () => {
    const groupId = 'grp_delete_99';

    // 1. Seed squad
    await idbPut<Group>(STORES.GROUPS, {
      id: groupId,
      name: 'Vacation Squad',
      description: 'Vacation trips',
      category: 'Travel',
      currency: 'BDT',
      avatarGradient: 'from-blue-600 to-indigo-600',
      totalSpent: 12000,
      unsettledAmount: 6000,
      inviteCode: 'VACAY99',
      members: [{ id: 'usr_1', name: 'Member 1', email: 'm1@example.com', role: 'Admin', balance: 0 }],
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    });

    // 2. Seed squad expense
    await idbPut<Expense>(STORES.EXPENSES, {
      id: 'exp_squad_1',
      groupId: groupId,
      title: 'Resort Booking',
      merchant: 'Resort',
      amount: 12000,
      currency: 'BDT',
      category: 'Travel',
      status: 'Pending',
      paymentMethod: 'Cash',
      date: '2026-09-05',
      paidByUserId: 'usr_1',
      paidByName: 'Member 1',
      isShared: true,
      createdAt: '2026-09-05T10:00:00Z',
      updatedAt: '2026-09-05T10:00:00Z',
    });

    // 3. Seed squad settlement
    await idbPut<Settlement>(STORES.SETTLEMENTS, {
      id: 'stl_squad_1',
      groupId: groupId,
      groupName: 'Vacation Squad',
      fromUserId: 'usr_2',
      fromUserName: 'Member 2',
      toUserId: 'usr_1',
      toUserName: 'Member 1',
      amount: 6000,
      currency: 'BDT',
      paymentMethod: 'bKash',
      status: 'Pending',
      createdAt: '2026-09-06T10:00:00Z',
      updatedAt: '2026-09-06T10:00:00Z',
    });

    // 4. Seed squad audit log
    await idbPut<AuditLog>(STORES.AUDIT_LOGS, {
      id: 'log_squad_1',
      level: 'INFO',
      message: `Squad created: Vacation Squad (ID: ${groupId})`,
      source: 'squad-manager',
      timestamp: '2026-09-01T00:00:00Z',
    });

    // 5. Seed pending mutation for this squad
    await enqueueMutation({
      entityType: 'expense',
      entityId: 'exp_squad_1',
      operation: 'UPDATE',
      payload: { id: 'exp_squad_1', groupId: groupId },
      userId: 'usr_1',
      groupId: groupId,
    });

    // EXECUTE SQUAD PURGE
    await LocalRepository.deleteGroup(groupId, 'usr_1');

    // VERIFICATIONS
    // Group deleted
    const groups = await idbGetAll<Group>(STORES.GROUPS);
    expect(groups.find((g) => g.id === groupId)).toBeUndefined();

    // Expenses for this squad deleted
    const expenses = await idbGetAll<Expense>(STORES.EXPENSES);
    expect(expenses.find((e) => e.groupId === groupId)).toBeUndefined();

    // Settlements for this squad deleted
    const settlements = await idbGetAll<Settlement>(STORES.SETTLEMENTS);
    expect(settlements.find((s) => s.groupId === groupId)).toBeUndefined();

    // Audit logs referencing squad purged
    const logs = await idbGetAll<AuditLog>(STORES.AUDIT_LOGS);
    expect(logs.some((l) => l.message.includes(groupId))).toBe(false);

    // Pending mutation for squad expense purged; only group DELETE mutation remains
    const mutations = await getPendingMutations();
    expect(mutations.some((m) => m.entityId === 'exp_squad_1')).toBe(false);
    const grpDelMut = mutations.find((m) => m.entityType === 'group' && m.operation === 'DELETE');
    expect(grpDelMut).toBeDefined();
    expect(grpDelMut?.entityId).toBe(groupId);
  });

  it('sync pull correctly applies deletedUserIds and removes them from IndexedDB', async () => {
    // Seed user locally
    await idbPut(STORES.USERS, {
      id: 'usr_remote_deleted',
      name: 'Remote User',
      email: 'remote@example.com',
      systemRole: 'User',
      status: 'Active',
      createdAt: '2026-01-01',
    });

    // Mock sync pull API response containing deletedUserIds
    vi.spyOn(syncEngine, 'checkReachability').mockResolvedValue(true);
    (syncEngine as any).currentUserId = 'usr_active';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/sync/pull')) {
        return new Response(
          JSON.stringify({
            success: true,
            serverTimestamp: new Date().toISOString(),
            expenses: [],
            groups: [],
            settlements: [],
            registeredUsers: [],
            deletedUserIds: ['usr_remote_deleted'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    // Trigger sync
    const syncRes = await syncEngine.triggerSync();
    expect(syncRes.success).toBe(true);

    // Verify local IndexedDB has deleted the user
    const users = await idbGetAll<RegisteredUser>(STORES.USERS);
    expect(users.find((u) => u.id === 'usr_remote_deleted')).toBeUndefined();
  });
});
