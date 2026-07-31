import React, { useState } from 'react';
import { X, UserPlus, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';

interface JoinGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinGroup?: (inviteCode: string) => { success: boolean; message: string };
  onJoin?: (inviteCode: string) => { success: boolean; message: string };
}

export const JoinGroupModal: React.FC<JoinGroupModalProps> = ({
  isOpen,
  onClose,
  onJoinGroup,
  onJoin,
}) => {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanCode = inviteCode.trim();
    if (!cleanCode) {
      setError('Please enter a squad invite code.');
      return;
    }

    const joinFn = onJoinGroup || onJoin;
    if (!joinFn) {
      setError('Unable to process request.');
      return;
    }

    const result = joinFn(cleanCode);
    if (result.success) {
      setSuccessMsg(result.message);
      setTimeout(() => {
        setInviteCode('');
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } else {
      setError(result.message);
    }
  };

  const handleClose = () => {
    setInviteCode('');
    setError(null);
    setSuccessMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#27272a] flex items-center justify-between bg-[#1c1c1f]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#fafafa] uppercase tracking-wider">
                Join Expense Squad
              </h3>
              <p className="text-[11px] text-[#a1a1aa]">Enter a squad invite code to join</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-[#71717a] hover:text-[#fafafa] p-1 rounded-md hover:bg-[#27272a] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-400" /> Squad Invite Code
            </label>
            <input
              type="text"
              required
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="e.g. TLX-INFRA-889"
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3.5 py-2.5 text-sm text-[#fafafa] font-mono tracking-wider focus:outline-none focus:border-emerald-500 placeholder-[#52525b] uppercase"
            />
            <p className="text-[10px] text-[#71717a] mt-1.5">
              Ask squad members or admin for their 10-character code.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-xs text-rose-400 font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-xs text-emerald-400 font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#27272a]">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Join Squad</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
