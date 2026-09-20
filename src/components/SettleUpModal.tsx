import React, { useState, useEffect } from 'react';
import { X, Scale, Upload, Check } from 'lucide-react';
import { Group, Settlement, UserProfile } from '../types';

interface SettleUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  currentUser?: UserProfile | null;
  defaultGroupId?: string | null;
  onRecordSettlement?: (settlement: Settlement) => void;
  onSettle?: (settlement: Settlement) => void;
}

export const SettleUpModal: React.FC<SettleUpModalProps> = ({
  isOpen,
  onClose,
  groups,
  currentUser,
  defaultGroupId,
  onRecordSettlement,
  onSettle,
}) => {
  const [groupId, setGroupId] = useState(defaultGroupId || groups[0]?.id || '');
  const [toMemberId, setToMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'bKash' | 'Nagad' | 'Bank Transfer' | 'Other'>('bKash');
  const [note, setNote] = useState('');
  const [proofUrl, setProofUrl] = useState<string | undefined>();

  useEffect(() => {
    if (defaultGroupId) {
      setGroupId(defaultGroupId);
    } else if (groups.length > 0 && !groupId) {
      setGroupId(groups[0].id);
    }
  }, [defaultGroupId, groups, groupId]);

  if (!isOpen) return null;

  const selectedGroup = groups.find((g) => g.id === groupId) || groups[0];
  const currentUserId = currentUser?.id || 'usr_curr_1';
  const currentUserName = currentUser?.name || 'Staff Engineer (You)';

  const otherMembers = selectedGroup?.members.filter((m) => m.id !== currentUserId) || [];
  const targetMember = otherMembers.find((m) => m.id === toMemberId) || otherMembers[0];

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setAmount('');
      return;
    }
    // Only accept valid numeric values: digits and up to 2 decimal places if explicitly entered
    // Reject letters and invalid characters immediately
    const numericRegex = /^(\d+)?(\.\d{0,2})?$/;
    if (numericRegex.test(val)) {
      setAmount(val);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedAmount = amount.trim();
    const parsedAmount = Number(trimmedAmount);
    if (trimmedAmount === '' || isNaN(parsedAmount) || parsedAmount <= 0) return;

    // Preserve exact numeric value entered by user
    const exactAmount = Math.round(parsedAmount * 100) / 100;

    const newSettlement: Settlement = {
      id: `stl_${Date.now()}`,
      groupId: selectedGroup.id,
      groupName: selectedGroup.name,
      fromUserId: currentUserId,
      fromUserName: currentUserName,
      toUserId: targetMember?.id || 'usr_2',
      toUserName: targetMember?.name || 'Sarah Chen',
      amount: exactAmount,
      currency: selectedGroup.currency || 'BDT',
      paymentMethod,
      status: 'Pending',
      createdAt: new Date().toISOString().split('T')[0],
      proofUrl,
      note: note || `${paymentMethod} debt settlement for ${selectedGroup.name}`,
    };

    const settleFn = onRecordSettlement || onSettle;
    if (settleFn) {
      settleFn(newSettlement);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#27272a] flex items-center justify-between bg-[#1c1c1f]">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-[#fafafa] uppercase tracking-wider">
              Execute Debt Settlement
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-[#fafafa] p-1 rounded-md hover:bg-[#27272a]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Select Squad
            </label>
            <select
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value);
                const grp = groups.find((g) => g.id === e.target.value);
                if (grp) {
                  const firstOther = grp.members.find((m) => m.id !== currentUserId);
                  if (firstOther) setToMemberId(firstOther.id);
                }
              }}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-[#fafafa] focus:outline-none focus:border-blue-500"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Recipient Member
            </label>
            <select
              value={toMemberId || targetMember?.id || ''}
              onChange={(e) => setToMemberId(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-[#fafafa] focus:outline-none focus:border-blue-500"
            >
              {otherMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.balance > 0 ? `Is owed ৳${m.balance.toFixed(2)}` : `Owes ৳${Math.abs(m.balance).toFixed(2)}`})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-[#fafafa] focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="bKash">bKash</option>
              <option value="Cash">Cash</option>
              <option value="Nagad">Nagad</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Settlement Amount (BDT ৳)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-[#71717a] text-sm">৳</span>
              <input
                id="settlement-amount-input"
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

          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Wire / Payment Proof (Optional)
            </label>
            <div className="border border-dashed border-[#27272a] bg-[#09090b] rounded-lg p-3 text-center relative hover:border-[#3f3f46] transition-colors cursor-pointer">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={() => setProofUrl('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80')}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {proofUrl ? (
                <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-semibold">
                  <Check className="w-4 h-4" /> Transfer Proof Attached
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-[#71717a] text-xs">
                  <Upload className="w-4 h-4" /> Attach Zelle / bKash / Bank receipt confirmation
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Note / Reference Code
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. bKash TrxID #9012-SETTLE"
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-[#fafafa] focus:outline-none focus:border-blue-500 placeholder-[#52525b]"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#27272a]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-md transition-colors cursor-pointer shadow-md"
            >
              Send Settlement Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
