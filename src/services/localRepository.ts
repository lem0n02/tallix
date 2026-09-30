// Local Repository Layer: bridges IndexedDB storage, mutations queue, and UI state

import {
  STORES,
  idbGet,
  idbGetAll,
  idbPut,
  idbDelete,
  idbPutMany,
  idbGetMetadata,
  idbSetMetadata,
} from './indexedDB';
import { enqueueMutation, purgeUserMutations, purgeGroupMutations } from './syncQueue';
import { syncEngine } from './syncEngine';
import { Expense, Group, Settlement, RegisteredUser, AuditLog, GuestVisit } from '../types';
import { toPaisa, parseExactMoney } from '../utils/money';

export class LocalRepository {
  // Initialize and migrate localStorage data into IndexedDB on first run
  public static async initialize(seed: {
    expenses: Expense[];
    groups: Group[];
    settlements: Settlement[];
    registeredUsers: RegisteredUser[];
    auditLogs: AuditLog[];
    guestVisits: GuestVisit[];
  }): Promise<{
    expenses: Expense[];
    groups: Group[];
    settlements: Settlement[];
    registeredUsers: RegisteredUser[];
    auditLogs: AuditLog[];
    guestVisits: GuestVisit[];
  }> {
    const isInitialized = await idbGetMetadata<boolean>('is_seed_initialized');

    if (!isInitialized) {
      // Check if localStorage has existing user data to migrate
      let existingExpenses = seed.expenses;
      let existingGroups = seed.groups;
      let existingSettlements = seed.settlements;
      let existingUsers = seed.registeredUsers;
      let existingLogs = seed.auditLogs;
      let existingGuests = seed.guestVisits;

      try {
        const localExp = localStorage.getItem('tallix_expenses');
        if (localExp) existingExpenses = JSON.parse(localExp);

        const localGrp = localStorage.getItem('tallix_groups');
        if (localGrp) existingGroups = JSON.parse(localGrp);

        const localStl = localStorage.getItem('tallix_settlements');
        if (localStl) existingSettlements = JSON.parse(localStl);

        const localUsr = localStorage.getItem('tallix_registered_users');
        if (localUsr) existingUsers = JSON.parse(localUsr);

        const localLogs = localStorage.getItem('tallix_audit_logs');
        if (localLogs) existingLogs = JSON.parse(localLogs);

        const localGuests = localStorage.getItem('tallix_guest_visits');
        if (localGuests) existingGuests = JSON.parse(localGuests);
      } catch (e) {
        console.warn('[LocalRepository] Failed to read localStorage migration seed:', e);
      }

      await idbPutMany(STORES.EXPENSES, existingExpenses);
      await idbPutMany(STORES.GROUPS, existingGroups);
      await idbPutMany(STORES.SETTLEMENTS, existingSettlements);
      await idbPutMany(STORES.USERS, existingUsers);
      await idbPutMany(STORES.AUDIT_LOGS, existingLogs);
      await idbPutMany(STORES.GUEST_VISITS, existingGuests);

      await idbSetMetadata('is_seed_initialized', true);
      await idbSetMetadata('last_seed_time', new Date().toISOString());

      return {
        expenses: existingExpenses,
        groups: existingGroups,
        settlements: existingSettlements,
        registeredUsers: existingUsers,
        auditLogs: existingLogs,
        guestVisits: existingGuests,
      };
    }

    // Return stored data from IndexedDB
    const [expenses, groups, settlements, registeredUsers, auditLogs, guestVisits] = await Promise.all([
      idbGetAll<Expense>(STORES.EXPENSES),
      idbGetAll<Group>(STORES.GROUPS),
      idbGetAll<Settlement>(STORES.SETTLEMENTS),
      idbGetAll<RegisteredUser>(STORES.USERS),
      idbGetAll<AuditLog>(STORES.AUDIT_LOGS),
      idbGetAll<GuestVisit>(STORES.GUEST_VISITS),
    ]);

    return {
      expenses,
      groups,
      settlements,
      registeredUsers,
      auditLogs,
      guestVisits,
    };
  }

  // --- Expenses ---
  public static async getAllExpenses(): Promise<Expense[]> {
    return idbGetAll<Expense>(STORES.EXPENSES);
  }

