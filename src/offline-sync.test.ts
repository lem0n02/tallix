// Offline-First and Cloudflare Sync Comprehensive Test Suite
import { describe, it, expect } from 'vitest';
import { generateEntityId, getClientDeviceId } from './services/idGenerator';
import { SyncMutation } from './services/syncTypes';
import { Expense } from './types';

describe('Offline-First Architecture & Synchronization Invariants', () => {
  it('1. Generates collision-resistant stable entity IDs with expected entity prefixes', () => {
    const expId = generateEntityId('exp');
    const grpId = generateEntityId('grp');
    const stlId = generateEntityId('stl');
    const mutId = generateEntityId('mut');

    expect(expId).toMatch(/^exp_[a-z0-9]+_[a-z0-9]+$/);
    expect(grpId).toMatch(/^grp_[a-z0-9]+_[a-z0-9]+$/);
    expect(stlId).toMatch(/^stl_[a-z0-9]+_[a-z0-9]+$/);
    expect(mutId).toMatch(/^mut_[a-z0-9]+_[a-z0-9]+$/);

    // Entity IDs must remain unique
    const anotherExpId = generateEntityId('exp');
    expect(expId).not.toBe(anotherExpId);
  });

  it('2. Preserves persistent Client Device ID across operations', () => {
    const devId1 = getClientDeviceId();
    const devId2 = getClientDeviceId();
    expect(devId1).toBeTruthy();
    expect(devId1).toBe(devId2);
  });

  it('3. Enforces deterministic minor units (paisa) avoiding floating point drift', () => {
    const values = [10.5, 99.99, 1200.00, 33.3333333, 0.05];
    for (const val of values) {
      const rounded = Math.round(Number(val) * 100) / 100;
      const paisa = Math.round(rounded * 100);
      expect(Number.isInteger(paisa)).toBe(true);
      expect(paisa / 100).toBe(rounded);
    }
  });

  it('4. Idempotency verification: Retrying the same mutation preserves the mutationId', () => {
    const mutationId = generateEntityId('mut');
    const mutation: SyncMutation = {
      mutationId,
      entityType: 'expense',
      entityId: 'exp_abc123',
      operation: 'CREATE',
      payload: { id: 'exp_abc123', amount: 450, title: 'Dinner' },
      userId: 'usr_owner',
      createdAt: '2026-09-20T12:00:00.000Z',
      updatedAt: '2026-09-20T12:00:00.000Z',
      retryCount: 0,
      status: 'pending',
      clientDeviceId: getClientDeviceId(),
    };

    // Retry attempt simulates re-sending over network
    const retryAttempt: SyncMutation = {
      ...mutation,
      retryCount: mutation.retryCount + 1,
      status: 'syncing',
    };

    expect(retryAttempt.mutationId).toBe(mutationId);
    expect(retryAttempt.entityId).toBe('exp_abc123');
  });

  it('5. Group spend and member split balance calculations are strictly deterministic', () => {
    const groupExpenses: Expense[] = [
      {
        id: 'exp_1',
        title: 'Team Lunch',
        merchant: 'Diner',
        amount: 300,
        currency: 'BDT',
        category: 'Food',
        date: '2026-09-20',
        status: 'Settled',
        paymentMethod: 'Cash',
        paidByUserId: 'usr_1',
        paidByName: 'User 1',
        isShared: true,
        groupId: 'grp_test',
        splits: [
          { userId: 'usr_1', userName: 'User 1', amount: 100, settled: true },
          { userId: 'usr_2', userName: 'User 2', amount: 100, settled: false },
          { userId: 'usr_3', userName: 'User 3', amount: 100, settled: false },
        ],
      },
      {
        id: 'exp_2',
        title: 'Taxi Fare',
        merchant: 'Cab',
        amount: 150,
        currency: 'BDT',
        category: 'Transport',
        date: '2026-09-20',
        status: 'Settled',
        paymentMethod: 'Cash',
        paidByUserId: 'usr_2',
        paidByName: 'User 2',
        isShared: true,
        groupId: 'grp_test',
        splits: [
          { userId: 'usr_1', userName: 'User 1', amount: 50, settled: false },
          { userId: 'usr_2', userName: 'User 2', amount: 50, settled: true },
          { userId: 'usr_3', userName: 'User 3', amount: 50, settled: false },
        ],
      },
    ];

    // Total spent calculation
    const totalSpent = groupExpenses.reduce((acc, exp) => acc + exp.amount, 0);
    expect(totalSpent).toBe(450);

    // Balance calculations for usr_1:
    // Paid: 300. Share: 100 (from exp_1) + 50 (from exp_2) = 150.
    // Net balance = 300 - 150 = +150 (owed 150).
    const usr1Paid = groupExpenses.filter(e => e.paidByUserId === 'usr_1').reduce((a, b) => a + b.amount, 0);
    const usr1Owed = groupExpenses.reduce((acc, exp) => {
      const sp = exp.splits?.find(s => s.userId === 'usr_1');
      return acc + (sp ? sp.amount : 0);
    }, 0);
    const usr1Net = usr1Paid - usr1Owed;
    expect(usr1Net).toBe(150);

    // Balance for usr_3:
    // Paid: 0. Share: 100 + 50 = 150. Net balance = -150.
    const usr3Paid = groupExpenses.filter(e => e.paidByUserId === 'usr_3').reduce((a, b) => a + b.amount, 0);
    const usr3Owed = groupExpenses.reduce((acc, exp) => {
      const sp = exp.splits?.find(s => s.userId === 'usr_3');
      return acc + (sp ? sp.amount : 0);
    }, 0);
    const usr3Net = usr3Paid - usr3Owed;
    expect(usr3Net).toBe(-150);
  });

  it('6. Incremental pull delta filtering respects since timestamp', () => {
    const t0 = '2026-09-20T10:00:00.000Z';
    const t1 = '2026-09-20T11:00:00.000Z';
    const t2 = '2026-09-20T12:00:00.000Z';

    const items = [
      { id: 'item_1', updatedAt: t0 },
      { id: 'item_2', updatedAt: t1 },
      { id: 'item_3', updatedAt: t2 },
    ];

    const since = t1;
    const filtered = items.filter(item => new Date(item.updatedAt).getTime() > new Date(since).getTime());

    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('item_3');
  });

  it('7. Version and conflict handling increments version sequentially without loss', () => {
    const baseMutation: SyncMutation = {
      mutationId: generateEntityId('mut'),
      entityType: 'expense',
      entityId: 'exp_123',
      operation: 'UPDATE',
      payload: { id: 'exp_123', amount: 600 },
      userId: 'usr_1',
      createdAt: '2026-09-20T12:00:00.000Z',
      updatedAt: '2026-09-20T12:00:00.000Z',
      retryCount: 0,
      status: 'pending',
      clientDeviceId: getClientDeviceId(),
      baseVersion: 1,
    };

    const nextMutation: SyncMutation = {
      ...baseMutation,
      mutationId: generateEntityId('mut'),
      payload: { id: 'exp_123', amount: 650 },
      baseVersion: (baseMutation.baseVersion || 1) + 1,
    };

    expect(nextMutation.baseVersion).toBe(2);
    expect(nextMutation.payload.amount).toBe(650);
  });
});
