import React from 'react';
import { AlertCircle, LogOut, ArrowRight, X } from 'lucide-react';

interface ExitGuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExit: () => void;
}

export const ExitGuestModal: React.FC<ExitGuestModalProps> = ({
  isOpen,
  onClose,
  onConfirmExit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#121215] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#71717a] hover:text-[#fafafa] p-1 rounded-lg hover:bg-[#18181b] transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <LogOut className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#fafafa]">Exit Guest Mode</h3>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Your guest data is stored only on this device and will not be saved to an account.
            </p>
          </div>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-[#a1a1aa]">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-snug">
            Exiting will reset your temporary local session and return to the login screen.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-[#a1a1aa] hover:text-white bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] transition-all cursor-pointer"
          >
            Continue as Guest
          </button>
          <button
            type="button"
            onClick={onConfirmExit}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow-md shadow-red-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Exit Guest Mode</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