  public static async createExpense(expense: Expense, userId: string): Promise<Expense> {
    const exactAmount = parseExactMoney(expense.amount);
    const origAmount = expense.originalAmount !== undefined ? parseExactMoney(expense.originalAmount) : exactAmount;
    const record: Expense = {
      ...expense,
      amount: exactAmount,
      originalAmount: origAmount,
      amount_paisa: toPaisa(origAmount),
    };

    // Save locally first
    await idbPut(STORES.EXPENSES, record);

    // Queue mutation for server sync
    await enqueueMutation({
      entityType: 'expense',
      entityId: record.id,
      operation: 'CREATE',
      payload: record,
      userId,
      groupId: record.groupId,
    });

    await syncEngine.updatePendingCount();
    // Asynchronously trigger sync if online
    syncEngine.triggerSync().catch(console.warn);

    return record;
  }

  public static async updateExpense(expense: Expense, userId: string): Promise<Expense> {
    const exactAmount = parseExactMoney(expense.amount);
    const origAmount = expense.originalAmount !== undefined ? parseExactMoney(expense.originalAmount) : exactAmount;
    const record: Expense = {
      ...expense,
      amount: exactAmount,
      originalAmount: origAmount,
      amount_paisa: toPaisa(origAmount),
      updatedAt: expense.updatedAt || new Date().toISOString(),
    };

    await idbPut(STORES.EXPENSES, record);

    await enqueueMutation({
      entityType: 'expense',
      entityId: record.id,
      operation: 'UPDATE',
      payload: record,
      userId,
      groupId: record.groupId,
    });

    await syncEngine.updatePendingCount();
    syncEngine.triggerSync().catch(console.warn);

    return record;
  }

  public static async deleteExpense(id: string, userId: string): Promise<void> {
    const existing = await idbGet<Expense>(STORES.EXPENSES, id);
    await idbDelete(STORES.EXPENSES, id);

    await enqueueMutation({
      entityType: 'expense',
      entityId: id,
      operation: 'DELETE',
      payload: { id },
      userId,
      groupId: existing?.groupId,
    });

    await syncEngine.updatePendingCount();
    syncEngine.triggerSync().catch(console.warn);
  }

  // --- Groups ---
  public static async getAllGroups(): Promise<Group[]> {
    return idbGetAll<Group>(STORES.GROUPS);
  }

  public static async createGroup(group: Group, userId: string): Promise<Group> {
    await idbPut(STORES.GROUPS, group);

    await enqueueMutation({
      entityType: 'group',
      entityId: group.id,
      operation: 'CREATE',
      payload: group,
      userId,
      groupId: group.id,
    });

    await syncEngine.updatePendingCount();
    syncEngine.triggerSync().catch(console.warn);

    return group;
  }

  public static async updateGroup(group: Group, userId: string): Promise<Group> {
    await idbPut(STORES.GROUPS, group);

    await enqueueMutation({
      entityType: 'group',
      entityId: group.id,
      operation: 'UPDATE',
      payload: group,
      userId,
      groupId: group.id,
    });

    await syncEngine.updatePendingCount();
    syncEngine.triggerSync().catch(console.warn);

    return group;
  }

  public static async deleteGroup(id: string, userId: string): Promise<void> {
    // 1. Permanently delete squad record from local database
    await idbDelete(STORES.GROUPS, id);

    // 2. Cascade delete all expenses belonging exclusively to this squad
    const allExpenses = await idbGetAll<Expense>(STORES.EXPENSES);
    for (const exp of allExpenses) {
      if (exp.groupId === id) {
        await idbDelete(STORES.EXPENSES, exp.id);
      }
    }

    // 3. Cascade delete all settlements belonging exclusively to this squad
    const allSettlements = await idbGetAll<Settlement>(STORES.SETTLEMENTS);
    for (const stl of allSettlements) {
      if (stl.groupId === id) {
        await idbDelete(STORES.SETTLEMENTS, stl.id);
      }
    }

    // 4. Purge all audit logs referencing this squad
    const allLogs = await idbGetAll<AuditLog>(STORES.AUDIT_LOGS);
    for (const log of allLogs) {
      if (log.message?.includes(id)) {
        await idbDelete(STORES.AUDIT_LOGS, log.id);
      }
    }

    // 5. Purge all pending sync mutations for this squad to prevent resurrection
    await purgeGroupMutations(id);

    // 6. Enqueue DELETE mutation so remote Cloudflare D1/server permanently purges squad
    await enqueueMutation({
      entityType: 'group',
      entityId: id,
      operation: 'DELETE',
      payload: { id },
      userId,
      groupId: id,
    });

    await syncEngine.updatePendingCount();
    syncEngine.triggerSync().catch(console.warn);
  }

  // --- Settlements ---
  public static async getAllSettlements(): Promise<Settlement[]> {
    return idbGetAll<Settlement>(STORES.SETTLEMENTS);
  }

