import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Edit3, Users, DollarSign } from 'lucide-react';
import { Expense, Group, PaymentMethod, UserProfile } from '../types';
import { isMemberMatch } from '../utils/balanceEngine';
import { toPaisa, parseExactMoney, splitExactAmount } from '../utils/money';

interface EditExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense | null;
  groups: Group[];
  currentUser?: UserProfile | null;
  onSaveExpense?: (updatedExpense: Expense) => void;
  onSave?: (updatedExpense: Expense) => void;
}

export const EditExpenseModal: React.FC<EditExpenseModalProps> = ({
  isOpen,
  onClose,
  expense,
  groups,
  currentUser,
  onSaveExpense,
  onSave,
}) => {
  const [category, setCategory] = useState(expense?.category || '🍛 Food');
  const [title, setTitle] = useState(expense?.title || expense?.merchant || '');
  const [amount, setAmount] = useState(expense ? expense.amount.toString() : '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(expense?.paymentMethod || 'bkash');
  const [date, setDate] = useState(
    expense?.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [isShared, setIsShared] = useState(!!expense?.isShared);
  const [groupId, setGroupId] = useState(expense?.groupId || groups[0]?.id || '');
  const [paidByUserId, setPaidByUserId] = useState(expense?.paidByUserId || '');
  const [notes, setNotes] = useState(expense?.notes || '');
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

  const targetGroupId = isShared ? (groupId || groups[0]?.id || '') : undefined;
  const selectedGroup = groups.find((g) => g.id === targetGroupId);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setAmount('');
      setError(null);
      return;
    }
    // Only accept valid numeric values: digits and up to 2 decimal places if explicitly entered
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

    try {
      // Preserve exact numeric value entered by user
      const exactAmount = parseExactMoney(trimmedAmount);
      const exactPaisa = toPaisa(trimmedAmount);

      let finalPaidByUserId = expense.paidByUserId;
      let finalPaidByName = expense.paidByName;

      if (isShared && selectedGroup) {
        const foundPayer = selectedGroup.members.find((m) => m.id === paidByUserId);
        if (foundPayer) {
          finalPaidByUserId = foundPayer.id;
          finalPaidByName = foundPayer.name;
        } else if (currentUser) {
          const matchUser = selectedGroup.members.find((m) => isMemberMatch(m, currentUser.id, currentUser.name));
          finalPaidByUserId = matchUser ? matchUser.id : currentUser.id;
          finalPaidByName = matchUser ? matchUser.name : currentUser.name;
        }
      } else if (!isShared) {
        finalPaidByUserId = currentUser?.id || expense.paidByUserId || 'usr_curr_1';
        finalPaidByName = currentUser?.name || expense.paidByName || 'You';
      }

      let calculatedSplits = undefined;
      if (isShared && selectedGroup && selectedGroup.members.length > 0) {
        const count = selectedGroup.members.length;
        const splitShares = splitExactAmount(exactAmount, count);

        calculatedSplits = selectedGroup.members.map((m, idx) => ({
          userId: m.id,
          userName: m.name,
          amount: splitShares[idx],
          amount_paisa: toPaisa(splitShares[idx]),
          settled: isMemberMatch(m, finalPaidByUserId, finalPaidByName),
        }));
      }

      // CRITICAL: Preserve original transaction ID and immutable creation provenance
      const updatedExpense: Expense = {
        ...expense,
        id: expense.id, // KEEP ORIGINAL TRANSACTION ID
        title: title.trim(),
        merchant: title.trim(),
        amount: exactAmount,
        originalAmount: exactAmount,
        amount_paisa: exactPaisa,
        currency: expense.currency || 'BDT',
        date,
        category,
        paymentMethod,
        isShared,
        groupId: isShared ? targetGroupId : undefined,
        groupName: isShared ? selectedGroup?.name : undefined,
        paidByUserId: finalPaidByUserId,
        paidByName: finalPaidByName,
        notes: notes.trim(),
        splitType: isShared ? (expense.splitType || 'equal') : undefined,
        splits: calculatedSplits,
        updatedAt: new Date().toISOString(),
      };

      const saveFn = onSaveExpense || onSave;
      if (saveFn) {
        saveFn(updatedExpense);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save updated transaction. Please check inputs.');
    }
  };

  const parsedCurrentAmount = Number(amount) || 0;
  const memberCount = selectedGroup?.members.length || 0;
  const splitPerPerson = memberCount > 0 && parsedCurrentAmount > 0
    ? (parsedCurrentAmount / memberCount).toFixed(2)
    : '0.00';

  return (
    <div
      id="edit-expense-modal-backdrop"
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="edit-expense-modal-card"
        className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#27272a] flex items-center justify-between bg-[#1c1c1f]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold shrink-0">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#fafafa] uppercase tracking-wider">
                Edit Transaction
              </h3>
              <p className="text-xs text-[#a1a1aa] font-mono truncate max-w-[260px]">
                ID: {expense.id}
              </p>
            </div>
          </div>
          <button
            id="close-edit-expense-btn"
            onClick={onClose}
            className="text-[#71717a] hover:text-[#fafafa] p-1.5 rounded-lg hover:bg-[#27272a] transition-colors cursor-pointer"
            aria-label="Close Edit Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Expense Type Selector: Personal / Shared */}
          <div className="flex bg-[#09090b] p-1 rounded-xl border border-[#27272a]">
            <button
              id="edit-type-personal-btn"
              type="button"
              onClick={() => setIsShared(false)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                !isShared
                  ? 'bg-[#27272a] text-[#fafafa] shadow-sm'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
            >
              Personal Expense
            </button>
            <button
              id="edit-type-shared-btn"
              type="button"
              onClick={() => setIsShared(true)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                isShared
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
            >
              Shared Group Expense
            </button>
          </div>

          {/* Target Squad & Payer (if Shared) */}
          {isShared && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#09090b] p-3 rounded-xl border border-[#27272a]">
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
                  Target Squad / Group
                </label>
                <select
                  id="edit-expense-group-select"
                  value={targetGroupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-[#fafafa] focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.members.length} members)
                    </option>
                  ))}
                </select>
              </div>

              {selectedGroup && (
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
                    Paid By
                  </label>
                  <select
                    id="edit-expense-payer-select"
                    value={paidByUserId}
                    onChange={(e) => setPaidByUserId(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-[#fafafa] focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {selectedGroup.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.id === currentUser?.id ? '(You)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Item Title */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Description / Item Title
            </label>
            <input
              id="edit-expense-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monthly Rent, Food, Utilities"
              className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#fafafa] focus:outline-none focus:border-blue-500 placeholder-[#52525b]"
            />
          </div>

          {/* Amount & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
                Amount (BDT ৳)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-[#71717a] text-xs sm:text-sm">৳</span>
                <input
                  id="edit-expense-amount-input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  required
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="0.00"
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-xl pl-7 pr-3 py-2 text-xs sm:text-sm text-[#fafafa] font-mono focus:outline-none focus:border-blue-500 placeholder-[#52525b]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
                Category
              </label>
              <select
                id="edit-expense-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#fafafa] focus:outline-none focus:border-blue-500 cursor-pointer"
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
          </div>

          {/* Split Breakdown Preview (if Shared) */}
          {isShared && selectedGroup && selectedGroup.members.length > 0 && (
            <div className="bg-[#09090b] border border-purple-500/20 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-bold text-[#71717a]">
                <span className="flex items-center gap-1.5 text-purple-400">
                  <Users className="w-3.5 h-3.5" />
                  Split Information ({selectedGroup.members.length} members)
                </span>
                <span className="font-mono text-purple-300 font-bold">
                  ৳{splitPerPerson} / member
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {selectedGroup.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between text-[11px] px-2.5 py-1 rounded-lg bg-[#18181b] border border-[#27272a] text-[#a1a1aa]"
                  >
                    <span className="truncate">{m.name}</span>
                    <span className="font-mono text-white text-[10px] shrink-0 ml-1">
                      ৳{splitPerPerson}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Method & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
                Payment Method
              </label>
              <select
                id="edit-expense-payment-method-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#fafafa] focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="bkash">bKash</option>
                <option value="Cash">Cash</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
                Transaction Date
              </label>
              <input
                id="edit-expense-date-input"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#fafafa] focus:outline-none focus:border-blue-500 cursor-pointer"
              >
              </input>
            </div>
          </div>

          {/* Notes (Optional) */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Notes (Optional)
            </label>
            <input
              id="edit-expense-notes-input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Split details, receipt info"
              className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#fafafa] focus:outline-none focus:border-blue-500 placeholder-[#52525b]"
            />
          </div>

          {/* Actions Footer */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#27272a]">
            <button
              id="cancel-edit-expense-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#a1a1aa] hover:text-[#fafafa] rounded-xl border border-[#27272a] hover:bg-[#27272a] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="save-edit-expense-btn"
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md transition-all cursor-pointer active:scale-[0.98]"
            >
              Update Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
