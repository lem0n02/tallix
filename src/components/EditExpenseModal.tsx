import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Expense, Group, PaymentMethod } from '../types';
import { isMemberMatch } from '../utils/balanceEngine';

interface EditExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense | null;
  groups: Group[];
  onSaveExpense: (updatedExpense: Expense) => void;
}

export const EditExpenseModal: React.FC<EditExpenseModalProps> = ({
  isOpen,
  onClose,
  expense,
  groups,
  onSaveExpense,
}) => {
  const [category, setCategory] = useState('🍛 Food');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bkash');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isShared, setIsShared] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [paidByUserId, setPaidByUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (expense) {
      setTitle(expense.title || expense.merchant || '');
      setAmount(expense.amount.toString());
      setCategory(expense.category || '🍛 Food');
      setPaymentMethod(expense.paymentMethod || 'bkash');
      setDate(expense.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0]);
      setIsShared(!!expense.isShared);
      setGroupId(expense.groupId || groups[0]?.id || '');
      setPaidByUserId(expense.paidByUserId || '');
      setNotes(expense.notes || '');
      setError(null);
    }
  }, [expense, groups]);

  if (!isOpen || !expense) return null;

  const selectedGroup = groups.find((g) => g.id === groupId);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setAmount('');
      setError(null);
      return;
    }
    // Only accept valid numeric values: digits and up to 2 decimal places if explicitly entered
    // Reject letters and invalid characters immediately
    const numericRegex = /^(\d+)?(\.\d{0,2})?$/;
    if (numericRegex.test(val)) {
      setAmount(val);
      setError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedAmount = amount.trim();
    const parsedAmount = Number(trimmedAmount);

    if (!title.trim()) {
      setError('Item title is required.');
      return;
    }
    if (trimmedAmount === '' || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    // Preserve exact numeric value entered by user
    const exactAmount = Math.round(parsedAmount * 100) / 100;

    const selectedPayer = selectedGroup?.members.find((m) => m.id === paidByUserId)
      || { id: expense.paidByUserId, name: expense.paidByName };

    const finalPaidByUserId = selectedPayer.id;
    const finalPaidByName = selectedPayer.name;

    let calculatedSplits = undefined;
    if (isShared && selectedGroup && selectedGroup.members.length > 0) {
      const count = selectedGroup.members.length;
      const baseShare = Math.floor((exactAmount / count) * 100) / 100;
      let remainderCents = Math.round((exactAmount - (baseShare * count)) * 100);

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
          settled: isMemberMatch(m, finalPaidByUserId, finalPaidByName),
        };
      });
    }

    const updatedExpense: Expense = {
      ...expense,
      title,
      merchant: title,
      amount: exactAmount,
      date,
      category,
      paymentMethod,
      isShared,
      groupId: isShared ? groupId : undefined,
      groupName: isShared ? selectedGroup?.name : undefined,
      paidByUserId: finalPaidByUserId,
      paidByName: finalPaidByName,
      notes,
      splitType: isShared ? (expense.splitType || 'equal') : undefined,
      splits: calculatedSplits,
    };

    onSaveExpense(updatedExpense);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#27272a] flex items-center justify-between bg-[#1c1c1f]">
          <div>
            <h3 className="text-base font-bold text-[#fafafa] uppercase tracking-wider">
              Edit Transaction
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Update details for "{expense.title}"
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
                id="edit-expense-amount-input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                required
                value={amount}
                onChange={handleAmountChange}
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

          {/* 6. Notes */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Split details, receipt note"
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-[#fafafa] focus:outline-none focus:border-blue-500 placeholder-[#52525b]"
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
              Update Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
