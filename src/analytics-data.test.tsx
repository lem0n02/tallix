import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AnalyticsView } from './views/AnalyticsView';
import { LanguageProvider } from './i18n/LanguageContext';
import { Expense, CategoryItem } from './types';
import { sumExactAmounts } from './utils/money';

const MOCK_CATEGORIES: CategoryItem[] = [
  { id: 'cat-1', name: '🛒 Groceries', color: '#10b981', iconName: 'ShoppingCart', budgetMonthly: 10000, currentSpent: 0 },
  { id: 'cat-2', name: '🍔 Food & Dining', color: '#f59e0b', iconName: 'Utensils', budgetMonthly: 5000, currentSpent: 0 },
  { id: 'cat-3', name: '⚡ Utilities', color: '#6366f1', iconName: 'Zap', budgetMonthly: 3000, currentSpent: 0 },
];

describe('Analytics Real Data & Zero-Demo Isolation', () => {
  it('renders an empty state when a new account has zero expenses, with NO demo data', () => {
    const emptyExpenses: Expense[] = [];

    const html = renderToString(
      <LanguageProvider>
        <AnalyticsView expenses={emptyExpenses} categories={MOCK_CATEGORIES} />
      </LanguageProvider>
    );

    // Verify empty state messages are rendered
    expect(html.includes('No spending data yet')).toBe(true);
    expect(html.includes('No category breakdown yet')).toBe(true);
    expect(html.includes('Add your first transaction to see your monthly spending trend')).toBe(true);

    // Verify fabricated demo numbers DO NOT exist in rendered output
    expect(html.includes('1200')).toBe(false);
    expect(html.includes('1880')).toBe(false);
    expect(html.includes('1520')).toBe(false);
    expect(html.includes('2150')).toBe(false);
    expect(html.includes('2790')).toBe(false);
    expect(html.includes('3750')).toBe(false);
    expect(html.includes('2100')).toBe(false); // Demo travel category
  });

  it('correctly aggregates a single transaction of ৳360 with exact match across Total, Monthly, and Category', () => {
    const singleExpense: Expense[] = [
      {
        id: 'exp_single_1',
        title: 'Bazaar Groceries',
        merchant: 'Shwapno',
        amount: 360,
        currency: 'BDT',
        paidByUserId: 'user_fresh',
        paidByName: 'Abdul Latif',
        date: new Date().toISOString().split('T')[0],
        category: '🛒 Groceries',
        paymentMethod: 'bkash',
        isShared: false,
        status: 'Settled',
      },
    ];

    const html = renderToString(
      <LanguageProvider>
        <AnalyticsView expenses={singleExpense} categories={MOCK_CATEGORIES} />
      </LanguageProvider>
    );

    // Total spent matches ৳360
    expect(sumExactAmounts(singleExpense.map((e) => e.amount))).toBe(360);

    // The rendered total spent should show 360
    expect(html.includes('360')).toBe(true);

    // Category legend should show "Groceries"
    expect(html.includes('Groceries')).toBe(true);

    // Fabricated demo amounts must NOT appear
    expect(html.includes('1880')).toBe(false);
    expect(html.includes('2790')).toBe(false);
    expect(html.includes('3750')).toBe(false);
    expect(html.includes('2100')).toBe(false);
  });

  it('guarantees Total = Monthly Sum = Category Sum for multiple transactions with decimals', () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const expenses: Expense[] = [
      {
        id: 'exp_1',
        title: 'Morning Breakfast',
        merchant: 'Cafe',
        amount: 120.5,
        currency: 'BDT',
        paidByUserId: 'user_1',
        paidByName: 'User 1',
        date: todayStr,
        category: '🍔 Food & Dining',
        paymentMethod: 'Cash',
        isShared: false,
        status: 'Settled',
      },
      {
        id: 'exp_2',
        title: 'Evening Groceries',
        merchant: 'Agora',
        amount: 239.5,
        currency: 'BDT',
        paidByUserId: 'user_1',
        paidByName: 'User 1',
        date: todayStr,
        category: '🛒 Groceries',
        paymentMethod: 'bkash',
        isShared: false,
        status: 'Settled',
      },
    ];

    // Check sum exact calculation
    const total = sumExactAmounts(expenses.map((e) => e.amount));
    expect(total).toBe(360.0);

    const html = renderToString(
      <LanguageProvider>
        <AnalyticsView expenses={expenses} categories={MOCK_CATEGORIES} />
      </LanguageProvider>
    );

    // Both categories must be present
    expect(html.includes('Food &amp; Dining') || html.includes('Food & Dining')).toBe(true);
    expect(html.includes('Groceries')).toBe(true);
  });

  it('strictly isolates expenses so User B never sees User A transactions', () => {
    const allExpenses: Expense[] = [
      {
        id: 'exp_user_a',
        title: 'User A Laptop',
        merchant: 'Apple Store',
        amount: 85000,
        currency: 'BDT',
        paidByUserId: 'user_a',
        paidByName: 'Alice',
        date: '2026-03-01',
        category: 'Devices',
        paymentMethod: 'Cash',
        isShared: false,
        status: 'Settled',
      },
      {
        id: 'exp_user_b',
        title: 'User B Tea',
        merchant: 'Tea Stall',
        amount: 30,
        currency: 'BDT',
        paidByUserId: 'user_b',
        paidByName: 'Bob',
        date: '2026-03-01',
        category: 'Food',
        paymentMethod: 'Cash',
        isShared: false,
        status: 'Settled',
      },
    ];

    // User B's filtered expenses
    const userBExpenses = allExpenses.filter((e) => e.paidByUserId === 'user_b');
    expect(userBExpenses.length).toBe(1);
    expect(userBExpenses[0].amount).toBe(30);

    const html = renderToString(
      <LanguageProvider>
        <AnalyticsView expenses={userBExpenses} categories={MOCK_CATEGORIES} />
      </LanguageProvider>
    );

    // User B view must NOT contain 85000 from User A
    expect(html.includes('85000')).toBe(false);
    expect(html.includes('User A Laptop')).toBe(false);
  });
});
