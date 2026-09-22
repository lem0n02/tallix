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

describe('Sync Engine Worker Request Reduction & Visibility Throttling', () => {
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
        return { ok: true, json: async () => ({ status: 'ok' }) };
      }
      if (url.includes('/api/sync/pull')) {
        return { ok: true, json: async () => ({ success: true, groups: [], expenses: [], settlements: [] }) };
      }
      if (url.includes('/api/sync/push')) {
        return { ok: true, json: async () => ({ success: true, processedMutationIds: [] }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    if (engine) {
      engine.destroy();
    }
    vi.restoreAllMocks();
  });

  it('1. Verifies the standalone 20-second heartbeat has been completely removed', () => {
    engine = new SyncEngine();
    // Verify heartbeat property does not exist on the engine
    expect((engine as any).heartbeatInterval).toBeUndefined();
  });

  it('2. Active polling interval is initialized while tab is visible', () => {
    engine = new SyncEngine();
    expect((engine as any).periodicInterval).not.toBeNull();
  });

  it('3. Pauses polling and clears timer completely when document is hidden (background tab)', () => {
    engine = new SyncEngine();
    expect((engine as any).periodicInterval).not.toBeNull();

    // Tab transitions to hidden (background)
    mockDocument.visibilityState = 'hidden';
    mockDocument.dispatchEvent({ type: 'visibilitychange' });

    // Interval must be cleared
    expect((engine as any).periodicInterval).toBeNull();
  });

  it('4. Resumes polling and executes immediate sync when returning to visible', async () => {
    engine = new SyncEngine();
    engine.setUserId('usr_lemon');

    // Switch to background
    mockDocument.visibilityState = 'hidden';
    mockDocument.dispatchEvent({ type: 'visibilitychange' });
    expect((engine as any).periodicInterval).toBeNull();

    mockFetch.mockClear();

    // Switch to visible
    mockDocument.visibilityState = 'visible';
    mockDocument.dispatchEvent({ type: 'visibilitychange' });

    // Interval restored
    expect((engine as any).periodicInterval).not.toBeNull();

    // Wait for the immediate sync triggered by visibility restoration
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Health check was called as part of the sync cycle
    const healthCalls = mockFetch.mock.calls.filter((call: any[]) => call[0].includes('/api/health'));
    expect(healthCalls.length).toBe(1);
  });

  it('5. Prevents duplicate intervals if initListeners or visibility triggers repeatedly', () => {
    engine = new SyncEngine();
    const originalInterval = (engine as any).periodicInterval;
    expect(originalInterval).not.toBeNull();

    // Call initListeners multiple times
    engine.initListeners();
    engine.initListeners();
    engine.initListeners();

    // Still only a single timer exists
    expect((engine as any).periodicInterval).toBe(originalInterval);

    // Rapid visibility changes
    for (let i = 0; i < 5; i++) {
      mockDocument.visibilityState = 'hidden';
      mockDocument.dispatchEvent({ type: 'visibilitychange' });
      expect((engine as any).periodicInterval).toBeNull();

      mockDocument.visibilityState = 'visible';
      mockDocument.dispatchEvent({ type: 'visibilitychange' });
      expect((engine as any).periodicInterval).not.toBeNull();
    }
  });

  it('6. Reconnect sync: when online event fires, triggers immediate reachability and sync', async () => {
    engine = new SyncEngine();
    mockFetch.mockClear();

    // Device goes offline
    mockWindow.dispatchEvent({ type: 'offline' });
    expect(engine.getStatus().isOnline).toBe(false);
    expect(engine.getStatus().state).toBe('offline');

    // Device reconnects
    mockWindow.dispatchEvent({ type: 'online' });
    expect(engine.getStatus().isOnline).toBe(true);

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const healthCalls = mockFetch.mock.calls.filter((call: any[]) => call[0].includes('/api/health'));
    expect(healthCalls.length).toBe(1);
  });

  it('7. Cleanup destroys timers and event listeners preventing post-unmount activity', () => {
    engine = new SyncEngine();
    expect((engine as any).periodicInterval).not.toBeNull();

    engine.destroy();

    // Timer cleared
    expect((engine as any).periodicInterval).toBeNull();
    expect((engine as any).isInitialized).toBe(false);

    mockFetch.mockClear();
    mockWindow.dispatchEvent({ type: 'online' });
    mockDocument.dispatchEvent({ type: 'visibilitychange' });

    // No calls triggered because listeners were removed
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
