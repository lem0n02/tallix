import React, { useState, useMemo } from 'react';
import {
  X,
  Building,
  Calendar,
  FileText,
  Tag,
  Trash2,
  Users,
  User,
  Clock,
  Info,
  Edit3,
} from 'lucide-react';
import { Expense, Group, UserProfile } from '../types';

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense | null;
  onEditExpense?: (expense: Expense) => void;
  onEdit?: (expense: Expense) => void;
  currentUser?: UserProfile | null;
  groups?: Group[];
  onUpdateStatus?: (id: string, newStatus: 'Settled' | 'Pending' | 'Flagged') => void;
  onDeleteExpense: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  isOpen,
  onClose,
  expense,
  onEditExpense,
  onEdit,
  currentUser,
  groups = [],
  onDeleteExpense,
  onDelete,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Permission check: inspect ownership and authority rules
  const canEdit = useMemo(() => {
    if (!expense) return false;
    if (!currentUser) return true; // If no currentUser context passed, allow if handler available
    if (currentUser.systemRole === 'Admin') return true;

    // Personal expense: only the creator or payer
    if (!expense.isShared) {
      const cleanUserEmail = (currentUser.email || '').toLowerCase();
      const cleanExpEmail = ((expense as any).createdByEmail || '').toLowerCase();
      return (
        expense.paidByUserId === currentUser.id ||
        expense.createdBy === currentUser.id ||
        (cleanExpEmail !== '' && cleanExpEmail === cleanUserEmail) ||
        (!expense.paidByUserId && !expense.createdBy)
      );
    }

    // Shared squad expense: must be payer, creator, or member of the squad
    if (expense.isShared) {
      if (
        expense.paidByUserId === currentUser.id ||
        expense.createdBy === currentUser.id ||
        (expense.paidByName && expense.paidByName.toLowerCase() === currentUser.name.toLowerCase())
      ) {
        return true;
      }
      if (expense.groupId && groups && groups.length > 0) {
        const group = groups.find((g) => g.id === expense.groupId);
        if (group && Array.isArray(group.members)) {
          return group.members.some(
            (m) =>
              m.id === currentUser.id ||
              (m.email && m.email.toLowerCase() === currentUser.email?.toLowerCase()) ||
              m.name.toLowerCase() === currentUser.name.toLowerCase()
          );
        }
      }
      return true;
    }

    return true;
  }, [expense, currentUser, groups]);

  if (!isOpen || !expense) return null;

  const handleDelete = onDeleteExpense || onDelete || (() => {});
  const handleEdit = onEditExpense || onEdit;

  const handleConfirmDelete = () => {
    handleDelete(expense.id);
    setShowConfirmDelete(false);
    onClose();
  };

  // Format time display
  const getTimeDisplay = () => {
    if (expense.date.includes('T')) {
      const d = new Date(expense.date);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }
    return '10:30 AM';
  };

  const fullTitle = expense.title && expense.title !== expense.merchant
    ? `${expense.merchant} — ${expense.title}`
    : expense.merchant || expense.title || 'Untitled Expense';

  return (
    <div
      id="transaction-details-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="transaction-details-modal-card"
        className="relative w-full max-w-md bg-[#18181b] border border-[#27272a] rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#27272a] pb-3">
          <div className="flex items-center gap-3 pr-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider">Transaction Details</span>
              <h2 className="text-sm sm:text-base font-bold text-[#fafafa] leading-snug truncate max-w-[240px]">{expense.merchant}</h2>
            </div>
          </div>
          <button
            id="close-transaction-details-btn"
            onClick={onClose}
            className="text-[#71717a] hover:text-[#fafafa] p-1.5 rounded-lg hover:bg-[#27272a] transition-colors cursor-pointer shrink-0"
            aria-label="Close Details Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount Card */}
        <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#71717a] uppercase font-bold tracking-widest block">
              Total Amount
            </span>
            <div
              id="transaction-details-amount"
              className="text-2xl sm:text-3xl font-extrabold text-[#fafafa] font-mono tracking-tight"
            >
              ৳{expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase px-3 py-1 rounded-full border ${
              expense.isShared
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
            }`}
          >
            {expense.isShared ? <Users className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            {expense.isShared ? 'Shared' : 'Personal'}
          </span>
        </div>

        {/* Details Grid: Full Title, Category, Type, Date, Time */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="col-span-2 bg-[#09090b] border border-[#27272a] p-3 rounded-xl space-y-1">
            <span className="text-[10px] text-[#71717a] uppercase font-bold flex items-center gap-1">
              <Building className="w-3 h-3 text-blue-400" /> Full Title
            </span>
            <p id="transaction-details-title" className="font-semibold text-[#fafafa] text-xs sm:text-sm break-words">
              {fullTitle}
            </p>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] p-3 rounded-xl space-y-1">
            <span className="text-[10px] text-[#71717a] uppercase font-bold flex items-center gap-1">
              <Tag className="w-3 h-3 text-amber-400" /> Category
            </span>
            <p id="transaction-details-category" className="text-[#fafafa] font-medium truncate">
              {expense.category}
            </p>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] p-3 rounded-xl space-y-1">
            <span className="text-[10px] text-[#71717a] uppercase font-bold flex items-center gap-1">
              {expense.isShared ? <Users className="w-3 h-3 text-purple-400" /> : <User className="w-3 h-3 text-blue-400" />} Type
            </span>
            <p className="text-[#fafafa] font-medium">{expense.isShared ? 'Shared' : 'Personal'}</p>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] p-3 rounded-xl space-y-1">
            <span className="text-[10px] text-[#71717a] uppercase font-bold flex items-center gap-1">
              <Calendar className="w-3 h-3 text-emerald-400" /> Date
            </span>
            <p id="transaction-details-date" className="font-mono text-[#fafafa]">{expense.date}</p>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] p-3 rounded-xl space-y-1">
            <span className="text-[10px] text-[#71717a] uppercase font-bold flex items-center gap-1">
              <Clock className="w-3 h-3 text-teal-400" /> Time
            </span>
            <p className="font-mono text-[#fafafa]">{getTimeDisplay()}</p>
          </div>
        </div>

        {/* Group Info if Shared */}
        {expense.isShared && expense.groupName && (
          <div className="bg-purple-950/20 border border-purple-500/30 p-3 rounded-xl flex items-center justify-between text-xs">
            <span className="font-semibold text-purple-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-400" /> Group: {expense.groupName}
            </span>
            {expense.paidByName && (
              <span className="text-[11px] text-[#a1a1aa]">Paid by: {expense.paidByName}</span>
            )}
          </div>
        )}

        {/* Notes if present */}
        {expense.notes && (
          <div className="bg-[#09090b] border border-[#27272a] p-3 rounded-xl space-y-1">
            <span className="text-[10px] text-[#71717a] uppercase font-bold flex items-center gap-1">
              <FileText className="w-3 h-3 text-indigo-400" /> Notes
            </span>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">{expense.notes}</p>
          </div>
        )}

        {/* Actions Footer: [ Edit ] [ Delete Transaction ] */}
        <div className="flex items-center justify-between pt-3 border-t border-[#27272a]">
          {showConfirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-400 font-semibold">Confirm delete?</span>
              <button
                id="confirm-delete-transaction-btn"
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Delete
              </button>
              <button
                id="cancel-delete-transaction-btn"
                onClick={() => setShowConfirmDelete(false)}
                className="px-2.5 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#a1a1aa] text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {canEdit && handleEdit && (
                <button
                  id="edit-transaction-detail-btn"
                  onClick={() => handleEdit(expense)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-xs font-semibold transition-colors cursor-pointer"
                  title="Edit Transaction"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              )}
              <button
                id="delete-transaction-detail-btn"
                onClick={() => setShowConfirmDelete(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-colors cursor-pointer"
                title="Delete Transaction"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Transaction</span>
              </button>
            </div>
          )}

          <button
            id="close-details-footer-btn"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-xs font-bold text-white transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
