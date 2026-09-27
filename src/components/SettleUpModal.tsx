import React, { useState, useEffect } from 'react';
import { X, Scale, Upload, Check, ArrowUpRight, ArrowDownRight, Edit3 } from 'lucide-react';
import { Group, Settlement, UserProfile } from '../types';
import { parseExactMoney, toPaisa } from '../utils/money';

export type SettleDirection = 'UP' | 'DOWN';

interface SettleUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  currentUser?: UserProfile | null;
  defaultGroupId?: string | null;
  initialDirection?: SettleDirection;
  settlementToEdit?: Settlement | null;
  onRecordSettlement?: (settlement: Settlement) => void;
  onSettle?: (settlement: Settlement) => void;
}

export const SettleUpModal: React.FC<SettleUpModalProps> = ({
  isOpen,
  onClose,
  groups,
  currentUser,
  defaultGroupId,
  initialDirection = 'UP',
  settlementToEdit,
  onRecordSettlement,
  onSettle,
}) => {
  const [groupId, setGroupId] = useState(defaultGroupId || groups[0]?.id || '');
  const [direction, setDirection] = useState<SettleDirection>(initialDirection);
  const [toMemberId, setToMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'bKash' | 'Nagad' | 'Bank Transfer' | 'Other'>('bKash');
  const [note, setNote] = useState('');
  const [proofUrl, setProofUrl] = useState<string | undefined>();

  const currentUserId = currentUser?.id || 'usr_curr_1';
  const currentUserName = currentUser?.name || 'Staff Engineer (You)';

  useEffect(() => {
    if (settlementToEdit) {
      setGroupId(settlementToEdit.groupId);
      setAmount(String(settlementToEdit.originalAmount ?? settlementToEdit.amount));
      setPaymentMethod((settlementToEdit.paymentMethod as any) || 'bKash');
      setNote(settlementToEdit.note || '');
      setProofUrl(settlementToEdit.proofUrl);
      const isDown = settlementToEdit.settlementType === 'SETTLE_DOWN' || settlementToEdit.toUserId === currentUserId;
      setDirection(isDown ? 'DOWN' : 'UP');
      const counterpartyId = isDown ? settlementToEdit.fromUserId : settlementToEdit.toUserId;
      setToMemberId(counterpartyId);
    } else {
      if (defaultGroupId) {
        setGroupId(defaultGroupId);
      } else if (groups.length > 0 && !groupId) {
        setGroupId(groups[0].id);
      }
      setDirection(initialDirection || 'UP');
      setAmount('');
      setNote('');
      setProofUrl(undefined);
    }
  }, [settlementToEdit, defaultGroupId, groups, initialDirection, currentUserId]);

  if (!isOpen) return null;

  const selectedGroup = groups.find((g) => g.id === groupId) || groups[0];
  const otherMembers = selectedGroup?.members.filter((m) => m.id !== currentUserId) || [];
  const targetMember = otherMembers.find((m) => m.id === toMemberId) || otherMembers[0];

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setAmount('');
      return;
    }
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

    const exactAmount = parseExactMoney(trimmedAmount);
    const exactPaisa = toPaisa(trimmedAmount);

    const isUp = direction === 'UP';
    const fromId = isUp ? currentUserId : (targetMember?.id || 'usr_2');
    const fromName = isUp ? currentUserName : (targetMember?.name || 'Member');
    const toId = isUp ? (targetMember?.id || 'usr_2') : currentUserId;
    const toName = isUp ? (targetMember?.name || 'Member') : currentUserName;

    const newSettlement: Settlement = {
      id: settlementToEdit?.id || `stl_${Date.now()}`,
      groupId: selectedGroup?.id || '',
      groupName: selectedGroup?.name || 'Shared Squad',
      settlementType: isUp ? 'SETTLE_UP' : 'SETTLE_DOWN',
      requestedByUserId: settlementToEdit?.requestedByUserId || currentUserId,
      createdBy: settlementToEdit?.createdBy || currentUserId,
      fromUserId: fromId,
      fromUserName: fromName,
      toUserId: toId,
      toUserName: toName,
      amount: exactAmount,
      originalAmount: exactAmount,
      amount_paisa: exactPaisa,
      currency: selectedGroup?.currency || 'BDT',
      paymentMethod,
      status: 'Pending',
      createdAt: settlementToEdit?.createdAt || new Date().toISOString(),
      proofUrl,
      note: note || `${paymentMethod} Settle ${isUp ? 'Up' : 'Down'} for ${selectedGroup?.name || 'Squad'}`,
    };

    const settleFn = onRecordSettlement || onSettle;
    if (settleFn) {
      settleFn(newSettlement);
    }
    onClose();
  };

  const isUp = direction === 'UP';
  const isEditing = Boolean(settlementToEdit);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#27272a] flex items-center justify-between bg-[#1c1c1f]">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg border ${isUp ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
              {isEditing ? <Edit3 className="w-5 h-5" /> : isUp ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#fafafa] uppercase tracking-wider flex items-center gap-2">
                {isEditing ? 'Edit Pending Settlement' : isUp ? 'Settle Up' : 'Settle Down'}
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${isUp ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'}`}>
                  {isUp ? '+ Balance (Owed To Me)' : '- Balance (I Owe)'}
                </span>
              </h3>
              <p className="text-[11px] text-[#71717a]">
                {isUp
                  ? 'Increases "Amount Owed To Me" upon acceptance'
                  : 'Increases "Amount I Owe" upon acceptance'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-[#fafafa] p-1.5 rounded-md hover:bg-[#27272a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Direction Switcher Tab */}
        <div className="p-4 bg-[#141416] border-b border-[#27272a]">
          <div className="grid grid-cols-2 gap-2 bg-[#09090b] p-1 rounded-xl border border-[#27272a]">
            <button
              type="button"
              onClick={() => setDirection('UP')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isUp
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#18181b]'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Settle Up (Owed To Me ↗)</span>
            </button>
            <button
              type="button"
              onClick={() => setDirection('DOWN')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                !isUp
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#18181b]'
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>Settle Down (I Owe ↘)</span>
            </button>
          </div>
          <div className="mt-2 text-[11px] text-[#a1a1aa] bg-[#18181b] p-2.5 rounded-lg border border-[#27272a]/60">
            {isUp ? (
              <span>
                <strong>Settle Up:</strong> You are claiming or recording a settlement that shifts your squad balance <strong>UP</strong> into positive. After counterparty accepts, it reflects under <strong className="text-emerald-400">Amount Owed To Me</strong>.
              </span>
            ) : (
              <span>
                <strong>Settle Down:</strong> You are recording a settlement that shifts your squad balance <strong>DOWN</strong> into negative. After counterparty accepts, it reflects under <strong className="text-rose-400">Amount I Owe</strong>.
              </span>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
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
              {isUp ? 'Counterparty Member (Who owes you / payer)' : 'Counterparty Member (Who you owe / payee)'}
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
              className={`px-5 py-2 text-xs font-bold text-white rounded-md transition-colors cursor-pointer shadow-md ${
                isUp
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
              }`}
            >
              {isEditing ? 'Update Pending Settlement' : isUp ? 'Submit Settle Up Request' : 'Submit Settle Down Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
