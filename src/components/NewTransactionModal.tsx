import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Expense, Group, PaymentMethod, UserProfile } from '../types';
import { isMemberMatch } from '../utils/balanceEngine';
import { useLanguage } from '../i18n/LanguageContext';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  currentUser?: UserProfile;
  defaultGroupId?: string;
  onSaveExpense?: (expenseData: Omit<Expense, 'id'>) => void;
  onSave?: (expenseData: Omit<Expense, 'id'>) => void;
}

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
  isOpen,
  onClose,
  groups,
  currentUser,
  defaultGroupId,
  onSaveExpense,
  onSave,
}) => {
  const { t } = useLanguage();
  const [category, setCategory] = useState('🍛 Food');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bkash');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isShared, setIsShared] = useState(false);
  const [groupId, setGroupId] = useState(defaultGroupId || groups[0]?.id || '');
  const [paidByUserId, setPaidByUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const activeGrpId = defaultGroupId || groupId || groups[0]?.id || '';
      if (defaultGroupId) {
        setGroupId(defaultGroupId);
        setIsShared(true);
      } else if (groups.length > 0 && (!groupId || !groups.some((g) => g.id === groupId))) {
        setGroupId(groups[0].id);
      }

      const selectedGrp = groups.find((g) => g.id === activeGrpId) || groups[0];
      if (selectedGrp && currentUser) {
        const match = selectedGrp.members.find((m) => isMemberMatch(m, currentUser.id, currentUser.name));
        setPaidByUserId(match ? match.id : currentUser.id);
      } else if (currentUser) {
        setPaidByUserId(currentUser.id);
      }
    }
  }, [isOpen, defaultGroupId, groups, groupId, currentUser]);

  if (!isOpen) return null;

  const targetGroupId = isShared ? (groupId || defaultGroupId || groups[0]?.id) : undefined;
  const selectedGroup = groups.find((g) => g.id === targetGroupId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);

    if (!title.trim()) {
      setError('Item title is required.');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    const roundedAmount = Math.round(parsedAmount * 100) / 100;

    // Always automatically detect the currently authenticated (logged-in) user as the payer
    const loggedInUserMember = selectedGroup?.members.find((m) =>
      isMemberMatch(m, currentUser?.id, currentUser?.name)
    );

    const finalPaidByUserId = loggedInUserMember ? loggedInUserMember.id : (currentUser?.id || 'usr_curr_1');
    const finalPaidByName = loggedInUserMember ? loggedInUserMember.name : (currentUser?.name || 'Staff Engineer (You)');

    let calculatedSplits = undefined;
    if (isShared && selectedGroup && selectedGroup.members.length > 0) {
      const count = selectedGroup.members.length;
      const baseShare = Math.floor((roundedAmount / count) * 100) / 100;
      let remainderCents = Math.round((roundedAmount - (baseShare * count)) * 100);

      calculatedSplits = selectedGroup.members.map((m) => {
        let memberShare = baseShare;
        if (remainderCents > 0) {
          memberShare = Math.round((memberShare + 0.01) * 100) / 100;
          remainderCents--;
        }
        return {
          userId: m.id,
          userName: m.name,
          amount: memberShare,
          settled: isMemberMatch(m, finalPaidByUserId, finalPaidByName)
        };
      });
    }

    const newExpense: Omit<Expense, 'id'> = {
      title,
      merchant: title,
      amount: roundedAmount,
      currency: 'BDT',
      date,
      category,
      status: 'Settled',
      paymentMethod,
      taxAmount: 0,
      isShared,
      groupId: isShared ? targetGroupId : undefined,
      groupName: isShared ? selectedGroup?.name : undefined,
      createdBy: currentUser?.id || 'usr_curr_1',
      createdByEmail: currentUser?.email,
      paidByUserId: finalPaidByUserId,
      paidByName: finalPaidByName,
      splitType: isShared ? 'equal' : undefined,
      splits: calculatedSplits,
      tags: [category, isShared ? 'Shared' : 'Personal'],
    };

    const saveFn = onSaveExpense || onSave;
    if (saveFn) {
      saveFn(newExpense);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#27272a] flex items-center justify-between bg-[#1c1c1f]">
          <div>
            <h3 className="text-base font-bold text-[#fafafa] uppercase tracking-wider">
              Log Transaction
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Record new personal or shared expense.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-[#fafafa] p-1.5 rounded-md hover:bg-[#27272a]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Expense Type Selector */}
          <div className="flex bg-[#09090b] p-1 rounded-lg border border-[#27272a]">
            <button
              type="button"
              onClick={() => setIsShared(false)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                !isShared
                  ? 'bg-[#27272a] text-[#fafafa] shadow-sm'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
            >
              Personal Expense
            </button>
            <button
              type="button"
              onClick={() => setIsShared(true)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                isShared
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
            >
              Shared Group Expense
            </button>
          </div>

          {/* Target Squad if shared */}
          {isShared && (
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
                Target Group
              </label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-[#fafafa] focus:outline-none focus:border-blue-500"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.members.length} members)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 1. Category */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-[#fafafa] focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="🍛 Food">🍛 Food</option>
              <option value="🏠 Rent">🏠 Rent</option>
              <option value="🛒 Groceries">🛒 Groceries</option>
              <option value="💡 Utilities">💡 Utilities</option>
              <option value="🌐 Internet">🌐 Internet</option>
              <option value="🚍 Transportation">🚍 Transportation</option>
              <option value="🎓 Education">🎓 Education</option>
              <option value="📱 Mobile & Subscriptions">📱 Mobile & Subscriptions</option>
              <option value="🩺 Health">🩺 Health</option>
              <option value="👕 Personal Care">👕 Personal Care</option>
              <option value="🎉 Entertainment">🎉 Entertainment</option>
              <option value="🛍️ Shopping">🛍️ Shopping</option>
              <option value="👨‍👩‍👧 Family">👨‍👩‍👧 Family</option>
              <option value="💰 Savings">💰 Savings</option>
            </select>
          </div>

          {/* 2. Item Title */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Item Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monthly Rent, Dinner, Groceries"
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-[#fafafa] focus:outline-none focus:border-blue-500 placeholder-[#52525b]"
            />
          </div>

          {/* 3. Amount */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Amount (BDT ৳)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-[#71717a] text-sm">৳</span>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#09090b] border border-[#27272a] rounded-lg pl-7 pr-3 py-2 text-sm text-[#fafafa] font-mono focus:outline-none focus:border-blue-500 placeholder-[#52525b]"
              />
            </div>
          </div>

          {/* 4. Payment Method */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-[#fafafa] focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="bkash">bKash</option>
              <option value="Cash">Cash</option>
            </select>
          </div>

          {/* 5. Date */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Transaction Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-[#fafafa] focus:outline-none focus:border-blue-500 cursor-pointer"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#27272a]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-[#a1a1aa] hover:text-[#fafafa] rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-md shadow-md transition-colors cursor-pointer"
            >
              Save Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