  public static async createSettlement(settlement: Settlement, userId: string): Promise<Settlement> {
    const exactAmount = parseExactMoney(settlement.amount);
    const origAmount = settlement.originalAmount !== undefined ? parseExactMoney(settlement.originalAmount) : exactAmount;
    const record: Settlement = {
      ...settlement,
      amount: exactAmount,
      originalAmount: origAmount,
      amount_paisa: toPaisa(origAmount),
    };

    await idbPut(STORES.SETTLEMENTS, record);

    await enqueueMutation({
      entityType: 'settlement',
      entityId: record.id,
      operation: 'CREATE',
      payload: record,
      userId,
      groupId: record.groupId,
    });

    await syncEngine.updatePendingCount();
    syncEngine.triggerSync().catch(console.warn);

    return record;
  }

  public static async updateSettlement(settlement: Settlement, userId: string): Promise<Settlement> {
    const exactAmount = parseExactMoney(settlement.amount);
    const origAmount = settlement.originalAmount !== undefined ? parseExactMoney(settlement.originalAmount) : exactAmount;
    const record: Settlement = {
      ...settlement,
      amount: exactAmount,
      originalAmount: origAmount,
      amount_paisa: toPaisa(origAmount),
    };

    await idbPut(STORES.SETTLEMENTS, record);

    await enqueueMutation({
      entityType: 'settlement',
      entityId: record.id,
      operation: 'UPDATE',
      payload: record,
      userId,
      groupId: record.groupId,
    });

    await syncEngine.updatePendingCount();
    syncEngine.triggerSync().catch(console.warn);

    return record;
  }

  public static async cancelSettlement(settlement: Settlement, userId: string): Promise<Settlement> {
    const cancelledRecord: Settlement = {
      ...settlement,
      status: 'Cancelled',
    };

    await idbPut(STORES.SETTLEMENTS, cancelledRecord);

    await enqueueMutation({
      entityType: 'settlement',
      entityId: cancelledRecord.id,
      operation: 'UPDATE',
      payload: cancelledRecord,
      userId,
      groupId: cancelledRecord.groupId,
    });

    await syncEngine.updatePendingCount();
    syncEngine.triggerSync().catch(console.warn);

    return cancelledRecord;
  }

  public static async deleteSettlement(settlementId: string, userId: string, target?: Settlement): Promise<void> {
    const existing = target || await idbGet<Settlement>(STORES.SETTLEMENTS, settlementId);
    await idbDelete(STORES.SETTLEMENTS, settlementId);

    await enqueueMutation({
      entityType: 'settlement',
      entityId: settlementId,
      operation: 'DELETE',
      payload: {
        id: settlementId,
        groupId: existing?.groupId,
        fromUserId: existing?.fromUserId,
        toUserId: existing?.toUserId,
        settlementType: existing?.settlementType,
        requestedByUserId: existing?.requestedByUserId,
        createdBy: existing?.createdBy,
      },
      userId,
    });

    await syncEngine.updatePendingCount();
    syncEngine.triggerSync().catch(console.warn);
  }

  // --- Users & Logs ---
  public static async getAllRegisteredUsers(): Promise<RegisteredUser[]> {
    return idbGetAll<RegisteredUser>(STORES.USERS);
  }

  public static async saveRegisteredUser(user: RegisteredUser): Promise<void> {
    await idbPut(STORES.USERS, user);
    await enqueueMutation({
      entityType: 'registeredUser',
      entityId: user.id,
      operation: 'CREATE',
      payload: user,
      userId: user.id,
    });
    syncEngine.triggerSync().catch(console.warn);
  }

  public static async updateRegisteredUser(user: RegisteredUser): Promise<void> {
    await idbPut(STORES.USERS, user);
    await enqueueMutation({
      entityType: 'registeredUser',
      entityId: user.id,
      operation: 'UPDATE',
      payload: user,
      userId: user.id,
    });
    syncEngine.triggerSync().catch(console.warn);
  }

