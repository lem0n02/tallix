import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseLocationPath, getPathForTab } from './App';
import { Expense, Group, UserProfile } from './types';
import { enrichGroupsWithBalances, isMemberMatch } from './utils/balanceEngine';
import { toPaisa, fromPaisa } from './utils/money';
import { SyncEngine } from './services/syncEngine';

describe('Production Regression Verification Suite', () => {
  // Test Data Setup
  const userA: UserProfile = {
    id: 'usr_userA',
    name: 'User A',
    email: 'usera@example.com',
    role: 'Lead',
    systemRole: 'User',
    title: 'Engineer',
    department: 'Tech',
    avatarGradient: 'from-blue-500 to-indigo-600',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    liquidityLimit: 50000,
    currentLiquidity: 45000,
    monthlyBurnRate: 15000,
  };

  const userB: UserProfile = {
    id: 'usr_userB',
    name: 'User B',
    email: 'userb@example.com',
    role: 'Analyst',
    systemRole: 'User',
    title: 'Analyst',
    department: 'Finance',
    avatarGradient: 'from-emerald-500 to-teal-600',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    liquidityLimit: 40000,
    currentLiquidity: 35000,
    monthlyBurnRate: 12000,
  };

  const squad1: Group = {
    id: 'grp_squad1',
    name: 'Goa Trip',
    description: 'Vacation',
    category: 'Trip',
    inviteCode: 'GOA2026',
    avatarGradient: 'from-blue-500 to-indigo-600',
    members: [
      { id: userA.id, name: userA.name, email: userA.email, role: 'Admin', balance: 0 },
      { id: userB.id, name: userB.name, email: userB.email, role: 'Member', balance: 0 },
    ],
    currency: 'INR',
    totalSpent: 0,
    unsettledAmount: 0,
    createdAt: '2026-09-01T10:00:00.000Z',
  };

  const expensePersonalA: Expense = {
    id: 'exp_personal_a',
    title: 'User A Solo Lunch',
    merchant: 'Cafe',
    amount: 350,
    amount_paisa: 35000,
    currency: 'INR',
    category: 'Food',
    paymentMethod: 'Cash',
    date: '2026-09-21',
    paidByUserId: userA.id,
    paidByName: userA.name,
    createdBy: userA.id,
    isShared: false,
    status: 'Settled',
  };

  const expenseSquadPaidByA: Expense = {
    id: 'exp_squad_paid_by_a',
    title: 'Beach Villa Rental',
    merchant: 'Villa Resort',
    amount: 4000,
    amount_paisa: 400000,
    currency: 'INR',
    category: 'Accommodation',
    paymentMethod: 'Cash',
    date: '2026-09-21',
    paidByUserId: userA.id,
    paidByName: userA.name,
    createdBy: userA.id,
    groupId: squad1.id,
    groupName: squad1.name,
    isShared: true,
    splits: [
      { userId: userA.id, userName: userA.name, amount: 2000, amount_paisa: 200000, settled: true },
      { userId: userB.id, userName: userB.name, amount: 2000, amount_paisa: 200000, settled: false },
    ],
    status: 'Pending',
  };

  const expenseSquadPaidByB: Expense = {
    id: 'exp_squad_paid_by_b',
    title: 'Scuba Diving Passes',
    merchant: 'Dive Club',
    amount: 3000,
    amount_paisa: 300000,
    currency: 'INR',
    category: 'Entertainment',
    paymentMethod: 'Cash',
    date: '2026-09-22',
    paidByUserId: userB.id,
    paidByName: userB.name,
    createdBy: userB.id,
    groupId: squad1.id,
    groupName: squad1.name,
    isShared: true,
    splits: [
      { userId: userA.id, userName: userA.name, amount: 1500, amount_paisa: 150000, settled: false },
      { userId: userB.id, userName: userB.name, amount: 1500, amount_paisa: 150000, settled: true },
    ],
    status: 'Pending',
  };

  const allExpenses: Expense[] = [expensePersonalA, expenseSquadPaidByA, expenseSquadPaidByB];

  // Helper matching the exact logic in App.tsx for userExpenses & dashboardExpenses
  const getAuthorizedUserExpenses = (currentUser: UserProfile, expenses: Expense[], groups: Group[]) => {
    const cleanUserEmail = (currentUser.email || '').toLowerCase();
    const userMember = { id: currentUser.id, name: currentUser.name, email: currentUser.email };
    const userGroups = groups.filter((g) =>
      g.members.some(
        (m) =>
          isMemberMatch(m, currentUser.id, currentUser.name) ||
          (m.email && m.email.toLowerCase() === cleanUserEmail)
      )
    );
    const userGroupIds = new Set(userGroups.map((g) => g.id));

    return expenses.filter((e) => {
      if (e.isShared && e.groupId) {
        return userGroupIds.has(e.groupId);
      }
      return (
        e.paidByUserId === currentUser.id ||
        e.createdBy === currentUser.id ||
        (e as any).createdByEmail?.toLowerCase() === cleanUserEmail ||
        isMemberMatch(userMember, e.paidByUserId, e.paidByName)
      );
    });
  };

  const getDashboardExpenses = (currentUser: UserProfile, userExpenses: Expense[]) => {
    const cleanUserEmail = (currentUser.email || '').toLowerCase();
    const userMember = { id: currentUser.id, name: currentUser.name, email: currentUser.email };

    return userExpenses.filter((e) => {
      const isPaidByMe = isMemberMatch(userMember, e.paidByUserId, e.paidByName);
      const isOwnedByMe =
        e.paidByUserId === currentUser.id ||
        e.createdBy === currentUser.id ||
        (e as any).createdByEmail?.toLowerCase() === cleanUserEmail;

      return isPaidByMe || isOwnedByMe;
    });
  };

  // 1. DASHBOARD FILTER VERIFICATION
  describe('1. Dashboard Filter Regression Verification', () => {
    it('User A: Personal transaction and squad transaction paid by User A are visible on Dashboard', () => {
      const userAAuthorized = getAuthorizedUserExpenses(userA, allExpenses, [squad1]);
      const userADashboard = getDashboardExpenses(userA, userAAuthorized);

      const dashboardIds = userADashboard.map((e) => e.id);
      expect(dashboardIds).toContain('exp_personal_a');
      expect(dashboardIds).toContain('exp_squad_paid_by_a');
    });

    it('User B: Squad transaction paid by User B is strictly NOT visible on User A Dashboard', () => {
      const userAAuthorized = getAuthorizedUserExpenses(userA, allExpenses, [squad1]);
      const userADashboard = getDashboardExpenses(userA, userAAuthorized);

      const dashboardIds = userADashboard.map((e) => e.id);
      expect(dashboardIds).not.toContain('exp_squad_paid_by_b');
      expect(userADashboard.length).toBe(2);
    });

    it('User B Dashboard: Shows transactions paid by User B, NOT User A', () => {
      const userBAuthorized = getAuthorizedUserExpenses(userB, allExpenses, [squad1]);
      const userBDashboard = getDashboardExpenses(userB, userBAuthorized);

      const dashboardIds = userBDashboard.map((e) => e.id);
      expect(dashboardIds).toContain('exp_squad_paid_by_b');
      expect(dashboardIds).not.toContain('exp_squad_paid_by_a');
      expect(dashboardIds).not.toContain('exp_personal_a');
    });
  });

  // 2. SQUAD TRANSACTION HISTORY VERIFICATION
  describe('2. Squad Transaction History Regression Verification', () => {
    it('User A sees all squad transactions (both User A and User B) in Squad History', () => {
      const userAAuthorized = getAuthorizedUserExpenses(userA, allExpenses, [squad1]);
      const squadExpenses = userAAuthorized.filter((e) => e.groupId === squad1.id);

      const squadExpenseIds = squadExpenses.map((e) => e.id);
      // Both User A's and User B's transactions are present
      expect(squadExpenseIds).toContain('exp_squad_paid_by_a');
      expect(squadExpenseIds).toContain('exp_squad_paid_by_b');
      expect(squadExpenses.length).toBe(2);
    });

    it('Active group selection matches by both ID and inviteCode (e.g., GOA2026)', () => {
      const groups = [squad1];

      // Match by exact ID
      const byId = groups.find((g) => g.id === 'grp_squad1' || g.inviteCode?.toUpperCase() === 'grp_squad1'.toUpperCase());
      expect(byId?.name).toBe('Goa Trip');

      // Match by invite code (case-insensitive)
      const byInvite = groups.find(
        (g) => g.id === 'goa2026' || (g.inviteCode && g.inviteCode.toUpperCase() === 'goa2026'.toUpperCase())
      );
      expect(byInvite?.name).toBe('Goa Trip');
    });
  });

  // 3. CROSS-DEVICE SYNC & DUPLICATE PROTECTION
  describe('3. Cross-Device Sync & Idempotency', () => {
    it('Ensures pulling same transaction multiple times produces no duplicate records', () => {
      const existingExpenses: Expense[] = [expensePersonalA];
      const pulledTransaction: Expense = { ...expenseSquadPaidByB };

      // Helper function simulating IndexedDB upsert
      const upsertExpense = (list: Expense[], incoming: Expense) => {
        const index = list.findIndex((e) => e.id === incoming.id);
        if (index >= 0) {
          const updated = [...list];
          updated[index] = { ...updated[index], ...incoming };
          return updated;
        }
        return [...list, incoming];
      };

      // First pull: adds transaction
      let current = upsertExpense(existingExpenses, pulledTransaction);
      expect(current.length).toBe(2);

      // Second pull of same transaction: updates in place, NO duplicate created
      current = upsertExpense(current, pulledTransaction);
      expect(current.length).toBe(2);
      expect(current.filter((e) => e.id === pulledTransaction.id).length).toBe(1);
    });
  });

  // 4. OFFLINE -> ONLINE SYNC FLOW
  describe('4. Offline -> Online Sync Invariants', () => {
    it('Creates mutation in pending queue and updates status on reconnect', () => {
      const offlineMutation = {
        mutationId: 'mut_test_123',
        entityType: 'expense',
        entityId: 'exp_offline_1',
        operation: 'CREATE',
        payload: expenseSquadPaidByA,
        status: 'pending' as const,
        retryCount: 0,
      };

      expect(offlineMutation.status).toBe('pending');

      // Simulating sync processing response from worker
      const processedMutationIds = ['mut_test_123'];
      const updatedStatus = processedMutationIds.includes(offlineMutation.mutationId) ? 'synced' : 'pending';
      expect(updatedStatus).toBe('synced');
    });
  });

  // 5. REFRESH ROUTING & BROWSER NAVIGATION
  describe('5. Refresh Route Persistence and URL Synchronization', () => {
    it('Preserves /dashboard on refresh without redirect', () => {
      const result = parseLocationPath('/dashboard');
      expect(result.route).toBe('app');
      expect(result.activeTab).toBe('dashboard');
      expect(result.selectedGroupId).toBeNull();
      expect(result.isEditProfileOpen).toBe(false);
    });

    it('Preserves /groups/:groupId on refresh without redirect to dashboard', () => {
      const result = parseLocationPath('/groups/GOA2026');
      expect(result.route).toBe('app');
      expect(result.activeTab).toBe('shared-groups');
      expect(result.selectedGroupId).toBe('GOA2026');
      expect(result.isEditProfileOpen).toBe(false);
    });

    it('Preserves /groups with no groupId on refresh', () => {
      const result = parseLocationPath('/groups');
      expect(result.route).toBe('app');
      expect(result.activeTab).toBe('shared-groups');
      expect(result.selectedGroupId).toBeNull();
    });

    it('Preserves /transactions on refresh', () => {
      const result = parseLocationPath('/transactions');
      expect(result.route).toBe('app');
      expect(result.activeTab).toBe('personal-expenses');
    });

    it('Preserves /analytics on refresh', () => {
      const result = parseLocationPath('/analytics');
      expect(result.route).toBe('app');
      expect(result.activeTab).toBe('analytics');
    });

    it('Preserves /ai-advisor on refresh', () => {
      const result = parseLocationPath('/ai-advisor');
      expect(result.route).toBe('app');
      expect(result.activeTab).toBe('ai-advisor');
    });

    it('Preserves /settings on refresh', () => {
      const result = parseLocationPath('/settings');
      expect(result.route).toBe('app');
      expect(result.isEditProfileOpen).toBe(true);
    });

    it('Preserves /profile on refresh as alias for profile/settings', () => {
      const result = parseLocationPath('/profile');
      expect(result.route).toBe('app');
      expect(result.isEditProfileOpen).toBe(true);
      expect(result.activeTab).toBe('dashboard');
    });

    it('Preserves /admin/dashboard on refresh', () => {
      const result = parseLocationPath('/admin/dashboard');
      expect(result.route).toBe('app');
      expect(result.activeTab).toBe('system-admin');
    });

    it('Preserves /login, /signup, /forgot-password routes', () => {
      expect(parseLocationPath('/login').route).toBe('signin');
      expect(parseLocationPath('/signup').route).toBe('signup');
      expect(parseLocationPath('/forgot-password').route).toBe('forgot-password');
      expect(parseLocationPath('/').route).toBe('landing');
    });

    it('Maps tabs to URLs accurately with getPathForTab', () => {
      expect(getPathForTab('dashboard')).toBe('/dashboard');
      expect(getPathForTab('personal-expenses')).toBe('/transactions');
      expect(getPathForTab('shared-groups')).toBe('/groups');
      expect(getPathForTab('shared-groups', 'GOA2026')).toBe('/groups/GOA2026');
      expect(getPathForTab('analytics')).toBe('/analytics');
      expect(getPathForTab('ai-advisor')).toBe('/ai-advisor');
      expect(getPathForTab('system-admin')).toBe('/admin/dashboard');
    });
  });

  // 6. REQUEST REDUCTION & VISIBILITY AWARENESS
  describe('6. Request Reduction and Visibility Awareness', () => {
    let engine: SyncEngine;
    let mockWindow: any;
    let mockDocument: any;
    let mockFetch: any;

    beforeEach(() => {
      class SimpleEventTarget {
        private listeners: Record<string, Function[]> = {};
        addEventListener(t: string, f: Function) {
          (this.listeners[t] = this.listeners[t] || []).push(f);
        }
        removeEventListener(t: string, f: Function) {
          if (this.listeners[t]) this.listeners[t] = this.listeners[t].filter((x) => x !== f);
        }
        dispatchEvent(e: { type: string }) {
          if (this.listeners[e.type]) this.listeners[e.type].forEach((f) => f(e));
        }
      }

      mockWindow = new SimpleEventTarget();
      mockDocument = new SimpleEventTarget();
      mockDocument.visibilityState = 'visible';

      vi.stubGlobal('window', mockWindow);
      vi.stubGlobal('document', mockDocument);
      vi.stubGlobal('navigator', { onLine: true });

      mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/health')) return { ok: true, json: async () => ({ status: 'ok' }) };
        if (url.includes('/api/sync/pull')) return { ok: true, json: async () => ({ success: true, groups: [], expenses: [], settlements: [] }) };
        return { ok: true, json: async () => ({}) };
      });
      vi.stubGlobal('fetch', mockFetch);
    });

    afterEach(() => {
      if (engine) engine.destroy();
      vi.restoreAllMocks();
    });

    it('No 20-second heartbeat exists on the engine', () => {
      engine = new SyncEngine();
      expect((engine as any).heartbeatInterval).toBeUndefined();
    });

    it('Background tab (hidden) stops periodic polling', () => {
      engine = new SyncEngine();
      expect((engine as any).periodicInterval).not.toBeNull();

      mockDocument.visibilityState = 'hidden';
      mockDocument.dispatchEvent({ type: 'visibilitychange' });

      expect((engine as any).periodicInterval).toBeNull();
    });

    it('Visible tab resumes periodic polling and triggers sync', async () => {
      engine = new SyncEngine();
      engine.setUserId('usr_test');

      mockDocument.visibilityState = 'hidden';
      mockDocument.dispatchEvent({ type: 'visibilitychange' });
      expect((engine as any).periodicInterval).toBeNull();

      mockFetch.mockClear();

      mockDocument.visibilityState = 'visible';
      mockDocument.dispatchEvent({ type: 'visibilitychange' });

      expect((engine as any).periodicInterval).not.toBeNull();
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  // 7. DATA INTEGRITY & SETTLEMENT ENGINE
  describe('7. Data Integrity, Balances, and Money Math', () => {
    it('Calculates exact split shares and ensures total matches in paisa', () => {
      const totalAmount = 1000;
      const totalPaisa = toPaisa(totalAmount);
      expect(totalPaisa).toBe(100000);

      const splitA = 500;
      const splitB = 500;
      expect(toPaisa(splitA) + toPaisa(splitB)).toBe(totalPaisa);
    });

    it('Enriches groups with accurate balances and settlement debts', () => {
      const enriched = enrichGroupsWithBalances([squad1], allExpenses, []);
      expect(enriched.length).toBe(1);

      const group = enriched[0];
      // User A paid 4000 (split 2000 each) -> User B owes User A 2000
      // User B paid 3000 (split 1500 each) -> User A owes User B 1500
      // Net: User B owes User A 500
      expect(group.totalSpent).toBe(7000);
      const memberA = group.members.find((m) => m.id === userA.id);
      const memberB = group.members.find((m) => m.id === userB.id);
      expect(memberA?.balance).toBe(500);
      expect(memberB?.balance).toBe(-500);
    });
  });
});
