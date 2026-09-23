import { UserProfile, Group } from '../types';

export const INITIAL_GUEST_USER: UserProfile = {
  id: 'usr_guest_local',
  name: 'Guest',
  email: 'Guest Mode',
  role: 'Guest',
  title: 'Guest Visitor',
  department: 'Local Device',
  systemRole: 'User',
  avatarGradient: 'from-emerald-600 to-teal-500',
  liquidityLimit: 25000,
  monthlyBurnRate: 0,
  currentLiquidity: 25000,
  monthlyBudget: 25000,
  isGuest: true,
};

export const INITIAL_GUEST_GROUPS: Group[] = [
  {
    id: 'grp_guest_squad',
    name: 'Guest Squad',
    description: 'Temporary local squad for guest exploration',
    category: 'Trip',
    totalSpent: 0,
    unsettledAmount: 0,
    avatarGradient: 'from-emerald-600 to-teal-600',
    createdAt: new Date().toISOString().split('T')[0],
    inviteCode: 'GUEST01',
    members: [
      { id: 'usr_guest_local', name: 'Guest (You)', email: 'Guest Mode', role: 'Admin', balance: 0 },
      { id: 'usr_guest_friend', name: 'Friend', email: 'friend@guest.local', role: 'Member', balance: 0 },
    ],
    currency: 'BDT',
  },
];
