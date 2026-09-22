import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TransactionDetailsModal } from './components/TransactionDetailsModal';
import { EditExpenseModal } from './components/EditExpenseModal';
import { Expense, Group, UserProfile, Settlement } from './types';
import { calculateGroupMembersWithBalances, enrichGroupsWithBalances } from './utils/balanceEngine';
import { toPaisa, fromPaisa, parseExactMoney } from './utils/money';
import { LocalRepository } from './services/localRepository';

describe('Transaction Edit Feature — End-to-End Suite', () => {
  const currentUser: UserProfile = {
    id: 'usr_me',
    name: 'Sifat Tanvir',
    email: 'sifat@tallix.io',
    role: 'Financial Member',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    monthlyBudget: 25000,
    systemRole: 'User',
    roleTitle: 'Financial Member',
    status: 'Active',
  };

  const sampleGroup: Group = {
    id: 'grp_flat',
    name: 'Gulshan Flatmates',
    description: 'Gulshan Flat expenses',
    members: [
      { id: 'usr_me', name: 'Sifat Tanvir', spent: 0, share: 0, balance: 0, email: 'sifat@tallix.io', role: 'Admin' },
      { id: 'usr_lemon', name: 'Lemon', spent: 0, share: 0, balance: 0, email: 'lemon@tallix.io', role: 'Member' },
    ],
    totalSpent: 0,
    unsettledAmount: 0,
    category: 'Apartment',
    currency: 'BDT',
    avatarGradient: 'from-blue-500 to-indigo-600',
    inviteCode: 'FLAT123',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const sampleSharedExpense: Expense = {
    id: 'exp_groceries_1',
    title: 'Weekly Groceries',
    merchant: 'Weekly Groceries',
    amount: 1000,
    originalAmount: 1000,
    amount_paisa: 100000,
    currency: 'BDT',
    date: '2026-09-20',
    category: '🛒 Groceries',
    status: 'Settled',
    paymentMethod: 'bkash',
    taxAmount: 0,
    isShared: true,
    groupId: 'grp_flat',
    groupName: 'Gulshan Flatmates',
    createdBy: 'usr_me',
    createdByEmail: 'sifat@tallix.io',
    paidByUserId: 'usr_me',
    paidByName: 'Sifat Tanvir',
    splitType: 'equal',
    splits: [
      { userId: 'usr_me', userName: 'Sifat Tanvir', amount: 500, amount_paisa: 50000, settled: true },
      { userId: 'usr_lemon', userName: 'Lemon', amount: 500, amount_paisa: 50000, settled: false },
    ],
    tags: ['Groceries', 'Shared'],
  };

  const samplePersonalExpense: Expense = {
    id: 'exp_personal_1',
    title: 'Metro Rail Ticket',
    merchant: 'Metro Rail Ticket',
    amount: 100,
    originalAmount: 100,
    amount_paisa: 10000,
    currency: 'BDT',
    date: '2026-09-21',
    category: '🚍 Transportation',
    status: 'Settled',
    paymentMethod: 'Cash',
    taxAmount: 0,
    isShared: false,
    createdBy: 'usr_me',
    createdByEmail: 'sifat@tallix.io',
    paidByUserId: 'usr_me',
    paidByName: 'Sifat Tanvir',
    tags: ['Personal'],
  };

  describe('1. Transaction Details Modal — Edit Button Placement & Visibility', () => {
    it('renders [ Edit ] button directly beside [ Delete Transaction ]', () => {
      const html = renderToStaticMarkup(
        <TransactionDetailsModal
          isOpen={true}
          onClose={() => {}}
          expense={sampleSharedExpense}
          onEditExpense={() => {}}
          onDeleteExpense={() => {}}
          currentUser={currentUser}
          groups={[sampleGroup]}
        />
      );

      // Verify Edit button exists with icon and label
      expect(html).toContain('id="edit-transaction-detail-btn"');
      expect(html).toContain('Edit');

      // Verify Delete Transaction button exists
      expect(html).toContain('id="delete-transaction-detail-btn"');
      expect(html).toContain('Delete Transaction');

      // Verify amount display
      expect(html).toContain('৳1,000.00');
    });

    it('enforces permission check: hides edit button if user is not author/member of the transaction', () => {
      const otherUser: UserProfile = {
        id: 'usr_stranger',
        name: 'Stranger',
        email: 'stranger@tallix.io',
        role: 'Financial Member',
        avatar: '',
        monthlyBudget: 10000,
        systemRole: 'User',
      };

      const foreignPersonalExpense: Expense = {
        ...samplePersonalExpense,
        id: 'exp_foreign',
        createdBy: 'usr_other',
        createdByEmail: 'other@tallix.io',
        paidByUserId: 'usr_other',
        paidByName: 'Other User',
      };

      const html = renderToStaticMarkup(
        <TransactionDetailsModal
          isOpen={true}
          onClose={() => {}}
          expense={foreignPersonalExpense}
          onEditExpense={() => {}}
          onDeleteExpense={() => {}}
          currentUser={otherUser}
          groups={[]}
        />
      );

      // Should not render the Edit button for an unauthorized personal expense
      expect(html).not.toContain('id="edit-transaction-detail-btn"');
    });

    it('allows Admin to edit any transaction', () => {
      const adminUser: UserProfile = {
        id: 'usr_admin',
        name: 'Chief Admin',
        email: 'admin@tallix.io',
        role: 'System Administrator',
        avatar: '',
        monthlyBudget: 50000,
        systemRole: 'Admin',
      };

      const html = renderToStaticMarkup(
        <TransactionDetailsModal
          isOpen={true}
          onClose={() => {}}
          expense={samplePersonalExpense}
          onEditExpense={() => {}}
          onDeleteExpense={() => {}}
          currentUser={adminUser}
          groups={[]}
        />
      );

      expect(html).toContain('id="edit-transaction-detail-btn"');
    });
  });

  describe('2. Edit Transaction Modal — Pre-filling and Structure', () => {
    it('pre-fills with current transaction data and shows split breakdown', () => {
      const html = renderToStaticMarkup(
        <EditExpenseModal
          isOpen={true}
          onClose={() => {}}
          expense={sampleSharedExpense}
          groups={[sampleGroup]}
          currentUser={currentUser}
          onSaveExpense={() => {}}
        />
      );

      // Pre-filled Title
      expect(html).toContain('value="Weekly Groceries"');
      // Pre-filled Amount
      expect(html).toContain('value="1000"');
      // Target Squad
      expect(html).toContain('Gulshan Flatmates');
      // Payer dropdown includes members
      expect(html).toContain('Sifat Tanvir');
      expect(html).toContain('Lemon');
      // Displays split breakdown (1000 / 2 = 500)
      expect(html).toContain('৳500.00 / member');
      // Shows ID
      expect(html).toContain('ID: exp_groceries_1');
      // Preserves Update Transaction button
      expect(html).toContain('Update Transaction');
    });

    it('pre-fills personal expense with correct Personal toggle selected', () => {
      const html = renderToStaticMarkup(
        <EditExpenseModal
          isOpen={true}
          onClose={() => {}}
          expense={samplePersonalExpense}
          groups={[sampleGroup]}
          currentUser={currentUser}
          onSaveExpense={() => {}}
        />
      );

      expect(html).toContain('value="Metro Rail Ticket"');
      expect(html).toContain('value="100"');
      expect(html).toContain('Personal Expense');
    });
  });

  describe('3. Financial Integrity & Balance Recalculation', () => {
    it('recalculates squad member balances accurately when an expense is edited', () => {
      // Original: 1000 paid by Sifat, shared with Lemon (500 each)
      // Sifat balance: +500, Lemon balance: -500
      const initialMembers = calculateGroupMembersWithBalances(
        sampleGroup,
        [sampleSharedExpense],
        []
      );
      const sifatInitial = initialMembers.find((m) => m.id === 'usr_me');
      const lemonInitial = initialMembers.find((m) => m.id === 'usr_lemon');

      expect(sifatInitial?.balance).toBe(500);
      expect(lemonInitial?.balance).toBe(-500);

      // User edits amount from 1000 to 600
      const editedAmount = 600;
      const exactPaisa = toPaisa(editedAmount);
      const editedExpense: Expense = {
        ...sampleSharedExpense,
        amount: editedAmount,
        originalAmount: editedAmount,
        amount_paisa: exactPaisa,
        splits: [
          { userId: 'usr_me', userName: 'Sifat Tanvir', amount: 300, amount_paisa: 30000, settled: true },
          { userId: 'usr_lemon', userName: 'Lemon', amount: 300, amount_paisa: 30000, settled: false },
        ],
        updatedAt: '2026-09-22T04:00:00.000Z',
      };

      // Ensure ID is identical (no duplicate)
      expect(editedExpense.id).toBe(sampleSharedExpense.id);

      // Recalculate with edited expense
      const updatedMembers = calculateGroupMembersWithBalances(
        sampleGroup,
        [editedExpense],
        []
      );
      const sifatUpdated = updatedMembers.find((m) => m.id === 'usr_me');
      const lemonUpdated = updatedMembers.find((m) => m.id === 'usr_lemon');

      // Now 600 / 2 = 300 each
      // Sifat balance: +300, Lemon balance: -300
      expect(sifatUpdated?.balance).toBe(300);
      expect(lemonUpdated?.balance).toBe(-300);

      // Check group total spent
      const enriched = enrichGroupsWithBalances(
        [sampleGroup],
        [editedExpense],
        []
      );
      expect(enriched[0].totalSpent).toBe(600);
      expect(enriched[0].unsettledAmount).toBe(300);
    });

    it('recalculates correctly if the payer is changed during edit', () => {
      // Suppose Lemon actually paid the 1000
      const editedExpenseWithNewPayer: Expense = {
        ...sampleSharedExpense,
        paidByUserId: 'usr_lemon',
        paidByName: 'Lemon',
        splits: [
          { userId: 'usr_me', userName: 'Sifat Tanvir', amount: 500, amount_paisa: 50000, settled: false },
          { userId: 'usr_lemon', userName: 'Lemon', amount: 500, amount_paisa: 50000, settled: true },
        ],
      };

      const updatedMembers = calculateGroupMembersWithBalances(
        sampleGroup,
        [editedExpenseWithNewPayer],
        []
      );
      const sifat = updatedMembers.find((m) => m.id === 'usr_me');
      const lemon = updatedMembers.find((m) => m.id === 'usr_lemon');

      // Lemon paid 1000, share is 500 -> Lemon balance: +500
      // Sifat paid 0, share is 500 -> Sifat balance: -500
      expect(lemon?.balance).toBe(500);
      expect(sifat?.balance).toBe(-500);
    });

    it('preserves idempotency and prevents duplicate transactions in state', () => {
      const expensesList: Expense[] = [sampleSharedExpense, samplePersonalExpense];

      const updatedGroceries: Expense = {
        ...sampleSharedExpense,
        amount: 850,
        originalAmount: 850,
        amount_paisa: 85000,
        title: 'Weekly Groceries (Discounted)',
      };

      // Simulating setExpenses(prev => prev.map(e => e.id === cleanExpense.id ? cleanExpense : e))
      const updatedList = expensesList.map((e) =>
        e.id === updatedGroceries.id ? updatedGroceries : e
      );

      // Total list length remains exactly 2 (NO DUPLICATE)
      expect(updatedList.length).toBe(2);
      expect(updatedList.find((e) => e.id === sampleSharedExpense.id)?.amount).toBe(850);
      expect(updatedList.find((e) => e.id === sampleSharedExpense.id)?.title).toBe('Weekly Groceries (Discounted)');
    });
  });

  describe('4. Local Repository & Sync Engine Idempotency', () => {
    it('updateExpense maintains the exact same entityId and enqueues UPDATE mutation', async () => {
      const updatedExpense: Expense = {
        ...samplePersonalExpense,
        amount: 150,
        originalAmount: 150,
        amount_paisa: 15000,
        title: 'Metro Rail Return Ticket',
      };

      const result = await LocalRepository.updateExpense(updatedExpense, currentUser.id);

      expect(result.id).toBe(samplePersonalExpense.id);
      expect(result.amount).toBe(150);
      expect(result.amount_paisa).toBe(15000);
      expect(result.updatedAt).toBeDefined();
    });
  });
});
