import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SharedGroupsView } from './views/SharedGroupsView';
import { LanguageProvider } from './i18n/LanguageContext';
import { Group, Expense, Settlement, UserProfile } from './types';
import { calculateGroupMembersWithBalances } from './utils/balanceEngine';
import { toPaisa, fromPaisa, sumExactAmounts } from './utils/money';

describe('Group Financial Summary Engine & Labels', () => {
  // TEST CASE 1: The Lemon and Liya prompt example
  it('CASE 1: Lemon (A) pays 356 & 225, Liya (B) pays 65', () => {
    const group: Group = {
      id: 'grp_lemon_liya',
      name: 'Lemon and Liya',
      description: 'Trip squad',
      category: 'Trip',
      avatarGradient: 'from-blue-600 to-indigo-600',
      inviteCode: 'LEMON123',
      members: [
        { id: 'usr_lemon', name: 'Lemon', email: 'lemon@example.com', role: 'Admin', balance: 0 },
        { id: 'usr_liya', name: 'Liya', email: 'liya@example.com', role: 'Member', balance: 0 },
      ],
      totalSpent: 0,
      unsettledAmount: 0,
      currency: 'BDT',
      createdAt: '2026-03-01',
    };

    const expenses: Expense[] = [
      {
        id: 'exp_1',
        title: 'Lunch',
        merchant: 'Cafe',
        amount: 356,
        currency: 'BDT',
        paidByUserId: 'usr_lemon',
        paidByName: 'Lemon',
        date: '2026-03-01',
        category: 'Food',
        paymentMethod: 'Cash',
        isShared: true,
        groupId: 'grp_lemon_liya',
        status: 'Settled',
      },
      {
        id: 'exp_2',
        title: 'Groceries',
        merchant: 'Supermarket',
        amount: 225,
        currency: 'BDT',
        paidByUserId: 'usr_lemon',
        paidByName: 'Lemon',
        date: '2026-03-02',
        category: 'Groceries',
        paymentMethod: 'Cash',
        isShared: true,
        groupId: 'grp_lemon_liya',
        status: 'Settled',
      },
      {
        id: 'exp_3',
        title: 'Snacks',
        merchant: 'Bakery',
        amount: 65,
        currency: 'BDT',
        paidByUserId: 'usr_liya',
        paidByName: 'Liya',
        date: '2026-03-03',
        category: 'Food',
        paymentMethod: 'Cash',
        isShared: true,
        groupId: 'grp_lemon_liya',
        status: 'Settled',
      },
    ];

    const updatedMembers = calculateGroupMembersWithBalances(group, expenses, []);
    const lemonMember = updatedMembers.find((m) => m.id === 'usr_lemon')!;
    const liyaMember = updatedMembers.find((m) => m.id === 'usr_liya')!;

    const totalGroupSpending = sumExactAmounts(expenses.map((e) => e.amount));
    expect(totalGroupSpending).toBe(646);

    // Lemon metrics
    expect(lemonMember.spent).toBe(581);
    expect(lemonMember.share).toBe(323);
    expect(lemonMember.balance).toBe(258);

    // Liya metrics
    expect(liyaMember.spent).toBe(65);
    expect(liyaMember.share).toBe(323);
    expect(liyaMember.balance).toBe(-258);

    // Render for Lemon
    const lemonProfile: UserProfile = {
      id: 'usr_lemon',
      name: 'Lemon',
      email: 'lemon@example.com',
      role: 'Staff Engineer',
      systemRole: 'User',
      title: 'Lead',
      department: 'Engineering',
      avatarGradient: 'from-blue-500 to-indigo-500',
      liquidityLimit: 100000,
      currentLiquidity: 50000,
      monthlyBurnRate: 25000,
    };

    const lemonHtml = renderToString(
      <LanguageProvider>
        <SharedGroupsView
          groups={[group]}
          expenses={expenses}
          settlements={[]}
          selectedGroupId="grp_lemon_liya"
          setSelectedGroupId={() => {}}
          currentUser={lemonProfile}
        />
      </LanguageProvider>
    );

    // Check labels present
    expect(lemonHtml.includes('Total Group Spending')).toBe(true);
    expect(lemonHtml.includes('My Paid')).toBe(true);
    expect(lemonHtml.includes('Others Paid')).toBe(true);
    expect(lemonHtml.includes('My Share')).toBe(true);
    expect(lemonHtml.includes('Owed to Me')).toBe(true);
    expect(lemonHtml.includes('I Owe')).toBe(true);
    expect(lemonHtml.includes('Net Balance')).toBe(true);

    // Check values in Lemon's view
    expect(lemonHtml.includes('646.00')).toBe(true); // Total
    expect(lemonHtml.includes('581.00')).toBe(true); // Lemon My Paid
    expect(lemonHtml.includes('65.00')).toBe(true);  // Lemon Others Paid
    expect(lemonHtml.includes('323.00')).toBe(true); // Lemon My Share
    expect(lemonHtml.includes('258.00')).toBe(true); // Lemon Owed to Me / Net Balance

    // Render for Liya
    const liyaProfile: UserProfile = {
      id: 'usr_liya',
      name: 'Liya',
      email: 'liya@example.com',
      role: 'Engineer',
      systemRole: 'User',
      title: 'Member',
      department: 'Engineering',
      avatarGradient: 'from-purple-500 to-pink-500',
      liquidityLimit: 100000,
      currentLiquidity: 50000,
      monthlyBurnRate: 25000,
    };

    const liyaHtml = renderToString(
      <LanguageProvider>
        <SharedGroupsView
          groups={[group]}
          expenses={expenses}
          settlements={[]}
          selectedGroupId="grp_lemon_liya"
          setSelectedGroupId={() => {}}
          currentUser={liyaProfile}
        />
      </LanguageProvider>
    );

    expect(liyaHtml.includes('646.00')).toBe(true); // Total
    expect(liyaHtml.includes('65.00')).toBe(true);  // Liya My Paid
    expect(liyaHtml.includes('581.00')).toBe(true); // Liya Others Paid
    expect(liyaHtml.includes('323.00')).toBe(true); // Liya My Share
    expect(liyaHtml.includes('258.00')).toBe(true); // Liya Net Balance (258.00)
  });

  // TEST CASE 2: Equal spending
  it('CASE 2: A pays 100, B pays 100 -> Net Balance 0', () => {
    const group: Group = {
      id: 'grp_case2',
      name: 'Pair',
      description: 'Equal split',
      category: 'General',
      avatarGradient: 'from-blue-600 to-indigo-600',
      inviteCode: 'PAIR123',
      members: [
        { id: 'usr_a', name: 'Alice', email: 'alice@example.com', role: 'Admin', balance: 0 },
        { id: 'usr_b', name: 'Bob', email: 'bob@example.com', role: 'Member', balance: 0 },
      ],
      totalSpent: 0,
      unsettledAmount: 0,
      currency: 'BDT',
      createdAt: '2026-03-01',
    };

    const expenses: Expense[] = [
      {
        id: 'exp_2a',
        title: 'Exp A',
        merchant: 'Shop',
        amount: 100,
        currency: 'BDT',
        paidByUserId: 'usr_a',
        paidByName: 'Alice',
        date: '2026-03-01',
        category: 'General',
        paymentMethod: 'Cash',
        isShared: true,
        groupId: 'grp_case2',
        status: 'Settled',
      },
      {
        id: 'exp_2b',
        title: 'Exp B',
        merchant: 'Shop',
        amount: 100,
        currency: 'BDT',
        paidByUserId: 'usr_b',
        paidByName: 'Bob',
        date: '2026-03-01',
        category: 'General',
        paymentMethod: 'Cash',
        isShared: true,
        groupId: 'grp_case2',
        status: 'Settled',
      },
    ];

    const updated = calculateGroupMembersWithBalances(group, expenses, []);
    const a = updated.find((m) => m.id === 'usr_a')!;
    const b = updated.find((m) => m.id === 'usr_b')!;

    expect(a.spent).toBe(100);
    expect(a.share).toBe(100);
    expect(a.balance).toBe(0);

    expect(b.spent).toBe(100);
    expect(b.share).toBe(100);
    expect(b.balance).toBe(0);
  });

  // TEST CASE 3: One member pays all
  it('CASE 3: A pays 200, B pays 0 -> A Net +100, B Net -100', () => {
    const group: Group = {
      id: 'grp_case3',
      name: 'Pair',
      description: 'A pays all',
      category: 'General',
      avatarGradient: 'from-blue-600 to-indigo-600',
      inviteCode: 'PAIR3',
      members: [
        { id: 'usr_a', name: 'Alice', email: 'alice@example.com', role: 'Admin', balance: 0 },
        { id: 'usr_b', name: 'Bob', email: 'bob@example.com', role: 'Member', balance: 0 },
      ],
      totalSpent: 0,
      unsettledAmount: 0,
      currency: 'BDT',
      createdAt: '2026-03-01',
    };

    const expenses: Expense[] = [
      {
        id: 'exp_3a',
        title: 'Dinner',
        merchant: 'Diner',
        amount: 200,
        currency: 'BDT',
        paidByUserId: 'usr_a',
        paidByName: 'Alice',
        date: '2026-03-01',
        category: 'Food',
        paymentMethod: 'Cash',
        isShared: true,
        groupId: 'grp_case3',
        status: 'Settled',
      },
    ];

    const updated = calculateGroupMembersWithBalances(group, expenses, []);
    const a = updated.find((m) => m.id === 'usr_a')!;
    const b = updated.find((m) => m.id === 'usr_b')!;

    expect(a.spent).toBe(200);
    expect(a.share).toBe(100);
    expect(a.balance).toBe(100);

    expect(b.spent).toBe(0);
    expect(b.share).toBe(100);
    expect(b.balance).toBe(-100);
  });

  // TEST CASE 4: Three members
  it('CASE 4: A pays 300, B pays 0, C pays 0 -> Each share 100, A Net +200, B Net -100, C Net -100', () => {
    const group: Group = {
      id: 'grp_case4',
      name: 'Trio',
      description: '3 members',
      category: 'General',
      avatarGradient: 'from-blue-600 to-indigo-600',
      inviteCode: 'TRIO123',
      members: [
        { id: 'usr_a', name: 'Alice', email: 'alice@example.com', role: 'Admin', balance: 0 },
        { id: 'usr_b', name: 'Bob', email: 'bob@example.com', role: 'Member', balance: 0 },
        { id: 'usr_c', name: 'Charlie', email: 'charlie@example.com', role: 'Member', balance: 0 },
      ],
      totalSpent: 0,
      unsettledAmount: 0,
      currency: 'BDT',
      createdAt: '2026-03-01',
    };

    const expenses: Expense[] = [
      {
        id: 'exp_4a',
        title: 'Hotel',
        merchant: 'Hotel',
        amount: 300,
        currency: 'BDT',
        paidByUserId: 'usr_a',
        paidByName: 'Alice',
        date: '2026-03-01',
        category: 'Travel',
        paymentMethod: 'Cash',
        isShared: true,
        groupId: 'grp_case4',
        status: 'Settled',
      },
    ];

    const updated = calculateGroupMembersWithBalances(group, expenses, []);
    const a = updated.find((m) => m.id === 'usr_a')!;
    const b = updated.find((m) => m.id === 'usr_b')!;
    const c = updated.find((m) => m.id === 'usr_c')!;

    expect(a.spent).toBe(300);
    expect(a.share).toBe(100);
    expect(a.balance).toBe(200);

    expect(b.spent).toBe(0);
    expect(b.share).toBe(100);
    expect(b.balance).toBe(-100);

    expect(c.spent).toBe(0);
    expect(c.share).toBe(100);
    expect(c.balance).toBe(-100);
  });

  // TEST CASE 5: Exact decimals
  it('CASE 5: A pays 120.50, B pays 44.25 -> Total 164.75, exact shares without IEEE-754 drift', () => {
    const group: Group = {
      id: 'grp_case5',
      name: 'Decimal Pair',
      description: 'Precision test',
      category: 'General',
      avatarGradient: 'from-blue-600 to-indigo-600',
      inviteCode: 'DEC123',
      members: [
        { id: 'usr_a', name: 'Alice', email: 'alice@example.com', role: 'Admin', balance: 0 },
        { id: 'usr_b', name: 'Bob', email: 'bob@example.com', role: 'Member', balance: 0 },
      ],
      totalSpent: 0,
      unsettledAmount: 0,
      currency: 'BDT',
      createdAt: '2026-03-01',
    };

    const expenses: Expense[] = [
      {
        id: 'exp_5a',
        title: 'Item A',
        merchant: 'Store',
        amount: 120.50,
        currency: 'BDT',
        paidByUserId: 'usr_a',
        paidByName: 'Alice',
        date: '2026-03-01',
        category: 'Shopping',
        paymentMethod: 'Cash',
        isShared: true,
        groupId: 'grp_case5',
        status: 'Settled',
      },
      {
        id: 'exp_5b',
        title: 'Item B',
        merchant: 'Store',
        amount: 44.25,
        currency: 'BDT',
        paidByUserId: 'usr_b',
        paidByName: 'Bob',
        date: '2026-03-01',
        category: 'Shopping',
        paymentMethod: 'Cash',
        isShared: true,
        groupId: 'grp_case5',
        status: 'Settled',
      },
    ];

    const totalSpent = sumExactAmounts(expenses.map((e) => e.amount));
    expect(totalSpent).toBe(164.75);

    const updated = calculateGroupMembersWithBalances(group, expenses, []);
    const a = updated.find((m) => m.id === 'usr_a')!;
    const b = updated.find((m) => m.id === 'usr_b')!;

    expect(a.spent).toBe(120.50);
    expect(b.spent).toBe(44.25);

    // Sum of shares must exactly equal total (164.75)
    expect(a.share! + b.share!).toBe(164.75);
    // Net balances sum to zero
    expect(toPaisa(a.balance) + toPaisa(b.balance)).toBe(0);
  });

  // TEST CASE 6: Settle Up adjusts net balance to 0 while keeping historical Total, My Paid, Others Paid intact
  it('CASE 6: Settlement clears balance while preserving Total Group Spending & My Paid', () => {
    const group: Group = {
      id: 'grp_settle',
      name: 'Lemon and Liya',
      description: 'Settlement test',
      category: 'Trip',
      avatarGradient: 'from-blue-600 to-indigo-600',
      inviteCode: 'SET123',
      members: [
        { id: 'usr_lemon', name: 'Lemon', email: 'lemon@example.com', role: 'Admin', balance: 0 },
        { id: 'usr_liya', name: 'Liya', email: 'liya@example.com', role: 'Member', balance: 0 },
      ],
      totalSpent: 0,
      unsettledAmount: 0,
      currency: 'BDT',
      createdAt: '2026-03-01',
    };

    const expenses: Expense[] = [
      {
        id: 'exp_1',
        title: 'Lunch',
        merchant: 'Cafe',
        amount: 356,
        currency: 'BDT',
        paidByUserId: 'usr_lemon',
        paidByName: 'Lemon',
        date: '2026-03-01',
        category: 'Food',
        paymentMethod: 'Cash',
        isShared: true,
        groupId: 'grp_settle',
        status: 'Settled',
      },
      {
        id: 'exp_2',
        title: 'Groceries',
        merchant: 'Supermarket',
        amount: 225,
        currency: 'BDT',
        paidByUserId: 'usr_lemon',
        paidByName: 'Lemon',
        date: '2026-03-02',
        category: 'Groceries',
        paymentMethod: 'Cash',
        isShared: true,
        groupId: 'grp_settle',
        status: 'Settled',
      },
      {
        id: 'exp_3',
        title: 'Snacks',
        merchant: 'Bakery',
        amount: 65,
        currency: 'BDT',
        paidByUserId: 'usr_liya',
        paidByName: 'Liya',
        date: '2026-03-03',
        category: 'Food',
        paymentMethod: 'Cash',
        isShared: true,
        groupId: 'grp_settle',
        status: 'Settled',
      },
    ];

    // Liya pays Lemon ৳258.00 (accepted settlement)
    const settlements: Settlement[] = [
      {
        id: 'stl_1',
        groupId: 'grp_settle',
        groupName: 'Lemon and Liya',
        fromUserId: 'usr_liya',
        fromUserName: 'Liya',
        toUserId: 'usr_lemon',
        toUserName: 'Lemon',
        amount: 258,
        currency: 'BDT',
        paymentMethod: 'bKash',
        status: 'Accepted',
        createdAt: '2026-03-04',
      },
    ];

    const updated = calculateGroupMembersWithBalances(group, expenses, settlements);
    const lemon = updated.find((m) => m.id === 'usr_lemon')!;
    const liya = updated.find((m) => m.id === 'usr_liya')!;

    // Historical paid & share remain completely untouched
    expect(lemon.spent).toBe(581);
    expect(lemon.share).toBe(323);
    expect(liya.spent).toBe(65);
    expect(liya.share).toBe(323);

    // Balances are now 0 (fully settled / balanced)
    expect(lemon.balance).toBe(0);
    expect(liya.balance).toBe(0);
  });
});
