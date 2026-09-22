import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DashboardView } from './views/DashboardView';
import { MobileBottomNav } from './components/MobileBottomNav';
import { LanguageProvider } from './i18n/LanguageContext';
import { Expense, UserProfile } from './types';

const mockUser: UserProfile = {
  id: 'usr_lemon',
  name: 'Lemon',
  email: 'lemon@tallix.dev',
  role: 'Staff Engineer',
  systemRole: 'Admin',
  title: 'Lead Architect',
  department: 'Core Infrastructure',
  avatarGradient: 'from-emerald-500 to-teal-500',
  liquidityLimit: 50000,
  currentLiquidity: 35000,
  monthlyBurnRate: 15000,
};

const mockExpenses: Expense[] = [
  {
    id: 'tx_1',
    merchant: 'Dupur',
    title: 'Lunch',
    amount: 30,
    originalAmount: 30,
    currency: 'BDT',
    category: 'Food',
    status: 'Pending',
    paymentMethod: 'Cash',
    date: '2026-09-21',
    isShared: false,
    paidByName: 'Lemon',
    paidByUserId: 'usr_lemon',
    createdBy: 'usr_lemon',
  },
  {
    id: 'tx_2',
    merchant: 'Ghbbs',
    title: 'Groceries',
    amount: 356,
    originalAmount: 356,
    currency: 'BDT',
    category: 'Food',
    status: 'Settled',
    paymentMethod: 'bkash',
    date: '2026-09-20',
    isShared: true,
    paidByName: 'Lemon',
    paidByUserId: 'usr_lemon',
    createdBy: 'usr_lemon',
    groupId: 'grp_1',
    splits: [
      { userId: 'usr_lemon', amount: 178, settled: false },
      { userId: 'usr_other', amount: 178, settled: false },
    ],
  },
];

describe('Mobile Home / Dashboard Redesign', () => {
  it('renders Total Expenses card with real totals, transaction count badge, and personal/shared breakdown', () => {
    const html = renderToString(
      <LanguageProvider>
        <DashboardView
          user={mockUser}
          expenses={mockExpenses}
          onOpenNewTransaction={vi.fn()}
          onOpenSettleUp={vi.fn()}
          onOpenCreateGroup={vi.fn()}
          onOpenJoinGroup={vi.fn()}
        />
      </LanguageProvider>
    );

    // Total Expenses label & Txs count
    expect(html).toContain('Total Expenses');
    expect(html).toContain('Txs');
    expect(html).toMatch(/2.*Txs/);

    // Personal and Shared breakdown
    expect(html).toContain('Personal');
    expect(html).toContain('30.00');
    expect(html).toContain('Shared');
    expect(html).toContain('356.00');
  });

  it('renders Owed To You and You Owe cards with status badges and subtext', () => {
    const html = renderToString(
      <LanguageProvider>
        <DashboardView
          user={mockUser}
          expenses={mockExpenses}
          onOpenNewTransaction={vi.fn()}
          onOpenSettleUp={vi.fn()}
          onOpenCreateGroup={vi.fn()}
          onOpenJoinGroup={vi.fn()}
        />
      </LanguageProvider>
    );

    // Owed to You
    expect(html).toContain('Owed to You');
    expect(html).toContain('Receivable');

    // You Owe
    expect(html).toContain('You Owe');
    expect(html).toContain('Settled');
    expect(html).toContain('All shared debts cleared');
  });

  it('renders New Transaction and Settle Up action buttons', () => {
    const html = renderToString(
      <LanguageProvider>
        <DashboardView
          user={mockUser}
          expenses={mockExpenses}
          onOpenNewTransaction={vi.fn()}
          onOpenSettleUp={vi.fn()}
          onOpenCreateGroup={vi.fn()}
          onOpenJoinGroup={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(html).toContain('New Transaction');
    expect(html).toContain('Settle Up');
  });

  it('renders Recent Expenses section with search, filter tabs, and mobile expense cards', () => {
    const html = renderToString(
      <LanguageProvider>
        <DashboardView
          user={mockUser}
          expenses={mockExpenses}
          onOpenNewTransaction={vi.fn()}
          onOpenSettleUp={vi.fn()}
          onOpenCreateGroup={vi.fn()}
          onOpenJoinGroup={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(html).toContain('Recent Expenses');
    expect(html).toContain('Search expenses...');

    // Verify filter pills exist
    expect(html).toContain('All');
    expect(html).toContain('Personal');
    expect(html).toContain('Shared');

    // Verify transactions rendered
    expect(html).toContain('Dupur');
    expect(html).toContain('Ghbbs');
    expect(html).toContain('PERSONAL');
    expect(html).toContain('SHARED');
    expect(html).toContain('Details');
  });

  it('renders MobileBottomNav with all 6 items including Home, Personal Experiences, Shared Group, Analytics, Copilot, and user initials', () => {
    const html = renderToString(
      <MobileBottomNav
        activeTab="dashboard"
        onSelectTab={vi.fn()}
        user={mockUser}
        onOpenEditProfile={vi.fn()}
      />
    );

    // Verify 6 items are present
    expect(html).toContain('Home');
    expect(html).toContain('Personal');
    expect(html).toContain('Experiences');
    expect(html).toContain('Shared');
    expect(html).toContain('Group');
    expect(html).toContain('Analytics');
    expect(html).toContain('Talix AI');
    expect(html).toContain('Copilot');
    expect(html).toContain('LE'); // Initials of Lemon
  });
});
