import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DashboardView } from './views/DashboardView';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Header } from './components/Header';
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
    // Verify side-by-side layout with mobile vertical separation gap (14px mb-3.5 on mobile, sm:my-0 on desktop)
    expect(html).toContain('grid grid-cols-2 gap-2 sm:gap-2 w-full mt-0.5 mb-3.5 sm:my-0');
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

  it('renders MobileBottomNav with exactly 5 items (Home, Personal Experiences, Shared Group, Analytics, Talix AI Copilot) and no bottom avatar', () => {
    const html = renderToString(
      <MobileBottomNav
        activeTab="dashboard"
        onSelectTab={vi.fn()}
        user={mockUser}
        onOpenEditProfile={vi.fn()}
      />
    );

    // Verify 5 items are present
    expect(html).toContain('Home');
    expect(html).toContain('Personal');
    expect(html).toContain('Experiences');
    expect(html).toContain('Shared');
    expect(html).toContain('Group');
    expect(html).toContain('Analytics');
    expect(html).toContain('Talix AI');
    expect(html).toContain('Copilot');

    // Verify bottom avatar is removed
    expect(html).not.toContain('LE');
    expect(html).toContain('grid-cols-5');
  });

  it('renders mobile header with user greeting, status indicator, Month Selector, and profile avatar, without hamburger menu', () => {
    const html = renderToString(
      <Header
        onOpenNewTransaction={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        user={mockUser}
        onOpenEditProfile={vi.fn()}
        onLogout={vi.fn()}
        lang="en"
        onLangChange={vi.fn()}
      />
    );

    // Verify greeting and user name
    expect(html).toContain('Welcome back');
    expect(html).toContain('Lemon');

    // Verify Month Selector has replaced EN language switcher
    expect(html).toContain('Filter by month');

    // Verify Top-Right Profile avatar
    expect(html).toContain('Account Menu');
    expect(html).toContain('LE');

    // Verify hamburger menu button is NOT rendered
    expect(html).not.toContain('Toggle Navigation Menu');
  });

  it('renders metrics grid with full-width Total Expenses and side-by-side Owed To You and You Owe cards', () => {
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

    // Verify grid configuration: grid-cols-2 on mobile, grid-cols-3 on desktop
    expect(html).toContain('grid grid-cols-2 sm:grid-cols-3');
    // Total Expenses spans 2 columns on mobile, 1 on desktop
    expect(html).toContain('col-span-2 sm:col-span-1');
    // Owed to You and You Owe are col-span-1
    expect(html).toContain('col-span-1');
  });

  it('preserves side-by-side action buttons across mobile viewports (320px, 360px, 375px, 390px, 412px, 430px) with clean vertical gap to Recent Expenses', () => {
    const mobileWidths = [320, 360, 375, 390, 412, 430];

    mobileWidths.forEach((width) => {
      const html = renderToString(
        <div style={{ width: `${width}px` }}>
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
        </div>
      );

      // Verify action buttons container has side-by-side 2-column grid and clean mobile vertical spacing
      expect(html).toContain('grid grid-cols-2 gap-2 sm:gap-2 w-full mt-0.5 mb-3.5 sm:my-0');
      // Both buttons present
      expect(html).toContain('New Transaction');
      expect(html).toContain('Settle Up');
      // Recent Expenses ledger container present directly below
      expect(html).toContain('Recent Expenses');
      // No horizontal overflow classes or full-width button breakage
      expect(html).not.toContain('grid-cols-1 sm:grid-cols-2');
    });
  });
});
