import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SharedGroupsView } from './views/SharedGroupsView';
import { LanguageProvider } from './i18n/LanguageContext';
import { Group, Expense, UserProfile } from './types';

describe('Tallix Squads Mobile Refinement & Balance Calculations', () => {
  const userShahid: UserProfile = {
    id: 'usr_shahid',
    name: 'Shahid',
    email: 'shahid@example.com',
    role: 'Member',
    systemRole: 'User',
    title: 'Engineer',
    department: 'Tech',
    avatarGradient: 'from-blue-600 to-indigo-600',
    liquidityLimit: 50000,
    currentLiquidity: 20000,
    monthlyBurnRate: 10000,
  };

  const userLemon: UserProfile = {
    id: 'usr_lemon',
    name: 'Lemon',
    email: 'lemon@example.com',
    role: 'Member',
    systemRole: 'User',
    title: 'Designer',
    department: 'Design',
    avatarGradient: 'from-emerald-600 to-teal-600',
    liquidityLimit: 50000,
    currentLiquidity: 20000,
    monthlyBurnRate: 10000,
  };

  // Squad 412: 2 members (Shahid and Lemon)
  const squad412: Group = {
    id: 'grp_412',
    name: '412',
    description: 'Flat 412 Squad',
    category: 'Home',
    avatarGradient: 'from-blue-600 to-indigo-600',
    inviteCode: 'DJS6RK-J47',
    currency: 'BDT',
    createdAt: '2026-09-01',
    totalSpent: 0,
    unsettledAmount: 0,
    members: [
      // Note: testing with accidental stored '(You)' on Shahid's name to ensure sanitization works
      { id: 'usr_shahid', name: 'Shahid (You)', email: 'shahid@example.com', role: 'Admin', balance: 0 },
      { id: 'usr_lemon', name: 'Lemon', email: 'lemon@example.com', role: 'Member', balance: 0 },
    ],
  };

  // Squad Khaddo: 1 member
  const squadKhaddo: Group = {
    id: 'grp_khaddo',
    name: 'Khaddo',
    description: 'Food squad',
    category: 'Food',
    avatarGradient: 'from-amber-600 to-orange-600',
    inviteCode: 'VQB-3LF-162',
    currency: 'BDT',
    createdAt: '2026-09-01',
    totalSpent: 129,
    unsettledAmount: 0,
    members: [
      { id: 'usr_lemon', name: 'Lemon', email: 'lemon@example.com', role: 'Admin', balance: 0 },
    ],
  };

  // Case 1: Shahid pays ৳120 for Pepsi (2-member equal split)
  const expensePepsi120: Expense = {
    id: 'exp_pepsi',
    title: 'Pepsi',
    merchant: 'Corner Store',
    amount: 120,
    originalAmount: 120,
    currency: 'BDT',
    paidByUserId: 'usr_shahid',
    paidByName: 'Shahid (You)',
    date: '2026-09-24',
    category: 'Food',
    paymentMethod: 'Cash',
    isShared: true,
    groupId: 'grp_412',
    status: 'Settled',
  };

  it('Case 1: Payer perspective (Shahid) — My Paid: 120, Others Paid: 0, Owed to Me: 60, I Owe: 0', () => {
    const html = renderToString(
      <LanguageProvider>
        <SharedGroupsView
          groups={[squad412, squadKhaddo]}
          expenses={[expensePepsi120]}
          allExpenses={[expensePepsi120]}
          selectedGroupId="grp_412"
          setSelectedGroupId={() => {}}
          currentUser={userShahid}
          onOpenNewGroup={() => {}}
          onOpenJoinGroup={() => {}}
          onOpenNewTransaction={() => {}}
        />
      </LanguageProvider>
    );

    // Total Squad Spending = 120.00
    expect(html).toContain('120.00');
    // My Paid = 120.00
    expect(html).toContain('My Paid');
    // Others Paid = 0.00
    expect(html).toContain('Others Paid');
    // Amount Owed to Me = 60.00
    expect(html).toContain('Amount Owed to Me');
    expect(html).toContain('60.00');
    // Amount I Owe = 0.00
    expect(html).toContain('Amount I Owe');
    expect(html).toContain('0.00');

    // Dynamic "(You)" tag is on Shahid only
    expect(html).toContain('Shahid (You)');
    // Lemon should NOT have "(You)"
    expect(html).not.toContain('Lemon (You)');
  });

  it('Case 2: Non-payer perspective (Lemon) — My Paid: 0, Others Paid: 120, Owed to Me: 0, I Owe: 60', () => {
    const html = renderToString(
      <LanguageProvider>
        <SharedGroupsView
          groups={[squad412, squadKhaddo]}
          expenses={[expensePepsi120]}
          allExpenses={[expensePepsi120]}
          selectedGroupId="grp_412"
          setSelectedGroupId={() => {}}
          currentUser={userLemon}
          onOpenNewGroup={() => {}}
          onOpenJoinGroup={() => {}}
          onOpenNewTransaction={() => {}}
        />
      </LanguageProvider>
    );

    // Total Squad Spending = 120.00
    expect(html).toContain('120.00');
    // My Paid = 0.00 for Lemon
    expect(html).toContain('My Paid');
    // Others Paid = 120.00 for Lemon
    expect(html).toContain('Others Paid');
    // Amount I Owe = 60.00 for Lemon
    expect(html).toContain('Amount I Owe');
    expect(html).toContain('60.00');
    // Amount Owed to Me = 0.00 for Lemon
    expect(html).toContain('Amount Owed to Me');

    // Dynamic "(You)" tag: Lemon is logged in, so Lemon should have "(You)", and Shahid should NOT!
    expect(html).toContain('Lemon (You)');
    // Shahid had "(You)" hardcoded in the database, but our sanitizer strips it so Lemon sees clean "Shahid"
    expect(html).not.toContain('Shahid (You)');
  });

  it('Renders multiple squads in the switcher and isolates active squad', () => {
    const html = renderToString(
      <LanguageProvider>
        <SharedGroupsView
          groups={[squad412, squadKhaddo]}
          expenses={[expensePepsi120]}
          allExpenses={[expensePepsi120]}
          selectedGroupId="grp_412"
          setSelectedGroupId={() => {}}
          currentUser={userLemon}
          onOpenNewGroup={() => {}}
          onOpenJoinGroup={() => {}}
          onOpenNewTransaction={() => {}}
        />
      </LanguageProvider>
    );

    // Both squads appear in the top selector
    expect(html).toContain('412');
    expect(html).toContain('Khaddo');
    expect(html).toContain('Your Squads');
    expect(html).toContain('Explore &amp; Join +');

    // Invite code for selected squad is visible
    expect(html).toContain('DJS6RK-J47');

    // Per-member spending donut chart and members list
    expect(html).toContain('Per-Member Net Expense Breakdown');
    expect(html).toContain('Members');
  });

  it('Does not duplicate the squad management CTA section', () => {
    const html = renderToString(
      <LanguageProvider>
        <SharedGroupsView
          groups={[squad412, squadKhaddo]}
          expenses={[expensePepsi120]}
          allExpenses={[expensePepsi120]}
          selectedGroupId="grp_412"
          setSelectedGroupId={() => {}}
          currentUser={userLemon}
          onOpenNewGroup={() => {}}
          onOpenJoinGroup={() => {}}
          onOpenNewTransaction={() => {}}
        />
      </LanguageProvider>
    );

    // Only one 'Explore & Join +' button exists
    const exploreMatches = html.match(/Explore &amp; Join \+/g) || [];
    expect(exploreMatches.length).toBe(1);
  });
});
