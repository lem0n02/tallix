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
import { enqueueMutation } from './syncQueue';
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
    await idbDelete(STORES.GROUPS, id);

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

  public static async deleteRegisteredUser(userId: string): Promise<void> {
    await idbDelete(STORES.USERS, userId);
    await enqueueMutation({
      entityType: 'registeredUser',
      entityId: userId,
      operation: 'DELETE',
      payload: { id: userId },
      userId,
    });
    syncEngine.triggerSync().catch(console.warn);
  }

  public static async addAuditLog(log: AuditLog): Promise<void> {
    await idbPut(STORES.AUDIT_LOGS, log);
  }

  public static async addGuestVisit(visit: GuestVisit): Promise<void> {
    await idbPut(STORES.GUEST_VISITS, visit);
  }
}
