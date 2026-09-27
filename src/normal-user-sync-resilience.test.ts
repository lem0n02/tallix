import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncEngine } from './services/syncEngine';
import { enqueueMutation } from './services/syncQueue';

class MockEventTarget {
  private listeners: Record<string, Function[]> = {};

  addEventListener(type: string, fn: Function) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(fn);
  }

  removeEventListener(type: string, fn: Function) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== fn);
    }
  }

  dispatchEvent(event: { type: string }) {
    if (this.listeners[event.type]) {
      this.listeners[event.type].forEach((fn) => fn(event));
    }
  }
}

class MockStorage {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] || null;
  }
  setItem(key: string, value: string) {
    this.store[key] = value;
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('Normal User Sync Engine Resilience & Auto-Recovery Suite', () => {
  let engine: SyncEngine;
  let mockFetch: any;
  let mockWindow: any;
  let mockDocument: any;
  let mockLocalStorage: any;

  beforeEach(() => {
    mockWindow = new MockEventTarget();
    mockDocument = new MockEventTarget();
    mockDocument.visibilityState = 'visible';
    mockLocalStorage = new MockStorage();

    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('localStorage', mockLocalStorage);

    mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/health')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'operational',
            engine: 'Cloudflare Workers + D1',
            databaseConnected: true,
          }),
        };
      }
      if (url.includes('/api/sync/pull')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            groups: [],
            expenses: [],
            settlements: [],
            registeredUsers: [],
            serverTimestamp: '2026-09-27T10:00:00.000Z',
          }),
        };
      }
      if (url.includes('/api/sync/push')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            processedMutationIds: ['mut_test_1'],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    if (engine) {
      engine.destroy();
    }
    vi.restoreAllMocks();
  });

  it('1. Normal user remains online across multiple periodic sync cycles', async () => {
    engine = new SyncEngine();
    engine.setUserId('usr_normal_123');

    await vi.waitFor(() => {
      expect(engine.getStatus().isOnline).toBe(true);
      expect(engine.getStatus().state).toBe('synced');
    });

    // Run multiple sync triggers (simulating periodic polling)
    await engine.triggerSync();
    expect(engine.getStatus().isOnline).toBe(true);
    expect(engine.getStatus().state).toBe('synced');

    await engine.triggerSync();
    expect(engine.getStatus().isOnline).toBe(true);
    expect(engine.getStatus().state).toBe('synced');
  });

  it('2. Admin user remains online across periodic sync cycles', async () => {
    engine = new SyncEngine();
    engine.setUserId('usr_admin_master');

    await vi.waitFor(() => {
      expect(engine.getStatus().isOnline).toBe(true);
      expect(engine.getStatus().state).toBe('synced');
    });

    await engine.triggerSync();
    expect(engine.getStatus().isOnline).toBe(true);
    expect(engine.getStatus().state).toBe('synced');
  });

  it('3. Temporary API failure does NOT permanently kill polling or lock in OFFLINE', async () => {
    engine = new SyncEngine();
    engine.setUserId('usr_normal_456');

    await vi.waitFor(() => {
      expect(engine.getStatus().isOnline).toBe(true);
    });

    // Simulate transient network disruption
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/health') || url.includes('/api/sync')) {
        throw new TypeError('Failed to fetch');
      }
      return { ok: false, status: 503 };
    });

    // Check reachability fails temporarily
    const reachable1 = await engine.checkReachability();
    expect(reachable1).toBe(false);
    expect(engine.getStatus().isOnline).toBe(false);
    expect(engine.getStatus().state).toBe('offline');

    // Network recovers
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/health')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'operational' }),
        };
      }
      if (url.includes('/api/sync/pull')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            serverTimestamp: '2026-09-27T10:05:00.000Z',
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    // Calling reachability probe recovers automatically
    const reachable2 = await engine.checkReachability();
    expect(reachable2).toBe(true);
    expect(engine.getStatus().isOnline).toBe(true);
    expect(engine.getStatus().state).toBe('synced');
  });

  it('4. API recovery automatically restores ONLINE without user interaction', async () => {
    engine = new SyncEngine();
    engine.setUserId('usr_user_recovery');

    // Force offline via mock error
    mockFetch.mockImplementation(async () => {
      throw new TypeError('Network down');
    });

    await engine.checkReachability();
    expect(engine.getStatus().isOnline).toBe(false);

    // Restore network
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/health')) {
        return { ok: true, status: 200, json: async () => ({ status: 'operational' }) };
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    });

    const recovered = await engine.checkReachability();
    expect(recovered).toBe(true);
    expect(engine.getStatus().isOnline).toBe(true);
    expect(engine.getStatus().state).toBe('synced');
  });

  it('5. 401/403 authentication error is distinguished from network disconnection', async () => {
    engine = new SyncEngine();
    engine.setUserId('usr_auth_issue');

    // Health is operational, but pull returns 401 Unauthorized
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/health')) {
        return { ok: true, status: 200, json: async () => ({ status: 'operational' }) };
      }
      if (url.includes('/api/sync/pull')) {
        return { ok: false, status: 401, statusText: 'Unauthorized' };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const res = await engine.triggerSync();
    expect(res.success).toBe(false);

    // CRITICAL: Must NOT classify as network disconnection!
    const status = engine.getStatus();
    expect(status.isOnline).toBe(true);
    expect(status.state).toBe('error');
    expect(status.lastError).toContain('Authentication error (401)');
  });

  it('6. Successful authenticated sync updates lastSyncedAt', async () => {
    engine = new SyncEngine();
    engine.setUserId('usr_timestamp_test');

    const res = await engine.triggerSync();
    expect(res.success).toBe(true);

    const status = engine.getStatus();
    expect(status.lastSyncedAt).toBeInstanceOf(Date);
    expect(status.lastSyncedAt!.getTime()).toBeGreaterThan(0);
  });

  it('7. navigator.onLine === false does not override successful API reachability', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    engine = new SyncEngine();

    const reachable = await engine.checkReachability();
    expect(reachable).toBe(true);

    expect(engine.getStatus().isOnline).toBe(true);
  });

  it('8. visibilitychange triggers immediate recovery check', async () => {
    engine = new SyncEngine();
    engine.setUserId('usr_tab_switch');

    mockDocument.visibilityState = 'hidden';
    mockDocument.dispatchEvent({ type: 'visibilitychange' });

    mockFetch.mockClear();

    mockDocument.visibilityState = 'visible';
    mockDocument.dispatchEvent({ type: 'visibilitychange' });

    await vi.waitFor(() => {
      const healthCalls = mockFetch.mock.calls.filter((c: any[]) => c[0].includes('/api/health'));
      expect(healthCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('9. online event triggers immediate recovery check', async () => {
    engine = new SyncEngine();
    engine.setUserId('usr_online_evt');

    mockFetch.mockClear();
    mockWindow.dispatchEvent({ type: 'online' });

    await vi.waitFor(() => {
      const healthCalls = mockFetch.mock.calls.filter((c: any[]) => c[0].includes('/api/health'));
      expect(healthCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('10. Account switching resets user-specific sync state', async () => {
    engine = new SyncEngine();

    // User A logs in
    engine.setUserId('usr_user_a');
    await engine.triggerSync();
    expect(engine.getUserId()).toBe('usr_user_a');
    expect(engine.getStatus().lastSyncedAt).not.toBeNull();

    // User A logs out
    engine.resetUserState();
    expect(engine.getUserId()).toBeNull();
    expect(engine.getStatus().lastSyncedAt).toBeNull();
    expect(engine.getStatus().lastError).toBeNull();

    // User B logs in
    engine.setUserId('usr_user_b');
    expect(engine.getUserId()).toBe('usr_user_b');
  });

  it('11. Offline mutations remain queued and push automatically on recovery', async () => {
    engine = new SyncEngine();
    engine.setUserId('usr_offline_mutator');

    // Simulate offline
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/health')) {
        throw new TypeError('Failed to fetch');
      }
      return { ok: false, status: 503 };
    });

    await engine.checkReachability();
    expect(engine.getStatus().isOnline).toBe(false);

    // Queue a local mutation while offline
    await enqueueMutation({
      entityType: 'expense',
      entityId: 'exp_test_offline',
      operation: 'CREATE',
      payload: {
        id: 'exp_test_offline',
        title: 'Lunch',
        amount: 450,
      },
      userId: 'usr_offline_mutator',
    });

    const pending = await engine.updatePendingCount();
    expect(pending).toBeGreaterThanOrEqual(1);
    expect(engine.getStatus().state).toBe('offline');

    // Network recovers
    mockFetch.mockImplementation(async (url: string, init?: any) => {
      if (url.includes('/api/health')) {
        return { ok: true, status: 200, json: async () => ({ status: 'operational' }) };
      }
      if (url.includes('/api/sync/push')) {
        const body = init?.body ? JSON.parse(init.body) : { mutations: [] };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            processedMutationIds: (body.mutations || []).map((m: any) => m.mutationId),
          }),
        };
      }
      if (url.includes('/api/sync/pull')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            serverTimestamp: '2026-09-27T10:10:00.000Z',
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const res = await engine.triggerSync();
    expect(res.success).toBe(true);
    expect(engine.getStatus().isOnline).toBe(true);
    expect(engine.getStatus().state).toBe('synced');
  });
});
