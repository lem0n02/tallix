export type ExpenseStatus = 'Settled' | 'Pending' | 'Flagged';
export type PaymentMethod = 'bkash' | 'Cash';
export type SplitType = 'equal' | 'percentage' | 'custom';
export type MemberRole = 'Admin' | 'Member' | 'Guest';

export interface ExpenseSplit {
  userId: string;
  userName?: string;
  amount: number;
  amount_paisa?: number;
  percentage?: number;
  settled: boolean;
}

export interface Expense {
  id: string;
  title: string;
  merchant: string;
  amount: number;
  originalAmount?: number;
  amount_paisa?: number;
  currency: string;
  date: string;
  category: string;
  status: ExpenseStatus;
  paymentMethod: PaymentMethod;
  receiptUrl?: string;
  taxAmount?: number;
  notes?: string;
  isShared: boolean;
  groupId?: string;
  groupName?: string;
  paidByUserId: string;
  paidByName: string;
  createdBy?: string;
  createdByEmail?: string;
  splitType?: SplitType;
  splits?: ExpenseSplit[];
  tags?: string[];
}

export interface GroupMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: MemberRole;
  balance: number; // positive = owed money, negative = owes money
}

export interface Group {
  id: string;
  name: string;
  description: string;
  category: string;
  members: GroupMember[];
  currency: string;
  avatarGradient: string;
  imageUrl?: string;
  totalSpent: number;
  unsettledAmount: number;
  createdAt: string;
  inviteCode: string;
}

export interface Settlement {
  id: string;
  groupId: string;
  groupName: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  originalAmount?: number;
  amount_paisa?: number;
  currency: string;
  paymentMethod?: 'Cash' | 'bKash' | 'Nagad' | 'Bank Transfer' | 'Other' | string;
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Completed' | 'Pending Approval';
  createdAt: string;
  proofUrl?: string;
  note?: string;
}

export type LanguageMode = 'en' | 'bn';

export interface GuestVisit {
  id: string;
  name: string;
  email: string;
  ip: string;
  country: string;
  browser: string;
  os: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  visitTime: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  type?: 'LOGIN' | 'LOGOUT' | 'ACTIVITY' | 'GUEST_VISIT';
  userEmail?: string;
  ip?: string;
  message: string;
  source: string;
  details?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  systemRole: 'Admin' | 'User';
  title: string;
  department: string;
  avatarGradient: string;
  avatarUrl?: string;
  liquidityLimit: number;
  currentLiquidity: number;
  monthlyBurnRate: number;
  aiCopilotEnabled?: boolean;
  isGuest?: boolean;
}

export interface RegisteredUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  systemRole: 'Admin' | 'User';
  roleTitle?: string;
  department?: string;
  avatarGradient?: string;
  avatarUrl?: string;
  createdAt: string;
  status: 'Active' | 'Disabled';
  aiCopilotEnabled?: boolean;
  isVerified?: boolean;
  updatedAt?: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  iconName: string;
  color: string;
  budgetMonthly: number;
  currentSpent: number;
}

export interface FilterState {
  search: string;
  category: string;
  status: string;
  dateRange: string;
  groupId: string;
  paymentMethod: string;
  sortBy: 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
}

export interface AIAnalysisResult {
  summary: string;
  categorySuggestions: string[];
  anomaliesDetected: string[];
  optimizations: string[];
  recommendedAction: string;
}
