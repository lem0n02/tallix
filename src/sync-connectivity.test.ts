import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncEngine } from './services/syncEngine';

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

describe('Sync Engine False-Offline Fix & Connectivity Resilience', () => {
  let engine: SyncEngine;
  let mockFetch: any;
  let mockWindow: any;
  let mockDocument: any;

  beforeEach(() => {
    mockWindow = new MockEventTarget();
    mockDocument = new MockEventTarget();
    mockDocument.visibilityState = 'visible';

    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('navigator', { onLine: true });

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
            serverTimestamp: '2026-09-26T06:15:00.000Z',
          }),
        };
      }
      if (url.includes('/api/sync/push')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            processedMutationIds: [],
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

  it('1. API reachable + navigator.onLine true => marks ONLINE and state synced', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    engine = new SyncEngine();

    const reachable = await engine.checkReachability();
    expect(reachable).toBe(true);

    const status = engine.getStatus();
    expect(status.isOnline).toBe(true);
    expect(status.state).toBe('synced');
  });

  it('2. API reachable + navigator.onLine false => marks ONLINE based on actual API reachability precedence', async () => {
    // navigator.onLine is reporting false (e.g. sandbox/iframe/glitch), but the API is reachable
    vi.stubGlobal('navigator', { onLine: false });
    engine = new SyncEngine();

    const reachable = await engine.checkReachability();
    expect(reachable).toBe(true);

    // Actual API result MUST take precedence over navigator.onLine
    const status = engine.getStatus();
    expect(status.isOnline).toBe(true);
    expect(status.state).toBe('synced');
  });

  it('3. API unreachable => marks OFFLINE without crashing or altering local state', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/health')) {
        throw new TypeError('Failed to fetch (Network disconnected)');
      }
      return { ok: false, status: 503 };
    });

    engine = new SyncEngine();
    const reachable = await engine.checkReachability();
    expect(reachable).toBe(false);

    const status = engine.getStatus();
    expect(status.isOnline).toBe(false);
    expect(status.state).toBe('offline');
  });

  it('4. Startup successful health check => initial sync runs when user is active', async () => {
    engine = new SyncEngine();
    mockFetch.mockClear();

    engine.setUserId('usr_active_member');

    await vi.waitFor(() => {
      // Must have called health check and pull endpoint
      const healthCalls = mockFetch.mock.calls.filter((c: any[]) => c[0].includes('/api/health'));
      const pullCalls = mockFetch.mock.calls.filter((c: any[]) => c[0].includes('/api/sync/pull'));
      expect(healthCalls.length).toBeGreaterThanOrEqual(1);
      expect(pullCalls.length).toBeGreaterThanOrEqual(1);
    });

    expect(engine.getStatus().isOnline).toBe(true);
    expect(engine.getStatus().lastSyncedAt).not.toBeNull();
  });

  it('5. Tab visibility regain => triggers immediate health check + sync without waiting for interval', async () => {
    engine = new SyncEngine();
    engine.setUserId('usr_active_member');

    // Tab goes to background
    mockDocument.visibilityState = 'hidden';
    mockDocument.dispatchEvent({ type: 'visibilitychange' });

    mockFetch.mockClear();

    // Tab becomes visible again
    mockDocument.visibilityState = 'visible';
    mockDocument.dispatchEvent({ type: 'visibilitychange' });

    await vi.waitFor(() => {
      const healthCalls = mockFetch.mock.calls.filter((c: any[]) => c[0].includes('/api/health'));
      const pullCalls = mockFetch.mock.calls.filter((c: any[]) => c[0].includes('/api/sync/pull'));
      expect(healthCalls.length).toBeGreaterThanOrEqual(1);
      expect(pullCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('6. Online event => triggers immediate health check + sync', async () => {
    engine = new SyncEngine();
    engine.setUserId('usr_active_member');

    // Simulate browser offline event
    mockWindow.dispatchEvent({ type: 'offline' });
    expect(engine.getStatus().isOnline).toBe(false);

    mockFetch.mockClear();

    // Simulate browser online event
    mockWindow.dispatchEvent({ type: 'online' });

    await vi.waitFor(() => {
      const healthCalls = mockFetch.mock.calls.filter((c: any[]) => c[0].includes('/api/health'));
      const pullCalls = mockFetch.mock.calls.filter((c: any[]) => c[0].includes('/api/sync/pull'));
      expect(healthCalls.length).toBeGreaterThanOrEqual(1);
      expect(pullCalls.length).toBeGreaterThanOrEqual(1);
    });

    expect(engine.getStatus().isOnline).toBe(true);
  });

  it('7. Successful sync updates Last Server Sync timestamp', async () => {
    engine = new SyncEngine();
    engine.setUserId('usr_active_member');

    expect(engine.getStatus().lastSyncedAt).toBeNull();

    const res = await engine.triggerSync();
    expect(res.success).toBe(true);

    const status = engine.getStatus();
    expect(status.lastSyncedAt).toBeInstanceOf(Date);
    expect(status.lastSyncedAt!.getTime()).toBeGreaterThan(0);
    expect(status.lastError).toBeNull();
  });

  it('8. Deduplicates concurrent sync requests and health checks', async () => {
    engine = new SyncEngine();
    engine.setUserId('usr_active_member');

    // Fire 4 triggerSync calls simultaneously
    const p1 = engine.triggerSync();
    const p2 = engine.triggerSync();
    const p3 = engine.triggerSync();
    const p4 = engine.triggerSync();

    const results = await Promise.all([p1, p2, p3, p4]);

    // One must succeed while in-flight duplicates receive error 'Sync already in progress'
    const successCount = results.filter((r) => r.success).length;
    const busyCount = results.filter((r) => r.error === 'Sync already in progress').length;

    expect(successCount).toBe(1);
    expect(busyCount).toBe(3);
  });
});