  public static async deleteRegisteredUser(userId: string, emailCandidate?: string): Promise<void> {
    // 1. Resolve user details to obtain normalized email
    const existing = await idbGet<RegisteredUser>(STORES.USERS, userId);
    const allUsers = await idbGetAll<RegisteredUser>(STORES.USERS);
    const userRow = existing || allUsers.find(
      (u) => u.id === userId || (emailCandidate && u.email?.toLowerCase() === emailCandidate.toLowerCase())
    );
    const cleanEmail = (emailCandidate || userRow?.email || '').trim().toLowerCase();

    // 2. Permanently delete from registeredUsers store by ID and any matching email
    await idbDelete(STORES.USERS, userId);
    for (const u of allUsers) {
      if (u.id === userId || (cleanEmail && u.email?.toLowerCase() === cleanEmail)) {
        await idbDelete(STORES.USERS, u.id);
      }
    }

    // 3. Cascade purge all user-owned/created expenses and personal expenses paid by user
    const allExpenses = await idbGetAll<Expense>(STORES.EXPENSES);
    for (const exp of allExpenses) {
      const isUserExpense =
        exp.paidByUserId === userId ||
        exp.createdBy === userId ||
        (cleanEmail && (exp as any).createdByEmail?.toLowerCase() === cleanEmail);

      if (isUserExpense) {
        await idbDelete(STORES.EXPENSES, exp.id);
      } else if (exp.splits && Array.isArray(exp.splits)) {
        // Shared expense paid by someone else: remove deleted user from split participants
        const hasUserInSplits = exp.splits.some(
          (s) => s.userId === userId || (cleanEmail && (s as any).userEmail?.toLowerCase() === cleanEmail)
        );
        if (hasUserInSplits) {
          const updatedSplits = exp.splits.filter(
            (s) => s.userId !== userId && (!cleanEmail || (s as any).userEmail?.toLowerCase() !== cleanEmail)
          );
          if (updatedSplits.length === 0) {
            await idbDelete(STORES.EXPENSES, exp.id);
          } else {
            await idbPut(STORES.EXPENSES, { ...exp, splits: updatedSplits });
          }
        }
      }
    }

    // 4. Cascade purge all settlements involving this user (fromUserId or toUserId)
    const allSettlements = await idbGetAll<Settlement>(STORES.SETTLEMENTS);
    for (const stl of allSettlements) {
      if (stl.fromUserId === userId || stl.toUserId === userId) {
        await idbDelete(STORES.SETTLEMENTS, stl.id);
      }
    }

    // 5. Update squad memberships: remove user; if squad was created by user and has no other members, delete the squad entirely
    const allGroups = await idbGetAll<Group>(STORES.GROUPS);
    for (const grp of allGroups) {
      if (Array.isArray(grp.members)) {
        const remainingMembers = grp.members.filter(
          (m) => m.id !== userId && (!cleanEmail || m.email?.toLowerCase() !== cleanEmail)
        );
        const wasCreatedByUser = grp.createdBy === userId;
        if (remainingMembers.length === 0 || (wasCreatedByUser && remainingMembers.length === 0)) {
          await idbDelete(STORES.GROUPS, grp.id);
          for (const exp of allExpenses) {
            if (exp.groupId === grp.id) await idbDelete(STORES.EXPENSES, exp.id);
          }
          for (const stl of allSettlements) {
            if (stl.groupId === grp.id) await idbDelete(STORES.SETTLEMENTS, stl.id);
          }
        } else if (remainingMembers.length !== grp.members.length) {
          await idbPut(STORES.GROUPS, { ...grp, members: remainingMembers });
        }
      }
    }

    // 6. Purge all audit logs referencing this user (userId or email)
    const allLogs = await idbGetAll<AuditLog>(STORES.AUDIT_LOGS);
    for (const log of allLogs) {
      const matchUserId = log.userId === userId || log.message?.includes(userId);
      const matchEmail = cleanEmail && log.message?.toLowerCase().includes(cleanEmail);
      if (matchUserId || matchEmail) {
        await idbDelete(STORES.AUDIT_LOGS, log.id);
      }
    }

    // 7. Purge guest visits matching user email
    if (cleanEmail) {
      const allVisits = await idbGetAll<GuestVisit>(STORES.GUEST_VISITS);
      for (const v of allVisits) {
        if (v.email?.toLowerCase() === cleanEmail) {
          await idbDelete(STORES.GUEST_VISITS, v.id);
        }
      }
    }

    // 8. Purge all pending sync mutations for this user
    await purgeUserMutations(userId, cleanEmail);

    // 9. Enqueue DELETE mutation so remote Cloudflare D1/server permanently purges user and email
    await enqueueMutation({
      entityType: 'registeredUser',
      entityId: userId,
      operation: 'DELETE',
      payload: { id: userId, email: cleanEmail },
      userId,
    });

    await syncEngine.updatePendingCount();
    syncEngine.triggerSync().catch(console.warn);
  }

  public static async addAuditLog(log: AuditLog): Promise<void> {
    await idbPut(STORES.AUDIT_LOGS, log);
  }

  public static async addGuestVisit(visit: GuestVisit): Promise<void> {
    await idbPut(STORES.GUEST_VISITS, visit);
  }
}
