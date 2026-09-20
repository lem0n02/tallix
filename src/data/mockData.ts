import mockData from './mockData.json';
import { Expense, Group, Settlement, UserProfile, AuditLog, RegisteredUser, CategoryItem, GuestVisit } from '../types';

export const INITIAL_USER = mockData.INITIAL_USER as UserProfile;
export const INITIAL_REGISTERED_USERS = mockData.INITIAL_REGISTERED_USERS as RegisteredUser[];
export const INITIAL_GROUPS = mockData.INITIAL_GROUPS as Group[];
export const INITIAL_EXPENSES = mockData.INITIAL_EXPENSES as Expense[];
export const INITIAL_SETTLEMENTS = mockData.INITIAL_SETTLEMENTS as Settlement[];
export const CATEGORIES = mockData.CATEGORIES as CategoryItem[];
export const INITIAL_AUDIT_LOGS = mockData.INITIAL_AUDIT_LOGS as AuditLog[];
export const INITIAL_GUEST_VISITS = (mockData.INITIAL_GUEST_VISITS || []) as GuestVisit[];
